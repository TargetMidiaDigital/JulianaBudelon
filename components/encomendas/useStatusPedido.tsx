"use client";

import { useState } from "react";
import { useApp } from "../store";
import ConfirmarWhatsapp from "./ConfirmarWhatsapp";
import { fmtNowBR } from "@/lib/format";
import { LOCAIS_ESTOQUE, qtdEm } from "@/lib/estoque";
import { confirmaPagamento, efeitoEstoque, linkWhatsapp, localDaUnidade, mensagemConfirmacaoPedido, tarefasDaEncomenda, useEncomendas, type PedidoEncomenda, type PedidoStatus } from "@/lib/encomendas";

/** Mensagem de confirmação (WhatsApp) de um pedido, com o nome da loja e do produto. */
export function useMensagemConfirmacao() {
  const { workspace } = useApp();
  const { leads, produtoDe, unidadeDe } = useEncomendas();
  return (p: PedidoEncomenda) => {
    const lead = leads.find((l) => l.id === p.leadId);
    return mensagemConfirmacaoPedido({
      nome: lead?.nome ?? "", empresa: workspace.nome,
      pedido: { ...p, unidadeNome: p.unidadeNome ?? unidadeDe(p.unidadeId)?.nome },
      produto: produtoDe(p.produtoId)?.nome ?? p.produtoNome ?? "encomenda",
    });
  };
}

/**
 * Troca o status de um pedido do CRM de Encomendas. Devolve `mudar` e o `popup` (renderizar na tela):
 * ir para "Confirmado com o cliente" abre antes o pop-up do WhatsApp com a mensagem de confirmação.
 *  - Com banco: só manda ao servidor — ele cria as tarefas (pagamento confirmado) e dá/devolve a
 *    baixa no estoque da loja (Entregue), uma vez só (lib/encomendas-server mudarStatusPedido).
 *  - Demo: faz o mesmo aqui, no estoque e nas tarefas locais.
 */
export function useMudarStatusPedido() {
  const { addTask, currentUser, produtos: estoque, updateProduto } = useApp();
  const { modo, pedidos, leads, produtoDe, setPedidoStatus } = useEncomendas();

  const mensagemDe = useMensagemConfirmacao();
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const aplicar = (id: string, status: PedidoStatus) => {
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

  const mudar = (id: string, status: PedidoStatus) => {
    const p = pedidos.find((x) => x.id === id);
    if (!p || p.status === status) return;
    const lead = leads.find((l) => l.id === p.leadId);
    if (status === "Confirmado com o cliente" && lead?.numero) { setConfirmar(id); return; }
    aplicar(id, status);
  };

  const pc = confirmar ? pedidos.find((x) => x.id === confirmar) : undefined;
  const lc = pc ? leads.find((l) => l.id === pc.leadId) : undefined;
  const msg = pc ? mensagemDe(pc) : "";
  const popup = pc && lc ? (
    <ConfirmarWhatsapp
      nome={lc.nome || "o cliente"}
      numero={lc.numero}
      mensagem={msg}
      onClose={() => setConfirmar(null)}
      onSoMudar={() => { aplicar(pc.id, "Confirmado com o cliente"); setConfirmar(null); }}
      onAbrir={() => {
        const href = linkWhatsapp(lc.numero, msg);
        if (href) window.open(href, "_blank", "noopener,noreferrer");
        aplicar(pc.id, "Confirmado com o cliente");
        setConfirmar(null);
      }}
    />
  ) : null;

  return { mudar, popup };
}
