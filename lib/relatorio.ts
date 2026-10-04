import type { Pedido, Produto, Task } from "./types";
import { CATEGORIAS_ESTOQUE, LOCAIS_ESTOQUE } from "./estoque";
import { itemQtd } from "./pedido";
import { linhasDaTarefa } from "./conferencia";
import { ehExpedicao, ehProducao, ehUnidade } from "./tarefas";

/**
 * Relatório da ordem de serviço: para cada produto × unidade, o que foi PEDIDO e o que cada
 * etapa registrou — produzido (produção), separado (expedição) e recebido (unidade).
 * `undefined` = etapa ainda sem registro; `null` = etapa não se aplica (parte da Fábrica não
 * passa por expedição/recebimento).
 */
export type LinhaRelatorio = {
  produtoId: string; produto: string; categoria: string; local: string; unidade: string;
  pedido: number; produzido?: number | null; separado?: number | null; recebido?: number | null;
};

const realizado = (tarefas: Task[], produtoId: string): number | undefined => {
  let achou = false, soma = 0;
  for (const t of tarefas) for (const l of linhasDaTarefa(t)) if (l.produtoId === produtoId) {
    if (l.feito == null) return undefined; // alguma linha sem registro → etapa incompleta
    achou = true; soma += l.feito;
  }
  return achou ? soma : undefined;
};

export function relatorioDaOrdem(pedido: Pedido, tasks: Task[], produtos: Produto[]): LinhaRelatorio[] {
  const da = tasks.filter((t) => t.pedidoId === pedido.id);
  const ordemCat = (c: string) => { const i = CATEGORIAS_ESTOQUE.findIndex((x) => x.v === c); return i < 0 ? 999 : i; };
  const out: LinhaRelatorio[] = [];
  for (const pid of Object.keys(pedido.itens)) {
    const p = produtos.find((x) => x.id === pid);
    for (const l of LOCAIS_ESTOQUE) {
      const q = itemQtd(pedido.itens, pid, l.id);
      if (q <= 0) continue;
      const fab = l.id === "fabrica";
      out.push({
        produtoId: pid, produto: p?.nome ?? "Produto removido", categoria: p?.categoria ?? "", local: l.id, unidade: l.label, pedido: q,
        produzido: realizado(da.filter((t) => ehProducao(t) && t.local === l.id), pid),
        separado: fab ? null : realizado(da.filter((t) => ehExpedicao(t) && t.local === l.id), pid),
        recebido: fab ? null : realizado(da.filter((t) => ehUnidade(t) && t.local === l.id), pid),
      });
    }
  }
  const ordemLocal = (id: string) => LOCAIS_ESTOQUE.findIndex((l) => l.id === id);
  return out.sort((a, b) => ordemLocal(a.local) - ordemLocal(b.local) || ordemCat(a.categoria) - ordemCat(b.categoria) || a.produto.localeCompare(b.produto, "pt"));
}

/**
 * Etapas em que a quantidade mudou em relação à etapa anterior, com a diferença:
 * pedido → produzido → separado → recebido. Ex.: [{ etapa: "Produção", delta: -1 }, { etapa: "Recebimento", delta: -1 }].
 */
export function divergencias(l: LinhaRelatorio): { etapa: string; delta: number }[] {
  const etapas: [string, number | null | undefined][] = [["Produção", l.produzido], ["Expedição", l.separado], ["Recebimento", l.recebido]];
  const out: { etapa: string; delta: number }[] = [];
  let ref = l.pedido;
  for (const [etapa, v] of etapas) {
    if (v == null) continue;
    if (v !== ref) out.push({ etapa, delta: v - ref });
    ref = v;
  }
  return out;
}

export const textoDivergencias = (l: LinhaRelatorio): string =>
  divergencias(l).map((d) => `${d.etapa} ${d.delta > 0 ? "+" : "−"}${Math.abs(d.delta)}`).join(" · ");
