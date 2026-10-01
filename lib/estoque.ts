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

/** Locais com estoque próprio: a fábrica e cada loja (colunas da planilha de reposição). */
export const LOCAIS_ESTOQUE: { id: string; label: string }[] = [
  { id: "fabrica", label: "Fábrica" },
  { id: "centro", label: "Centro" },
  { id: "santa-monica", label: "Santa Mônica" },
  { id: "coqueiros", label: "Coqueiros" },
  { id: "areias", label: "Areias" },
  { id: "rocado", label: "Roçado" },
  { id: "pagani", label: "Pagani" },
];

/** Objeto cru (jsonb/JSON) → quantidades válidas só dos locais conhecidos (inteiro ≥ 0). */
export function parseQuantidades(raw: unknown): Record<string, number> {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, number> = {};
  for (const l of LOCAIS_ESTOQUE) {
    const n = Number(o[l.id]);
    out[l.id] = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
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
