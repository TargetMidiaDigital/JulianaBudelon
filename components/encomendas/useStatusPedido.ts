"use client";

import { useApp } from "../store";
import { brl, foneBR, fmtNowBR } from "@/lib/format";
import { LOCAIS_ESTOQUE } from "@/lib/estoque";
import { CATEGORIA_ENCOMENDA, CATEGORIA_PRODUCAO } from "@/lib/tarefas";
import { dataBR, numeroPedido, useEncomendas, type PedidoEncomenda, type PedidoStatus } from "@/lib/encomendas";
import type { Task } from "@/lib/types";

/** Unidade de retirada da encomenda → local do estoque/tarefas (u-centro → centro). */
const localDaUnidade = (unidadeId?: string) => {
  const id = (unidadeId ?? "").replace(/^u-/, "");
  return LOCAIS_ESTOQUE.some((l) => l.id === id) ? id : undefined;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Troca o status de um pedido do CRM de Encomendas. Quando o pagamento é confirmado
 * (sai de "Verificar pagamento" para "Em fila" — ou direto para "Em produção"), cria duas tarefas:
 *  - Lojas → Encomendas: a loja entrega a encomenda ao cliente na data/hora de retirada;
 *  - Produção: produzir a encomenda até a data de retirada.
 * Só cria uma vez por pedido (`tarefasCriadas`).
 */
export function useMudarStatusPedido() {
  const { addTask, currentUser } = useApp();
  const { pedidos, leads, produtoDe, setPedidoStatus } = useEncomendas();

  return (id: string, status: PedidoStatus) => {
    const p = pedidos.find((x) => x.id === id);
    if (!p || p.status === status) return;
    const confirmouPagamento = p.status === "Verificar pagamento" && (status === "Em fila" || status === "Em produção");
    if (!confirmouPagamento || p.tarefasCriadas) { setPedidoStatus(id, status); return; }

    const lead = leads.find((l) => l.id === p.leadId);
    const cliente = lead?.nome || (lead ? foneBR(lead.numero) : "Cliente");
    const produto = produtoDe(p.produtoId)?.nome ?? p.produtoNome ?? "Produto";
    const loja = p.unidadeNome ?? "Loja";
    for (const t of tarefasDaEncomenda(p, { cliente, fone: lead ? foneBR(lead.numero) : "", produto, loja, user: currentUser.id })) addTask(t);
    setPedidoStatus(id, status, { tarefasCriadas: true });
  };
}

function tarefasDaEncomenda(p: PedidoEncomenda, x: { cliente: string; fone: string; produto: string; loja: string; user: string }): Task[] {
  const now = fmtNowBR();
  const venc = dataBR(p.data);
  const base = Date.now();
  const local = localDaUnidade(p.unidadeId);
  const num = numeroPedido(p.id);
  const itens = `${p.quantidade}× ${x.produto}`;
  const obs = p.mensagem ? `<p><strong>Observação do cliente:</strong> ${esc(p.mensagem)}</p>` : "";
  const log = (msg: string) => [{ id: crypto.randomUUID(), message: msg, author: "sistema", created_at: new Date().toISOString(), tipo: "log" as const }];
  const comum = { gestor: x.user, status: "verificar" as const, prio: "normal" as const, tipo: "Encomenda", local, criada: now.date, criadaHora: now.hora, venc, vencHora: p.hora };

  const loja: Task = {
    ...comum,
    id: `t-${base}-encl`,
    titulo: `Encomenda - ${x.cliente} - ${x.loja} - ${venc}`,
    categoria: CATEGORIA_ENCOMENDA,
    desc:
      `<p><strong>Encomenda #${num}</strong> · retirada na loja <strong>${esc(x.loja)}</strong> em <strong>${venc} às ${p.hora}</strong>.</p>` +
      `<p><strong>Cliente:</strong> ${esc(x.cliente)}${x.fone ? ` · ${x.fone}` : ""}</p>` +
      `<ul><li>${esc(itens)}</li></ul>${obs}` +
      `<p><strong>Valor:</strong> ${brl(p.total)} (pago via PIX)</p>` +
      `<p>Receba a encomenda da produção e entregue ao cliente no horário combinado. Conclua quando o cliente retirar.</p>`,
    comentarios: log(`🎂 Criada automaticamente pelo CRM de Encomendas (pedido #${num}, pagamento confirmado).`),
  };
  const producao: Task = {
    ...comum,
    id: `t-${base}-encp`,
    titulo: `Encomenda - ${itens} - ${x.cliente} - ${venc}`,
    categoria: CATEGORIA_PRODUCAO,
    desc:
      `<p><strong>Encomenda #${num}</strong> — produzir <strong>${esc(itens)}</strong>.</p>${obs}` +
      `<p><strong>Sai para a loja ${esc(x.loja)}</strong>: retirada do cliente em <strong>${venc} às ${p.hora}</strong>. A encomenda precisa estar pronta e na loja antes disso.</p>` +
      `<p><strong>Cliente:</strong> ${esc(x.cliente)}</p>`,
    comentarios: log(`🎂 Criada automaticamente pelo CRM de Encomendas (pedido #${num}, pagamento confirmado).`),
  };
  return [producao, loja];
}
