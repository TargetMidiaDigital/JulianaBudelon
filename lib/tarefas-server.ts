import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtBR, parseComentarios } from "./data";
import { sincronizarStatusPedido } from "./pedido-server";
import { LOCAIS_ESTOQUE, parseQuantidades } from "./estoque";
import { parseItens } from "./pedido";
import type { TaskStatus } from "./types";

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

const feita = (s: string) => s === "concluida" || s === "validada";

/**
 * Tarefa de PRODUÇÃO com produto e quantidade: ao passar para concluída (ou validada) soma a
 * quantidade no estoque da Fábrica; ao sair de concluída (reaberta) estorna. Concluída ↔
 * validada não mexe. Grava log no produto e na tarefa (autor "sistema"). Nunca lança.
 */
export async function aplicarEstoqueProducao(
  sb: SupabaseClient,
  t: { id: string; nome?: string | null; status?: string | null; categoria?: string | null; produto_id?: string | null; quantidade?: number | null },
  novoStatus: TaskStatus,
): Promise<void> {
  try {
    if (t.categoria === "expedicao" || t.categoria === "unidade" || !t.produto_id || !t.quantidade || t.quantidade <= 0) return;
    const antes = feita(t.status ?? ""), depois = feita(novoStatus);
    if (antes === depois) return;
    const { data: prod } = await sb.from("produto").select("nome, estoque, historico").eq("id", t.produto_id).maybeSingle();
    const p = prod as { nome: string; estoque: unknown; historico: unknown } | null;
    if (!p) return;
    const q = t.quantidade, estoque = parseQuantidades(p.estoque);
    const de = estoque.fabrica ?? 0, para = Math.max(0, de + (depois ? q : -q));
    estoque.fabrica = para;
    const agora = new Date().toISOString();
    const logProduto = { id: crypto.randomUUID(), message: `Sistema ${depois ? "somou" : "estornou"} ${q} un. na unidade Fábrica (${de} → ${para}) — tarefa "${t.nome ?? ""}" ${depois ? "concluída" : "reaberta"}`, author: "sistema", created_at: agora, tipo: "log" as const };
    await sb.from("produto").update({ estoque, historico: [...parseComentarios(p.historico), logProduto].slice(-500) }).eq("id", t.produto_id);
    const { data: tr } = await sb.from("tarefas").select("ultimos_comentarios").eq("id", t.id).maybeSingle();
    const logTarefa = { id: crypto.randomUUID(), message: `📦 Sistema ${depois ? "somou" : "estornou"} ${q} un. de ${p.nome} no estoque da Fábrica (${de} → ${para}).`, author: "sistema", created_at: agora, tipo: "log" as const };
    await sb.from("tarefas").update({ ultimos_comentarios: [...parseComentarios((tr as { ultimos_comentarios?: unknown } | null)?.ultimos_comentarios), logTarefa] }).eq("id", t.id);
  } catch (e) {
    console.error("[tarefas] falha ao aplicar estoque da produção:", e);
  }
}

/**
 * RECEBIMENTO na unidade concluído: cada produto que a ordem mandou para aquela unidade SAI do
 * estoque da Fábrica e ENTRA no da unidade. Reabrir desfaz. Concluída ↔ validada não mexe.
 * Se a Fábrica não tinha o suficiente, fica em 0 e o log registra quanto faltou — é o furo
 * entre produção e recebimento. Log no produto e na tarefa. Nunca lança.
 */
export async function aplicarEstoqueRecebimento(
  sb: SupabaseClient,
  t: { id: string; nome?: string | null; status?: string | null; categoria?: string | null; local?: string | null; pedido_id?: string | null },
  novoStatus: TaskStatus,
): Promise<void> {
  try {
    if (t.categoria !== "unidade" || !t.local || !t.pedido_id || t.local === "fabrica") return;
    const antes = feita(t.status ?? ""), depois = feita(novoStatus);
    if (antes === depois) return;
    const label = LOCAIS_ESTOQUE.find((l) => l.id === t.local)?.label ?? t.local;
    const { data: ped } = await sb.from("pedido").select("itens").eq("id", t.pedido_id).maybeSingle();
    const itens = parseItens((ped as { itens?: unknown } | null)?.itens);
    const agora = new Date().toISOString();
    const linhas: string[] = [];
    for (const [pid, q0] of Object.entries(itens)) {
      const q = q0[t.local] ?? 0;
      if (q <= 0) continue;
      const { data: prod } = await sb.from("produto").select("nome, estoque, historico").eq("id", pid).maybeSingle();
      const p = prod as { nome: string; estoque: unknown; historico: unknown } | null;
      if (!p) continue;
      const est = parseQuantidades(p.estoque);
      const fab = est.fabrica ?? 0, uni = est[t.local] ?? 0;
      let msg: string;
      if (depois) {
        const falta = Math.max(0, q - fab);
        est.fabrica = Math.max(0, fab - q); est[t.local] = uni + q;
        msg = `Sistema transferiu ${q} un. da Fábrica (${fab} → ${est.fabrica}) para ${label} (${uni} → ${est[t.local]}) — recebimento concluído${falta ? `. ⚠ Fábrica tinha só ${fab}: faltaram ${falta} un.` : ""}`;
      } else {
        est.fabrica = fab + q; est[t.local] = Math.max(0, uni - q);
        msg = `Sistema devolveu ${q} un. de ${label} (${uni} → ${est[t.local]}) para a Fábrica (${fab} → ${est.fabrica}) — recebimento reaberto`;
      }
      const log = { id: crypto.randomUUID(), message: msg, author: "sistema", created_at: agora, tipo: "log" as const };
      await sb.from("produto").update({ estoque: est, historico: [...parseComentarios(p.historico), log].slice(-500) }).eq("id", pid);
      linhas.push(`${p.nome}: ${q}`);
    }
    if (!linhas.length) return;
    const { data: tr } = await sb.from("tarefas").select("ultimos_comentarios").eq("id", t.id).maybeSingle();
    const logT = { id: crypto.randomUUID(), message: `📦 Sistema ${depois ? `transferiu da Fábrica para ${label}` : `devolveu de ${label} para a Fábrica`}: ${linhas.join(", ")}.`, author: "sistema", created_at: agora, tipo: "log" as const };
    await sb.from("tarefas").update({ ultimos_comentarios: [...parseComentarios((tr as { ultimos_comentarios?: unknown } | null)?.ultimos_comentarios), logT] }).eq("id", t.id);
  } catch (e) {
    console.error("[tarefas] falha ao aplicar estoque do recebimento:", e);
  }
}
