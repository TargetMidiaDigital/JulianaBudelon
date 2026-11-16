import type { ScreenPage, Task } from "./types";

/**
 * Produção, Expedição, Unidades e Encomendas (lojas) são a MESMA tabela de tarefas, separadas pela `categoria`:
 * "expedicao" = Operacional → Expedição (uma tarefa por unidade: separar o que vai para a loja);
 * "unidade"   = Lojas → Unidades (uma tarefa por unidade: a loja confere o que recebeu);
 * "encomenda" = Lojas → Encomendas (a loja entrega a encomenda do cliente na data de retirada);
 * o resto (default "operacional") = Operacional → Produção (id de tela "listaview").
 */
export const CATEGORIA_EXPEDICAO = "expedicao";
export const CATEGORIA_UNIDADE = "unidade";
export const CATEGORIA_ENCOMENDA = "encomenda";
export const CATEGORIA_PRODUCAO = "operacional";

type ComCategoria = { categoria?: string | null };
export const ehExpedicao = (t: ComCategoria): boolean => t.categoria === CATEGORIA_EXPEDICAO;
export const ehUnidade = (t: ComCategoria): boolean => t.categoria === CATEGORIA_UNIDADE;
export const ehEncomendaLoja = (t: ComCategoria): boolean => t.categoria === CATEGORIA_ENCOMENDA;
export const ehProducao = (t: ComCategoria): boolean => !ehExpedicao(t) && !ehUnidade(t) && !ehEncomendaLoja(t);
/** Expedição, Unidades e Encomendas não têm "Em produção" nem produto/quantidade na tarefa. */
export const semEtapaProducao = (t: ComCategoria): boolean => !ehProducao(t);

export type PageTarefas = "listaview" | "expedicao" | "unidades" | "lojas-encomendas";

/** Tela onde a tarefa aparece (e cuja permissão vale para editá-la). */
export const pageDaTarefa = (t: ComCategoria): PageTarefas =>
  ehExpedicao(t) ? "expedicao" : ehUnidade(t) ? "unidades" : ehEncomendaLoja(t) ? "lojas-encomendas" : "listaview";

/** Categoria gravada numa tarefa criada a partir de uma tela. */
export const categoriaDaPage = (page: ScreenPage): string =>
  page === "expedicao" ? CATEGORIA_EXPEDICAO : page === "unidades" ? CATEGORIA_UNIDADE : page === "lojas-encomendas" ? CATEGORIA_ENCOMENDA : CATEGORIA_PRODUCAO;

/** Tela de lista de tarefas sem a etapa "Em produção"? */
export const pageSemProducao = (page: ScreenPage): boolean => page === "expedicao" || page === "unidades" || page === "lojas-encomendas";

/** Tarefas de uma tela (Produção, Expedição, Unidades ou Encomendas). */
export const tarefasDaPage = <T extends Pick<Task, "categoria">>(tasks: T[], page: ScreenPage): T[] => tasks.filter((t) => pageDaTarefa(t) === page);

// ── Encomendas da loja: A verificar → Recebido → Entregue → Validado ───────────────────────
// Usam os mesmos status do banco (verificar / em andamento / concluida / validada); só o nome muda.

/** Expedição e Unidades não têm a etapa do meio ("em andamento"); nas Encomendas da loja ela é o "Recebido". */
export const semEtapaDoMeio = (t: ComCategoria): boolean => ehExpedicao(t) || ehUnidade(t);
export const pageSemEtapaDoMeio = (page: ScreenPage): boolean => page === "expedicao" || page === "unidades";

/** Nome do status nas Encomendas da loja. */
export const ROTULO_ENCOMENDA: Partial<Record<string, string>> = { "em andamento": "Recebido", concluida: "Entregue", validada: "Validado" };
export const rotuloEncomenda = (status: string, t: ComCategoria): string | undefined => (ehEncomendaLoja(t) ? ROTULO_ENCOMENDA[status] : undefined);

/**
 * Passou do momento da conferência (quando o realizado é registrado e o estoque entra na loja)?
 * Encomendas da loja: ao marcar Recebido (ou depois). Demais tarefas: ao concluir.
 */
export const passouDaConferencia = (t: ComCategoria, status?: string | null): boolean =>
  ehEncomendaLoja(t) ? status === "em andamento" || status === "concluida" || status === "validada" : status === "concluida" || status === "validada";

/** De onde veio a tarefa de Produção: Encomenda (CRM), Ordem de Serviço ou criada à mão. */
export type OrigemProducao = "encomenda" | "os" | "avulsa";
export const origemProducao = (t: { id: string; tipo?: string; pedidoId?: string }): OrigemProducao =>
  t.tipo === "Encomenda" || t.id.includes("-encp-") ? "encomenda" : t.pedidoId ? "os" : "avulsa";
