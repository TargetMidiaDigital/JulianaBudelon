import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isCargoFull } from "@/lib/acesso";
import { toISO } from "@/lib/data";
import type { Task, TaskStatus } from "@/lib/types";
import { sincronizarStatusPedido } from "@/lib/pedido-server";
import { aplicarEstoqueProducao } from "@/lib/tarefas-server";
import { parseQuantidade } from "@/lib/estoque";
import { pageDaTarefa } from "@/lib/tarefas";
import { requireSession, nivelNaTela } from "@/lib/auth-admin";

/**
 * Write-back das tarefas (tabela `tarefas`).
 *  - POST   { task }        → cria
 *  - PATCH  { id, patch }   → atualiza (só os campos enviados)
 *  - DELETE { id }          → exclui (subtarefas caem em cascata)
 * Autorização: nível "editar" na tela da tarefa — Produção ("listaview") ou Expedição
 * ("expedicao"), pela `categoria`. Cargos sem acesso total (Operacional) só mexem nas
 * PRÓPRIAS tarefas e não trocam o responsável.
 */
export const dynamic = "force-dynamic";

/** "Atrasada" só o sistema grava (lib/tarefas-server.ts); "Validada" só Administrador/Head. */
function validarStatusManual(status: unknown, cargo: string): string | null {
  if (status === "atrasada") return 'O status "Atrasada" é definido automaticamente pelo vencimento.';
  if (status === "validada" && !isCargoFull(cargo)) return 'Só Administrador ou Head Operacional podem validar.';
  return null;
}

/** Campos do app → colunas da tabela (apenas os presentes no patch). */
function mapPatch(patch: Partial<Task>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if ("titulo" in patch) c.nome = patch.titulo;
  if ("gestor" in patch) c.responsavel = patch.gestor || null;
  if ("status" in patch) c.status = patch.status;
  if ("prio" in patch) c.urgencia = patch.prio;
  if ("tipo" in patch) c.tipo = patch.tipo ?? null;
  if ("desc" in patch) c.descricao = patch.desc ?? null;
  if ("comentarios" in patch) c.ultimos_comentarios = patch.comentarios ?? [];
  if ("categoria" in patch) c.categoria = patch.categoria ?? "operacional";
  if ("parentId" in patch) c.parent_id = patch.parentId ?? null;
  if ("produtoId" in patch) c.produto_id = patch.produtoId || null;
  if ("quantidade" in patch) c.quantidade = patch.quantidade == null ? null : parseQuantidade(patch.quantidade);
  if ("pedidoId" in patch) c.pedido_id = patch.pedidoId ?? null;
  if ("venc" in patch || "vencHora" in patch) c.vence_em = toISO(patch.venc, patch.vencHora);
  if ("criada" in patch || "criadaHora" in patch) c.criada_em = toISO(patch.criada, patch.criadaHora);
  return c;
}

/** Sessão válida + nível "editar" na tela da tarefa (Produção ou Expedição). */
async function editorDaTarefa(req: Request, sb: NonNullable<ReturnType<typeof getSupabase>>, t: { categoria?: string | null }) {
  const s = await requireSession(req, sb);
  if (!s.ok) return s;
  if ((await nivelNaTela(sb, s.cargo, pageDaTarefa(t))) !== "editar") return { ok: false as const, status: 403, error: "Sem permissão para editar nesta tela." };
  return s;
}

/** Linha atual (responsável + categoria) — decide a tela da permissão e o escopo próprio. */
async function linhaAtual(sb: NonNullable<ReturnType<typeof getSupabase>>, id: string) {
  const { data } = await sb.from("tarefas").select("id, nome, status, responsavel, categoria, produto_id, quantidade").eq("id", id).maybeSingle();
  return data as { id: string; nome?: string | null; status?: string | null; responsavel?: string | null; categoria?: string | null; produto_id?: string | null; quantidade?: number | null } | null;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const { task } = (await req.json().catch(() => ({}))) as { task?: Task };
  if (!task?.id || !task.titulo) return NextResponse.json({ error: "task.id e task.titulo são obrigatórios." }, { status: 400 });
  const sess = await editorDaTarefa(req, sb, task);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const recusaStatus = validarStatusManual(task.status, sess.cargo) ?? (task.categoria === "expedicao" && task.status === "em andamento" ? 'Expedição não usa o status "Em produção".' : null);
  if (recusaStatus) return NextResponse.json({ error: recusaStatus }, { status: 403 });
  if (!isCargoFull(sess.cargo) && task.gestor && task.gestor !== sess.userId) {
    return NextResponse.json({ error: "Sem permissão para atribuir a outra pessoa." }, { status: 403 });
  }
  const row: Record<string, unknown> = {
    id: task.id, nome: task.titulo, status: task.status, urgencia: task.prio,
    responsavel: task.gestor || null, tipo: task.tipo ?? null, categoria: task.categoria ?? "operacional",
    parent_id: task.parentId ?? null, pedido_id: task.pedidoId ?? null, produto_id: task.produtoId || null, quantidade: task.quantidade == null ? null : parseQuantidade(task.quantidade), descricao: task.desc ?? null, ultimos_comentarios: task.comentarios ?? [],
    criada_em: toISO(task.criada, task.criadaHora) ?? new Date().toISOString(), vence_em: toISO(task.venc, task.vencHora),
  };
  const { error } = await sb.from("tarefas").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<Task> };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const atual = await linhaAtual(sb, id);
  if (!atual) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  const sess = await editorDaTarefa(req, sb, atual);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });

  if (!isCargoFull(sess.cargo)) {
    if (atual.responsavel !== sess.userId) return NextResponse.json({ error: "Sem permissão nesta tarefa." }, { status: 403 });
    if (patch && "gestor" in patch && patch.gestor !== sess.userId) return NextResponse.json({ error: "Sem permissão para alterar o responsável." }, { status: 403 });
  }

  const cols = mapPatch(patch ?? {});
  if ("status" in cols) {
    const recusa = validarStatusManual(cols.status as string, sess.cargo) ?? (atual.categoria === "expedicao" && cols.status === "em andamento" ? 'Expedição não usa o status "Em produção".' : null);
    if (recusa) return NextResponse.json({ error: recusa }, { status: 403 });
  }
  if (Object.keys(cols).length === 0) return NextResponse.json({ persisted: true });
  const { data: salva, error } = await sb.from("tarefas").update(cols).eq("id", id).select("pedido_id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Tarefa de uma ordem de serviço mudou de status → a ordem acompanha (em produção / concluída).
  const pedidoId = (salva as { pedido_id?: string | null } | null)?.pedido_id;
  if (pedidoId && "status" in cols) await sincronizarStatusPedido(sb, pedidoId);
  // Produção concluída → soma a quantidade no estoque da Fábrica (reaberta → estorna).
  if ("status" in cols) await aplicarEstoqueProducao(sb, atual, cols.status as TaskStatus);
  return NextResponse.json({ persisted: true });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const atual = await linhaAtual(sb, id);
  if (!atual) return NextResponse.json({ persisted: true }); // já não existe
  const sess = await editorDaTarefa(req, sb, atual);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  if (!isCargoFull(sess.cargo) && atual.responsavel !== sess.userId) return NextResponse.json({ error: "Sem permissão nesta tarefa." }, { status: 403 });
  const { data: apagada, error } = await sb.from("tarefas").delete().eq("id", id).select("pedido_id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pedidoId = (apagada as { pedido_id?: string | null } | null)?.pedido_id;
  if (pedidoId) await sincronizarStatusPedido(sb, pedidoId);
  return NextResponse.json({ persisted: true });
}
