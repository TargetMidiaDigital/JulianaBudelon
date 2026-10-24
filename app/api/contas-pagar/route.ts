import { NextResponse } from "next/server";
import { getSupabase, type SB } from "@/lib/supabase";
import { nivelNaTela, requireEditor, requireSession } from "@/lib/auth-admin";
import { FORMAS, SITUACOES, ehPaga, type Comprovante, type Conta } from "@/lib/contas-pagar";

/**
 * Administrativo → Contas a Pagar (tabela `conta_pagar`; listas `cp_empresa` e `cp_plano`).
 *  - GET                      → { contas, empresas, planos, podeEditar }   (nível ≥ "ver")
 *  - POST   { contas }        → cria uma ou várias (parcelas)              (nível "editar")
 *  - PATCH  { id, patch }     → atualiza
 *  - DELETE { id }            → exclui (e apaga os comprovantes do bucket)
 * Fica fora do /api/bootstrap de propósito: dado financeiro só desce para quem tem acesso à tela.
 */
export const dynamic = "force-dynamic";
const PAGE = "contas-pagar" as const;
const BUCKET = "contas-pagar";

type Row = {
  id: string; descricao: string; plano: string; empresa: string; forma: string; vencimento: string; valor: number | string;
  situacao: string; valor_pago: number | string | null; data_pagamento: string | null; obs: string | null; codigo_barras: string | null;
  comprovantes: Comprovante[] | null; grupo: string | null; parcela: number | null; parcelas: number | null;
};

const paraConta = (r: Row): Conta => ({
  id: r.id, descricao: r.descricao, plano: r.plano, empresa: r.empresa, forma: r.forma as Conta["forma"], vencimento: r.vencimento,
  valor: Number(r.valor), situacao: r.situacao as Conta["situacao"],
  valorPago: r.valor_pago != null ? Number(r.valor_pago) : undefined, dataPagamento: r.data_pagamento ?? undefined,
  obs: r.obs ?? undefined, codigoBarras: r.codigo_barras ?? undefined, comprovantes: Array.isArray(r.comprovantes) ? r.comprovantes : [],
  grupo: r.grupo ?? undefined, parcela: r.parcela ?? undefined, parcelas: r.parcelas ?? undefined,
});

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Valida e converte para colunas. Devolve string = mensagem de erro. */
function colunas(p: Partial<Conta>, criando: boolean): Record<string, unknown> | string {
  const c: Record<string, unknown> = {};
  if (criando || "descricao" in p) { const d = txt(p.descricao); if (!d) return "Informe a descrição."; c.descricao = d.slice(0, 300); }
  if (criando || "plano" in p) { const v = txt(p.plano); if (!v) return "Informe o plano de contas."; c.plano = v; }
  if (criando || "empresa" in p) { const v = txt(p.empresa); if (!v) return "Informe a empresa."; c.empresa = v; }
  if (criando || "forma" in p) { if (!FORMAS.includes(p.forma as Conta["forma"])) return "Forma de pagamento inválida."; c.forma = p.forma; }
  if (criando || "vencimento" in p) { if (!DATA.test(p.vencimento ?? "")) return "Vencimento inválido."; c.vencimento = p.vencimento; }
  if (criando || "valor" in p) { const v = Number(p.valor); if (!(v > 0)) return "Informe o valor original."; c.valor = Math.round(v * 100) / 100; }
  if (criando || "situacao" in p) { if (!SITUACOES.some((s) => s.key === p.situacao)) return "Situação inválida."; c.situacao = p.situacao; }
  if ("valorPago" in p) c.valor_pago = p.valorPago != null && Number(p.valorPago) > 0 ? Math.round(Number(p.valorPago) * 100) / 100 : null;
  if ("dataPagamento" in p) { if (p.dataPagamento && !DATA.test(p.dataPagamento)) return "Data de pagamento inválida."; c.data_pagamento = p.dataPagamento || null; }
  if ("obs" in p) c.obs = txt(p.obs);
  if ("codigoBarras" in p) c.codigo_barras = txt(p.codigoBarras);
  if ("comprovantes" in p) c.comprovantes = (Array.isArray(p.comprovantes) ? p.comprovantes : []).filter((x) => x && typeof x.path === "string").slice(0, 30);
  if ("grupo" in p) c.grupo = txt(p.grupo);
  if ("parcela" in p) c.parcela = p.parcela ?? null;
  if ("parcelas" in p) c.parcelas = p.parcelas ?? null;
  // Em aberto não guarda pagamento.
  if (typeof c.situacao === "string" && !ehPaga(c.situacao as Conta["situacao"])) { c.valor_pago = null; c.data_pagamento = null; }
  return c;
}

async function listas(sb: SB) {
  const [e, p] = await Promise.all([
    sb.from("cp_empresa").select("id, nome, cnpj").eq("ativo", true).order("ordem").order("nome"),
    sb.from("cp_plano").select("id, nome").eq("ativo", true).order("ordem").order("nome"),
  ]);
  return { empresas: e.data ?? [], planos: p.data ?? [], erro: e.error?.message ?? p.error?.message };
}

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const sess = await requireSession(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const nivel = await nivelNaTela(sb, sess.cargo, PAGE);
  if (nivel === "nenhum") return NextResponse.json({ error: "Sem acesso a Contas a Pagar." }, { status: 403 });

  // Paginado (PostgREST devolve no máx. 1000 linhas por chamada).
  const contas: Conta[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from("conta_pagar").select("*").order("vencimento").order("descricao").range(de, de + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    contas.push(...(data as Row[]).map(paraConta));
    if ((data?.length ?? 0) < 1000) break;
  }
  const l = await listas(sb);
  if (l.erro) return NextResponse.json({ error: l.erro }, { status: 500 });
  return NextResponse.json({ contas, empresas: l.empresas, planos: l.planos, podeEditar: nivel === "editar" });
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const sess = await requireEditor(req, sb, PAGE);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { contas } = (await req.json().catch(() => ({}))) as { contas?: Conta[] };
  if (!Array.isArray(contas) || contas.length === 0 || contas.length > 120) return NextResponse.json({ error: "Nada para lançar." }, { status: 400 });
  const rows: Record<string, unknown>[] = [];
  for (const c of contas) {
    if (!c?.id || typeof c.id !== "string") return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
    const cols = colunas({ ...c, valorPago: c.valorPago, dataPagamento: c.dataPagamento, obs: c.obs, codigoBarras: c.codigoBarras, comprovantes: c.comprovantes ?? [] }, true);
    if (typeof cols === "string") return NextResponse.json({ error: cols }, { status: 400 });
    rows.push({ id: c.id, ...cols, criado_por: sess.userId });
  }
  const { error } = await sb.from("conta_pagar").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const sess = await requireEditor(req, sb, PAGE);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<Conta> };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const cols = colunas(patch ?? {}, false);
  if (typeof cols === "string") return NextResponse.json({ error: cols }, { status: 400 });
  if (Object.keys(cols).length === 0) return NextResponse.json({ ok: true });
  const antes = "comprovantes" in cols ? (await sb.from("conta_pagar").select("comprovantes").eq("id", id).maybeSingle()).data as { comprovantes?: Comprovante[] } | null : null;
  const { error } = await sb.from("conta_pagar").update(cols).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Comprovante tirado da conta → apaga o arquivo do bucket.
  if (antes) {
    const ficam = new Set((cols.comprovantes as Comprovante[]).map((c) => c.path));
    const sairam = (antes.comprovantes ?? []).map((c) => c.path).filter((p) => p && !ficam.has(p));
    if (sairam.length) await sb.storage.from(BUCKET).remove(sairam);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const sess = await requireEditor(req, sb, PAGE);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const { data } = await sb.from("conta_pagar").select("comprovantes").eq("id", id).maybeSingle();
  const { error } = await sb.from("conta_pagar").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const paths = ((data as { comprovantes?: Comprovante[] } | null)?.comprovantes ?? []).map((c) => c.path).filter(Boolean);
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
  return NextResponse.json({ ok: true });
}
