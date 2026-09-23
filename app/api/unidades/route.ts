import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireEditor } from "@/lib/auth-admin";
import type { Unidade } from "@/lib/types";

/**
 * Unidades (Recrutamento → Vagas, tabela `unidade`). O id e o slug vêm do cliente
 * (o store precisa deles na hora, para abrir a unidade recém-criada); o banco garante
 * a unicidade do slug.
 *  - POST   { unidade }     → cria
 *  - PATCH  { id, patch }   → atualiza
 *  - DELETE { id }          → remove a unidade e as vagas dela (candidatos ficam, perdem só o vínculo)
 */
export const dynamic = "force-dynamic";

function mapCols(p: Partial<Unidade>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if ("slug" in p) c.slug = (p.slug ?? "").trim();
  if ("cidade" in p) c.cidade = (p.cidade ?? "").trim() || null;
  if ("nome" in p) c.nome = (p.nome ?? "").trim();
  if ("ativa" in p) c.ativa = p.ativa !== false;
  return c;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "recrutamento-vagas");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { unidade } = (await req.json().catch(() => ({}))) as { unidade?: Unidade };
  if (!unidade?.id || !unidade.slug || !unidade.nome?.trim()) return NextResponse.json({ error: "id, slug e nome são obrigatórios." }, { status: 400 });
  const { error } = await sb.from("unidade").insert({ id: unidade.id, ...mapCols(unidade), criada: unidade.criada ?? new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "recrutamento-vagas");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<Unidade> };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const cols = mapCols(patch ?? {});
  if (Object.keys(cols).length === 0) return NextResponse.json({ persisted: true });
  const { error } = await sb.from("unidade").update(cols).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "recrutamento-vagas");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  // Candidatos ficam; as FKs (vaga_id/unidade_id → set null, vaga → cascade) cuidam do resto.
  const { error } = await sb.from("unidade").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}
