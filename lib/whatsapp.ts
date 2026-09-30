import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENTE_RECRUTAMENTO } from "./agente";
import { foneBR } from "./format";
import { SETOR_PADRAO, type SetorGrupo } from "./grupo";

/**
 * WhatsApp via Uazapi — USO EXCLUSIVO NO SERVIDOR (route handlers). Portado do CRM do
 * Cachorrão HD (lib/uazapiSend.ts + lib/grupoNotify.ts). As credenciais (URL + token) vêm
 * da linha do agente em `agente_ia` (service role), com fallback para UZAPI_URL/UZAPI_TOKEN;
 * o token nunca trafega pelo navegador.
 *
 * ⚠️ Os paths seguem o padrão da uazapiGO v2 (/send/text, /instance/*). Se a instância
 * usar outro caminho, basta ajustar as constantes.
 */

const SEND_TEXT_PATH = "/send/text";

export interface UazapiCreds { url: string; token: string }

/** Lê url+token da Uazapi de `agente_ia` (service role) com fallback para env. */
export async function getUazapiCreds(sb: SupabaseClient): Promise<UazapiCreds | null> {
  const { data } = await sb.from("agente_ia").select("uazapi_url, uazapi_token").eq("slug", AGENTE_RECRUTAMENTO).maybeSingle();
  const row = data as { uazapi_url: string | null; uazapi_token: string | null } | null;
  const url = (row?.uazapi_url || process.env.UZAPI_URL || "").trim().replace(/\/+$/, "");
  const token = (row?.uazapi_token || process.env.UZAPI_TOKEN || "").trim();
  if (!url || !token) return null;
  return { url, token };
}

/** Chamada crua à Uazapi. Lança com a mensagem da API quando não for 2xx. */
export async function uazapiFetch(creds: UazapiCreds, path: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${creds.url}${path}`, {
    method,
    headers: { "Content-Type": "application/json", token: creds.token },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  const texto = await res.text();
  let data: unknown;
  try { data = JSON.parse(texto); } catch { data = { raw: texto }; }
  if (!res.ok) throw new Error(`Uazapi ${path} respondeu ${res.status}: ${texto.slice(0, 300)}`);
  return data;
}

/** Envia uma mensagem de texto. `numero` = telefone com DDI ou JID de grupo (…@g.us). */
export async function sendText(sb: SupabaseClient, numero: string, texto: string): Promise<unknown> {
  const creds = await getUazapiCreds(sb);
  if (!creds) throw new Error("WhatsApp não configurado (URL/token da Uazapi em Configurações → WhatsApp).");
  return uazapiFetch(creds, SEND_TEXT_PATH, "POST", { number: numero, text: texto });
}

/* ------------------------------------------------- notificações nos grupos */

/**
 * Origem absoluta a partir do request. A mensagem no grupo precisa de link completo (a
 * pessoa abre no celular) — um caminho relativo não serve. Usa os headers que a Vercel
 * injeta atrás do proxy; NEXT_PUBLIC_SITE_URL tem prioridade.
 */
export function origemDeRequest(req: Request): string {
  const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (envUrl) return envUrl;
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : "";
}

/** Os campos do candidato que a mensagem do grupo usa. */
export interface CandidatoNotify {
  id: string;
  nome: string;
  fone?: string | null;
  vaga?: string | null;
  unidade?: string | null;
  turno?: string | null;
  /** Veio currículo anexado nesta candidatura? */
  temCurriculo: boolean;
  /** Gente nova (true) ou recandidatura de quem já estava no Banco de Talentos (false)? */
  novo?: boolean;
}

/**
 * Mensagem de CANDIDATURA NOVA — com o link que abre o painel já no candidato.
 * O arquivo do currículo NÃO vai na mensagem de propósito: é documento pessoal (CPF,
 * endereço, telefone) e um link encaminhado abriria para qualquer um. Quem precisa ler
 * abre pelo painel, que tem login.
 */
export function textoNovoCandidato(c: CandidatoNotify, origem: string): string {
  const linhas = [
    `Nome: ${c.nome}`,
    c.fone ? `WhatsApp: ${foneBR(c.fone)}` : "",
    c.vaga ? `Vaga: ${c.vaga}` : "Vaga: não informada",
    c.unidade ? `Unidade: ${c.unidade}` : "",
    c.turno ? `Turno: ${c.turno}` : "",
    `Currículo: ${c.temCurriculo ? "anexado" : "não enviado"}`,
  ].filter(Boolean);
  const link = origem ? ["", `Ver candidato: ${origem}/?talento=${encodeURIComponent(c.id)}`] : [];
  const cabecalho = c.novo === false ? "🔁 Recandidatura no Banco de Talentos" : "🧁 Novo candidato no Banco de Talentos";
  return [cabecalho, "", ...linhas, ...link].join("\n");
}

/**
 * Aviso de currículo novo: vai só para os grupos escolhidos em Recrutamento → Agente IA →
 * Ferramentas (`agente_ia.notificar_grupos`). Nenhum escolhido = nada sai.
 */
export async function notificarCurriculo(sb: SupabaseClient, texto: string): Promise<void> {
  const { data } = await sb.from("agente_ia").select("notificar_grupos").eq("slug", AGENTE_RECRUTAMENTO).maybeSingle();
  const ids = ((data as { notificar_grupos?: string[] | null } | null)?.notificar_grupos ?? []).map(String);
  if (!ids.length) { console.warn("[whatsapp] aviso de currículo não enviado: nenhum grupo escolhido em Agente IA → Ferramentas."); return; }
  await notificarGrupos(sb, texto, { ids });
}

/** Mensagem que o botão "Testar" da tela de grupos envia. */
export const TEXTO_TESTE_GRUPO = "✅ Teste da Ju Budelon: este grupo está configurado para receber as notificações do sistema.";

/**
 * Envia `texto` para grupos ATIVOS: os escolhidos por id (`ids`) ou, sem lista, todos os do
 * setor. Best-effort: lê os grupos, dispara um sendText por grupo e engole qualquer falha
 * (JID inválido, Uazapi fora do ar) — só registra no log. Nunca lança: uma candidatura não
 * pode falhar porque o WhatsApp falhou.
 */
export async function notificarGrupos(sb: SupabaseClient, texto: string, opts: { ids?: string[]; setor?: SetorGrupo } = {}): Promise<void> {
  const setor = opts.setor ?? SETOR_PADRAO;
  // Máquina de desenvolvimento aponta para o MESMO banco e a MESMA instância da produção:
  // mensagem com link localhost nunca é útil — melhor não sair.
  if (/localhost|127\.0\.0\.1/.test(texto)) {
    console.warn("[whatsapp] envio ignorado: a mensagem aponta para localhost (ambiente de desenvolvimento).");
    return;
  }
  try {
    const creds = await getUazapiCreds(sb);
    if (!creds) return;
    if (opts.ids && opts.ids.length === 0) return; // lista explícita vazia: ninguém escolhido
    let q = sb.from("whatsapp_grupos").select("grupo_id").eq("ativo", true);
    q = opts.ids ? q.in("id", opts.ids) : q.contains("setores", [setor]);
    const { data } = await q;
    const grupos = (data ?? []) as { grupo_id: string }[];
    if (!grupos.length) return;
    await Promise.allSettled(
      grupos.map((g) =>
        uazapiFetch(creds, SEND_TEXT_PATH, "POST", { number: g.grupo_id, text: texto }).catch((e) => {
          console.error(`[whatsapp] falha ao enviar para ${g.grupo_id}:`, e instanceof Error ? e.message : e);
        }),
      ),
    );
  } catch (e) {
    console.error("[whatsapp] falha ao carregar grupos:", e instanceof Error ? e.message : e);
  }
}
