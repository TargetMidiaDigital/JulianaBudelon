import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin, requireEditor } from "@/lib/auth-admin";
import { limparHorarios } from "@/lib/encomendas-base";
import type { Unidade } from "@/lib/types";

/**
 * Lojas — cadastro único (Configurações → Lojas; tabela `unidade`). A mesma loja alimenta
 * RH → Vagas (`ativa`), a operação (`codigo` + `operacao`) e a retirada de encomendas (`retirada`).
 * O id, o slug e o código vêm do cliente na criação (o store precisa deles na hora) e não mudam depois.
 *  - POST   { unidade }     → cria (Administrador)
 *  - PATCH  { id, patch }   → atualiza. Só "ativa" (pausar na página de vagas): quem edita RH → Vagas;
 *                             o resto: Administrador
 *  - DELETE { id }          → só loja sem código (fora da operação/encomendas), sem vagas e sem candidatos
 */
export const dynamic = "force-dynamic";

const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const codigoValido = (c: unknown): c is string => typeof c === "string" && /^[a-z0-9-]{1,40}$/.test(c) && c !== "fabrica";

function mapCols(p: Partial<Unidade>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if ("slug" in p) c.slug = (p.slug ?? "").trim();
  if ("cidade" in p) c.cidade = txt(p.cidade, 80) || null;
  if ("nome" in p) c.nome = txt(p.nome, 80);
  if ("ativa" in p) c.ativa = p.ativa !== false;
  if ("operacao" in p) c.operacao = p.operacao === true;
  if ("retirada" in p) c.retirada = p.retirada === true;
  if ("endereco" in p) c.endereco = txt(p.endereco, 200) || null;
  if ("horarios" in p) c.horarios = p.horarios ? limparHorarios(p.horarios) ?? null : null;
  if ("ordem" in p) c.ordem = Math.max(0, Math.min(999, Math.floor(Number(p.ordem) || 0)));
  return c;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireAdmin(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { unidade } = (await req.json().catch(() => ({}))) as { unidade?: Unidade };
  if (!unidade?.id || !unidade.slug || !unidade.nome?.trim()) return NextResponse.json({ error: "id, slug e nome são obrigatórios." }, { status: 400 });
  if (unidade.codigo != null && !codigoValido(unidade.codigo)) return NextResponse.json({ error: "Código da loja inválido." }, { status: 400 });
  const { error } = await sb.from("unidade").insert({
    id: unidade.id, ...mapCols(unidade), codigo: unidade.codigo ?? null, criada: unidade.criada ?? new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: /codigo/i.test(error.message) ? "Já existe uma loja com esse código." : error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<Unidade> };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const cols = mapCols(patch ?? {});
  delete cols.slug; // o link público não muda depois de criado
  if (Object.keys(cols).length === 0) return NextResponse.json({ persisted: true });
  // Pausar/reativar na página de vagas é do RH; o resto do cadastro é do Administrador.
  const soVagas = Object.keys(cols).every((k) => k === "ativa");
  const sess = soVagas ? await requireEditor(req, sb, "recrutamento-vagas") : await requireAdmin(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  // Código: só pode ser definido numa loja que ainda não tem (nunca troca — estoque e tarefas usam).
  if (patch && "codigo" in patch && patch.codigo) {
    if (!codigoValido(patch.codigo)) return NextResponse.json({ error: "Código da loja inválido." }, { status: 400 });
    const { data: atual } = await sb.from("unidade").select("codigo").eq("id", id).maybeSingle();
    if (!(atual as { codigo?: string | null } | null)?.codigo) cols.codigo = patch.codigo;
  }
  const { error } = await sb.from("unidade").update(cols).eq("id", id);
  if (error) return NextResponse.json({ error: /codigo/i.test(error.message) ? "Já existe uma loja com esse código." : error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireAdmin(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  // Nada se perde: loja com código (estoque, tarefas, encomendas), vagas ou candidatos não é excluída — só desativada.
  const [{ data: u }, { count: nVagas }, { count: nCand }] = await Promise.all([
    sb.from("unidade").select("*").eq("id", id).maybeSingle(),
    sb.from("vaga").select("id", { count: "exact", head: true }).eq("unidade_id", id),
    sb.from("talento").select("id", { count: "exact", head: true }).eq("unidade_id", id),
  ]);
  if ((u as { codigo?: string | null } | null)?.codigo || (nVagas ?? 0) > 0 || (nCand ?? 0) > 0) {
    return NextResponse.json({ error: "Essa loja tem histórico (operação, encomendas, vagas ou candidatos). Desligue as chaves em vez de excluir." }, { status: 409 });
  }
  const { error } = await sb.from("unidade").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}
