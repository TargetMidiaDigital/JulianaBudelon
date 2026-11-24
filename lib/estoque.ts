/**
 * Dimensões do Estoque (Operacional → Estoque). As categorias são as seções da planilha
 * de reposição das lojas (Frutas, Caseirinhos… Encomendas), na mesma ordem.
 */
export const CATEGORIAS_ESTOQUE: { v: string; cor: string }[] = [
  { v: "Frutas", cor: "#E5484D" },
  { v: "Caseirinhos", cor: "#C2410C" },
  { v: "Brownies", cor: "#78350F" },
  { v: "Copinhos", cor: "#DB2777" },
  { v: "Bolos Gelados", cor: "#0891B2" },
  { v: "Bolos de Potes", cor: "#7C3AED" },
  { v: "Congelados", cor: "#2563EB" },
  { v: "Tortas Acrílico Fatia", cor: "#9A7B0A" },
  { v: "Encomendas", cor: "#1B7F4D" },
];

/** Cor de cada local (agrupamento e filtro por loja nas listas de tarefas). Lojas novas ganham uma cor da paleta. */
const COR_LOCAL: Record<string, string> = {
  fabrica: "#955C6B", centro: "#2563EB", "santa-monica": "#0E8FB0", coqueiros: "#16A34A", areias: "#C98500", rocado: "#7C3AED", pagani: "#DB2777",
};
const PALETA_LOJAS = ["#0F766E", "#B45309", "#4F46E5", "#BE123C", "#15803D", "#0369A1", "#A21CAF", "#9A3412"];
export const corDoLocal = (id?: string) => {
  if (!id) return "#9398A6";
  if (COR_LOCAL[id]) return COR_LOCAL[id];
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA_LOJAS[h % PALETA_LOJAS.length];
};

/** A Fábrica é fixa (não é loja); as lojas vêm do cadastro único (Configurações → Lojas). */
export const FABRICA = { id: "fabrica", label: "Fábrica" };
/** Lojas da operação de antes do cadastro único — valem até o cadastro carregar (e no servidor sem banco). */
export const LOJAS_PADRAO: { id: string; label: string }[] = [
  { id: "centro", label: "Centro" },
  { id: "santa-monica", label: "Santa Mônica" },
  { id: "coqueiros", label: "Coqueiros" },
  { id: "areias", label: "Areias" },
  { id: "rocado", label: "Roçado" },
  { id: "pagani", label: "Pagani" },
];

/**
 * Locais com estoque próprio: a Fábrica e cada loja da operação, na ordem do cadastro.
 * É o MESMO array a vida toda (as telas importam a referência): `definirLojasOperacao` troca o conteúdo.
 */
export const LOCAIS_ESTOQUE: { id: string; label: string }[] = [FABRICA, ...LOJAS_PADRAO];
/** Nome de qualquer loja com código já vista (inclusive as que saíram da operação), para rótulos de histórico. */
const NOMES_LOJAS = new Map<string, string>(LOCAIS_ESTOQUE.map((l) => [l.id, l.label]));

/** Atualiza as lojas da operação a partir do cadastro (lojas com `codigo` e `operacao`, na ordem). */
export function definirLojasOperacao(lojas: { codigo?: string | null; nome: string; operacao?: boolean; ordem?: number }[]) {
  for (const l of lojas) if (l.codigo) NOMES_LOJAS.set(l.codigo, l.nome);
  const op = lojas
    .filter((l) => l.codigo && l.operacao && l.codigo !== FABRICA.id)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, "pt"))
    .map((l) => ({ id: l.codigo as string, label: l.nome }));
  LOCAIS_ESTOQUE.splice(0, LOCAIS_ESTOQUE.length, FABRICA, ...op);
}

/** Nome de um local pelo id (Fábrica, loja da operação ou loja que já saiu dela). */
export const nomeDoLocal = (id?: string | null): string => (id ? NOMES_LOJAS.get(id) ?? LOCAIS_ESTOQUE.find((l) => l.id === id)?.label ?? id : "");

/**
 * Objeto cru (jsonb/JSON) → quantidades válidas (inteiro ≥ 0): todos os locais da operação e também
 * qualquer outro local que já tenha saldo (loja que saiu da operação não perde o estoque ao salvar).
 */
export function parseQuantidades(raw: unknown): Record<string, number> {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, number> = {};
  for (const l of LOCAIS_ESTOQUE) {
    const n = Number(o[l.id]);
    out[l.id] = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }
  for (const [k, v] of Object.entries(o)) {
    if (k in out || !/^[a-z0-9-]{1,40}$/.test(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = Math.round(n);
  }
  return out;
}

export const qtdEm = (q: Record<string, number> | undefined, local: string): number => q?.[local] ?? 0;
export const totalProduto = (q: Record<string, number> | undefined): number => LOCAIS_ESTOQUE.reduce((s, l) => s + qtdEm(q, l.id), 0);

export const corDaCategoria = (c: string): string => CATEGORIAS_ESTOQUE.find((x) => x.v === c)?.cor ?? "#7A8090";

/** Texto digitado → quantidade válida (inteiro ≥ 0); null se não for número. */
export function parseQuantidade(v: string | number): number | null {
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  if (!Number.isFinite(n) || String(v).trim() === "") return null;
  return Math.max(0, Math.round(n));
}

/** Chave para detectar produto repetido (mesmo nome na mesma categoria, sem acento/caixa). */
export const chaveProduto = (nome: string, categoria: string): string =>
  `${categoria}|${nome}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
