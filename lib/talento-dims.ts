/**
 * Dimensões do Banco de Talentos (Recrutamento) — status, vagas e qualidade.
 * Mesmos nomes/cores da lista ClickUp "03 - Banco de Talentos". Compartilhado
 * entre a tela (BancoTalentos) e o modal (TalentoDetail) para não duplicar.
 */
export type TalentoOpt = { v: string; cor: string; label?: string };

/** Colunas do quadro, na ordem do funil de recrutamento. `key` = status cru do ClickUp. */
export const TALENTO_STATUS: { key: string; label: string; dot: string }[] = [
  { key: "novo", label: "Novo", dot: "#38BDF8" },
  { key: "banco de talentos", label: "Banco de Talentos", dot: "#F8AE00" },
  { key: "qualificado", label: "Qualificado", dot: "#16A34A" },
  { key: "reunião agendada", label: "Reunião agendada", dot: "#3DB88B" },
  { key: "desqualificado", label: "Desqualificado", dot: "#87909E" },
  { key: "contratado", label: "Contratado", dot: "#2563EB" },
  // "antigos" não vem do ClickUp — é um arquivo interno; oculto por padrão, como o desqualificado.
  { key: "antigos", label: "Antigos", dot: "#78716C" },
];

const STATUS_COR: Record<string, string> = Object.fromEntries(TALENTO_STATUS.map((s) => [s.key, s.dot]));

export const statusLabel = (key: string): string =>
  TALENTO_STATUS.find((s) => s.key === key)?.label ?? key;

/** { label, fg, bg } de um pill de status (bg = cor a ~10%). */
export const statusPill = (key: string) => {
  const cor = STATUS_COR[key] ?? "#9398A6";
  return { label: statusLabel(key), fg: cor, bg: `${cor}1A` };
};

/** Cor estável por texto (título da vaga) — mesma vaga, mesma cor, sem cadastro de cores. */
const PALETA = ["#9A7B0A", "#1366A8", "#DB2777", "#0891B2", "#7C3AED", "#15803D", "#C2410C", "#0E7490", "#B91C1C", "#6D28D9"];
export function corDeTexto(s?: string): string {
  if (!s) return "#9398A6";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

export const QUALIDADE_TALENTO: TalentoOpt[] = [
  { v: "Aguardando Análise", cor: "#ffc53d" },
  { v: "Ruim", cor: "#e50000" },
  { v: "Bom", cor: "#2ecd6f" },
  { v: "Ótimo", cor: "#0231E8" },
];
