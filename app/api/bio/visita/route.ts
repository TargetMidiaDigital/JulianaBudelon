import { getSupabase } from "@/lib/supabase";
import { aparelhoDe, origemDe } from "@/lib/bio";

/**
 * Visita à página /bio (rota pública, chamada pela própria página ao abrir — uma vez a cada
 * 30 min por navegador). Robôs e prévias de link não contam.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return new Response(null, { status: 204 });
  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawler|spider|facebookexternalhit|preview|whatsapp/i.test(ua)) return new Response(null, { status: 204 });
  const body = (await req.json().catch(() => ({}))) as { ref?: string };
  const { data: pg } = await sb.from("bio_pagina").select("dados").eq("id", 1).maybeSingle();
  const publicada = ((pg as { dados?: { publicada?: boolean } } | null)?.dados?.publicada) !== false;
  if (pg && publicada) await sb.from("bio_evento").insert({ tipo: "view", aparelho: aparelhoDe(ua), origem: origemDe(ua, body.ref || req.headers.get("referer")) });
  return new Response(null, { status: 204 });
}
