import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para uso EXCLUSIVO no servidor (route handlers). Usa a secret key
 * (service role), que bypassa RLS — nunca importar em código que rode no navegador.
 * Retorna null se as variáveis não estiverem configuradas: aí o app roda no modo demo
 * (dados de exemplo no localStorage), como na fase 1.
 */
let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cached;
}

export type SB = SupabaseClient;
