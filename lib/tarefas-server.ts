import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtBR, parseComentarios } from "./data";
import { sincronizarStatusPedido } from "./pedido-server";
import { LOCAIS_ESTOQUE, parseQuantidades } from "./estoque";
import { parseItens } from "./pedido";
import { parseConferencia } from "./conferencia";
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

type TarefaEstoque = { id: string; nome?: string | null; status?: string | null; categoria?: string | null; produto_id?: string | null; quantidade?: number | null; local?: string | null; pedido_id?: string | null; conferencia?: unknown };

/** Linhas da tarefa (conferência; tarefa antiga → produto/quantidade). Quantidade = realizado. */
function linhasEstoque(t: TarefaEstoque): { produtoId: string; q: number; pedido: number }[] {
  const conf = parseConferencia(t.conferencia);
  if (conf.length) return conf.map((l) => ({ produtoId: l.produtoId, q: l.feito ?? l.pedido, pedido: l.pedido }));
  return t.produto_id && t.quantidade ? [{ produtoId: t.produto_id, q: t.quantidade, pedido: t.quantidade }] : [];
}

async function logNaTarefa(sb: SupabaseClient, id: string, message: string) {
  const { data: tr } = await sb.from("tarefas").select("ultimos_comentarios").eq("id", id).maybeSingle();
  const log = { id: crypto.randomUUID(), message, author: "sistema", created_at: new Date().toISOString(), tipo: "log" as const };
  await sb.from("tarefas").update({ ultimos_comentarios: [...parseComentarios((tr as { ultimos_comentarios?: unknown } | null)?.ultimos_comentarios), log] }).eq("id", id);
}

/**
 * PRODUÇÃO concluída (ou validada): o PRODUZIDO de cada linha soma no estoque da Fábrica;
 * reaberta, estorna. Concluída ↔ validada não mexe. Log no produto e na tarefa. Nunca lança.
 */
export async function aplicarEstoqueProducao(sb: SupabaseClient, t: TarefaEstoque, novoStatus: TaskStatus): Promise<void> {
  try {
    if (t.categoria === "expedicao" || t.categoria === "unidade") return;
    const antes = feita(t.status ?? ""), depois = feita(novoStatus);
    if (antes === depois) return;
    const agora = new Date().toISOString(); const resumo: string[] = [];
    for (const l of linhasEstoque(t)) {
      if (l.q <= 0) continue;
      const { data: prod } = await sb.from("produto").select("nome, estoque, historico").eq("id", l.produtoId).maybeSingle();
      const p = prod as { nome: string; estoque: unknown; historico: unknown } | null;
      if (!p) continue;
      const estoque = parseQuantidades(p.estoque);
      const de = estoque.fabrica ?? 0, para = Math.max(0, de + (depois ? l.q : -l.q));
      estoque.fabrica = para;
      const dif = depois && l.q !== l.pedido ? ` (pedido ${l.pedido})` : "";
      const log = { id: crypto.randomUUID(), message: `Sistema ${depois ? "somou" : "estornou"} ${l.q} un.${dif} na unidade Fábrica (${de} → ${para}) — tarefa "${t.nome ?? ""}" ${depois ? "concluída" : "reaberta"}`, author: "sistema", created_at: agora, tipo: "log" as const };
      await sb.from("produto").update({ estoque, historico: [...parseComentarios(p.historico), log].slice(-500) }).eq("id", l.produtoId);
      resumo.push(`${p.nome}: ${l.q}${dif}`);
    }
    if (resumo.length) await logNaTarefa(sb, t.id, `📦 Sistema ${depois ? "somou no" : "estornou do"} estoque da Fábrica: ${resumo.join(", ")}.`);
  } catch (e) {
    console.error("[tarefas] falha ao aplicar estoque da produção:", e);
  }
}

/**
 * RECEBIMENTO na unidade concluído: o RECEBIDO de cada linha sai da Fábrica e entra na
 * unidade; reabrir desfaz; concluída ↔ validada não mexe. Sem saldo na Fábrica, fica em 0 e o
 * log registra quanto faltou (o furo entre produção e recebimento). Nunca lança.
 */
export async function aplicarEstoqueRecebimento(sb: SupabaseClient, t: TarefaEstoque, novoStatus: TaskStatus): Promise<void> {
  try {
    if (t.categoria !== "unidade" || !t.local || t.local === "fabrica") return;
    const antes = feita(t.status ?? ""), depois = feita(novoStatus);
    if (antes === depois) return;
    const local = t.local;
    const label = LOCAIS_ESTOQUE.find((l) => l.id === local)?.label ?? local;
    let linhas = linhasEstoque(t);
    if (!linhas.length && t.pedido_id) { // tarefa antiga, sem conferência: usa o que a ordem mandou
      const { data: ped } = await sb.from("pedido").select("itens").eq("id", t.pedido_id).maybeSingle();
      linhas = Object.entries(parseItens((ped as { itens?: unknown } | null)?.itens)).map(([produtoId, q]) => ({ produtoId, q: q[local] ?? 0, pedido: q[local] ?? 0 }));
    }
    const agora = new Date().toISOString(); const resumo: string[] = [];
    for (const l of linhas) {
      if (l.q <= 0) continue;
      const { data: prod } = await sb.from("produto").select("nome, estoque, historico").eq("id", l.produtoId).maybeSingle();
      const p = prod as { nome: string; estoque: unknown; historico: unknown } | null;
      if (!p) continue;
      const est = parseQuantidades(p.estoque);
      const fab = est.fabrica ?? 0, uni = est[local] ?? 0;
      let msg: string;
      if (depois) {
        const falta = Math.max(0, l.q - fab);
        est.fabrica = Math.max(0, fab - l.q); est[local] = uni + l.q;
        msg = `Sistema transferiu ${l.q} un.${l.q !== l.pedido ? ` (pedido ${l.pedido})` : ""} da Fábrica (${fab} → ${est.fabrica}) para ${label} (${uni} → ${est[local]}) — recebimento concluído${falta ? `. ⚠ Fábrica tinha só ${fab}: faltaram ${falta} un.` : ""}`;
      } else {
        est.fabrica = fab + l.q; est[local] = Math.max(0, uni - l.q);
        msg = `Sistema devolveu ${l.q} un. de ${label} (${uni} → ${est[local]}) para a Fábrica (${fab} → ${est.fabrica}) — recebimento reaberto`;
      }
      const log = { id: crypto.randomUUID(), message: msg, author: "sistema", created_at: agora, tipo: "log" as const };
      await sb.from("produto").update({ estoque: est, historico: [...parseComentarios(p.historico), log].slice(-500) }).eq("id", l.produtoId);
      resumo.push(`${p.nome}: ${l.q}`);
    }
    if (resumo.length) await logNaTarefa(sb, t.id, `📦 Sistema ${depois ? `transferiu da Fábrica para ${label}` : `devolveu de ${label} para a Fábrica`}: ${resumo.join(", ")}.`);
  } catch (e) {
    console.error("[tarefas] falha ao aplicar estoque do recebimento:", e);
  }
}
