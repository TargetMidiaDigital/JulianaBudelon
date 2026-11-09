"use client";

import { useSyncExternalStore } from "react";
import {
  CATEGORIA_PADRAO, CONFIG_PADRAO, PRODUTOS_PADRAO, isoDia, validarNovoPedido,
  type Categoria, type Compromisso, type ConfigEncomendas, type Lead, type LeadStatus, type NovoPedido, type PedidoEncomenda, type PedidoStatus, type ProdutoEncomenda, type ResponsavelLead, type TipoEntrega,
} from "./encomendas-base";

export * from "./encomendas-base";

/**
 * Store das Encomendas (Autoatendimento, CRM, Contatos, Agenda e a página pública /encomendar).
 *  - COM Supabase ("banco"): lê de /api/encomendas (painel) ou /api/encomendas/publico (página do
 *    cliente) e grava por ações em /api/encomendas — otimista, recarrega se o servidor recusar.
 *    O realtime_ping (enc_*) faz o painel recarregar quando outra pessoa (ou um cliente) muda algo.
 *    Pagamento confirmado (tarefas) e Entregue (baixa no estoque) são feitos NO SERVIDOR.
 *  - SEM Supabase ("demo"): tudo no localStorage, com dados de exemplo (como na primeira versão).
 */

// ── Dados de exemplo (datas relativas a hoje) ───────────────────────────────

function seed() {
  const hoje = new Date();
  const diaRel = (n: number) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return isoDia(d); };
  const ts = (n: number, h = "10:00") => new Date(`${diaRel(n)}T${h}:00`).toISOString();
  const leads: Lead[] = [
    { id: "l1", numero: "5548991230001", nome: "Camila Rocha", status: "Venda", responsavel: "I.A", criadoEm: ts(-6), ultimoContato: ts(-1, "15:20") },
    { id: "l2", numero: "5548991230002", nome: "Rodrigo Mendes", status: "Venda", responsavel: "Humano", criadoEm: ts(-9), ultimoContato: ts(-2, "11:05") },
    { id: "l3", numero: "5548991230003", nome: "Patrícia Lima", status: "Venda", responsavel: "I.A", criadoEm: ts(-12), ultimoContato: ts(-4, "09:40") },
    { id: "l4", numero: "5548991230004", nome: "Fernanda Souza", status: "Em atendimento", responsavel: "Humano", criadoEm: ts(-2), ultimoContato: ts(0, "08:50") },
    { id: "l5", numero: "5548991230005", nome: "Lucas Martins", status: "Novo contato", responsavel: "I.A", criadoEm: ts(0, "07:30"), ultimoContato: ts(0, "07:31") },
    { id: "l6", numero: "5548991230006", nome: "Juliana Prado", status: "Followup", responsavel: "I.A", criadoEm: ts(-5), ultimoContato: ts(-3, "17:10") },
    { id: "l7", numero: "5548991230007", nome: "Bruno Teixeira", status: "Perdido", responsavel: "Humano", criadoEm: ts(-20), ultimoContato: ts(-15, "14:00") },
    { id: "l8", numero: "5548991230008", nome: "Aline Castro", status: "Venda", responsavel: "I.A", criadoEm: ts(-25), ultimoContato: ts(-18, "10:30") },
  ];
  const ped = (id: string, leadId: string, produtoId: string, quantidade: number, tipo: TipoEntrega, data: string, hora: string, status: PedidoStatus, criadoEm: string, extra: Partial<PedidoEncomenda> = {}): PedidoEncomenda => {
    const p = PRODUTOS_PADRAO.find((x) => x.id === produtoId)!;
    const subtotal = p.preco * quantidade;
    const taxa = tipo === "Entrega" ? CONFIG_PADRAO.taxaEntrega : 0;
    const un = CONFIG_PADRAO.unidades.find((u) => u.id === extra.unidadeId);
    return { id, leadId, produtoId, produtoNome: p.nome, quantidade, tipo, data, hora, subtotal, taxa, total: subtotal + taxa, status, criadoEm, origem: "autoatendimento", unidadeNome: un?.nome, ...extra };
  };
  const pedidos: PedidoEncomenda[] = [
    ped("p-0a1b2c3d-1", "l1", "morango", 1, "Retirada", diaRel(2), "10:00", "Verificar pagamento", ts(-1, "15:20"), { unidadeId: "u-centro", mensagem: "Escrever: Feliz aniversário, Lu!" }),
    ped("p-4e5f6a7b-2", "l2", "brigadeiro", 2, "Retirada", diaRel(1), "15:00", "Em fila", ts(-2, "11:05"), { unidadeId: "u-coqueiros" }),
    ped("p-8c9d0e1f-3", "l3", "bem-casado", 1, "Retirada", diaRel(0), "16:00", "Em produção", ts(-4, "09:40"), { unidadeId: "u-santa-monica" }),
    ped("p-2a3b4c5d-4", "l8", "pudim", 1, "Retirada", diaRel(-3), "11:00", "Entregue", ts(-18, "10:30"), { unidadeId: "u-pagani" }),
    ped("p-6e7f8a9b-5", "l3", "prestigio", 1, "Retirada", diaRel(-8), "14:00", "Entregue", ts(-12, "09:00"), { unidadeId: "u-centro" }),
  ];
  const compromissos: Compromisso[] = [
    { id: "c1", titulo: "Degustação — casamento Fernanda", data: diaRel(3), hora: "14:00", horaFim: "15:00", contato: "Fernanda Souza", notas: "Levar Bem Casado e Marta Rocha" },
  ];
  return {
    leads, pedidos, compromissos,
    categorias: [CATEGORIA_PADRAO] as Categoria[],
    produtos: PRODUTOS_PADRAO,
    config: CONFIG_PADRAO,
  };
}

// ── Store ────────────────────────────────────────────────────────────────────

export type EstadoEncomendas = ReturnType<typeof seed>;
type Estado = EstadoEncomendas;
export type ModoEncomendas = "demo" | "banco";
type Meta = { modo: ModoEncomendas; carregado: boolean; erro: string | null };
type Snap = { s: Estado; meta: Meta };

const KEY = "jb-encomendas-demo-v1";
const VAZIO: Estado = { leads: [], pedidos: [], compromissos: [], categorias: [], produtos: [], config: CONFIG_PADRAO };
const ouvintes = new Set<() => void>();
let estado: Estado | null = null;
let meta: Meta = { modo: "demo", carregado: false, erro: null };
let snap: Snap | null = null;
const SNAP_SERVIDOR: Snap = { s: VAZIO, meta: { modo: "demo", carregado: false, erro: null } };

const noNavegador = () => typeof window !== "undefined";
// Mesmo critério de supabase-browser (variáveis públicas presentes = banco), sem carregar o cliente
// do Supabase na página do cliente: lá só há fetch simples para /api/encomendas/publico.
const modoAtual = (): ModoEncomendas => (noNavegador() && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "banco" : "demo");
/** Chamada JSON: autenticada no painel (supabase-browser, carregado sob demanda); simples na página pública. */
async function api<T>(url: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  if (!paginaPublica()) return (await import("./supabase-browser")).apiJson<T>(url, method, body);
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(j?.error || `Falha (${res.status})`);
  return j;
}
/** Página pública do cliente (sem login): só o catálogo e a configuração públicos. */
const paginaPublica = () => noNavegador() && window.location.pathname.startsWith("/encomendar");

function avisar() { snap = null; ouvintes.forEach((f) => f()); }

function lerDemo(): Estado {
  const base = seed();
  try {
    const raw = window.localStorage.getItem(KEY);
    // Dados salvos por uma versão anterior (sem catálogo/configuração) ganham os padrões.
    const salvo = raw ? (JSON.parse(raw) as Partial<Estado>) : null;
    let e: Estado = salvo ? { ...base, ...salvo, config: { ...base.config, ...(salvo.config ?? {}) } } : base;
    // Configuração ainda com as 2 unidades do primeiro exemplo (com entrega): troca pelas 6 lojas,
    // só retirada, e os pedidos de exemplo pela versão nova (pedidos criados no teste ficam).
    if (e.config.unidades.map((u) => u.id).join(",") === "u-centro,u-kobrasol") {
      e = { ...e, config: { ...e.config, unidades: base.config.unidades, entregaAtiva: false }, pedidos: e.pedidos.map((p) => base.pedidos.find((n) => n.id === p.id) ?? p) };
    }
    // Os flyers viraram WebP (mais leves): fotos salvas com o caminho antigo .jpg são trocadas.
    return { ...e, produtos: e.produtos.map((p) => (p.foto && /^\/encomendas\/torta-[\w-]+\.jpg$/.test(p.foto) ? { ...p, foto: p.foto.replace(/\.jpg$/, ".webp") } : p)) };
  } catch {
    return base;
  }
}

function carregar(): Estado {
  if (estado) return estado;
  meta = { ...meta, modo: modoAtual() };
  if (meta.modo === "banco") { estado = VAZIO; void buscar(); return estado; }
  estado = noNavegador() ? lerDemo() : seed();
  meta = { ...meta, carregado: true };
  return estado;
}

function snapshot(): Snap {
  if (snap) return snap;
  const s = carregar();
  snap = { s, meta };
  return snap;
}

// ── Banco: leitura, realtime e ações ─────────────────────────────────────────

let buscando = false;
let deNovo = false;
let canal = false;
async function buscar() {
  if (buscando) { deNovo = true; return; }
  buscando = true;
  try {
    const j = await api<Partial<Estado>>(paginaPublica() ? "/api/encomendas/publico" : "/api/encomendas", "GET");
    estado = { ...VAZIO, ...j, config: { ...CONFIG_PADRAO, ...(j.config ?? {}) } };
    meta = { ...meta, carregado: true, erro: null };
  } catch (e) {
    meta = { ...meta, carregado: true, erro: e instanceof Error ? e.message : "Falha ao carregar as encomendas." };
  } finally {
    buscando = false;
    avisar();
    if (deNovo) { deNovo = false; void buscar(); }
  }
  void ligarRealtime();
}

let espera: ReturnType<typeof setTimeout> | null = null;
async function ligarRealtime() {
  if (canal || paginaPublica()) return;
  canal = true;
  const sb = (await import("./supabase-browser")).getSupabaseBrowser();
  if (!sb) return;
  // Outra pessoa (ou um cliente na página de encomendas) mudou algo → recarrega. O sinal não traz dado.
  sb.channel("enc-ping").on("postgres_changes", { event: "*", schema: "public", table: "realtime_ping" }, (msg) => {
    const dom = (msg.new as { dominio?: string } | null)?.dominio ?? "";
    if (!dom.startsWith("enc_")) return;
    if (espera) clearTimeout(espera);
    espera = setTimeout(() => { void buscar(); }, 700);
  }).subscribe();
}

/** Recarrega do servidor (banco) — ex.: depois de uma ação cujo efeito o servidor completa. */
export const recarregarEncomendas = () => { if (meta.modo === "banco") void buscar(); };

/** Ação no servidor. Erro → avisa e recarrega (desfaz o otimista). Devolve a resposta ou null. */
async function acao<T = unknown>(nome: string, dados: Record<string, unknown>, recarregarDepois = false): Promise<T | null> {
  try {
    const r = await api<T>("/api/encomendas", "POST", { acao: nome, ...dados });
    if (recarregarDepois) void buscar();
    return r;
  } catch (e) {
    if (noNavegador()) window.alert(e instanceof Error ? e.message : "Não foi possível salvar.");
    void buscar();
    return null;
  }
}

/** Atualiza o estado na tela (e no localStorage, no demo). */
function salvar(novo: Estado): string | null {
  estado = novo;
  let erro: string | null = null;
  if (meta.modo === "demo") {
    try { window.localStorage.setItem(KEY, JSON.stringify(novo)); } catch { erro = "Não foi possível guardar no navegador (espaço cheio?). A alteração vale só até recarregar a página."; }
  }
  avisar();
  return erro;
}
const muda = (f: (s: Estado) => Partial<Estado>) => { const s = carregar(); return salvar({ ...s, ...f(s) }); };
/** Aplica na tela já e, com banco, manda a ação ao servidor. */
const fazer = (f: (s: Estado) => Partial<Estado>, nome: string, dados: Record<string, unknown>, recarregarDepois = false): string | null => {
  const erro = muda(f);
  if (meta.modo === "banco") void acao(nome, dados, recarregarDepois);
  return erro;
};

if (noNavegador()) {
  // Demo: pedido feito na página /encomendar (outra aba) aparece no painel sem recarregar.
  window.addEventListener("storage", (e) => { if (e.key === KEY && meta.modo === "demo") { estado = null; avisar(); } });
}

export function useEncomendas() {
  const { s, meta: m } = useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    snapshot,
    () => SNAP_SERVIDOR,
  );
  return {
    ...s,
    modo: m.modo,
    carregado: m.carregado,
    erroCarga: m.erro,
    produtoDe: (id: string) => s.produtos.find((p) => p.id === id),
    unidadeDe: (id?: string) => s.config.unidades.find((u) => u.id === id),
    setLeadStatus: (id: string, status: LeadStatus) =>
      fazer((e) => ({ leads: e.leads.map((l) => (l.id === id ? { ...l, status } : l)) }), "leadStatus", { id, status }),
    setResponsavel: (id: string, responsavel: ResponsavelLead) =>
      fazer((e) => ({ leads: e.leads.map((l) => (l.id === id ? { ...l, responsavel } : l)) }), "responsavel", { id, responsavel }),
    /** Com banco, o servidor cria as tarefas (pagamento confirmado) e dá/devolve a baixa no estoque (Entregue). */
    setPedidoStatus: (id: string, status: PedidoStatus, extra: Partial<PedidoEncomenda> = {}) =>
      fazer((e) => ({ pedidos: e.pedidos.map((p) => (p.id === id ? { ...p, ...extra, status } : p)) }), "pedidoStatus", { id, status }, true),
    addCompromisso: (c: Omit<Compromisso, "id">) => {
      const novo = { ...c, id: crypto.randomUUID() };
      fazer((e) => ({ compromissos: [...e.compromissos, novo] }), "compromisso", { compromisso: novo });
    },
    removeCompromisso: (id: string) => fazer((e) => ({ compromissos: e.compromissos.filter((c) => c.id !== id) }), "excluirCompromisso", { id }),
    /** Cria (sem id existente) ou atualiza um produto. Foto nova (data URL) vai para o storage no servidor. */
    salvarProduto: (p: ProdutoEncomenda) =>
      fazer((e) => ({ produtos: e.produtos.some((x) => x.id === p.id) ? e.produtos.map((x) => (x.id === p.id ? p : x)) : [...e.produtos, p] }), "produto", { produto: p }, !!p.foto?.startsWith("data:")),
    excluirProduto: (id: string) => fazer((e) => ({ produtos: e.produtos.filter((p) => p.id !== id) }), "excluirProduto", { id }),
    salvarCategoria: (c: Categoria) =>
      fazer((e) => ({ categorias: e.categorias.some((x) => x.id === c.id) ? e.categorias.map((x) => (x.id === c.id ? c : x)) : [...e.categorias, c] }), "categoria", { categoria: c, ordem: carregar().categorias.findIndex((x) => x.id === c.id) }),
    /** Exclui a categoria; os produtos dela ficam "Sem categoria" (não somem do catálogo). */
    excluirCategoria: (id: string) =>
      fazer((e) => ({ categorias: e.categorias.filter((c) => c.id !== id), produtos: e.produtos.map((p) => (p.categoriaId === id ? { ...p, categoriaId: null } : p)) }), "excluirCategoria", { id }),
    moverCategoria: (id: string, dir: -1 | 1) => {
      const cs = [...carregar().categorias];
      const i = cs.findIndex((c) => c.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= cs.length) return;
      [cs[i], cs[j]] = [cs[j], cs[i]];
      fazer(() => ({ categorias: cs }), "ordemCategorias", { ids: cs.map((c) => c.id) });
    },
    salvarConfig: (config: ConfigEncomendas) => fazer(() => ({ config }), "config", { config }),
    /** Só no demo: volta aos dados de exemplo. */
    restaurarExemplo: () => (meta.modo === "demo" ? salvar(seed()) : null),
  };
}

/**
 * Cria o pedido do autoatendimento (como o POST /api/totem/pedido do Cachorrão): acha ou cria o
 * contato pelo WhatsApp, move para "Venda" e registra o pedido em "Verificar pagamento". O total
 * é recalculado (validarNovoPedido) a partir do catálogo e da configuração — com banco, no servidor.
 * Lança Error com a mensagem para o cliente quando o pedido não pode ser feito.
 */
export async function criarPedidoAutoatendimento(n: NovoPedido): Promise<PedidoEncomenda> {
  carregar();
  if (meta.modo === "banco") {
    const r = await api<{ pedido: PedidoEncomenda }>("/api/encomendas/publico", "POST", { pedido: n });
    return r.pedido;
  }
  const s = carregar();
  const v = validarNovoPedido(n, s.produtos, s.config);
  if ("erro" in v) throw new Error(v.erro);
  const agora = new Date().toISOString();
  let lead = s.leads.find((l) => l.numero === v.numero);
  const leads = lead
    ? s.leads.map((l) => (l.id === lead!.id ? { ...l, nome: v.nome || l.nome, status: "Venda" as const, ultimoContato: agora, resumo: v.resumo } : l))
    : [...s.leads, (lead = { id: crypto.randomUUID(), numero: v.numero, nome: v.nome, status: "Venda", responsavel: "I.A", criadoEm: agora, ultimoContato: agora, resumo: v.resumo })];
  const pedido: PedidoEncomenda = {
    id: crypto.randomUUID(), leadId: lead.id, produtoId: v.produto.id, produtoNome: v.produto.nome, quantidade: v.quantidade, mensagem: v.mensagem,
    tipo: n.tipo, unidadeId: v.unidade?.id, unidadeNome: v.unidade?.nome, endereco: n.tipo === "Entrega" ? n.endereco : undefined, data: n.data, hora: n.hora,
    subtotal: v.subtotal, taxa: v.taxa, total: v.total, status: "Verificar pagamento", criadoEm: agora, origem: "autoatendimento",
  };
  salvar({ ...s, leads, pedidos: [...s.pedidos, pedido] });
  return pedido;
}

/** Foto enviada pela tela → JPEG reduzido (máx. 900px) em data URL (com banco, o servidor sobe para o storage). */
export function reduzirFoto(arquivo: File): Promise<string> {
  return new Promise((ok, falha) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const esc = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("Não foi possível ler essa imagem.")); };
    img.src = url;
  });
}
