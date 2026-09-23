import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireEditor } from "@/lib/auth-admin";
import type { Talento } from "@/lib/types";

/**
 * Candidatos (Recrutamento → Banco de Talentos, tabela `talento`).
 *  - POST   { talento }     → cria (cadastro manual)
 *  - PATCH  { id, patch }   → atualiza status / vaga / unidade / qualidade / comentários / anexos
 *  - DELETE { id }          → exclui
 * Autorização: nível "editar" em Recrutamento → Banco de Talentos.
 */
export const dynamic = "force-dynamic";

function mapCols(p: Partial<Talento>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if ("nome" in p) c.nome = (p.nome ?? "").trim();
  if ("status" in p) c.status = p.status || "novo";
  if ("vaga" in p) c.vaga = p.vaga || null;
  if ("vagaId" in p) c.vaga_id = p.vagaId || null;
  if ("unidadeId" in p) c.unidade_id = p.unidadeId || null;
  if ("turno" in p) c.turno = p.turno || null;
  if ("origem" in p) c.origem = p.origem || null;
  if ("fone" in p) c.fone = p.fone || null;
  if ("qualidade" in p) c.qualidade = p.qualidade || null;
  if ("criada" in p) c.criada = p.criada || null;
  // Colunas jsonb: arrays de verdade (JSON.stringify gravaria um escalar string).
  if ("comentarios" in p) c.ultimos_comentarios = p.comentarios ?? [];
  if ("anexos" in p) c.anexos = p.anexos ?? [];
  return c;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "recrutamento-talentos");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { talento } = (await req.json().catch(() => ({}))) as { talento?: Talento };
  if (!talento?.id || !talento.nome?.trim()) return NextResponse.json({ error: "id e nome são obrigatórios." }, { status: 400 });
  const row: Record<string, unknown> = { id: talento.id, ...mapCols(talento) };
  if (!row.criada) row.criada = new Date().toISOString();
  const { error } = await sb.from("talento").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "recrutamento-talentos");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<Talento> };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const cols = mapCols(patch ?? {});
  if (Object.keys(cols).length === 0) return NextResponse.json({ persisted: true });
  const { error } = await sb.from("talento").update(cols).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "recrutamento-talentos");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const { error } = await sb.from("talento").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}
