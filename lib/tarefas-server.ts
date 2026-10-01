import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtBR, parseComentarios } from "./data";
import { sincronizarStatusPedido } from "./pedido-server";

/**
 * "Atrasada" é status SÓ do sistema: ninguém escolhe à mão. Tarefa "A verificar" ou
 * "Em produção" cujo vencimento passou vira Atrasada aqui, com log de sistema. Roda a
 * cada /api/bootstrap (service role), então basta alguém abrir o app. Nunca lança.
 */
export async function marcarAtrasadas(sb: SupabaseClient): Promise<number> {
  try {
    const { data } = await sb.from("tarefas").select("id, vence_em, ultimos_comentarios, pedido_id")
      .in("status", ["verificar", "em andamento"]).lt("vence_em", new Date().toISOString()).limit(500);
    const rows = (data ?? []) as { id: string; vence_em: string; ultimos_comentarios: unknown; pedido_id: string | null }[];
    if (!rows.length) return 0;
    const pedidos = new Set<string>();
    for (const r of rows) {
      const v = fmtBR(r.vence_em);
      const log = { id: crypto.randomUUID(), message: `⏰ Sistema marcou como "Atrasada": venceu em ${v.date} ${v.hora}.`, author: "sistema", created_at: new Date().toISOString(), tipo: "log" as const };
      await sb.from("tarefas").update({ status: "atrasada", ultimos_comentarios: [...parseComentarios(r.ultimos_comentarios), log] }).eq("id", r.id).in("status", ["verificar", "em andamento"]);
      if (r.pedido_id) pedidos.add(r.pedido_id);
    }
    for (const id of pedidos) await sincronizarStatusPedido(sb, id);
    return rows.length;
  } catch (e) {
    console.error("[tarefas] falha ao marcar atrasadas:", e);
    return 0;
  }
}
