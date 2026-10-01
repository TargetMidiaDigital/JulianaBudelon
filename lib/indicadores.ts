import type { Pedido, PedidoStatus, Produto, Task, TaskStatus } from "./types";
import { CATEGORIAS_ESTOQUE, LOCAIS_ESTOQUE } from "./estoque";
import { itemQtd, totalPorLocal } from "./pedido";
import { ehExpedicao } from "./tarefas";

/**
 * Indicadores operacionais (Operacional → Indicadores): tudo calculado no navegador a partir
 * do que o store já tem (ordens, tarefas e produtos). Os filtros valem para TODOS os números
 * da página; cada função abaixo recebe o recorte já filtrado.
 */

export type Periodo = "7d" | "30d" | "90d" | "mes" | "tudo";
export const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "mes", label: "Este mês" },
  { key: "tudo", label: "Todo o período" },
];

export type Filtros = {
  periodo: Periodo;
  local: string; // "" = todas as unidades
  categoria: string; // "" = todas
  status: PedidoStatus | ""; // "" = todos
};
export const FILTROS_VAZIOS: Filtros = { periodo: "30d", local: "", categoria: "", status: "" };

/** Início do período (ms), em relação a agora. null = sem corte. */
export function inicioDoPeriodo(p: Periodo, agora = new Date()): number | null {
  const d0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (p === "7d") return d0.getTime() - 6 * 86400000;
  if (p === "30d") return d0.getTime() - 29 * 86400000;
  if (p === "90d") return d0.getTime() - 89 * 86400000;
  if (p === "mes") return new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
  return null;
}

const ms = (iso?: string) => (iso ? new Date(iso).getTime() : NaN);
const produtoDe = (produtos: Produto[], id: string) => produtos.find((p) => p.id === id);
const nomeDe = (produtos: Produto[], id: string) => produtoDe(produtos, id)?.nome ?? "Produto removido";
const feita = (s: TaskStatus) => s === "concluida" || s === "validada";

/** Quantidade de um item considerando o filtro de unidade. */
const qtdItem = (p: Pedido, produtoId: string, local: string): number =>
  local ? itemQtd(p.itens, produtoId, local) : LOCAIS_ESTOQUE.reduce((s, l) => s + itemQtd(p.itens, produtoId, l.id), 0);

/** Itens da ordem que passam nos filtros de categoria e unidade: [produtoId, quantidade][]. */
function itensFiltrados(p: Pedido, produtos: Produto[], f: Filtros): [string, number][] {
  return Object.keys(p.itens)
    .filter((id) => !f.categoria || produtoDe(produtos, id)?.categoria === f.categoria)
    .map((id) => [id, qtdItem(p, id, f.local)] as [string, number])
    .filter(([, q]) => q > 0);
}

/** Ordens dentro do recorte: período (pela criação), status, e com algum item na unidade/categoria. */
export function filtrarPedidos(pedidos: Pedido[], produtos: Produto[], f: Filtros, agora = new Date()): Pedido[] {
  const ini = inicioDoPeriodo(f.periodo, agora);
  return pedidos.filter((p) => {
    if (ini != null && !(ms(p.criada) >= ini)) return false;
    if (f.status && p.status !== f.status) return false;
    if ((f.local || f.categoria) && itensFiltrados(p, produtos, f).length === 0) return false;
    return true;
  });
}

/** Tarefas geradas pelas ordens do recorte, respeitando unidade (expedição) e categoria (produção). */
export function filtrarTarefas(tasks: Task[], pedidosFiltrados: Pedido[], produtos: Produto[], f: Filtros): Task[] {
  const ids = new Set(pedidosFiltrados.map((p) => p.id));
  const localLabel = LOCAIS_ESTOQUE.find((l) => l.id === f.local)?.label;
  const nomesCategoria = f.categoria ? new Set(produtos.filter((p) => p.categoria === f.categoria).map((p) => p.nome)) : null;
  return tasks.filter((t) => {
    if (!t.pedidoId || !ids.has(t.pedidoId)) return false;
    if (ehExpedicao(t)) return !localLabel || t.titulo.startsWith(`Expedição - ${localLabel} -`);
    // produção: "Nome do produto: N"
    return !nomesCategoria || nomesCategoria.has(t.titulo.replace(/:\s*\d+\s*$/, ""));
  });
}

// ───────────────────────── agregados ─────────────────────────

export type ResumoOrdens = { total: number; porStatus: Record<PedidoStatus, number>; unidades: number; produtosDistintos: number };
export function resumoOrdens(ps: Pedido[], produtos: Produto[], f: Filtros): ResumoOrdens {
  const porStatus: Record<PedidoStatus, number> = { aberta: 0, "em andamento": 0, concluida: 0, validada: 0 };
  let unidades = 0; const distintos = new Set<string>();
  for (const p of ps) {
    porStatus[p.status] += 1;
    for (const [id, q] of itensFiltrados(p, produtos, f)) { unidades += q; distintos.add(id); }
  }
  return { total: ps.length, porStatus, unidades, produtosDistintos: distintos.size };
}

/** Top produtos por quantidade pedida (desc). */
export function rankingProdutos(ps: Pedido[], produtos: Produto[], f: Filtros, limite = 5): { id: string; nome: string; categoria: string; qtd: number; ordens: number }[] {
  const acc = new Map<string, { qtd: number; ordens: number }>();
  for (const p of ps) for (const [id, q] of itensFiltrados(p, produtos, f)) {
    const a = acc.get(id) ?? { qtd: 0, ordens: 0 }; a.qtd += q; a.ordens += 1; acc.set(id, a);
  }
  return [...acc.entries()]
    .map(([id, a]) => ({ id, nome: nomeDe(produtos, id), categoria: produtoDe(produtos, id)?.categoria ?? "", ...a }))
    .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt"))
    .slice(0, limite > 0 ? limite : undefined);
}

/** Unidades recebidas por local (sempre os 7 locais, na ordem fixa). */
export function porUnidade(ps: Pedido[], produtos: Produto[], f: Filtros): { id: string; label: string; qtd: number; ordens: number }[] {
  return LOCAIS_ESTOQUE.map((l) => {
    let qtd = 0, ordens = 0;
    for (const p of ps) {
      const ids = Object.keys(p.itens).filter((id) => !f.categoria || produtoDe(produtos, id)?.categoria === f.categoria);
      const q = ids.reduce((s, id) => s + itemQtd(p.itens, id, l.id), 0);
      if (q > 0) { qtd += q; ordens += 1; }
    }
    return { id: l.id, label: l.label, qtd, ordens };
  });
}

/** Unidades pedidas por categoria de produto (ordem fixa das categorias; só as com valor). */
export function porCategoria(ps: Pedido[], produtos: Produto[], f: Filtros): { categoria: string; qtd: number; produtos: number }[] {
  const acc = new Map<string, { qtd: number; ids: Set<string> }>();
  for (const p of ps) for (const [id, q] of itensFiltrados(p, produtos, f)) {
    const c = produtoDe(produtos, id)?.categoria ?? "Sem categoria";
    const a = acc.get(c) ?? { qtd: 0, ids: new Set<string>() }; a.qtd += q; a.ids.add(id); acc.set(c, a);
  }
  const ordem = (c: string) => { const i = CATEGORIAS_ESTOQUE.findIndex((x) => x.v === c); return i < 0 ? 999 : i; };
  return [...acc.entries()].map(([categoria, a]) => ({ categoria, qtd: a.qtd, produtos: a.ids.size })).sort((a, b) => ordem(a.categoria) - ordem(b.categoria));
}

/** Série temporal: ordens criadas e unidades pedidas por dia (ou por semana em períodos longos). */
export type PontoSerie = { chave: string; label: string; ordens: number; unidades: number };
export function serieTemporal(ps: Pedido[], produtos: Produto[], f: Filtros, agora = new Date()): PontoSerie[] {
  const ini = inicioDoPeriodo(f.periodo, agora);
  const primeiro = ps.length ? Math.min(...ps.map((p) => ms(p.criada)).filter((n) => !isNaN(n))) : agora.getTime();
  const inicio = ini ?? new Date(primeiro).setHours(0, 0, 0, 0);
  const dias = Math.max(1, Math.ceil((agora.getTime() - inicio) / 86400000) + 1);
  const semanal = dias > 45;
  const passo = semanal ? 7 : 1;
  const pontos: PontoSerie[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  for (let t = inicio; t <= agora.getTime(); t += passo * 86400000) {
    const d = new Date(t);
    pontos.push({ chave: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, ordens: 0, unidades: 0 });
  }
  for (const p of ps) {
    const t = ms(p.criada); if (isNaN(t)) continue;
    const idx = Math.min(pontos.length - 1, Math.max(0, Math.floor((t - inicio) / (passo * 86400000))));
    pontos[idx].ordens += 1;
    pontos[idx].unidades += itensFiltrados(p, produtos, f).reduce((s, [, q]) => s + q, 0);
  }
  return pontos;
}

/** Tarefas por status, separadas em produção × expedição. */
export type StatusSetor = { setor: "Produção" | "Expedição"; total: number; concluidas: number } & Record<TaskStatus, number>;
export function statusPorSetor(ts: Task[]): StatusSetor[] {
  const zero = (): Record<TaskStatus, number> => ({ verificar: 0, "em andamento": 0, atrasada: 0, concluida: 0, validada: 0 });
  const prod = { setor: "Produção" as const, total: 0, concluidas: 0, ...zero() };
  const exp = { setor: "Expedição" as const, total: 0, concluidas: 0, ...zero() };
  for (const t of ts) {
    const alvo = ehExpedicao(t) ? exp : prod;
    alvo[t.status] += 1; alvo.total += 1; if (feita(t.status)) alvo.concluidas += 1;
  }
  return [prod, exp];
}

/** Matriz produto × unidade (top N produtos), para o mapa de calor. */
export function matrizProdutoUnidade(ps: Pedido[], produtos: Produto[], f: Filtros, limite = 8): { nome: string; valores: Record<string, number>; total: number }[] {
  const top = rankingProdutos(ps, produtos, { ...f, local: "" }, limite);
  return top.map((r) => {
    const valores: Record<string, number> = {};
    for (const l of LOCAIS_ESTOQUE) valores[l.id] = ps.reduce((s, p) => s + itemQtd(p.itens, r.id, l.id), 0);
    return { nome: r.nome, valores, total: Object.values(valores).reduce((s, n) => s + n, 0) };
  });
}

/** Responsáveis: tarefas concluídas por pessoa (produção + expedição). */
export function porResponsavel(ts: Task[]): { gestor: string; total: number; concluidas: number; atrasadas: number }[] {
  const acc = new Map<string, { total: number; concluidas: number; atrasadas: number }>();
  for (const t of ts) {
    const a = acc.get(t.gestor) ?? { total: 0, concluidas: 0, atrasadas: 0 };
    a.total += 1; if (feita(t.status)) a.concluidas += 1; if (t.status === "atrasada") a.atrasadas += 1; acc.set(t.gestor, a);
  }
  return [...acc.entries()].map(([gestor, a]) => ({ gestor, ...a })).sort((a, b) => b.total - a.total);
}

/** Unidades: total e percentual, para rótulos. */
export const pct = (n: number, total: number): string => (total ? `${Math.round((n / total) * 100)}%` : "0%");
