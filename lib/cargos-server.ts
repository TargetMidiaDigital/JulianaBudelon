import type { SupabaseClient } from "@supabase/supabase-js";
import type { CargoDef } from "./types";
import { CARGOS_PADRAO, ordenarCargos } from "./acesso";

/** Cargos cadastrados (tabela `cargo`). Sem a tabela (migration 0028 pendente) → os padrões. */
export async function lerCargos(sb: SupabaseClient): Promise<CargoDef[]> {
  const { data, error } = await sb.from("cargo").select("nome, cor, ordem, acesso_total, sistema");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return CARGOS_PADRAO;
    throw new Error(error.message);
  }
  const rows = (data ?? []) as { nome: string; cor: string; ordem: number; acesso_total: boolean; sistema: boolean }[];
  return ordenarCargos(rows.map((r) => ({ nome: r.nome, cor: r.cor, ordem: r.ordem, acessoTotal: r.acesso_total, sistema: r.sistema })));
}

/** O cargo existe? */
export async function cargoExiste(sb: SupabaseClient, nome: string): Promise<CargoDef | null> {
  return (await lerCargos(sb)).find((c) => c.nome === nome) ?? null;
}
