import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth-admin";

/**
 * "Versão" dos dados: o `at` mais recente da tabela-sinal `realtime_ping` (os triggers
 * a atualizam em qualquer escrita). O cliente compara com a versão do último bootstrap
 * ao voltar para a aba — ~100 bytes em vez de refazer a carga inteira.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ v: null });
  const sess = await requireSession(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { data } = await sb.from("realtime_ping").select("at").order("at", { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json({ v: (data as { at?: string } | null)?.at ?? null });
}
