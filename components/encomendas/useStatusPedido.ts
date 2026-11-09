"use client";

import { useApp } from "../store";
import { fmtNowBR } from "@/lib/format";
import { LOCAIS_ESTOQUE, qtdEm } from "@/lib/estoque";
import { confirmaPagamento, efeitoEstoque, localDaUnidade, tarefasDaEncomenda, useEncomendas, type PedidoEncomenda, type PedidoStatus } from "@/lib/encomendas";

/**
 * Troca o status de um pedido do CRM de Encomendas.
 *  - Com banco: só manda ao servidor — ele cria as tarefas (pagamento confirmado) e dá/devolve a
 *    baixa no estoque da loja (Entregue), uma vez só (lib/encomendas-server mudarStatusPedido).
 *  - Demo: faz o mesmo aqui, no estoque e nas tarefas locais.
 */
export function useMudarStatusPedido() {
  const { addTask, currentUser, produtos: estoque, updateProduto } = useApp();
  const { modo, pedidos, leads, produtoDe, setPedidoStatus } = useEncomendas();

  return (id: string, status: PedidoStatus) => {
    const p = pedidos.find((x) => x.id === id);
    if (!p || p.status === status) return;
    if (modo === "banco") { setPedidoStatus(id, status); return; }

    const extra: Partial<PedidoEncomenda> = {};
    const prod = produtoDe(p.produtoId);
    const local = localDaUnidade(p.unidadeId, LOCAIS_ESTOQUE);
    const estoqueId = prod?.produtoEstoqueId ?? undefined;

    if (confirmaPagamento(p.status, status) && !p.tarefasCriadas) {
      const lead = leads.find((l) => l.id === p.leadId);
      for (const t of tarefasDaEncomenda(p, {
        cliente: lead?.nome || "Cliente", numero: lead?.numero, produto: prod?.nome ?? p.produtoNome ?? "Produto",
        produtoEstoqueId: estoqueId, local, responsavel: currentUser.id, agora: fmtNowBR(), base: Date.now(),
      })) addTask(t);
      extra.tarefasCriadas = true;
    }

    const ef = efeitoEstoque(p, status);
    if (ef !== 0) {
      extra.estoqueBaixado = ef === 1;
      const item = estoqueId ? estoque.find((x) => x.id === estoqueId) : undefined;
      if (item && local) {
        const atual = qtdEm(item.quantidades, local);
        updateProduto(item.id, { quantidades: { ...item.quantidades, [local]: Math.max(0, atual - ef * p.quantidade) } });
      }
    }
    setPedidoStatus(id, status, extra);
  };
}
