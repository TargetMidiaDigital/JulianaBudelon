import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import mammoth from "mammoth";
import { talentoDe, vagaDe, unidadeDe, type TalentoRow, type VagaRow, type UnidadeRow } from "./data";
import { unidadeLabel } from "./localdb";
import type { AnaliseIA, Anexo, Comentario, Talento } from "./types";

/**
 * Análise do currículo por IA (servidor). Lê o currículo anexado ao candidato no Storage,
 * junta com a descrição/requisitos da vaga e pede à Claude API:
 *   1) um resumo do currículo (experiência, formação, pontos fortes, alertas);
 *   2) a classificação candidato × vaga (nota 0–100 + Ótimo/Bom/Ruim + justificativa + lacunas).
 * Grava em `talento` (resumo, analise, nota_ia, qualidade_ia, analisado_em) e preenche a
 * "Qualidade" só se ela ainda estiver em "Aguardando Análise" — a decisão humana prevalece.
 *
 * Disparo: automático ao receber a candidatura pela página pública (/api/vagas/candidatura),
 * e manual pelo botão "Analisar com IA" (/api/talentos/analisar).
 *
 * Variáveis: ANTHROPIC_API_KEY (obrigatória) e ANTHROPIC_MODEL (opcional; padrão claude-opus-5).
 */

const BUCKET = "task-anexos";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
const MAX_BYTES = 20 * 1024 * 1024; // limite da API é 32 MB por requisição (base64 infla ~33%)

export const temIA = () => !!process.env.ANTHROPIC_API_KEY;

const Schema = z.object({
  resumo: z.string().describe("3 a 5 frases, em português, resumindo quem é o candidato: área, tempo de experiência, último cargo, perfil."),
  experiencia: z.array(z.string()).describe("Experiências relevantes, da mais recente para a mais antiga: 'Cargo · Empresa · período'. Vazio se o currículo não trouxer."),
  formacao: z.array(z.string()).describe("Formação e cursos relevantes."),
  pontosFortes: z.array(z.string()).describe("Até 5 pontos fortes para ESTA vaga, concretos."),
  alertas: z.array(z.string()).describe("Pontos de atenção: períodos sem trabalho, trocas frequentes, distância da unidade, informações faltando, currículo ilegível…"),
  nota: z.number().int().min(0).max(100).describe("Aderência do candidato à vaga, de 0 a 100."),
  classificacao: z.enum(["Ótimo", "Bom", "Ruim"]).describe("Ótimo = 75 a 100; Bom = 50 a 74; Ruim = 0 a 49."),
  justificativa: z.string().describe("2 a 4 frases explicando a nota, citando requisitos atendidos e não atendidos."),
  lacunas: z.array(z.string()).describe("Requisitos da vaga não atendidos ou não comprovados no currículo."),
});

const SYSTEM = `Você é a assistente de recrutamento da Ju Budelon, uma rede de cafeteria e confeitaria artesanal da Grande Florianópolis (SC), com unidades e cozinha de produção própria. Você faz a triagem inicial de currículos para vagas operacionais e administrativas (cozinha/confeitaria, atendimento de cafeteria, limpeza, expedição, administrativo/financeiro, RH, marketing, liderança de produção e supervisão de loja).

Sua tarefa: ler o currículo do candidato e compará-lo com a vaga informada.

Regras:
- Escreva sempre em português do Brasil, direto e sem floreios. É para a equipe de RH ler em 30 segundos.
- Baseie-se SOMENTE no que está no currículo. Não invente experiência, formação ou dados. Se algo não estiver no currículo, trate como "não informado" e liste em lacunas quando for requisito.
- Para vagas operacionais (cozinha, atendimento, limpeza, expedição), valorize experiência prática na função ou em função parecida (restaurante, padaria, lanchonete, supermercado, hotelaria), disponibilidade de horário e estabilidade nos empregos. Formação superior não é requisito nessas vagas e não deve puxar a nota para cima nem para baixo.
- Para vagas administrativas e de análise, valorize experiência na área, ferramentas citadas e formação compatível.
- Nota: 0 a 100. Ótimo = 75 a 100 (atende os requisitos obrigatórios e tem experiência direta), Bom = 50 a 74 (atende parcialmente ou tem experiência correlata), Ruim = 0 a 49 (não atende os requisitos ou não há como avaliar).
- Se o arquivo não for um currículo, estiver ilegível ou vazio, dê nota baixa, classificação Ruim e explique isso em alertas e justificativa.
- Um candidato que se inscreveu para uma vaga mas tem perfil claro para OUTRA vaga da rede: diga isso na justificativa (ex.: "perfil forte para Atendente de Cafeteria").`;

type VagaCtx = { titulo: string; turno?: string; descricao?: string; requisitos?: string; diferenciais?: string; unidade?: string };

function textoVaga(v: VagaCtx | null, tituloLivre?: string): string {
  if (!v) return tituloLivre ? `Vaga: ${tituloLivre}\n(Sem descrição cadastrada — avalie pela experiência típica desse cargo em cafeteria/confeitaria.)` : "Vaga: não informada — avalie o currículo de forma geral para uma rede de cafeteria/confeitaria.";
  const linhas = [`Vaga: ${v.titulo}${v.turno ? ` — turno ${v.turno}` : ""}`];
  if (v.unidade) linhas.push(`Unidade: ${v.unidade}`);
  linhas.push(`Descrição: ${v.descricao?.trim() || "(sem descrição cadastrada — use a experiência típica desse cargo)"}`);
  linhas.push(`Requisitos obrigatórios:\n${v.requisitos?.trim() || "(não cadastrados)"}`);
  linhas.push(`Diferenciais:\n${v.diferenciais?.trim() || "(não cadastrados)"}`);
  return linhas.join("\n");
}

/** Escolhe o anexo que mais parece ser o currículo: PDF > DOCX > imagem, o mais recente. */
export function escolherCurriculo(anexos: Anexo[]): Anexo | null {
  const ext = (a: Anexo) => (a.nome.split(".").pop() ?? "").toLowerCase();
  const peso = (a: Anexo) => {
    const e = ext(a); const m = (a.mime ?? "").toLowerCase();
    if (e === "pdf" || m === "application/pdf") return 3;
    if (e === "docx") return 2;
    if (["jpg", "jpeg", "png", "webp"].includes(e) || /^image\/(jpeg|png|webp)$/.test(m)) return 1;
    return 0;
  };
  const ok = anexos.filter((a) => peso(a) > 0 && a.url.startsWith("/api/anexo/"));
  if (!ok.length) return null;
  return ok.sort((a, b) => peso(b) - peso(a) || String(b.criadoEm ?? "").localeCompare(String(a.criadoEm ?? "")))[0];
}

type Conteudo = Anthropic.Beta.BetaContentBlockParam;

/** Baixa o anexo do Storage e monta o bloco de conteúdo para a API (PDF/imagem nativos; DOCX vira texto). */
async function carregarCurriculo(sb: SupabaseClient, anexo: Anexo): Promise<Conteudo> {
  const path = decodeURIComponent(anexo.url.replace(/^\/api\/anexo\//, ""));
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error("Não foi possível baixar o currículo do Storage.");
  const buf = Buffer.from(await data.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("Currículo acima de 20 MB — anexe uma versão menor.");
  const ext = (anexo.nome.split(".").pop() ?? "").toLowerCase();
  const mime = (anexo.mime || data.type || "").toLowerCase();
  if (ext === "pdf" || mime === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") }, title: anexo.nome };
  }
  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    const texto = value.trim();
    if (!texto) throw new Error("O DOCX não tem texto legível.");
    return { type: "document", source: { type: "text", media_type: "text/plain", data: texto.slice(0, 200_000) }, title: anexo.nome };
  }
  const img = ext === "png" || mime === "image/png" ? "image/png" : ext === "webp" || mime === "image/webp" ? "image/webp" : "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: img, data: buf.toString("base64") } };
}

export type ResultadoAnalise = { ok: true; talento: Talento } | { ok: false; erro: string; talento?: Talento };

/**
 * Roda a análise de um candidato e grava o resultado. Nunca lança: erros viram
 * `analise_erro` no banco (e aparecem no detalhe do candidato).
 */
export async function analisarTalento(sb: SupabaseClient, id: string, autor = "sistema"): Promise<ResultadoAnalise> {
  const { data: tr } = await sb.from("talento").select("*").eq("id", id).maybeSingle();
  if (!tr) return { ok: false, erro: "Candidato não encontrado." };
  const talento = talentoDe(tr as TalentoRow);

  const falhar = async (erro: string): Promise<ResultadoAnalise> => {
    await sb.from("talento").update({ analise_erro: erro }).eq("id", id);
    return { ok: false, erro, talento: { ...talento, analiseErro: erro } };
  };

  if (!temIA()) return falhar("Análise por IA não configurada no servidor (ANTHROPIC_API_KEY).");
  let anexo = escolherCurriculo(talento.anexos ?? []);
  if (!anexo) {
    // O painel salva o anexo de forma otimista e dispara a análise em seguida: dá uma
    // segunda chance ao PATCH dos anexos chegar antes de desistir.
    await new Promise((r) => setTimeout(r, 1500));
    const { data: tr2 } = await sb.from("talento").select("anexos").eq("id", id).maybeSingle();
    anexo = escolherCurriculo(talentoDe({ ...(tr as TalentoRow), anexos: (tr2 as { anexos?: unknown } | null)?.anexos }).anexos ?? []);
    if (!anexo) return falhar("Nenhum currículo em PDF, DOCX ou imagem anexado ao candidato.");
  }

  // Vaga: pelo vínculo (vaga_id) ou, sem vínculo, pelo título + unidade.
  let vagaCtx: VagaCtx | null = null;
  let vagaId: string | undefined;
  let vr: VagaRow | null = null;
  if (talento.vagaId) vr = ((await sb.from("vaga").select("*").eq("id", talento.vagaId).maybeSingle()).data as VagaRow | null) ?? null;
  if (!vr && talento.vaga) {
    let q = sb.from("vaga").select("*").eq("titulo", talento.vaga);
    if (talento.unidadeId) q = q.eq("unidade_id", talento.unidadeId);
    vr = (((await q.limit(1)).data ?? []) as VagaRow[])[0] ?? null;
  }
  if (vr) {
    const v = vagaDe(vr);
    vagaId = v.id;
    const ur = (await sb.from("unidade").select("*").eq("id", v.unidadeId).maybeSingle()).data as UnidadeRow | null;
    vagaCtx = { titulo: v.titulo, turno: v.turno || undefined, descricao: v.descricao, requisitos: v.requisitos, diferenciais: v.diferenciais, unidade: ur ? unidadeLabel(unidadeDe(ur)) : undefined };
  }

  let curriculo: Conteudo;
  try { curriculo = await carregarCurriculo(sb, anexo); } catch (e) { return falhar(e instanceof Error ? e.message : "Falha ao ler o currículo."); }

  const client = new Anthropic();
  let saida: z.infer<typeof Schema>;
  try {
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(Schema) },
      messages: [{
        role: "user",
        content: [
          curriculo,
          { type: "text", text: `Candidato: ${talento.nome}\n\n${textoVaga(vagaCtx, talento.vaga)}\n\nAnalise o currículo acima para esta vaga.` },
        ],
      }],
    });
    if (res.stop_reason === "refusal") return falhar("A análise foi recusada pelo modelo. Revise o arquivo e tente de novo.");
    if (!res.parsed_output) return falhar("O modelo não devolveu a análise no formato esperado. Tente de novo.");
    saida = res.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return falhar("Chave da Claude API inválida (ANTHROPIC_API_KEY).");
    if (e instanceof Anthropic.RateLimitError) return falhar("Limite de uso da Claude API atingido. Tente em alguns minutos.");
    if (e instanceof Anthropic.APIError) return falhar(`Claude API (${e.status}): ${e.message}`);
    return falhar(e instanceof Error ? e.message : "Falha na análise.");
  }

  const agora = new Date().toISOString();
  const analise: AnaliseIA = { ...saida, vagaId, vagaTitulo: vagaCtx?.titulo ?? talento.vaga, modelo: MODEL, em: agora };
  const aguardando = !talento.qualidade || talento.qualidade === "Aguardando Análise";
  const log: Comentario = {
    id: `c-ia-${Date.now()}`, author: autor, created_at: agora, tipo: "log",
    message: `Análise por IA concluída: ${analise.classificacao} (${analise.nota}/100) para ${analise.vagaTitulo ?? "a vaga"}${aguardando ? " — qualidade preenchida automaticamente" : ""}.`,
  };
  const patch: Record<string, unknown> = {
    resumo: analise.resumo, analise, nota_ia: analise.nota, qualidade_ia: analise.classificacao, analisado_em: agora, analise_erro: null,
    ultimos_comentarios: [...(talento.comentarios ?? []), log],
  };
  if (aguardando) patch.qualidade = analise.classificacao;
  const { error } = await sb.from("talento").update(patch).eq("id", id);
  if (error) return falhar(`Não foi possível gravar a análise: ${error.message}`);
  return { ok: true, talento: { ...talento, analise, analiseErro: undefined, qualidade: aguardando ? analise.classificacao : talento.qualidade, comentarios: [...(talento.comentarios ?? []), log] } };
}
