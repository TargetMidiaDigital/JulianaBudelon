import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth-admin";
import { AGENTE_RECRUTAMENTO } from "@/lib/agente";
import type { WhatsAppConfigPublica } from "@/lib/grupo";

/**
 * Credenciais da Uazapi (URL + token), em `agente_ia` (linha do agente), via service role.
 * Mesmo desenho do /api/uazapi/config do Cachorrão HD: o token NUNCA é devolvido ao
 * navegador — o GET só retorna a URL (não secreta) e `configurado`. Só Administrador.
 */
export const dynamic = "force-dynamic";

async function ler(sb: NonNullable<ReturnType<typeof getSupabase>>): Promise<WhatsAppConfigPublica & { temToken: boolean }> {
  const { data } = await sb.from("agente_ia").select("uazapi_url, uazapi_token").eq("slug", AGENTE_RECRUTAMENTO).maybeSingle();
  const r = data as { uazapi_url: string | null; uazapi_token: string | null } | null;
  const url = (r?.uazapi_url ?? "").trim();
  const temToken = Boolean((r?.uazapi_token ?? "").trim());
  return { url, configurado: Boolean(url) && temToken, temToken };
}

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ demo: true });
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return NextResponse.json({ error: adm.error }, { status: adm.status });
  const { url, configurado } = await ler(sb);
  return NextResponse.json({ url, configurado });
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Disponível só com o Supabase ligado." }, { status: 503 });
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return NextResponse.json({ error: adm.error }, { status: adm.status });
  const body = (await req.json().catch(() => ({}))) as { url?: string; token?: string };
  const url = (body.url ?? "").trim().replace(/\/+$/, "");
  const token = (body.token ?? "").trim(); // opcional: só sobrescreve se enviado
  if (!/^https?:\/\/[^\s]+$/.test(url)) return NextResponse.json({ error: "Informe a URL da API (ex.: https://sua-instancia.uazapi.com)." }, { status: 400 });
  const atual = await ler(sb);
  if (!atual.temToken && !token) return NextResponse.json({ error: "Informe o token da instância." }, { status: 400 });
  const payload: Record<string, unknown> = { slug: AGENTE_RECRUTAMENTO, nome: "RECRUTAMENTO", uazapi_url: url };
  if (token) payload.uazapi_token = token;
  const { error } = await sb.from("agente_ia").upsert(payload, { onConflict: "slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { url: u, configurado } = await ler(sb);
  return NextResponse.json({ ok: true, url: u, configurado });
}
