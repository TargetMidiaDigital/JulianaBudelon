import type { CargoDef, NivelAcesso, ScreenPage } from "./types";
import { spacesTree } from "./seed";

/**
 * Regras de acesso por cargo. Os cargos são editáveis (Configurações → Acessos → Cargos,
 * tabela `cargo`); `CARGOS_PADRAO` é a lista inicial (seed do banco e do modo demo).
 * Só "Administrador" é fixo no código: acesso total, não renomeia nem exclui.
 */

export const ADMIN = "Administrador";

/** Cargos iniciais (mesma ordem/cor da migration 0028). */
export const CARGOS_PADRAO: CargoDef[] = [
  { nome: "Administrador", cor: "#8B3FB0", ordem: 0, acessoTotal: true, sistema: true },
  { nome: "Gerente", cor: "#1B7F4D", ordem: 1, acessoTotal: true, sistema: false },
  { nome: "Produção", cor: "#A4466A", ordem: 2, acessoTotal: false, sistema: false },
  { nome: "Expedição", cor: "#0E8FB0", ordem: 3, acessoTotal: false, sistema: false },
  { nome: "Líder (Loja)", cor: "#B07800", ordem: 4, acessoTotal: false, sistema: false },
  { nome: "Recursos Humanos", cor: "#C2410C", ordem: 5, acessoTotal: false, sistema: false },
];

/** Cores oferecidas ao criar/editar um cargo. */
export const CORES_CARGO = ["#8B3FB0", "#1B7F4D", "#A4466A", "#0E8FB0", "#B07800", "#C2410C", "#3B5BDB", "#0F766E", "#BE185D", "#6D28D9", "#B45309", "#475569"];

/** Ordena os cargos (Administrador sempre primeiro). */
export const ordenarCargos = (cs: CargoDef[]) =>
  [...cs].sort((a, b) => (a.nome === ADMIN ? -1 : b.nome === ADMIN ? 1 : a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt")));

// Registro em memória: o store registra os cargos e acessos carregados, e as funções puras
// (cor da pílula, responsáveis por setor…) leem daqui sem precisar receber tudo por parâmetro.
let registro: CargoDef[] = CARGOS_PADRAO;
let acessosReg: Record<string, Record<string, NivelAcesso>> = {};
export function registrarCargos(cargos: CargoDef[], acessos: Record<string, Record<string, NivelAcesso>>) {
  registro = cargos.length ? ordenarCargos(cargos) : CARGOS_PADRAO;
  acessosReg = acessos;
}
/** Cargos cadastrados, na ordem de exibição. */
export const listaCargos = () => registro;

export const corDoCargo = (c: string) => registro.find((x) => x.nome === c)?.cor ?? CARGOS_PADRAO.find((x) => x.nome === c)?.cor ?? "#5B6472";

/** Cargo tem acesso total (vê tudo, sem recorte; pode validar)? */
export const isCargoFull = (cargo?: string | null, cargos: CargoDef[] = registro) =>
  cargo === ADMIN || !!cargos.find((x) => x.nome === cargo)?.acessoTotal;

/** Escopo próprio padrão (só vê o que é dele) quando não há config salva. */
export const DEFAULT_ESCOPO: Record<string, boolean> = {};

/** Acesso padrão por cargo: setor(es) inteiros (ids de `spacesTree`) e/ou telas específicas.
 *  Administrador não entra aqui: acesso total sempre. Vale só enquanto nada foi salvo em
 *  Configurações → Acessos. Cargo novo (sem padrão) começa sem acesso a nada. */
export const ACESSO_PADRAO: Record<string, { setores?: string[]; pages?: ScreenPage[] }> = {
  "Gerente": { setores: ["operacional", "lojas", "encomendas"] },
  "Produção": { pages: ["pedidos", "listaview", "estoque"] },
  "Expedição": { pages: ["pedidos", "listaview", "expedicao", "estoque"] },
  "Líder (Loja)": { pages: ["unidades", "lojas-encomendas", "estoque"] },
  "Recursos Humanos": { setores: ["recrutamento"] },
};

/** Exceções de nível padrão (quando a tela tem acesso mas não deve ser "editar"). */
export const EDICAO_PADRAO: Record<string, Partial<Record<ScreenPage, NivelAcesso>>> = {
  "Produção": { pedidos: "ver", estoque: "ver" },
  "Expedição": { pedidos: "ver", listaview: "ver" },
  "Líder (Loja)": { estoque: "ver" },
};

/** Nome exibido de cada setor. As chaves internas ("Operacional"/"Recrutamento", e os ids
 *  "operacional"/"recrutamento") continuam iguais no código e no banco (grupos internos). */
export const SETOR_NOME: Record<string, string> = { Operacional: "Produção", Recrutamento: "RH" };
export const nomeDoSetor = (s: string) => SETOR_NOME[s] ?? s;

/** Nível padrão de um cargo numa tela (quando nada foi salvo em Configurações → Acessos). */
export function nivelPadrao(cargo: string, setorId: string, page: ScreenPage): NivelAcesso {
  if (cargo === ADMIN) return "editar";
  if (page === "treinamentos") return "ver"; // guias: todos os cargos leem
  const def = ACESSO_PADRAO[cargo];
  if (!def) return "nenhum";
  const temAcesso = (def.setores?.includes(setorId) ?? false) || (def.pages?.includes(page) ?? false);
  return !temAcesso ? "nenhum" : (EDICAO_PADRAO[cargo]?.[page] ?? "editar");
}

/** Nível efetivo (o salvo em Configurações → Acessos ou o padrão). */
export function nivelEfetivo(acessos: Record<string, Record<string, NivelAcesso>>, cargo: string, setorId: string, page: ScreenPage): NivelAcesso {
  if (cargo === ADMIN) return "editar";
  return acessos[cargo]?.[page] ?? nivelPadrao(cargo, setorId, page);
}

/** Setores das tarefas e os espaços do menu que contam para cada um. */
const ESPACOS_DO_SETOR: Record<string, string[]> = { Operacional: ["operacional", "lojas"], Recrutamento: ["recrutamento"] };

/**
 * Cargos que aparecem como "Responsável" num setor (e em "Quem pode ver" dos grupos):
 * os que têm acesso a alguma tela do setor em Configurações → Acessos. Administrador sempre.
 */
export function cargosDoSetor(setor: string, cargos: CargoDef[] = registro, acessos = acessosReg): string[] {
  const espacos = spacesTree.filter((sp) => (ESPACOS_DO_SETOR[setor] ?? ESPACOS_DO_SETOR.Operacional).includes(sp.id));
  return cargos
    .filter((c) => c.nome === ADMIN || espacos.some((sp) => sp.children.some((k) => nivelEfetivo(acessos, c.nome, sp.id, k.page) !== "nenhum")))
    .map((c) => c.nome);
}

/** Matriz completa (todas as telas) de um cargo — usada ao renomear, para o padrão não se perder. */
export function matrizEfetiva(acessos: Record<string, Record<string, NivelAcesso>>, cargo: string): Record<string, NivelAcesso> {
  const m: Record<string, NivelAcesso> = {};
  for (const sp of spacesTree) for (const k of sp.children) m[k.page] = nivelEfetivo(acessos, cargo, sp.id, k.page);
  return m;
}
