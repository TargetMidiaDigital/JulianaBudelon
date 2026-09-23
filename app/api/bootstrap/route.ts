import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth-admin";
import { getData, scopeData } from "@/lib/data";

/**
 * Carrega os dados do app — AUTENTICADO e RECORTADO por cargo. O navegador chama
 * aqui após o login (e a cada sinal do realtime_ping); o servidor envia só o que o
 * cargo pode ver. Sem Supabase configurado → { demo:true } e o app usa o localStorage.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ demo: true });
  const sess = await requireSession(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  try {
    const full = await getData(sb);
    const data = scopeData(full, sess.cargo, sess.userId);
    const { data: ping } = await sb.from("realtime_ping").select("at").order("at", { ascending: false }).limit(1).maybeSingle();
    return NextResponse.json({ data, userId: sess.userId, versao: (ping as { at?: string } | null)?.at ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
