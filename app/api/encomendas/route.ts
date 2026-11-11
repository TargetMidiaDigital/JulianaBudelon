import { NextResponse } from "next/server";
import { getSupabase, type SB } from "@/lib/supabase";
import { nivelNaTela, requireSession, type Sessao } from "@/lib/auth-admin";
import {
  colunasCategoria, colunasCompromisso, colunasProduto, lerTudo, mudarStatusPedido, statusLeadValido, statusPedidoValido, subirFotoSeNova, validarConfigServidor,
} from "@/lib/encomendas-server";
import type { Categoria, Compromisso, ConfigEncomendas, ProdutoEncomenda } from "@/lib/encomendas-base";
import type { ScreenPage } from "@/lib/types";

/**
 * Encomendas no painel (tabelas enc_*).
 *  - GET  → { categorias, produtos, config, leads, pedidos, compromissos }  (nível ≥ "ver" em alguma tela de Encomendas)
 *  - POST { acao, ... } → { ok }   cada ação exige "editar" na tela correspondente:
 *      Autoatendimento: produto, excluirProduto, categoria, excluirCategoria, ordemCategorias, config
 *      CRM (ou Contatos, para o contato): pedidoStatus, leadStatus, responsavel
 *      Agenda: compromisso, excluirCompromisso
 *  O status do pedido cria as tarefas (pagamento confirmado) e mexe no estoque (Entregue) — lib/encomendas-server.
 */
export const dynamic = "force-dynamic";

const PAGES: ScreenPage[] = ["encomendas-autoatendimento", "encomendas-crm", "encomendas-contatos", "encomendas-agenda"];
const DA_ACAO: Record<string, ScreenPage[]> = {
  produto: ["encomendas-autoatendimento"], excluirProduto: ["encomendas-autoatendimento"], categoria: ["encomendas-autoatendimento"],
  excluirCategoria: ["encomendas-autoatendimento"], ordemCategorias: ["encomendas-autoatendimento"], config: ["encomendas-autoatendimento"],
  pedidoStatus: ["encomendas-crm"], leadStatus: ["encomendas-crm", "encomendas-contatos"], responsavel: ["encomendas-crm", "encomendas-contatos"],
  compromisso: ["encomendas-agenda"], excluirCompromisso: ["encomendas-agenda"],
};

const erro = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
const ok = (extra: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...extra });

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return erro("Banco não configurado.", 503);
  const sess = await requireSession(req, sb);
  if (!sess.ok) return erro(sess.error, sess.status);
  const niveis = await Promise.all(PAGES.map((p) => nivelNaTela(sb, sess.cargo, p)));
  if (niveis.every((n) => n === "nenhum")) return erro("Sem acesso às Encomendas.", 403);
  try {
    return NextResponse.json(await lerTudo(sb));
  } catch (e) {
    return erro(e instanceof Error ? e.message : "Falha ao carregar.", 500);
  }
}

async function podeEditar(sb: SB, sess: Sessao, pages: ScreenPage[]) {
  for (const p of pages) if ((await nivelNaTela(sb, sess.cargo, p)) === "editar") return true;
  return false;
}

/** Próxima posição numa tabela com coluna `ordem` (registro novo vai para o fim). */
async function ordemDe(sb: SB, tabela: string, id: string): Promise<number> {
  const { data } = await sb.from(tabela).select("ordem").eq("id", id).maybeSingle();
  const atual = (data as { ordem?: number } | null)?.ordem;
  if (atual != null) return atual;
  const { count } = await sb.from(tabela).select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return erro("Banco não configurado.", 503);
  const sess = await requireSession(req, sb);
  if (!sess.ok) return erro(sess.error, sess.status);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown> & { acao?: string };
  const pages = DA_ACAO[b.acao ?? ""];
  if (!pages) return erro("Ação desconhecida.");
  if (!(await podeEditar(sb, sess, pages))) return erro("Sem permissão para editar nesta tela.", 403);
  const id = typeof b.id === "string" ? b.id : "";

  switch (b.acao) {
    case "produto": {
      const p = b.produto as ProdutoEncomenda;
      const cols = colunasProduto(p, await ordemDe(sb, "enc_produto", String(p?.id ?? "")));
      if (typeof cols === "string") return erro(cols);
      try { cols.foto = await subirFotoSeNova(sb, p.id, cols.foto as string | null); } catch (e) { return erro(e instanceof Error ? e.message : "Falha ao enviar a foto."); }
      const { error } = await sb.from("enc_produto").upsert(cols);
      return error ? erro(error.message, 500) : ok();
    }
    case "excluirProduto": {
      // Com pedidos, o produto só é desativado (os pedidos guardam o nome; o catálogo deixa de mostrar).
      const { count } = await sb.from("enc_pedido").select("id", { count: "exact", head: true }).eq("produto_id", id);
      const { error } = count ? await sb.from("enc_produto").update({ ativo: false }).eq("id", id) : await sb.from("enc_produto").delete().eq("id", id);
      return error ? erro(error.message, 500) : ok({ desativado: !!count });
    }
    case "categoria": {
      const c = b.categoria as Categoria;
      const cols = colunasCategoria(c, await ordemDe(sb, "enc_categoria", String(c?.id ?? "")));
      if (typeof cols === "string") return erro(cols);
      try { cols.foto = await subirFotoSeNova(sb, "categoria-" + c.id, cols.foto as string | null); } catch (e) { return erro(e instanceof Error ? e.message : "Falha ao enviar a foto."); }
      const { error } = await sb.from("enc_categoria").upsert(cols);
      return error ? erro(error.message, 500) : ok();
    }
    case "excluirCategoria": {
      const { error } = await sb.from("enc_categoria").delete().eq("id", id); // produtos ficam "Sem categoria" (on delete set null)
      return error ? erro(error.message, 500) : ok();
    }
    case "ordemCategorias": {
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x): x is string => typeof x === "string").slice(0, 200);
      for (const [i, cid] of ids.entries()) {
        const { error } = await sb.from("enc_categoria").update({ ordem: i }).eq("id", cid);
        if (error) return erro(error.message, 500);
      }
      return ok();
    }
    case "config": {
      const c = validarConfigServidor(b.config as ConfigEncomendas);
      if (typeof c === "string") return erro(c);
      const { error } = await sb.from("enc_config").upsert({ id: "geral", dados: c });
      return error ? erro(error.message, 500) : ok();
    }
    case "pedidoStatus": {
      if (!statusPedidoValido(b.status)) return erro("Status inválido.");
      const falha = await mudarStatusPedido(sb, id, b.status, sess.userId);
      return falha ? erro(falha, 500) : ok();
    }
    case "leadStatus": {
      if (!statusLeadValido(b.status)) return erro("Status inválido.");
      const { error } = await sb.from("enc_contato").update({ status: b.status }).eq("id", id);
      return error ? erro(error.message, 500) : ok();
    }
    case "responsavel": {
      if (b.responsavel !== "I.A" && b.responsavel !== "Humano") return erro("Responsável inválido.");
      const { error } = await sb.from("enc_contato").update({ responsavel: b.responsavel }).eq("id", id);
      return error ? erro(error.message, 500) : ok();
    }
    case "compromisso": {
      const cols = colunasCompromisso(b.compromisso as Compromisso);
      if (typeof cols === "string") return erro(cols);
      const { error } = await sb.from("enc_compromisso").upsert(cols);
      return error ? erro(error.message, 500) : ok();
    }
    case "excluirCompromisso": {
      const { error } = await sb.from("enc_compromisso").delete().eq("id", id);
      return error ? erro(error.message, 500) : ok();
    }
  }
  return erro("Ação desconhecida.");
}
