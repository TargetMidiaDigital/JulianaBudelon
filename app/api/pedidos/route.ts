import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireEditor } from "@/lib/auth-admin";
import { PEDIDO_STATUS_ORDER, entregaParaIso, parseItens } from "@/lib/pedido";
import type { Pedido } from "@/lib/types";

/**
 * Ordens de serviço (Operacional → Ordem de Serviço, tabela `pedido`).
 *  - POST   { pedido }      → cria (criado_por = quem chamou)
 *  - PATCH  { id, patch }   → atualiza título / status / entrega / itens / histórico
 *  - DELETE { id }          → exclui
 * Autorização: nível "editar" em Operacional → Ordem de Serviço.
 */
export const dynamic = "force-dynamic";

const statusValido = (s?: string | null) => (PEDIDO_STATUS_ORDER as string[]).includes(s ?? "");

function mapCols(p: Partial<Pedido>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if ("titulo" in p) c.titulo = (p.titulo ?? "").trim();
  if ("status" in p) c.status = p.status;
  if ("entrega" in p) c.entrega = entregaParaIso(p.entrega);
  if ("itens" in p) c.itens = parseItens(p.itens); // jsonb: objeto de verdade
  if ("historico" in p) c.historico = Array.isArray(p.historico) ? p.historico.slice(-500) : [];
  return c;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "pedidos");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { pedido } = (await req.json().catch(() => ({}))) as { pedido?: Pedido };
  if (!pedido?.id || !pedido.titulo?.trim()) return NextResponse.json({ error: "id e título são obrigatórios." }, { status: 400 });
  const row = { id: pedido.id, ...mapCols(pedido), status: statusValido(pedido.status) ? pedido.status : "aberta", criado_por: sess.userId, criada: pedido.criada ?? new Date().toISOString() };
  const { error } = await sb.from("pedido").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "pedidos");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<Pedido> };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const cols = mapCols(patch ?? {});
  if ("titulo" in cols && !cols.titulo) return NextResponse.json({ error: "Título obrigatório." }, { status: 400 });
  if ("status" in cols && !statusValido(cols.status as string)) return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  if (Object.keys(cols).length === 0) return NextResponse.json({ persisted: true });
  const { error } = await sb.from("pedido").update(cols).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "pedidos");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const { error } = await sb.from("pedido").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}
