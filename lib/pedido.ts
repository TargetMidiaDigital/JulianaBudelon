import type { Pedido, PedidoStatus, Produto, TaskStatus } from "./types";
import { LOCAIS_ESTOQUE } from "./estoque";

/**
 * Dimensões da Ordem de Serviço (Operacional → Ordem de Serviço): status e helpers dos itens.
 * `itens` é { produtoId: { localId: quantidade } } — só produtos/locais com quantidade > 0.
 */
export const PEDIDO_STATUS: { key: PedidoStatus; label: string; bg: string; fg: string; dot: string }[] = [
  // Mesmas cores dos status de tarefa (A verificar / Em produção / Concluída / Validada).
  { key: "aberta", label: "Aberta", bg: "#FFF7E0", fg: "#9C7414", dot: "#EFA417" },
  { key: "em andamento", label: "Em andamento", bg: "#FFF1E8", fg: "#C25712", dot: "#F76808" }, // alguma tarefa (produção ou expedição) começou
  { key: "concluida", label: "Concluída", bg: "#E7F6EE", fg: "#1B7F4D", dot: "#2FB56F" },
  { key: "validada", label: "Validada", bg: "#EAF0FE", fg: "#1D4ED8", dot: "#2563EB" }, // conferida pela gestão; sai da visão padrão
];
export const PEDIDO_STATUS_ORDER: PedidoStatus[] = PEDIDO_STATUS.map((s) => s.key);
export const pedidoStatusInfo = (s: string) => PEDIDO_STATUS.find((x) => x.key === s) ?? PEDIDO_STATUS[0];

export type Itens = Record<string, Record<string, number>>;

/** Objeto cru (jsonb) → itens válidos: só ids de local conhecidos, inteiros > 0. */
export function parseItens(raw: unknown): Itens {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Itens = {};
  for (const [pid, q] of Object.entries(o)) {
    if (!q || typeof q !== "object") continue;
    const linha: Record<string, number> = {};
    for (const l of LOCAIS_ESTOQUE) {
      const n = Number((q as Record<string, unknown>)[l.id]);
      if (Number.isFinite(n) && n > 0) linha[l.id] = Math.round(n);
    }
    if (Object.keys(linha).length) out[pid] = linha;
  }
  return out;
}

export const itemQtd = (itens: Itens | undefined, produtoId: string, local: string): number => itens?.[produtoId]?.[local] ?? 0;

/** Itens com a célula (produto × local) trocada; zera → remove (mantém o objeto enxuto). */
export function comItem(itens: Itens, produtoId: string, local: string, n: number): Itens {
  const linha = { ...(itens[produtoId] ?? {}) };
  if (n > 0) linha[local] = n; else delete linha[local];
  const out = { ...itens };
  if (Object.keys(linha).length) out[produtoId] = linha; else delete out[produtoId];
  return out;
}

/** Total de unidades por local: { fabrica: 120, centro: 30, … }. */
export function totalPorLocal(itens: Itens | undefined): Record<string, number> {
  const t: Record<string, number> = {};
  for (const l of LOCAIS_ESTOQUE) t[l.id] = 0;
  for (const linha of Object.values(itens ?? {})) for (const l of LOCAIS_ESTOQUE) t[l.id] += linha[l.id] ?? 0;
  return t;
}
export const totalProdutoNoPedido = (itens: Itens | undefined, produtoId: string): number =>
  LOCAIS_ESTOQUE.reduce((s, l) => s + itemQtd(itens, produtoId, l.id), 0);
export const totalPedido = (itens: Itens | undefined): number => Object.values(totalPorLocal(itens)).reduce((s, n) => s + n, 0);
export const produtosNoPedido = (itens: Itens | undefined): number => Object.keys(itens ?? {}).length;

/** Nome do produto de um item (produto apagado → "Produto removido"). */
export const nomeProduto = (produtos: Produto[], id: string): string => produtos.find((p) => p.id === id)?.nome ?? "Produto removido";

/** "dd/mm/yyyy" ↔ "YYYY-MM-DD" (coluna date). */
export const entregaParaIso = (br?: string | null): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((br ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
export const entregaParaBR = (iso?: string | null): string | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : undefined;
};

/** Pedido "vivo" (conta no menu): aberta ou em produção. */
export const pedidoAtivo = (p: Pedido): boolean => p.status === "aberta" || p.status === "em andamento";

/**
 * Status da ordem a partir de TODAS as tarefas que ela gerou (produção + expedição):
 *  - todas concluídas (ou validadas) → "concluida";
 *  - alguma já saiu de "A verificar" → "em andamento";
 *  - nenhuma começou → "aberta".
 * Ordem validada (fechada pela gestão) e ordem sem tarefas ficam como estão (null = não mexer).
 */
export function statusDerivadoDoPedido(atual: PedidoStatus, tarefas: TaskStatus[]): PedidoStatus | null {
  if (atual === "validada" || tarefas.length === 0) return null;
  const feita = (s: TaskStatus) => s === "concluida" || s === "validada";
  const novo: PedidoStatus = tarefas.every(feita) ? "concluida" : tarefas.some((s) => s !== "verificar") ? "em andamento" : "aberta";
  return novo === atual ? null : novo;
}
