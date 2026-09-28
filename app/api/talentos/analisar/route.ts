import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireEditor } from "@/lib/auth-admin";
import { analisarTalento, temIA } from "@/lib/analise-curriculo";

/**
 * Análise do currículo por IA, sob demanda (botão "Analisar com IA" / "Reanalisar").
 *  - POST { id } → { ok, talento } | { ok:false, error, talento? }
 * Autorização: nível "editar" em Recrutamento → Banco de Talentos. A análise em si roda em
 * lib/analise-curriculo.ts (a mesma usada no disparo automático da candidatura).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Análise por IA disponível só com o Supabase ligado." }, { status: 503 });
  const sess = await requireEditor(req, sb, "recrutamento-talentos");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  if (!(await temIA(sb))) return NextResponse.json({ error: "Token do OpenRouter não configurado (Recrutamento → Agente IA → LLM)." }, { status: 503 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const r = await analisarTalento(sb, id, sess.userId);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.erro, talento: r.talento ?? null }, { status: 422 });
  return NextResponse.json({ ok: true, talento: r.talento });
}
