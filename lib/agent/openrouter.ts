// Cliente do OpenRouter (API compatível com OpenAI). USO SERVER-SIDE apenas.
// Portado do CRM do Cachorrão HD (lib/agent/openrouter.ts), com `response_format`
// (JSON Schema) para a saída estruturada da análise de currículo.
// Modelo e token vêm da tabela `agente_ia`, nunca de variável de ambiente.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** Parte de conteúdo multimodal (texto / imagem / arquivo) do turno do usuário. */
export type ContentPart = { type: string } & Record<string, unknown>;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[] | null;
}

interface CompletionResponse {
  choices?: { message?: ChatMessage; finish_reason?: string }[];
  error?: { message?: string };
}

/** Erro definitivo do OpenRouter (não vale a pena tentar de novo). */
export class OpenRouterError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "OpenRouterError";
  }
}

const TIMEOUT_MS = 22_000; // por tentativa; a rota morre em 60s (maxDuration)
const MAX_TENTATIVAS = 3;

/** 429 (rate limit) e 5xx costumam passar numa nova tentativa; o resto, não. */
const ehTransiente = (status: number) => status === 429 || status >= 500;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Uma rodada de chat completion, com timeout e retry. Devolve a mensagem do
 * assistente. `responseFormat` liga a saída em JSON Schema nos modelos que suportam
 * (Gemini, GPT); quem chama ainda valida o JSON, porque nem todo modelo obedece.
 */
export async function callOpenRouter(opts: {
  token: string;
  model: string;
  messages: ChatMessage[];
  timeoutMs?: number;
  /** Plugins do OpenRouter — usado para o file-parser de PDF (leitura de currículo). */
  plugins?: Record<string, unknown>[];
  /** { type:"json_schema", json_schema:{ name, strict, schema } } */
  responseFormat?: Record<string, unknown>;
  temperature?: number;
}): Promise<ChatMessage> {
  const body = JSON.stringify({
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    ...(opts.plugins && opts.plugins.length ? { plugins: opts.plugins } : {}),
    ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
  });

  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.token}`,
          "HTTP-Referer": "https://jubudelon.com.br",
          "X-Title": "Ju Budelon - Gestao",
        },
        body,
        signal: ctrl.signal,
      });
      const txt = await res.text();
      if (!res.ok) {
        if (ehTransiente(res.status) && tentativa < MAX_TENTATIVAS) {
          ultimoErro = new OpenRouterError(`OpenRouter ${res.status}`, res.status);
          await espera(600 * 2 ** (tentativa - 1) + Math.floor(Math.random() * 300));
          continue;
        }
        throw new OpenRouterError(`OpenRouter ${res.status}: ${txt.slice(0, 300)}`, res.status);
      }
      let data: CompletionResponse;
      try { data = JSON.parse(txt) as CompletionResponse; } catch { throw new OpenRouterError("OpenRouter: resposta inválida"); }
      if (data.error) throw new OpenRouterError(`OpenRouter: ${data.error.message ?? "erro"}`);
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new OpenRouterError("OpenRouter: sem resposta");
      return msg;
    } catch (e) {
      if (e instanceof OpenRouterError) throw e; // definitivo
      ultimoErro = e; // abort (timeout) ou rede: tenta de novo
      if (tentativa < MAX_TENTATIVAS) {
        await espera(600 * 2 ** (tentativa - 1) + Math.floor(Math.random() * 300));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const detalhe = ultimoErro instanceof Error ? ultimoErro.message : "sem resposta";
  throw new OpenRouterError(`OpenRouter indisponível após ${MAX_TENTATIVAS} tentativas: ${detalhe}`);
}

/** Texto da mensagem do assistente (string ou partes de texto concatenadas). */
export function textoDaMensagem(msg: ChatMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) return msg.content.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
  return "";
}
