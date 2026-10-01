import type { ScreenPage, Task } from "./types";

/**
 * Produção × Expedição são a MESMA tabela de tarefas, separadas pela `categoria`:
 * "expedicao" = Operacional → Expedição (uma tarefa por unidade que recebe a ordem);
 * o resto (default "operacional") = Operacional → Produção (id de tela "listaview").
 */
export const CATEGORIA_EXPEDICAO = "expedicao";
export const CATEGORIA_PRODUCAO = "operacional";

export const ehExpedicao = (t: { categoria?: string | null }): boolean => t.categoria === CATEGORIA_EXPEDICAO;

/** Tela onde a tarefa aparece (e cuja permissão vale para editá-la). */
export const pageDaTarefa = (t: { categoria?: string | null }): ScreenPage => (ehExpedicao(t) ? "expedicao" : "listaview");

/** Categoria gravada numa tarefa criada a partir de uma tela. */
export const categoriaDaPage = (page: ScreenPage): string => (page === "expedicao" ? CATEGORIA_EXPEDICAO : CATEGORIA_PRODUCAO);

/** Tarefas de uma tela (Produção ou Expedição). */
export const tarefasDaPage = <T extends Pick<Task, "categoria">>(tasks: T[], page: ScreenPage): T[] => tasks.filter((t) => pageDaTarefa(t) === page);
