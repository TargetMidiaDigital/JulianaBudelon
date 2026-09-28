import type { SupabaseClient } from "@supabase/supabase-js";
import { callOpenRouter, textoDaMensagem, type ContentPart } from "./agent/openrouter";
import { textoDeDocx } from "./docx";
import { talentoDe, vagaDe, unidadeDe, parseAnalise, type TalentoRow, type VagaRow, type UnidadeRow } from "./data";
import { unidadeLabel } from "./localdb";
import { AGENTE_RECRUTAMENTO, MODELO_RECRUTAMENTO_PADRAO, PDF_ENGINE_PADRAO, PROMPT_RECRUTAMENTO_PADRAO } from "./agente";
import type { AnaliseIA, Anexo, Comentario, Talento } from "./types";

/**
 * Análise do currículo por IA — USO SERVER-SIDE (service role). Mesmo desenho do
 * `resumoCurriculo` do CRM do Cachorrão HD, com duas diferenças pedidas aqui:
 *   1) além do resumo, devolve a CLASSIFICAÇÃO candidato × vaga (nota 0–100, Ótimo/Bom/Ruim,
 *      justificativa e lacunas), comparando com descrição/requisitos/diferenciais da vaga;
 *   2) a resposta é JSON (response_format do OpenRouter + validação aqui), gravada em colunas.
 *
 * Config (token, modelo, motor de PDF, prompt, ferramentas) vem da linha `recrutamento` da
 * tabela `agente_ia` — Configurações → Agente IA. Nada de variável de ambiente.
 *
 * O arquivo é baixado do bucket PRIVADO com service role e mandado em base64 — nenhuma
 * URL do Storage sai para terceiro. ⚠️ O conteúdo do currículo (dado pessoal) vai para o
 * OpenRouter, que roteia para o provedor do modelo escolhido.
 *
 * Grava em `talento` (resumo, analise, nota_ia, qualidade_ia, analisado_em) e preenche a
 * "Qualidade" só se ela ainda estiver em "Aguardando Análise" — a decisão humana prevalece.
 */

const BUCKET = "task-anexos";
// Base64 infla ~33% e a rota morre em 60s: um anexo muito grande não vale a tentativa.
const MAX_BYTES = 8 * 1024 * 1024;
const IMAGENS: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Formato fixo da resposta — anexado ao prompt editável e enviado como JSON Schema. */
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resumo", "experiencia", "formacao", "pontosFortes", "alertas", "nota", "classificacao", "justificativa", "lacunas"],
  properties: {
    resumo: { type: "string", description: "3 a 5 frases resumindo quem é o candidato: área, tempo de experiência, último cargo, perfil." },
    experiencia: { type: "array", items: { type: "string" }, description: "Experiências relevantes, da mais recente para a mais antiga: 'Cargo · Empresa · período'." },
    formacao: { type: "array", items: { type: "string" }, description: "Formação e cursos relevantes." },
    pontosFortes: { type: "array", items: { type: "string" }, description: "Até 5 pontos fortes para ESTA vaga, concretos." },
    alertas: { type: "array", items: { type: "string" }, description: "Pontos de atenção: períodos sem trabalho, trocas frequentes, distância da unidade, informações faltando, currículo ilegível." },
    nota: { type: "integer", minimum: 0, maximum: 100, description: "Aderência do candidato à vaga, de 0 a 100." },
    classificacao: { type: "string", enum: ["Ótimo", "Bom", "Ruim"], description: "Ótimo = 75 a 100; Bom = 50 a 74; Ruim = 0 a 49." },
    justificativa: { type: "string", description: "2 a 4 frases explicando a nota, citando requisitos atendidos e não atendidos." },
    lacunas: { type: "array", items: { type: "string" }, description: "Requisitos da vaga não atendidos ou não comprovados no currículo." },
  },
} as const;

const FORMATO = [
  "",
  "FORMATO DA RESPOSTA (obrigatório): responda SOMENTE com um JSON válido, sem texto antes ou depois, sem markdown, com exatamente estas chaves:",
  '{"resumo": string (3 a 5 frases), "experiencia": string[] ("Cargo · Empresa · período", da mais recente), "formacao": string[], "pontosFortes": string[] (até 5, concretos para esta vaga), "alertas": string[], "nota": inteiro 0–100, "classificacao": "Ótimo" | "Bom" | "Ruim", "justificativa": string (2 a 4 frases), "lacunas": string[] (requisitos não atendidos ou não comprovados)}',
  "Listas podem ser vazias ([]), mas todas as chaves devem existir.",
].join("\n");

export interface ConfigRecrutamento {
  prompt: string;
  modelo: string;
  engine: string;
  token: string;
  ferramentas: Record<string, boolean>;
}

/** Linha do agente de recrutamento. `null` = sem token (IA não configurada). */
export async function carregarConfigRecrutamento(sb: SupabaseClient): Promise<ConfigRecrutamento | null> {
  const { data } = await sb.from("agente_ia").select("prompt, openrouter_modelo, openrouter_token, pdf_engine, ferramentas").eq("slug", AGENTE_RECRUTAMENTO).maybeSingle();
  const r = (data ?? {}) as Record<string, unknown>;
  const token = ((r.openrouter_token as string | null) ?? "").trim();
  if (!token) return null;
  const ferr = (r.ferramentas && typeof r.ferramentas === "object" ? r.ferramentas : {}) as Record<string, unknown>;
  return {
    prompt: ((r.prompt as string | null) ?? "").trim() || PROMPT_RECRUTAMENTO_PADRAO,
    modelo: ((r.openrouter_modelo as string | null) ?? "").trim() || MODELO_RECRUTAMENTO_PADRAO,
    engine: ((r.pdf_engine as string | null) ?? "").trim() || PDF_ENGINE_PADRAO,
    token,
    ferramentas: Object.fromEntries(Object.entries(ferr).map(([k, v]) => [k, v !== false])),
  };
}

/** Interruptor da aba Ferramentas. Só `=== false` desliga — chave ausente conta como ligada. */
export async function ferramentaLigada(sb: SupabaseClient, chave: string): Promise<boolean> {
  try {
    const { data } = await sb.from("agente_ia").select("ferramentas").eq("slug", AGENTE_RECRUTAMENTO).maybeSingle();
    const ferr = ((data as { ferramentas?: unknown } | null)?.ferramentas ?? {}) as Record<string, unknown>;
    return ferr[chave] !== false;
  } catch {
    return true;
  }
}

/** true quando há token do OpenRouter gravado (a IA está configurada). */
export async function temIA(sb: SupabaseClient): Promise<boolean> {
  return (await carregarConfigRecrutamento(sb)) !== null;
}

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

const extDe = (a: Anexo) => (a.nome.split(".").pop() ?? "").toLowerCase();

/** Escolhe o anexo que mais parece ser o currículo: PDF > DOCX > imagem, o mais recente. */
export function escolherCurriculo(anexos: Anexo[]): Anexo | null {
  const peso = (a: Anexo) => {
    const e = extDe(a); const m = (a.mime ?? "").toLowerCase();
    if (e === "pdf" || m === "application/pdf") return 3;
    if (e === "docx") return 2;
    if (IMAGENS[e] || /^image\/(jpeg|png|webp)$/.test(m)) return 1;
    return 0;
  };
  const ok = anexos.filter((a) => peso(a) > 0 && a.url.startsWith("/api/anexo/"));
  if (!ok.length) return null;
  return ok.sort((a, b) => peso(b) - peso(a) || String(b.criadoEm ?? "").localeCompare(String(a.criadoEm ?? "")))[0];
}

/** Baixa o anexo do Storage e monta a parte de conteúdo (PDF via file-parser; imagem por visão; DOCX vira texto). */
async function carregarCurriculo(sb: SupabaseClient, anexo: Anexo): Promise<{ parte: ContentPart; ehPdf: boolean }> {
  const path = decodeURIComponent(anexo.url.replace(/^\/api\/anexo\//, ""));
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error("Não consegui baixar o currículo do Storage.");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (!bytes.length) throw new Error("Currículo vazio.");
  if (bytes.length > MAX_BYTES) throw new Error("Currículo grande demais para analisar automaticamente (acima de 8 MB).");
  const ext = extDe(anexo);
  const mime = (anexo.mime || data.type || "").toLowerCase();
  if (ext === "pdf" || mime === "application/pdf") {
    return { ehPdf: true, parte: { type: "file", file: { filename: anexo.nome || "curriculo.pdf", file_data: `data:application/pdf;base64,${bytes.toString("base64")}` } } };
  }
  if (ext === "docx") {
    // Word não passa por parser nem por visão: o texto sai do próprio arquivo.
    const texto = textoDeDocx(bytes);
    if (!texto) throw new Error("Não consegui ler o texto deste .docx.");
    return { ehPdf: false, parte: { type: "text", text: `Conteúdo do currículo (extraído do arquivo Word):\n\n${texto}` } };
  }
  const img = IMAGENS[ext] || (/^image\/(jpeg|png|webp)$/.test(mime) ? mime : "image/jpeg");
  return { ehPdf: false, parte: { type: "image_url", image_url: { url: `data:${img};base64,${bytes.toString("base64")}` } } };
}

/** Acha o JSON na resposta mesmo se o modelo embrulhar em ```json … ``` ou escrever algo antes. */
function extrairJson(texto: string): unknown {
  const t = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { /* tenta o primeiro bloco {…} */ }
  const ini = t.indexOf("{"), fim = t.lastIndexOf("}");
  if (ini >= 0 && fim > ini) { try { return JSON.parse(t.slice(ini, fim + 1)); } catch { /* inválido */ } }
  return null;
}

export type ResultadoAnalise = { ok: true; talento: Talento } | { ok: false; erro: string; talento?: Talento };

/**
 * Roda a análise de um candidato e grava o resultado. Nunca lança: erros viram
 * `analise_erro` no banco e aparecem no detalhe do candidato, com botão de refazer.
 */
export async function analisarTalento(sb: SupabaseClient, id: string, autor = "sistema"): Promise<ResultadoAnalise> {
  const { data: tr } = await sb.from("talento").select("*").eq("id", id).maybeSingle();
  if (!tr) return { ok: false, erro: "Candidato não encontrado." };
  const talento = talentoDe(tr as TalentoRow);

  const falhar = async (erro: string): Promise<ResultadoAnalise> => {
    await sb.from("talento").update({ analise_erro: erro }).eq("id", id);
    return { ok: false, erro, talento: { ...talento, analiseErro: erro } };
  };

  const cfg = await carregarConfigRecrutamento(sb);
  if (!cfg) return falhar("Token do OpenRouter não configurado (Configurações → Agente IA → LLM).");

  let anexo = escolherCurriculo(talento.anexos ?? []);
  if (!anexo) {
    // O painel salva o anexo de forma otimista e dispara a análise em seguida: dá uma
    // segunda chance ao PATCH dos anexos chegar antes de desistir.
    await new Promise((r) => setTimeout(r, 1500));
    const { data: tr2 } = await sb.from("talento").select("anexos").eq("id", id).maybeSingle();
    anexo = escolherCurriculo(talentoDe({ ...(tr as TalentoRow), anexos: (tr2 as { anexos?: unknown } | null)?.anexos }).anexos ?? []);
    if (!anexo) return falhar("Nenhum currículo com leitura automática anexado (PDF, DOCX, JPG, PNG ou WEBP). Abra o arquivo para ler.");
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

  let curriculo: { parte: ContentPart; ehPdf: boolean };
  try { curriculo = await carregarCurriculo(sb, anexo); } catch (e) { return falhar(e instanceof Error ? e.message : "Falha ao ler o currículo."); }

  let saida: AnaliseIA | undefined;
  try {
    const msg = await callOpenRouter({
      token: cfg.token,
      model: cfg.modelo,
      messages: [
        { role: "system", content: cfg.prompt + "\n" + FORMATO },
        { role: "user", content: [{ type: "text", text: `Candidato: ${talento.nome}\n\n${textoVaga(vagaCtx, talento.vaga)}\n\nAnalise o currículo em anexo para esta vaga.` }, curriculo.parte] },
      ],
      // O file-parser só entra para PDF; para imagem o modelo já enxerga direto.
      ...(curriculo.ehPdf ? { plugins: [{ id: "file-parser", pdf: { engine: cfg.engine } }] } : {}),
      responseFormat: { type: "json_schema", json_schema: { name: "analise_curriculo", strict: true, schema: SCHEMA } },
      timeoutMs: 45_000,
    });
    const bruto = extrairJson(textoDaMensagem(msg));
    saida = parseAnalise(bruto);
    if (!saida) return falhar("A IA não devolveu a análise no formato esperado. Tente de novo ou troque o modelo em Configurações → Agente IA → LLM.");
  } catch (e) {
    const detalhe = e instanceof Error ? e.message : "erro desconhecido";
    console.error("[analise-curriculo]", detalhe);
    return falhar(`Falha ao gerar a análise: ${detalhe}`);
  }

  const agora = new Date().toISOString();
  const analise: AnaliseIA = { ...saida, vagaId, vagaTitulo: vagaCtx?.titulo ?? talento.vaga, modelo: cfg.modelo, em: agora };
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
  if (error) return falhar(`Análise gerada, mas falhou ao salvar: ${error.message}`);
  return { ok: true, talento: { ...talento, analise, analiseErro: undefined, qualidade: aguardando ? analise.classificacao : talento.qualidade, comentarios: [...(talento.comentarios ?? []), log] } };
}
