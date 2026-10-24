import type { Cargo, NivelAcesso, ScreenPage } from "./types";

/**
 * Regras de acesso por cargo. Sem backend nesta fase, tudo roda no cliente —
 * mas fica concentrado aqui para migrar para o servidor depois sem divergir.
 */

/** Ordem oficial dos cargos (grupos de Pessoas, dropdowns, matriz de Acessos). */
export const CARGOS: Cargo[] = ["Administrador", "Gerente", "Produção", "Expedição", "Líder (Loja)", "Recursos Humanos"];

/** Cor por cargo (pílulas e matriz de acessos). */
export const CARGO_COR: Record<string, string> = {
  "Administrador": "#8B3FB0",
  "Gerente": "#1B7F4D",
  "Produção": "#A4466A",
  "Expedição": "#0E8FB0",
  "Líder (Loja)": "#B07800",
  "Recursos Humanos": "#C2410C",
};
export const corDoCargo = (c: string) => CARGO_COR[c] ?? "#5B6472";

/** Cargos com acesso total (veem tudo, sem recorte; podem validar). */
export const CARGOS_FULL = ["Administrador", "Gerente"];

/** Escopo próprio padrão (só vê o que é dele) quando não há config salva. */
export const DEFAULT_ESCOPO: Record<string, boolean> = {};

/** Acesso padrão por cargo: setor(es) inteiros (ids de `spacesTree`) e/ou telas específicas.
 *  Administrador não entra aqui: acesso total sempre. Vale só enquanto nada foi salvo em
 *  Configurações → Acessos. */
export const ACESSO_PADRAO: Record<string, { setores?: string[]; pages?: ScreenPage[] }> = {
  "Gerente": { setores: ["operacional", "lojas"] },
  "Produção": { pages: ["pedidos", "listaview", "estoque"] },
  "Expedição": { pages: ["pedidos", "listaview", "expedicao", "estoque"] },
  "Líder (Loja)": { pages: ["unidades", "estoque"] },
  "Recursos Humanos": { setores: ["recrutamento"] },
};

/** Exceções de nível padrão (quando a tela tem acesso mas não deve ser "editar"). */
export const EDICAO_PADRAO: Record<string, Partial<Record<ScreenPage, NivelAcesso>>> = {
  "Produção": { pedidos: "ver", estoque: "ver" },
  "Expedição": { pedidos: "ver", listaview: "ver" },
  "Líder (Loja)": { estoque: "ver" },
};

/** Cargo tem acesso total? */
export const isCargoFull = (cargo?: string | null) => CARGOS_FULL.includes(cargo ?? "");

/** Nome exibido de cada setor. As chaves internas ("Operacional"/"Recrutamento", e os ids
 *  "operacional"/"recrutamento") continuam iguais no código e no banco (grupos internos). */
export const SETOR_NOME: Record<string, string> = { Operacional: "Produção", Recrutamento: "RH" };
export const nomeDoSetor = (s: string) => SETOR_NOME[s] ?? s;

/** Cargos que aparecem como "Responsável" por setor (só membros ativos). */
export const SETOR_CARGOS: Record<string, string[]> = {
  Operacional: ["Administrador", "Gerente", "Produção", "Expedição", "Líder (Loja)"],
  Recrutamento: ["Administrador", "Recursos Humanos"],
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
