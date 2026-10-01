import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireEditor } from "@/lib/auth-admin";
import { CATEGORIAS_ESTOQUE, parseQuantidades } from "@/lib/estoque";
import type { Produto } from "@/lib/types";

/**
 * Produtos do estoque (Operacional → Estoque, tabela `produto`).
 *  - POST   { produto }     → cadastra
 *  - PATCH  { id, patch }   → atualiza nome / categoria / quantidades por local
 *  - DELETE { id }          → exclui
 * Autorização: nível "editar" em Operacional → Estoque.
 */
export const dynamic = "force-dynamic";

const categoriaValida = (c?: string | null) => CATEGORIAS_ESTOQUE.some((x) => x.v === c);

function mapCols(p: Partial<Produto>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if ("nome" in p) c.nome = (p.nome ?? "").trim();
  if ("categoria" in p) c.categoria = p.categoria;
  if ("quantidades" in p) c.estoque = parseQuantidades(p.quantidades); // jsonb: objeto de verdade
  if ("historico" in p) c.historico = Array.isArray(p.historico) ? p.historico.slice(-500) : [];
  return c;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "estoque");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { produto } = (await req.json().catch(() => ({}))) as { produto?: Produto };
  if (!produto?.id || !produto.nome?.trim()) return NextResponse.json({ error: "id e nome são obrigatórios." }, { status: 400 });
  if (!categoriaValida(produto.categoria)) return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  const { error } = await sb.from("produto").insert({ id: produto.id, ...mapCols(produto), criada: produto.criada ?? new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "estoque");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<Produto> };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const cols = mapCols(patch ?? {});
  if ("nome" in cols && !cols.nome) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
  if ("categoria" in cols && !categoriaValida(cols.categoria as string)) return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  if (Object.keys(cols).length === 0) return NextResponse.json({ persisted: true });
  const { error } = await sb.from("produto").update(cols).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "estoque");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const { error } = await sb.from("produto").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}
