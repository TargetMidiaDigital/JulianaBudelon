/**
 * Recorrência de tarefas (estilo ClickUp). Funções puras de data, usadas pelo
 * formulário (prévia) e pelo store (gerar a próxima ocorrência ao abrir o app).
 */

export type Frequencia = "diaria" | "semanal" | "mensal";
type Regra = { frequencia: Frequencia | string; dia_semana: number | null; dia_mes: number | null };

const pad = (n: number) => String(n).padStart(2, "0");

/** Hoje no fuso de Brasília, como "YYYY-MM-DD". */
export function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** "YYYY-MM-DD" + N dias (aritmética de calendário, sem drift de fuso). */
export function addDias(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Dia da semana de "YYYY-MM-DD" (0 = domingo … 6 = sábado), sem drift de fuso. */
export function diaSemanaDe(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function ultimoDiaMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function dataDoDiaMes(y: number, m: number, dia: number): string {
  return `${y}-${pad(m)}-${pad(Math.min(dia, ultimoDiaMes(y, m)))}`;
}

/** Próxima ocorrência ESTRITAMENTE depois de `apos` (YYYY-MM-DD), pela regra. */
export function proximaApos(apos: string, r: Regra): string {
  if (r.frequencia === "diaria") return addDias(apos, 1);
  if (r.frequencia === "semanal") {
    const alvo = (((r.dia_semana ?? diaSemanaDe(apos)) % 7) + 7) % 7;
    const delta = ((alvo - diaSemanaDe(apos) + 7) % 7) || 7; // 0 vira 7 (estritamente depois)
    return addDias(apos, delta);
  }
  const [y, m] = apos.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return dataDoDiaMes(ny, nm, r.dia_mes ?? Number(apos.split("-")[2]));
}

/** Primeira ocorrência >= `desde` (inclusive), pela regra. */
export function primeiraOcorrencia(desde: string, r: Regra): string {
  if (r.frequencia === "diaria") return desde;
  if (r.frequencia === "semanal") {
    const alvo = (((r.dia_semana ?? diaSemanaDe(desde)) % 7) + 7) % 7;
    return addDias(desde, (alvo - diaSemanaDe(desde) + 7) % 7);
  }
  const [y, m] = desde.split("-").map(Number);
  const cand = dataDoDiaMes(y, m, r.dia_mes ?? Number(desde.split("-")[2]));
  if (cand >= desde) return cand;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return dataDoDiaMes(ny, nm, r.dia_mes ?? Number(desde.split("-")[2]));
}

/** "YYYY-MM-DD" → "dd/mm/yyyy". */
export function isoParaBR(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? "");
}
