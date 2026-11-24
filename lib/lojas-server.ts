import type { SupabaseClient } from "@supabase/supabase-js";
import { definirLojasOperacao } from "./estoque";

/**
 * Servidor: atualiza a lista de lojas da operação (LOCAIS_ESTOQUE) com o cadastro único
 * (tabela `unidade`) antes de mexer em estoque/tarefas. Sem códigos ainda (antes da migração
 * 0034) ou com erro, fica a lista padrão. Nunca lança.
 */
export async function carregarLojasOperacao(sb: SupabaseClient): Promise<void> {
  try {
    const { data, error } = await sb.from("unidade").select("*");
    if (error || !data) return;
    const lojas = data as { codigo?: string | null; nome: string; operacao?: boolean | null; ordem?: number | null }[];
    if (lojas.some((l) => l.codigo)) definirLojasOperacao(lojas.map((l) => ({ codigo: l.codigo, nome: l.nome, operacao: l.operacao === true, ordem: l.ordem ?? 0 })));
  } catch (e) {
    console.error("[lojas] falha ao carregar o cadastro:", e);
  }
}
