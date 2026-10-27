import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireEditor } from "@/lib/auth-admin";

/**
 * Listas de Contas a Pagar: cadastra empresa (`cp_empresa`) ou plano de contas (`cp_plano`)
 * direto do formulário da conta.
 *  - POST   { tipo: "empresa" | "plano", nome, cnpj? } → { item }   (nível "editar")
 *  - PATCH  { tipo, id, nome } → renomeia e atualiza as contas que usavam o nome antigo
 *  - DELETE { tipo, id }       → tira da lista (ativo = false); as contas já lançadas
 *                                continuam com o nome, só não aparece mais para escolher
 */
export const dynamic = "force-dynamic";

const tabelaDe = (tipo?: string) => (tipo === "empresa" ? "cp_empresa" : tipo === "plano" ? "cp_plano" : null);
const colunaDe = (tipo: string) => (tipo === "empresa" ? "empresa" : "plano");

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const sess = await requireEditor(req, sb, "contas-pagar");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { tipo, nome, cnpj } = (await req.json().catch(() => ({}))) as { tipo?: string; nome?: string; cnpj?: string };
  const tabela = tabelaDe(tipo);
  const n = (nome ?? "").trim().toUpperCase().slice(0, 80);
  if (!tabela || !n || !slug(n)) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  const { data: existe } = await sb.from(tabela).select("id, nome, ativo").ilike("nome", n).maybeSingle();
  if (existe) {
    if (!(existe as { ativo: boolean }).ativo) await sb.from(tabela).update({ ativo: true }).eq("id", (existe as { id: string }).id);
    return NextResponse.json({ item: { id: (existe as { id: string }).id, nome: (existe as { nome: string }).nome } });
  }
  const { data: ult } = await sb.from(tabela).select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
  const item = { id: `${slug(n)}-${Date.now().toString(36)}`, nome: n, ordem: ((ult as { ordem?: number } | null)?.ordem ?? 0) + 1, ...(tabela === "cp_empresa" && cnpj?.trim() ? { cnpj: cnpj.trim() } : {}) };
  const { error } = await sb.from(tabela).insert(item);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: { id: item.id, nome: item.nome } });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const sess = await requireEditor(req, sb, "contas-pagar");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { tipo, id, nome } = (await req.json().catch(() => ({}))) as { tipo?: string; id?: string; nome?: string };
  const tabela = tabelaDe(tipo);
  const n = (nome ?? "").trim().toUpperCase().slice(0, 80);
  if (!tabela || !id || !n) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  const { data: atual } = await sb.from(tabela).select("nome").eq("id", id).maybeSingle();
  const antigo = (atual as { nome?: string } | null)?.nome;
  if (!antigo) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  if (antigo === n) return NextResponse.json({ item: { id, nome: n }, contas: 0 });
  const { data: dup } = await sb.from(tabela).select("id").ilike("nome", n).neq("id", id).maybeSingle();
  if (dup) return NextResponse.json({ error: `Já existe “${n}” na lista.` }, { status: 409 });
  const { error } = await sb.from(tabela).update({ nome: n }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // As contas guardam o nome: troca nas que usavam o antigo.
  const { data: mudadas, error: e2 } = await sb.from("conta_pagar").update({ [colunaDe(tipo!)]: n }).eq(colunaDe(tipo!), antigo).select("id");
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  return NextResponse.json({ item: { id, nome: n }, contas: mudadas?.length ?? 0 });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const sess = await requireEditor(req, sb, "contas-pagar");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { tipo, id } = (await req.json().catch(() => ({}))) as { tipo?: string; id?: string };
  const tabela = tabelaDe(tipo);
  if (!tabela || !id) return NextResponse.json({ error: "Item inválido." }, { status: 400 });
  const { error } = await sb.from(tabela).update({ ativo: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
