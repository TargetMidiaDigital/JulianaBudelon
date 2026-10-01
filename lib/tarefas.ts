import type { ScreenPage, Task } from "./types";

/**
 * Produção, Expedição e Unidades são a MESMA tabela de tarefas, separadas pela `categoria`:
 * "expedicao" = Operacional → Expedição (uma tarefa por unidade: separar o que vai para a loja);
 * "unidade"   = Operacional → Unidades (uma tarefa por unidade: a loja confere o que recebeu);
 * o resto (default "operacional") = Operacional → Produção (id de tela "listaview").
 */
export const CATEGORIA_EXPEDICAO = "expedicao";
export const CATEGORIA_UNIDADE = "unidade";
export const CATEGORIA_PRODUCAO = "operacional";

type ComCategoria = { categoria?: string | null };
export const ehExpedicao = (t: ComCategoria): boolean => t.categoria === CATEGORIA_EXPEDICAO;
export const ehUnidade = (t: ComCategoria): boolean => t.categoria === CATEGORIA_UNIDADE;
export const ehProducao = (t: ComCategoria): boolean => !ehExpedicao(t) && !ehUnidade(t);
/** Expedição e Unidades não têm "Em produção" nem produto/quantidade na tarefa. */
export const semEtapaProducao = (t: ComCategoria): boolean => !ehProducao(t);

export type PageTarefas = "listaview" | "expedicao" | "unidades";

/** Tela onde a tarefa aparece (e cuja permissão vale para editá-la). */
export const pageDaTarefa = (t: ComCategoria): PageTarefas => (ehExpedicao(t) ? "expedicao" : ehUnidade(t) ? "unidades" : "listaview");

/** Categoria gravada numa tarefa criada a partir de uma tela. */
export const categoriaDaPage = (page: ScreenPage): string => (page === "expedicao" ? CATEGORIA_EXPEDICAO : page === "unidades" ? CATEGORIA_UNIDADE : CATEGORIA_PRODUCAO);

/** Tela de lista de tarefas sem a etapa "Em produção"? */
export const pageSemProducao = (page: ScreenPage): boolean => page === "expedicao" || page === "unidades";

/** Tarefas de uma tela (Produção, Expedição ou Unidades). */
export const tarefasDaPage = <T extends Pick<Task, "categoria">>(tasks: T[], page: ScreenPage): T[] => tasks.filter((t) => pageDaTarefa(t) === page);
