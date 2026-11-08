"use client";

import FunilEncomenda from "@/components/encomendas/FunilEncomenda";

/**
 * Página pública de encomendas (sem login): o cliente escolhe o produto e percorre o funil.
 * Primeira versão sem banco — catálogo, unidades e horários vêm da configuração guardada no
 * navegador (lib/encomendas.ts), e o pedido aparece no setor Encomendas no mesmo navegador.
 */
export default function Encomendar() {
  return <FunilEncomenda />;
}
