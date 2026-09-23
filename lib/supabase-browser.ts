"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para uso no NAVEGADOR (só Auth + sinal de realtime). Usa a chave
 * publicável e mantém a sessão em localStorage. Singleton. Retorna null se as variáveis
 * NEXT_PUBLIC_* não estiverem configuradas → modo demo (sem login real).
 */
let cached: SupabaseClient | null | undefined;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cached = url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    : null;
  return cached;
}

/** true quando o app está ligado ao Supabase (false = modo demo/localStorage). */
export const temSupabase = () => getSupabaseBrowser() !== null;

/** Access token da sessão atual (Bearer) ou null se não logado. */
export async function authToken(): Promise<string | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  try {
    return (await sb.auth.getSession()).data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Headers para chamadas JSON autenticadas. Para multipart (FormData) use só `authToken()`. */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await authToken();
  return { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
}

/** Chamada JSON autenticada a /api/*. Lança Error(mensagem do servidor) quando falha. */
export async function apiJson<T = unknown>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: await authHeaders(), body: body === undefined ? undefined : JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(j?.error || `Falha (${res.status})`);
  return j;
}
