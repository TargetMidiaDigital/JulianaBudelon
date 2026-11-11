import type { SupabaseClient } from "@supabase/supabase-js";
import { parseComentarios, toISO } from "./data";
import { LOCAIS_ESTOQUE, parseQuantidades } from "./estoque";
import { parseConferencia } from "./conferencia";
import { fmtNowBR } from "./format";
import {
  CONFIG_PADRAO, CORES_DESTAQUE, LEAD_STATUS, PEDIDO_STATUS, VITRINE_PADRAO, categoriaAtiva, confirmaPagamento, efeitoEstoque, localDaUnidade, tarefasDaEncomenda, validarConfig, validarNovoPedido, vitrineDe,
  type Categoria, type Compromisso, type ConfigEncomendas, type Lead, type NovoPedido, type PedidoEncomenda, type PedidoStatus, type ProdutoEncomenda, type Vitrine,
} from "./encomendas-base";
import type { Task } from "./types";

/**
 * Encomendas no banco (tabelas enc_*, migration 0025). Só o servidor (service role) mexe aqui;
 * as rotas /api/encomendas e /api/encomendas/publico fazem a autorização.
 */

type SB = SupabaseClient;

// ── Linhas do banco → tipos do app ──────────────────────────────────────────

type RowCategoria = { id: string; nome: string; ordem: number; descricao: string | null; foto: string | null; ativa: boolean; destaque: boolean };
type RowProduto = {
  id: string; nome: string; categoria_id: string | null; preco: number | string; porcoes: string; peso: string; descricao: string | null;
  camadas: unknown; foto: string | null; ativo: boolean; produto_estoque_id: string | null; ordem: number;
};
type RowContato = { id: string; numero: string; nome: string; status: string; responsavel: string; resumo: string | null; criado_em: string; ultimo_contato: string };
type RowPedido = {
  id: string; contato_id: string; produto_id: string | null; produto_nome: string | null; quantidade: number; mensagem: string | null; tipo: string;
  unidade_id: string | null; unidade_nome: string | null; endereco: unknown; data: string; hora: string; subtotal: number | string; taxa: number | string;
  total: number | string; status: string; origem: string; tarefas_criadas: boolean; estoque_baixado: boolean; criado_em: string;
};
type RowCompromisso = { id: string; titulo: string; data: string; hora: string; hora_fim: string; contato: string | null; notas: string | null };

const paraProduto = (r: RowProduto): ProdutoEncomenda => ({
  id: r.id, nome: r.nome, categoriaId: r.categoria_id, preco: Number(r.preco), porcoes: r.porcoes ?? "", peso: r.peso ?? "",
  descricao: r.descricao ?? undefined, camadas: Array.isArray(r.camadas) ? (r.camadas as unknown[]).map(String) : [], foto: r.foto, ativo: r.ativo,
  produtoEstoqueId: r.produto_estoque_id,
});
const paraLead = (r: RowContato): Lead => ({
  id: r.id, numero: r.numero, nome: r.nome, status: r.status as Lead["status"], responsavel: r.responsavel as Lead["responsavel"],
  criadoEm: r.criado_em, ultimoContato: r.ultimo_contato, resumo: r.resumo ?? undefined,
});
const paraPedido = (r: RowPedido): PedidoEncomenda => ({
  id: r.id, leadId: r.contato_id, produtoId: r.produto_id ?? "", produtoNome: r.produto_nome ?? undefined, quantidade: r.quantidade,
  mensagem: r.mensagem ?? undefined, tipo: r.tipo as PedidoEncomenda["tipo"], unidadeId: r.unidade_id ?? undefined, unidadeNome: r.unidade_nome ?? undefined,
  endereco: (r.endereco as PedidoEncomenda["endereco"]) ?? undefined, data: r.data, hora: r.hora, subtotal: Number(r.subtotal), taxa: Number(r.taxa),
  total: Number(r.total), status: r.status as PedidoStatus, criadoEm: r.criado_em, origem: r.origem as PedidoEncomenda["origem"],
  tarefasCriadas: r.tarefas_criadas, estoqueBaixado: r.estoque_baixado,
});
const paraCompromisso = (r: RowCompromisso): Compromisso => ({
  id: r.id, titulo: r.titulo, data: r.data, hora: r.hora, horaFim: r.hora_fim, contato: r.contato ?? undefined, notas: r.notas ?? undefined,
});

/** Configuração salva (com os padrões para campos que ainda não existiam). */
export async function lerConfig(sb: SB): Promise<ConfigEncomendas> {
  const { data } = await sb.from("enc_config").select("dados").eq("id", "geral").maybeSingle();
  const dados = (data as { dados?: Partial<ConfigEncomendas> } | null)?.dados ?? {};
  return { ...CONFIG_PADRAO, ...dados, janelas: { ...CONFIG_PADRAO.janelas, ...(dados.janelas ?? {}) }, vitrine: vitrineDe(dados) };
}

/** Catálogo (categorias na ordem + produtos). `soAtivos` = página pública. */
export async function lerCatalogo(sb: SB, soAtivos: boolean): Promise<{ categorias: Categoria[]; produtos: ProdutoEncomenda[] }> {
  let qp = sb.from("enc_produto").select("*").order("ordem").order("nome");
  if (soAtivos) qp = qp.eq("ativo", true);
  const [c, p] = await Promise.all([sb.from("enc_categoria").select("id, nome, ordem, descricao, foto, ativa, destaque").order("ordem").order("nome"), qp]);
  if (c.error) throw new Error(c.error.message);
  if (p.error) throw new Error(p.error.message);
  const categorias: Categoria[] = (c.data as RowCategoria[]).map((r) => ({ id: r.id, nome: r.nome, descricao: r.descricao ?? undefined, foto: r.foto, ativa: r.ativa, destaque: r.destaque }));
  const produtos = (p.data as RowProduto[]).map(paraProduto);
  if (!soAtivos) return { categorias, produtos };
  // Página pública: categoria oculta some com os produtos dela (e o pedido deles é recusado),
  // e o cliente não precisa saber qual item do estoque cada produto movimenta.
  const ocultas = new Set(categorias.filter((x) => !categoriaAtiva(x)).map((x) => x.id));
  return {
    categorias: categorias.filter(categoriaAtiva),
    produtos: produtos.filter((x) => !(x.categoriaId && ocultas.has(x.categoriaId))).map((x) => ({ ...x, produtoEstoqueId: undefined })),
  };
}

/** Lê todas as linhas (PostgREST devolve no máximo 1000 por chamada). */
async function todas<T>(sb: SB, tabela: string, ordem: string): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select("*").order(ordem).range(de, de + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

/** Tudo o que o painel usa (Autoatendimento, CRM, Contatos, Agenda). */
export async function lerTudo(sb: SB) {
  const [catalogo, config, contatos, pedidos, compromissos] = await Promise.all([
    lerCatalogo(sb, false), lerConfig(sb),
    todas<RowContato>(sb, "enc_contato", "criado_em"), todas<RowPedido>(sb, "enc_pedido", "criado_em"), todas<RowCompromisso>(sb, "enc_compromisso", "data"),
  ]);
  return { ...catalogo, config, leads: contatos.map(paraLead), pedidos: pedidos.map(paraPedido), compromissos: compromissos.map(paraCompromisso) };
}

// ── Validação das gravações do painel ───────────────────────────────────────

const txt = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const DATA = /^\d{4}-\d{2}-\d{2}$/, HORA = /^\d{2}:\d{2}$/;
const idValido = (v: unknown) => typeof v === "string" && /^[\w-]{1,80}$/.test(v);

export function colunasProduto(p: ProdutoEncomenda, ordem: number): Record<string, unknown> | string {
  if (!idValido(p?.id)) return "Produto inválido.";
  const nome = txt(p.nome, 120);
  if (nome.length < 2) return "Informe o nome do produto.";
  const preco = Number(p.preco);
  if (!(preco >= 0) || preco > 100000) return "Preço inválido.";
  return {
    id: p.id, nome, categoria_id: p.categoriaId && idValido(p.categoriaId) ? p.categoriaId : null, preco: Math.round(preco * 100) / 100,
    porcoes: txt(p.porcoes, 60), peso: txt(p.peso, 40), descricao: txt(p.descricao, 1000) || null,
    camadas: (Array.isArray(p.camadas) ? p.camadas : []).map((c) => txt(c, 120)).filter(Boolean).slice(0, 30),
    foto: typeof p.foto === "string" && p.foto ? p.foto.slice(0, 2000) : null, ativo: p.ativo !== false,
    produto_estoque_id: p.produtoEstoqueId && idValido(p.produtoEstoqueId) ? p.produtoEstoqueId : null, ordem,
  };
}

export function validarConfigServidor(c: ConfigEncomendas): ConfigEncomendas | string {
  if (!c || typeof c !== "object") return "Configuração inválida.";
  const limpa: ConfigEncomendas = {
    ...CONFIG_PADRAO, ...c,
    unidades: (Array.isArray(c.unidades) ? c.unidades : []).slice(0, 50).map((u) => ({ id: idValido(u.id) ? u.id : crypto.randomUUID(), nome: txt(u.nome, 80), endereco: txt(u.endereco, 200), ativo: u.ativo !== false })),
    vitrine: limparVitrine(c.vitrine),
    pixChave: txt(c.pixChave, 120), pixNome: txt(c.pixNome, 25), pixCidade: txt(c.pixCidade, 15), whatsappContato: String(c.whatsappContato ?? "").replace(/\D/g, "").slice(0, 15),
  };
  return validarConfig(limpa) ?? limpa;
}

function limparVitrine(v: Partial<Vitrine> | undefined): Vitrine {
  const b = vitrineDe({ vitrine: v as Vitrine });
  return {
    titulo: txt(b.titulo, 80) || VITRINE_PADRAO.titulo, subtitulo: txt(b.subtitulo, 160),
    destaqueAtivo: b.destaqueAtivo !== false, destaqueTitulo: txt(b.destaqueTitulo, 60), destaqueTexto: txt(b.destaqueTexto, 200),
    destaqueCor: CORES_DESTAQUE.some((x) => x.key === b.destaqueCor) ? b.destaqueCor : VITRINE_PADRAO.destaqueCor,
    mostrarPreco: b.mostrarPreco !== false, mostrarQuantidade: b.mostrarQuantidade !== false,
  };
}

/** Categoria do painel → colunas (a foto em data URL é enviada à parte). */
export function colunasCategoria(c: Categoria, ordem: number): Record<string, unknown> | string {
  if (!idValido(c?.id)) return "Categoria inválida.";
  const nome = txt(c.nome, 80);
  if (!nome) return "Informe o nome da categoria.";
  return { id: c.id, nome, ordem, descricao: txt(c.descricao, 120) || null, foto: typeof c.foto === "string" && c.foto ? c.foto.slice(0, 2000) : null, ativa: c.ativa !== false, destaque: c.destaque === true };
}

export function colunasCompromisso(c: Compromisso): Record<string, unknown> | string {
  if (!idValido(c?.id)) return "Compromisso inválido.";
  const titulo = txt(c.titulo, 160);
  if (!titulo) return "Informe o título.";
  if (!DATA.test(c.data ?? "") || !HORA.test(c.hora ?? "") || !HORA.test(c.horaFim ?? "")) return "Data ou horário inválido.";
  return { id: c.id, titulo, data: c.data, hora: c.hora, hora_fim: c.horaFim, contato: txt(c.contato, 120) || null, notas: txt(c.notas, 1000) || null };
}

export const statusLeadValido = (s: unknown) => LEAD_STATUS.some((x) => x.key === s);
export const statusPedidoValido = (s: unknown): s is PedidoStatus => PEDIDO_STATUS.some((x) => x.key === s);

/** Foto nova enviada como data URL → bucket público `avatars` (encomendas/<id>.jpg); devolve a URL. */
export async function subirFotoSeNova(sb: SB, produtoId: string, foto: string | null): Promise<string | null> {
  if (!foto || !foto.startsWith("data:")) return foto;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(foto);
  if (!m) throw new Error("Foto inválida.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 2 * 1024 * 1024) throw new Error("Foto acima de 2 MB.");
  const ext = m[1] === "image/png" ? "png" : m[1] === "image/webp" ? "webp" : "jpg";
  const path = `encomendas/${produtoId}.${ext}`;
  const up = await sb.storage.from("avatars").upload(path, buf, { contentType: m[1], upsert: true, cacheControl: "31536000" });
  if (up.error) throw new Error(up.error.message);
  return `${sb.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}

// ── Pedido da página pública ─────────────────────────────────────────────────

/** Valida no servidor (preço, loja, horário, antecedência), acha/cria o contato e grava o pedido. */
export async function criarPedidoPublico(sb: SB, n: NovoPedido): Promise<{ pedido: PedidoEncomenda } | { erro: string }> {
  const [{ produtos }, cfg] = await Promise.all([lerCatalogo(sb, true), lerConfig(sb)]);
  const v = validarNovoPedido(n, produtos, cfg);
  if ("erro" in v) return v;
  const agora = new Date().toISOString();
  const { data: existente } = await sb.from("enc_contato").select("id, nome").eq("numero", v.numero).maybeSingle();
  let contatoId = (existente as { id?: string } | null)?.id;
  if (contatoId) {
    await sb.from("enc_contato").update({ nome: v.nome, status: "Venda", ultimo_contato: agora, resumo: v.resumo }).eq("id", contatoId);
  } else {
    contatoId = crypto.randomUUID();
    const ins = await sb.from("enc_contato").insert({ id: contatoId, numero: v.numero, nome: v.nome, status: "Venda", responsavel: "I.A", resumo: v.resumo, criado_em: agora, ultimo_contato: agora });
    if (ins.error) {
      // Corrida: o mesmo WhatsApp criou o contato agora → usa o que ficou.
      const { data: d2 } = await sb.from("enc_contato").select("id").eq("numero", v.numero).maybeSingle();
      contatoId = (d2 as { id?: string } | null)?.id;
      if (!contatoId) return { erro: "Não foi possível registrar o pedido. Tente de novo." };
    }
  }
  const pedido: PedidoEncomenda = {
    id: crypto.randomUUID(), leadId: contatoId, produtoId: v.produto.id, produtoNome: v.produto.nome, quantidade: v.quantidade, mensagem: v.mensagem,
    tipo: n.tipo, unidadeId: v.unidade?.id, unidadeNome: v.unidade?.nome, endereco: n.tipo === "Entrega" ? n.endereco : undefined, data: n.data, hora: n.hora,
    subtotal: v.subtotal, taxa: v.taxa, total: v.total, status: "Verificar pagamento", criadoEm: agora, origem: "autoatendimento",
  };
  const { error } = await sb.from("enc_pedido").insert({
    id: pedido.id, contato_id: contatoId, produto_id: pedido.produtoId, produto_nome: pedido.produtoNome, quantidade: pedido.quantidade, mensagem: pedido.mensagem ?? null,
    tipo: pedido.tipo, unidade_id: pedido.unidadeId ?? null, unidade_nome: pedido.unidadeNome ?? null, endereco: pedido.endereco ?? null, data: pedido.data, hora: pedido.hora,
    subtotal: pedido.subtotal, taxa: pedido.taxa, total: pedido.total, status: pedido.status, origem: pedido.origem, criado_em: agora,
  });
  if (error) return { erro: "Não foi possível registrar o pedido. Tente de novo." };
  return { pedido };
}

// ── Status do pedido no CRM: tarefas e estoque ──────────────────────────────

async function logNoProduto(sb: SB, produtoId: string, estoque: Record<string, number>, historico: unknown, message: string) {
  const log = { id: crypto.randomUUID(), message, author: "sistema", created_at: new Date().toISOString(), tipo: "log" as const };
  await sb.from("produto").update({ estoque, historico: [...parseComentarios(historico), log].slice(-500) }).eq("id", produtoId);
}

/**
 * Muda o status do pedido e aplica os efeitos (uma vez só, mesmo com cliques repetidos):
 *  - pagamento confirmado (Verificar pagamento → Em fila/Em produção): cria a tarefa da Produção e a
 *    da loja (Lojas → Encomendas), com o produto do estoque quando a torta está ligada a um;
 *  - Entregue: dá baixa no estoque da loja de retirada; sair de Entregue devolve.
 */
export async function mudarStatusPedido(sb: SB, id: string, status: PedidoStatus, responsavel: string): Promise<string | null> {
  const { data } = await sb.from("enc_pedido").select("*").eq("id", id).maybeSingle();
  const row = data as RowPedido | null;
  if (!row) return "Pedido não encontrado.";
  const p = paraPedido(row);
  if (p.status === status) return null;

  const cols: Record<string, unknown> = { status };
  const precisaProduto = (confirmaPagamento(p.status, status) && !p.tarefasCriadas) || efeitoEstoque(p, status) !== 0;
  const prod = precisaProduto && p.produtoId
    ? ((await sb.from("enc_produto").select("nome, produto_estoque_id").eq("id", p.produtoId).maybeSingle()).data as { nome: string; produto_estoque_id: string | null } | null)
    : null;
  const local = localDaUnidade(p.unidadeId, LOCAIS_ESTOQUE);

  // Tarefas: grava a marca ANTES (update condicional) — dois cliques ao mesmo tempo não criam em dobro.
  if (confirmaPagamento(p.status, status) && !p.tarefasCriadas) {
    const { data: marcou } = await sb.from("enc_pedido").update({ tarefas_criadas: true }).eq("id", id).eq("tarefas_criadas", false).select("id");
    if (marcou?.length) {
      const { data: ct } = await sb.from("enc_contato").select("nome, numero").eq("id", p.leadId).maybeSingle();
      const contato = ct as { nome: string; numero: string } | null;
      const tarefas: Task[] = tarefasDaEncomenda(p, {
        cliente: contato?.nome || "Cliente", numero: contato?.numero, produto: prod?.nome ?? p.produtoNome ?? "Produto",
        produtoEstoqueId: prod?.produto_estoque_id, local, responsavel, agora: fmtNowBR(), base: Date.now(),
      });
      const rows = tarefas.map((t) => ({
        id: t.id, nome: t.titulo, status: t.status, urgencia: t.prio, responsavel: t.gestor || null, tipo: t.tipo ?? null, categoria: t.categoria ?? "operacional",
        produto_id: t.produtoId || null, quantidade: t.quantidade ?? null, local: t.local || null, conferencia: parseConferencia(t.conferencia),
        descricao: t.desc ?? null, ultimos_comentarios: t.comentarios ?? [], criada_em: toISO(t.criada, t.criadaHora) ?? new Date().toISOString(), vence_em: toISO(t.venc, t.vencHora),
      }));
      const { error } = await sb.from("tarefas").insert(rows);
      if (error) {
        await sb.from("enc_pedido").update({ tarefas_criadas: false }).eq("id", id);
        return `Não foi possível criar as tarefas: ${error.message}`;
      }
    }
  }

  // Estoque da loja: Entregue dá baixa; sair de Entregue devolve.
  const ef = efeitoEstoque(p, status);
  if (ef !== 0) {
    cols.estoque_baixado = ef === 1;
    const estoqueId = prod?.produto_estoque_id;
    if (estoqueId && local) {
      const { data: pr } = await sb.from("produto").select("nome, estoque, historico").eq("id", estoqueId).maybeSingle();
      const item = pr as { nome: string; estoque: unknown; historico: unknown } | null;
      if (item) {
        const est = parseQuantidades(item.estoque);
        const label = LOCAIS_ESTOQUE.find((l) => l.id === local)?.label ?? local;
        const antes = est[local] ?? 0;
        const q = p.quantidade;
        if (ef === 1) {
          est[local] = Math.max(0, antes - q);
          const falta = Math.max(0, q - antes);
          await logNoProduto(sb, estoqueId, est, item.historico, `Sistema deu baixa de ${q} un. em ${label} (${antes} → ${est[local]}) — encomenda entregue ao cliente${falta ? `. ⚠ ${label} tinha só ${antes}: faltaram ${falta} un. (recebimento não registrado?)` : ""}`);
        } else {
          est[local] = antes + q;
          await logNoProduto(sb, estoqueId, est, item.historico, `Sistema devolveu ${q} un. em ${label} (${antes} → ${est[local]}) — encomenda saiu de "Entregue"`);
        }
      }
    }
  }

  const { error } = await sb.from("enc_pedido").update(cols).eq("id", id);
  return error ? error.message : null;
}
