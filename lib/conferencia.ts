import type { Task } from "./types";

/**
 * Conferência de uma tarefa da ordem de serviço: cada linha é um produto com o que foi PEDIDO
 * e o que a pessoa registrou como realizado (produzido / separado / recebido). A tarefa só
 * pode ser concluída com todas as linhas preenchidas; o estoque e o relatório usam o realizado.
 */
export type LinhaConferencia = { produtoId: string; pedido: number; feito?: number };

const inteiro = (v: unknown): number | undefined => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? undefined : Math.max(0, Math.round(n));
};

/** jsonb → linhas válidas (descarta lixo). */
export function parseConferencia(raw: unknown): LinhaConferencia[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && typeof (x as Record<string, unknown>).produtoId === "string")
    .map((x) => ({ produtoId: String(x.produtoId), pedido: inteiro(x.pedido) ?? 0, feito: inteiro(x.feito) }));
}

/** Linhas da tarefa; tarefa antiga só com produto/quantidade vira uma linha. */
export function linhasDaTarefa(t: Pick<Task, "conferencia" | "produtoId" | "quantidade">): LinhaConferencia[] {
  if (t.conferencia?.length) return t.conferencia;
  return t.produtoId && t.quantidade ? [{ produtoId: t.produtoId, pedido: t.quantidade }] : [];
}

export const conferenciaCompleta = (linhas: LinhaConferencia[]): boolean => linhas.every((l) => typeof l.feito === "number");
export const faltamPreencher = (linhas: LinhaConferencia[]): number => linhas.filter((l) => typeof l.feito !== "number").length;

/** Quantidade efetiva de uma linha (o realizado; se ainda vazio, o pedido). */
export const qtdEfetiva = (l: LinhaConferencia): number => l.feito ?? l.pedido;

/** Rótulo da coluna "realizado" conforme o setor. */
export const rotuloRealizado = (categoria?: string | null): string =>
  categoria === "expedicao" ? "Separado" : categoria === "unidade" ? "Recebido" : "Produzido";
