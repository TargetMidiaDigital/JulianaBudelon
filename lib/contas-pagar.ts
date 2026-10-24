/**
 * Administrativo → Contas a Pagar: tipos e regras compartilhados entre a tela e a rota
 * /api/contas-pagar (tabelas `conta_pagar`, `cp_empresa`, `cp_plano`; migration 0023).
 * Contas por empresa/CNPJ, plano de contas, forma de pagamento, parcelas, situação,
 * comprovantes (bucket privado `contas-pagar`) e código de barras.
 */

export type FormaPagamento = "Boleto" | "PIX" | "Débito automático" | "Cartão de crédito" | "Transferência";
export type Situacao = "a pagar" | "pago" | "pago c/ comprovante" | "qr code / pix" | "pago no débito" | "pago no crédito";

export type Conta = {
  id: string;
  descricao: string;
  plano: string; // plano de contas
  empresa: string; // empresa/CNPJ
  forma: FormaPagamento;
  vencimento: string; // YYYY-MM-DD
  valor: number; // valor original
  situacao: Situacao;
  valorPago?: number; // com juros/multa, se houver
  dataPagamento?: string; // YYYY-MM-DD
  obs?: string;
  codigoBarras?: string;
  comprovantes: Comprovante[];
  grupo?: string; // parcelas do mesmo lançamento
  parcela?: number;
  parcelas?: number;
};

export type Comprovante = { path: string; nome: string; mime?: string; tamanho?: number; em?: string; autor?: string };
export type ItemLista = { id: string; nome: string; cnpj?: string | null };

/** Link autenticado (cookie de sessão) para abrir um comprovante. */
export const urlComprovante = (c: Comprovante, baixar = false) => `/api/contas-pagar/comprovante?path=${encodeURIComponent(c.path)}${baixar ? "&dl=1" : ""}`;

export const FORMAS: FormaPagamento[] = ["Boleto", "PIX", "Débito automático", "Cartão de crédito", "Transferência"];
export const SITUACOES: { key: Situacao; label: string }[] = [
  { key: "a pagar", label: "A pagar" },
  { key: "pago", label: "Pago" },
  { key: "pago c/ comprovante", label: "Pago c/ comprovante" },
  { key: "qr code / pix", label: "QR Code / PIX" },
  { key: "pago no débito", label: "Pago no débito" },
  { key: "pago no crédito", label: "Pago no crédito" },
];
export const ehPaga = (s: Situacao) => s === "pago" || s === "pago c/ comprovante" || s === "pago no débito" || s === "pago no crédito";
export const situacaoLabel = (s: Situacao) => SITUACOES.find((x) => x.key === s)?.label ?? s;

// ── datas ──
const pad = (n: number) => String(n).padStart(2, "0");
export const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hojeISO = () => isoDe(new Date());
export const brDe = (iso?: string) => (iso ? iso.split("-").reverse().join("/") : "—");
export const diasEntre = (de: string, ate: string) => Math.round((new Date(ate + "T12:00:00").getTime() - new Date(de + "T12:00:00").getTime()) / 86400000);
export const addDias = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoDe(d); };
export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const mesDe = (iso: string) => iso.slice(0, 7); // "2026-10"
export const nomeMes = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${MESES[m - 1]} de ${y}`; };
export const somaMes = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Situação exibida na lista: paga, ou em aberto com o prazo (vencida há N dias / vence hoje / em N dias). */
export function statusDaConta(c: Conta, hoje = hojeISO()): { label: string; tipo: "pago" | "vencida" | "hoje" | "breve" | "aberto"; dias: number } {
  if (ehPaga(c.situacao)) return { label: "Pago", tipo: "pago", dias: 0 };
  const d = diasEntre(hoje, c.vencimento);
  if (d < 0) return { label: `Vencida · ${-d}d`, tipo: "vencida", dias: -d };
  if (d === 0) return { label: "Vence hoje", tipo: "hoje", dias: 0 };
  if (d <= 7) return { label: `Vence em ${d}d`, tipo: "breve", dias: d };
  return { label: c.situacao === "qr code / pix" ? "A pagar · PIX" : "A pagar", tipo: "aberto", dias: d };
}

/** Valor efetivamente pago (com juros), ou o original se ainda não foi pago. */
export const valorEfetivo = (c: Conta) => (ehPaga(c.situacao) ? c.valorPago ?? c.valor : c.valor);
