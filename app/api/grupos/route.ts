import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth-admin";
import type { GrupoInterno } from "@/lib/types";

/**
 * Grupos internos (Configurações → Grupos, tabela `grupo_interno`). Só Administrador.
 *  - POST   { grupo }       → cria (id vem do cliente)
 *  - PATCH  { id, patch }   → atualiza
 *  - DELETE { id }          → remove
 */
export const dynamic = "force-dynamic";

function mapCols(p: Partial<GrupoInterno>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if ("nome" in p) c.nome = (p.nome ?? "").trim();
  if ("descricao" in p) c.descricao = (p.descricao ?? "").trim() || null;
  if ("setores" in p) c.setores = p.setores ?? [];
  if ("visivelCargos" in p) c.visivel_cargos = p.visivelCargos ?? [];
  if ("logo" in p) c.logo = p.logo || null;
  return c;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return NextResponse.json({ error: adm.error }, { status: adm.status });
  const { grupo } = (await req.json().catch(() => ({}))) as { grupo?: GrupoInterno };
  if (!grupo?.id || !grupo.nome?.trim()) return NextResponse.json({ error: "id e nome são obrigatórios." }, { status: 400 });
  const { error } = await sb.from("grupo_interno").insert({ id: grupo.id, ...mapCols(grupo) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return NextResponse.json({ error: adm.error }, { status: adm.status });
  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<GrupoInterno> };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const cols = mapCols(patch ?? {});
  if (!Object.keys(cols).length) return NextResponse.json({ persisted: true });
  const { error } = await sb.from("grupo_interno").update(cols).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return NextResponse.json({ error: adm.error }, { status: adm.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const { error } = await sb.from("grupo_interno").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}
