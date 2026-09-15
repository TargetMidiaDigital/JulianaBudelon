/** Formatação de números, telefones e datas (pt-BR). */

export function brl(v: number | null | undefined): string {
  if (v == null) return "—";
  return "R$ " + v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Telefone/WhatsApp → só dígitos (remove +, máscara e sufixo "@s.whatsapp.net"). */
export function normalizePhone(v: string | null | undefined): string {
  return (v ?? "").replace(/@.*$/, "").replace(/\D/g, "");
}

/**
 * Qualquer coisa que o usuário digitou → formato canônico 55 + DDD + 9 dígitos.
 * Se não parecer um telefone brasileiro, devolve os dígitos como vieram.
 */
export function normalizarWhatsapp(v: string | null | undefined): string {
  let d = normalizePhone(v);
  if (!d) return "";
  if (d.startsWith("55")) d = d.slice(2);
  if (d.length === 10) d = d.slice(0, 2) + "9" + d.slice(2);
  if (d.length !== 11) return normalizePhone(v);
  return "55" + d;
}

/** Canônico → máscara de exibição: "5548998071211" → "(48) 99807-1211". */
export function foneBR(v: string | null | undefined): string {
  const d = normalizePhone(v);
  const s = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return (v ?? "").trim();
}

export function slug(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Default time used for due dates that have no time set. */
export const DEFAULT_DUE_TIME = "18:00";

/** Date → "dd/mm/yyyy". */
export function formatBR(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Whether two dates fall on the same calendar day. */
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Parse "dd/mm/yyyy" → Date (local). */
export function parseBR(d: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

/** Hoje (só o dia) — referência para prazos. Os dados de exemplo são gerados em relação a esta data. */
export const TODAY = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();

/** "dd/mm/yyyy" de hoje + N dias (N pode ser negativo). */
export function diasAPartirDeHoje(n: number): string {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + n);
  return formatBR(d);
}

export function daysUntil(d: string, ref: Date = TODAY): number | null {
  const date = parseBR(d);
  if (!date) return null;
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const b = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** Human relative deadline label, e.g. "Atrasada 2d", "Hoje", "em 3 dias". */
export function prazoLabel(d: string, ref: Date = TODAY): string {
  const n = daysUntil(d, ref);
  if (n == null) return "—";
  if (n < 0) return `Atrasada ${Math.abs(n)}d`;
  if (n === 0) return "Hoje";
  if (n === 1) return "Amanhã";
  return `em ${n} dias`;
}

export function shortDate(d: string): string {
  const date = parseBR(d);
  if (!date) return d;
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** Data/hora atuais no fuso de Brasília, no formato exibido nas tarefas (dd/mm/yyyy + hh:mm). */
export function fmtNowBR(): { date: string; hora: string } {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${g("day")}/${g("month")}/${g("year")}`, hora: `${g("hour")}:${g("minute")}` };
}
