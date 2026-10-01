import type { SupabaseClient } from "@supabase/supabase-js";
import type { PedidoStatus, TaskStatus } from "./types";
import { parseComentarios } from "./data";
import { pedidoStatusInfo, statusDerivadoDoPedido } from "./pedido";

/**
 * A ordem de serviço acompanha as tarefas que gerou — produção E expedição (tarefas.pedido_id):
 * alguma começou → "em andamento"; todas concluídas → "concluida". Roda no servidor
 * (service role) depois de cada mudança de status/exclusão de tarefa, para valer mesmo
 * quando quem mexeu na tarefa não tem permissão de editar ordens. Nunca lança.
 */
export async function sincronizarStatusPedido(sb: SupabaseClient, pedidoId: string): Promise<void> {
  try {
    const [{ data: pedido }, { data: tarefas }] = await Promise.all([
      sb.from("pedido").select("status, historico").eq("id", pedidoId).maybeSingle(),
      sb.from("tarefas").select("status").eq("pedido_id", pedidoId),
    ]);
    const p = pedido as { status: PedidoStatus; historico: unknown } | null;
    if (!p) return;
    const novo = statusDerivadoDoPedido(p.status, ((tarefas ?? []) as { status: TaskStatus }[]).map((t) => t.status));
    if (!novo) return;
    const log = { id: crypto.randomUUID(), message: `Sistema mudou o status para "${pedidoStatusInfo(novo).label}" (pelas tarefas de produção)`, author: "sistema", created_at: new Date().toISOString(), tipo: "log" as const };
    await sb.from("pedido").update({ status: novo, historico: [...parseComentarios(p.historico), log].slice(-500) }).eq("id", pedidoId);
  } catch (e) {
    console.error("[pedido] falha ao sincronizar status:", e);
  }
}
