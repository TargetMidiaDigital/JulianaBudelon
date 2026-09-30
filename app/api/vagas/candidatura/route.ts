import { NextResponse, after } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { normalizarWhatsapp } from "@/lib/format";
import { parseAnexos, parseComentarios, unidadeDe, vagaDe, type UnidadeRow, type VagaRow } from "@/lib/data";
import { slugify, unidadeLabel, vagaLabel } from "@/lib/localdb";
import { analisarTalento, ferramentaLigada } from "@/lib/analise-curriculo";
import { notificarCurriculo, origemDeRequest, textoNovoCandidato } from "@/lib/whatsapp";

/**
 * ROTA PÚBLICA (sem sessão, por design) — o candidato se inscreve pela página /vagas.
 * Cria o talento (status "novo", origem "linkbio") com o currículo no bucket privado
 * `task-anexos` (servido só à equipe pelo /api/anexo).
 *
 * Deduplica por WhatsApp (mesmo desenho do Cachorrão HD): se o número já está no Banco de
 * Talentos (ou, com número fictício tipo 99999-9999, se número E nome batem), ATUALIZA o
 * cadastro dessa pessoa (nome, vaga, unidade, turno, novo currículo,
 * sobe para o topo) em vez de criar uma segunda linha, e registra a recandidatura no
 * histórico (comentários). O status do funil não é rebaixado — só quem estava arquivado em
 * "Antigos"/"Desqualificado" volta para "Novo", senão a volta passaria despercebida.
 *
 * Defesas (é o que substitui o Bearer):
 *  - No máximo 5 envios em 24h por pessoa; e, com número fictício (99999-9999…), no máximo
 *    5 envios em 24h somando TODAS as pessoas que usarem aquele número → 429.
 *  - Revalidação no servidor: vaga/unidade inexistente ou pausada → 409; arquivo fora
 *    do tipo/tamanho → 400. Nunca lê nem lista candidatos para o visitante.
 *
 *  POST multipart { nome, whatsapp, vagaId, file } → { ok }
 *
 * Depois de gravar, dispara a análise do currículo por IA em segundo plano (`after`): o
 * candidato já aparece no Banco de Talentos e, segundos depois, recebe resumo + classificação
 * (o realtime_ping avisa o painel), e avisa os grupos de WhatsApp cadastrados. Interruptores:
 * Recrutamento → Agente IA → Ferramentas. Sem token do OpenRouter, fica "Aguardando Análise";
 * sem Uazapi/grupos, nenhum aviso sai.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "task-anexos";
const MAX_BYTES = 3 * 1024 * 1024;
const EXT_OK = new Set(["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"]);
const LIMITE_ENVIOS_24H = 5;
/** Teto de envios em 24h com número fictício (ex.: (48) 99999-9999), somando todas as pessoas. */
const LIMITE_FICTICIO_24H = 5;

/** Nome sem acento/caixa/símbolos, para comparar "RAIMUNDAFERREIRA…" com "Raimunda Ferreira…". */
function normNome(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
}
/** Mesmo nome (com ou sem espaços) ou mesmo primeiro + último nome. */
function mesmaPessoa(a: string, b: string): boolean {
  const x = normNome(a), y = normNome(b);
  if (!x || !y) return false;
  if (x === y || x.replace(/ /g, "") === y.replace(/ /g, "")) return true;
  const ax = x.split(" "), by = y.split(" ");
  return ax.length > 1 && by.length > 1 && ax[0] === by[0] && ax[ax.length - 1] === by[by.length - 1];
}
/**
 * Número "coringa": depois do DDD, todos os dígitos iguais (99999-9999, 00000-0000) ou a
 * sequência 12345-6789. Quem lança currículo de terceiros usa isso, então várias PESSOAS
 * DIFERENTES compartilham o mesmo telefone — ele não identifica ninguém.
 */
function numeroFicticio(fone: string): boolean {
  const d = fone.replace(/\D/g, "").replace(/^55/, "").slice(2);
  return /^(\d)\1+$/.test(d) || d === "123456789" || d === "12345678";
}

function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot >= 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "curriculo";
  const ext = (dot >= 0 ? name.slice(dot + 1) : "").replace(/[^a-zA-Z0-9]+/g, "").slice(0, 8).toLowerCase();
  return ext ? `${base}.${ext}` : base;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const nome = String(form?.get("nome") ?? "").trim();
  const whatsapp = String(form?.get("whatsapp") ?? "").trim();
  const vagaId = String(form?.get("vagaId") ?? "").trim();
  const file = form?.get("file");

  if (nome.length < 3) return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
  const digitos = whatsapp.replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 11) return NextResponse.json({ error: "Informe o WhatsApp com DDD." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Anexe seu currículo." }, { status: 400 });
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!EXT_OK.has(ext)) return NextResponse.json({ error: "Use PDF, DOC, DOCX, JPG, PNG ou WEBP." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo acima de 3 MB." }, { status: 413 });

  // Vaga e unidade revalidadas no servidor: pausadas entre abrir a página e enviar → 409.
  const { data: vr } = await sb.from("vaga").select("*").eq("id", vagaId).maybeSingle();
  if (!vr) return NextResponse.json({ error: "Vaga não encontrada." }, { status: 409 });
  const vaga = vagaDe(vr as VagaRow);
  if (!vaga.ativa) return NextResponse.json({ error: "Esta vaga não está mais aberta." }, { status: 409 });
  const { data: ur } = await sb.from("unidade").select("*").eq("id", vaga.unidadeId).maybeSingle();
  if (!ur) return NextResponse.json({ error: "Unidade não encontrada." }, { status: 409 });
  const unidade = unidadeDe(ur as UnidadeRow);
  if (!unidade.ativa) return NextResponse.json({ error: "Esta unidade não está recebendo candidaturas." }, { status: 409 });

  const fone = normalizarWhatsapp(whatsapp);
  const agora = new Date().toISOString();

  // Já está no Banco de Talentos? → recandidatura: atualiza a linha da pessoa.
  //  - WhatsApp de verdade: o número identifica a pessoa (mesmo com o nome digitado diferente).
  //  - Número fictício (99999-9999…): só é a mesma pessoa se o NOME bater — senão cada
  //    currículo lançado com o telefone coringa apagaria o anterior.
  const ficticio = numeroFicticio(fone);
  const { data: ex } = await sb.from("talento").select("*").eq("fone", fone).order("criada", { ascending: true }).limit(200);
  const mesmos = (ex ?? []) as Record<string, unknown>[];
  const existente = (ficticio ? mesmos.find((r) => mesmaPessoa(String(r.nome ?? ""), nome)) : mesmos[0]) ?? null;
  const anexosAntes = existente ? parseAnexos(existente.anexos) : [];
  const comentariosAntes = existente ? parseComentarios(existente.ultimos_comentarios) : [];

  // Anti-abuso (protege o Storage): conta os currículos recebidos nas últimas 24h —
  // da própria pessoa (número real) ou de todo mundo que usou o número coringa.
  const desde = Date.now() - 24 * 3600_000;
  const recentes = (linhas: Record<string, unknown>[]) => linhas.flatMap((r) => parseAnexos(r.anexos)).filter((a) => a.criadoEm && new Date(a.criadoEm).getTime() >= desde).length;
  const estourou = ficticio ? recentes(mesmos) >= LIMITE_FICTICIO_24H : recentes(existente ? [existente] : []) >= LIMITE_ENVIOS_24H;
  if (estourou) return NextResponse.json({ error: "Você já enviou candidaturas recentemente. Tente novamente amanhã." }, { status: 429 });

  const id = existente ? String(existente.id) : `tal-${slugify(nome).slice(0, 40)}-${Date.now().toString(36)}`;
  const path = `talentos/${id}/${Date.now()}-${safeName(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (up.error) return NextResponse.json({ error: "Não conseguimos guardar o currículo. Tente de novo." }, { status: 500 });
  const anexoNovo = { id: `a-${Date.now()}`, nome: file.name, url: `/api/anexo/${path}`, mime: file.type || undefined, tamanho: file.size, criadoEm: agora };

  if (existente) {
    // O que mudou em relação ao cadastro anterior — vai para o histórico (comentários).
    const mudancas: string[] = [];
    const nomeAntes = String(existente.nome ?? "");
    const vagaAntes = String(existente.vaga ?? "");
    if (nomeAntes && nomeAntes !== nome) mudancas.push(`nome: "${nomeAntes}" → "${nome}"`);
    if (vagaAntes !== vaga.titulo) mudancas.push(`vaga: ${vagaAntes || "—"} → ${vaga.titulo}`);
    if (String(existente.unidade_id ?? "") !== unidade.id) mudancas.push(`unidade → ${unidadeLabel(unidade)}`);
    if (String(existente.turno ?? "") !== String(vaga.turno || "")) mudancas.push(`turno → ${vaga.turno || "sem turno"}`);
    // Não rebaixa o funil: quem está em "Reunião agendada" continua lá. Só o arquivo volta para "Novo".
    const statusAntes = String(existente.status ?? "novo");
    const volta = statusAntes === "antigos" || statusAntes === "desqualificado";
    if (volta) mudancas.push(`status: ${statusAntes} → novo`);
    const log = {
      id: `c-${Date.now()}`, author: "sistema", created_at: agora, tipo: "log" as const,
      message: `Recandidatura pela página de vagas — ${vagaLabel(vaga)} · ${unidadeLabel(unidade)}. Novo currículo anexado (${file.name}).${mudancas.length ? ` Dados atualizados: ${mudancas.join("; ")}.` : " Dados sem alteração."}`,
    };
    const { error } = await sb.from("talento").update({
      nome, vaga: vaga.titulo, vaga_id: vaga.id, unidade_id: unidade.id, turno: vaga.turno || null,
      status: volta ? "novo" : statusAntes,
      // Recadastro conta como candidatura nova: sobe para o topo e volta a aguardar a análise do novo currículo.
      criada: agora, qualidade: "Aguardando Análise", analise_erro: null,
      ultimos_comentarios: [...comentariosAntes, log],
      anexos: [...anexosAntes, anexoNovo],
    }).eq("id", id);
    if (error) return NextResponse.json({ error: "Não conseguimos registrar a candidatura. Tente de novo." }, { status: 500 });
  } else {
    const row = {
      id, nome, status: "novo", vaga: vaga.titulo, vaga_id: vaga.id, unidade_id: unidade.id, turno: vaga.turno || null,
      fone, qualidade: "Aguardando Análise", origem: "linkbio", criada: agora,
      ultimos_comentarios: [{ id: `c-${Date.now()}`, message: `Candidatura enviada pela página de vagas — ${vagaLabel(vaga)} · ${unidadeLabel(unidade)}.`, author: "sistema", created_at: agora, tipo: "log" }],
      anexos: [anexoNovo],
    };
    const { error } = await sb.from("talento").insert(row);
    if (error) return NextResponse.json({ error: "Não conseguimos registrar a candidatura. Tente de novo." }, { status: 500 });
  }
  const novo = !existente;
  after(async () => {
    // Aviso nos grupos de WhatsApp escolhidos em Agente IA → Ferramentas. Best-effort: nunca lança.
    try {
      if (await ferramentaLigada(sb, "notificar_curriculo")) {
        await notificarCurriculo(sb, textoNovoCandidato({ id, nome, fone, vaga: vaga.titulo, unidade: unidadeLabel(unidade), turno: vaga.turno || null, temCurriculo: true, novo }, origemDeRequest(req)));
      }
    } catch (e) { console.error("[candidatura] aviso no grupo falhou:", e instanceof Error ? e.message : e); }
    try {
      if (!(await ferramentaLigada(sb, "analisar_curriculo"))) return;
      // `analisarTalento` não lança: devolve o motivo (sem token, formato…). Sem este log,
      // um currículo sem análise simplesmente não apareceria analisado e ninguém saberia por quê.
      const r = await analisarTalento(sb, id);
      if (!r.ok) console.warn(`[candidatura] sem análise para ${id}: ${r.erro}`);
    } catch (e) { console.error("[candidatura] análise falhou:", e instanceof Error ? e.message : e); }
  });
  return NextResponse.json({ ok: true });
}
