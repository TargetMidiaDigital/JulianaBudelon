import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth-admin";
import { gerarRecorrentes } from "@/lib/recorrencia-server";

/**
 * Gera as ocorrências das tarefas recorrentes vencidas (rec_proxima <= hoje).
 * POST por sessão ("rodar agora" / ao abrir o app) e GET pelo Vercel Cron
 * (Bearer CRON_SECRET, ver vercel.json). Idempotente por dia.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const sess = await requireSession(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const r = await gerarRecorrentes(sb);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const r = await gerarRecorrentes(sb);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
