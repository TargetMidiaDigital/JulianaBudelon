import type { Cargo, NivelAcesso, ScreenPage } from "./types";

/**
 * Regras de acesso por cargo. Sem backend nesta fase, tudo roda no cliente —
 * mas fica concentrado aqui para migrar para o servidor depois sem divergir.
 */

/** Ordem oficial dos cargos (grupos de Pessoas, dropdowns, matriz de Acessos). */
export const CARGOS: Cargo[] = ["Administrador", "Head Operacional", "Operacional", "Recrutamento"];

/** Cor por cargo (pílulas e matriz de acessos). */
export const CARGO_COR: Record<string, string> = {
  "Administrador": "#8B3FB0",
  "Head Operacional": "#1B7F4D",
  "Operacional": "#1366A8",
  "Recrutamento": "#C2410C",
};
export const corDoCargo = (c: string) => CARGO_COR[c] ?? "#5B6472";

/** Cargos com acesso total (veem tudo, sem recorte). */
export const CARGOS_FULL = ["Administrador", "Head Operacional"];

/** Escopo próprio padrão (só vê o que é dele) quando não há config salva. */
export const DEFAULT_ESCOPO: Record<string, boolean> = {
  "Operacional": true,
};

/** Acesso padrão por cargo: setor(es) inteiros (ids de `spacesTree`) e/ou telas específicas.
 *  Administrador não entra aqui: acesso total sempre. */
export const ACESSO_PADRAO: Record<string, { setores?: string[]; pages?: ScreenPage[] }> = {
  "Head Operacional": { setores: ["operacional"] },
  "Operacional": { setores: ["operacional"] },
  "Recrutamento": { setores: ["recrutamento"] },
};

/** Exceções de nível padrão (quando a tela tem acesso mas não deve ser "editar"). */
export const EDICAO_PADRAO: Record<string, Partial<Record<ScreenPage, NivelAcesso>>> = {};

/** Cargo tem acesso total? */
export const isCargoFull = (cargo?: string | null) => CARGOS_FULL.includes(cargo ?? "");

/** Cargos que aparecem como "Responsável" por setor (só membros ativos). */
export const SETOR_CARGOS: Record<string, string[]> = {
  Operacional: ["Administrador", "Head Operacional", "Operacional"],
  Recrutamento: ["Administrador", "Recrutamento"],
};

/** Nível padrão de um cargo numa tela (quando nada foi salvo em Configurações → Acessos). */
export function nivelPadrao(cargo: string, setorId: string, page: ScreenPage): NivelAcesso {
  if (cargo === "Administrador") return "editar";
  const def = ACESSO_PADRAO[cargo];
  const temAcesso = def
    ? (def.setores?.includes(setorId) ?? false) || (def.pages?.includes(page) ?? false)
    : true;
  return !temAcesso ? "nenhum" : (EDICAO_PADRAO[cargo]?.[page] ?? "editar");
}
