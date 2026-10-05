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
 * Divergência de cada etapa contra o que ELA deveria entregar:
 *  - Produção  × pedido   (produzir a mais fica de sobra na Fábrica; a menos falta);
 *  - Expedição × pedido   (a expedição separa o pedido da loja, não o que sobrou da produção);
 *  - Recebimento × separado (a loja deve receber o que foi enviado; sem separado, × pedido).
 * Ex.: pedido 8, produzido 10, separado 8, recebido 8 → só "Produção +2".
 */
export function divergencias(l: LinhaRelatorio): { etapa: string; delta: number }[] {
  const out: { etapa: string; delta: number }[] = [];
  if (l.produzido != null && l.produzido !== l.pedido) out.push({ etapa: "Produção", delta: l.produzido - l.pedido });
  if (l.separado != null && l.separado !== l.pedido) out.push({ etapa: "Expedição", delta: l.separado - l.pedido });
  const enviado = l.separado ?? l.pedido;
  if (l.recebido != null && l.recebido !== enviado) out.push({ etapa: "Recebimento", delta: l.recebido - enviado });
  return out;
}

export const textoDivergencias = (l: LinhaRelatorio): string =>
  divergencias(l).map((d) => `${d.etapa} ${d.delta > 0 ? "+" : "−"}${Math.abs(d.delta)}`).join(" · ");
