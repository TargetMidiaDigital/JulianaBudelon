"use client";

import { useSyncExternalStore } from "react";
import { normalizePhone } from "./format";

/**
 * Setor Encomendas — PRIMEIRA VERSÃO, SEM BANCO: tudo no navegador (localStorage), com
 * dados de exemplo. Espelha o fluxo do Cachorrão HD (totem /encomendar → CRM de contatos →
 * pedidos → agenda), trocando a caixa de mini dogs por um catálogo de produtos em
 * categorias (começa com as tortas "Camadas de Felicidade" do PDF Encomendas - Juliana
 * Budelon): o cliente ESCOLHE O PRODUTO e depois percorre o funil. Catálogo, unidades de
 * retirada, entrega e horários são editáveis em Encomendas → Autoatendimento.
 */

// ── Catálogo ────────────────────────────────────────────────────────────────

export type Categoria = { id: string; nome: string };

export type ProdutoEncomenda = {
  id: string;
  nome: string; // "Torta de Morango"
  categoriaId: string | null; // null = sem categoria
  preco: number;
  porcoes: string; // "8 a 10 porções"
  peso: string; // "1,2 kg"
  descricao?: string;
  camadas: string[]; // ordem de camadas, de cima para baixo (como no PDF)
  foto: string | null; // /encomendas/torta-*.webp (flyer do PDF; há também a versão -card.webp) ou data URL enviada na tela
  ativo: boolean;
};

export const CATEGORIA_PADRAO: Categoria = { id: "camadas-de-felicidade", nome: "Camadas de Felicidade" };

const torta = (id: string, nome: string, preco: number, peso: string, camadas: string[]): ProdutoEncomenda => ({
  id, nome: `Torta de ${nome}`, categoriaId: CATEGORIA_PADRAO.id, preco, porcoes: "8 a 10 porções", peso, camadas, foto: `/encomendas/torta-${id}.webp`, ativo: true,
});

const PRODUTOS_PADRAO: ProdutoEncomenda[] = [
  torta("morango", "Morango", 169.9, "1,2 kg", ["Suspiros", "Buttercreme", "Pão de ló", "Morangos", "Pão de ló", "Creme belga"]),
  torta("pudim", "Pudim", 169.9, "1,2 kg", ["Creme", "Pão de ló", "Pudim de leite", "Doce de leite", "Pão de ló", "Creme"]),
  torta("duo", "Duo", 159.9, "1,3 kg", ["Creme belga branco", "Massa de chocolate fofinha", "Creme belga de chocolate", "Finalizada com brigadeiros branco e tradicional"]),
  torta("maracuja-chocolate", "Maracujá com Chocolate", 159.9, "1,3 kg", ["Creme de maracujá", "Massa de chocolate fofinha", "Creme de chocolate belga", "Bem molhadinha"]),
  torta("brigadeiro", "Brigadeiro", 159.9, "1,3 kg", ["Creme de brigadeiro", "Massa de chocolate", "Brigadeiro de panela", "Massa de chocolate", "Creme de brigadeiro", "Brigadeiro de panela"]),
  torta("bem-casado", "Bem Casado", 169.9, "1,3 kg", ["Creme de ninho", "Massa de bolo fofinha", "Doce de leite caseiro", "Finalizado com bem casado"]),
  torta("mineira", "Mineira", 159.9, "1,3 kg", ["Abacaxi", "Buttercreme", "Creme belga", "Pão de ló", "Creme belga com abacaxi", "Pão de ló", "Creme belga com abacaxi", "Pão de ló", "Creme belga com abacaxi"]),
  torta("prestigio", "Prestígio", 159.9, "1,3 kg", ["Massa de chocolate fofinha", "Creme de coco fresco com belga", "Creme de chocolate", "Finalizado com coco e chocolate prestígio"]),
  torta("marta-rocha", "Marta Rocha", 159.9, "1,3 kg", ["Creme de ameixa & nozes", "Baba de moça", "Pão de ló", "Creme de nozes", "Creme de ameixa", "Massa de chocolate", "Creme de nozes", "Creme de ameixa", "Pão de ló", "Creme belga"]),
];

/** Recorte da foto do flyer que mostra a torta (o topo do flyer é título/preço). */
export const FOTO_POSICAO = "center 72%";

// ── Configuração do autoatendimento (editável em Autoatendimento → Configurações) ──

export type DiaKey = "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab";
export const DIAS: { key: DiaKey; label: string; curto: string }[] = [
  { key: "dom", label: "Domingo", curto: "Dom" }, { key: "seg", label: "Segunda", curto: "Seg" }, { key: "ter", label: "Terça", curto: "Ter" },
  { key: "qua", label: "Quarta", curto: "Qua" }, { key: "qui", label: "Quinta", curto: "Qui" }, { key: "sex", label: "Sexta", curto: "Sex" }, { key: "sab", label: "Sábado", curto: "Sáb" },
];

export type Intervalo = { inicio: string; fim: string }; // "HH:MM"
export type JanelaDia = { ativo: boolean; intervalos: Intervalo[] };
export type UnidadeRetirada = { id: string; nome: string; endereco: string; ativo: boolean };

export type ConfigEncomendas = {
  retiradaAtiva: boolean;
  unidades: UnidadeRetirada[];
  entregaAtiva: boolean;
  taxaEntrega: number;
  antecedenciaHoras: number;
  intervaloMin: number;
  maxPorPedido: number;
  janelas: Record<DiaKey, JanelaDia>;
  pixChave: string; // vazio = PIX de exemplo
  pixNome: string;
  pixCidade: string;
  whatsappContato: string;
};

const dia = (inicio: string, fim: string): JanelaDia => ({ ativo: true, intervalos: [{ inicio, fim }] });
const CONFIG_PADRAO: ConfigEncomendas = {
  retiradaAtiva: true,
  unidades: [
    { id: "u-centro", nome: "Florianópolis · Centro", endereco: "", ativo: true },
    { id: "u-kobrasol", nome: "São José · Kobrasol", endereco: "", ativo: true },
  ],
  entregaAtiva: true,
  taxaEntrega: 15,
  antecedenciaHoras: 48,
  intervaloMin: 60,
  maxPorPedido: 5,
  janelas: { dom: { ativo: false, intervalos: [] }, seg: dia("09:00", "18:00"), ter: dia("09:00", "18:00"), qua: dia("09:00", "18:00"), qui: dia("09:00", "18:00"), sex: dia("09:00", "18:00"), sab: dia("09:00", "14:00") },
  pixChave: "",
  pixNome: "",
  pixCidade: "",
  whatsappContato: "5548999990001",
};

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const diaKeyDe = (iso: string): DiaKey => DIAS[new Date(`${iso}T12:00:00`).getDay()].key;
export const paraMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
export const deMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Horários de uma janela: cada bloco fatiado a cada `intervaloMin` (fim incluso), sem repetir. */
export function horariosDaJanela(j: JanelaDia, intervaloMin: number): string[] {
  if (!j.ativo) return [];
  const passo = Math.max(5, intervaloMin || 60);
  const set = new Set<number>();
  for (const b of j.intervalos) for (let m = paraMin(b.inicio); m <= paraMin(b.fim); m += passo) set.add(m);
  return [...set].sort((a, b) => a - b).map(deMin);
}
export const horariosDoDia = (cfg: ConfigEncomendas, iso: string) => horariosDaJanela(cfg.janelas[diaKeyDe(iso)], cfg.intervaloMin);

/** O horário respeita a antecedência mínima? */
export const respeitaAntecedencia = (cfg: ConfigEncomendas, iso: string, hora: string, agora = new Date()) =>
  new Date(`${iso}T${hora}:00`).getTime() - agora.getTime() >= cfg.antecedenciaHoras * 3600_000;

/** Problemas que impedem salvar a configuração (mensagens para a tela). */
export function validarConfig(c: ConfigEncomendas): string | null {
  if (!c.retiradaAtiva && !c.entregaAtiva) return "Ligue pelo menos uma forma de receber: retirada ou entrega.";
  if (c.retiradaAtiva && !c.unidades.some((u) => u.ativo && u.nome.trim())) return "A retirada está ligada, mas não há nenhuma unidade ativa. Adicione uma unidade ou desligue a retirada.";
  if (c.unidades.some((u) => !u.nome.trim())) return "Toda unidade precisa de um nome.";
  if (c.entregaAtiva && !(c.taxaEntrega >= 0)) return "A taxa de entrega não pode ser negativa.";
  if (!(c.maxPorPedido >= 1)) return "O máximo por pedido precisa ser pelo menos 1.";
  if (!(c.antecedenciaHoras >= 0)) return "A antecedência não pode ser negativa.";
  if (!(c.intervaloMin >= 5)) return "O intervalo entre horários precisa ser de pelo menos 5 minutos.";
  for (const d of DIAS) {
    const j = c.janelas[d.key];
    if (j.ativo && j.intervalos.some((b) => paraMin(b.fim) <= paraMin(b.inicio))) return `Horário inválido na ${d.label.toLowerCase()}: o fim precisa ser depois do início.`;
  }
  if (!DIAS.some((d) => horariosDaJanela(c.janelas[d.key], c.intervaloMin).length)) return "Nenhum horário disponível: ligue pelo menos um dia da semana.";
  return null;
}

export const PERIODOS = [
  { label: "Manhã", de: 0, ate: 12 },
  { label: "Tarde", de: 12, ate: 18 },
  { label: "Noite", de: 18, ate: 24 },
];

export const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

// ── Contatos (leads) e pedidos ──────────────────────────────────────────────

export type ResponsavelLead = "I.A" | "Humano";

/** Funil do CRM (mesmos estágios e cores do Cachorrão). */
export const LEAD_STATUS = [
  { key: "Novo contato", cor: "#5B6FD6" },
  { key: "Followup", cor: "#8B5CF6" },
  { key: "Em atendimento", cor: "#F5B942" },
  { key: "Venda", cor: "#16A34A" },
  { key: "Desqualificado", cor: "#94A3B8" },
  { key: "Perdido", cor: "#EF4444" },
] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number]["key"];
export const corLead = (s: string) => LEAD_STATUS.find((x) => x.key === s)?.cor ?? "#94A3B8";

/** Status do pedido (o funil do contato e o do pedido são independentes). */
export const PEDIDO_STATUS = [
  { key: "Verificar pagamento", cor: "#EAB308", agenda: "#2563EB" },
  { key: "Em fila", cor: "#F5B942", agenda: "#A16207" },
  { key: "Em produção", cor: "#F97316", agenda: "#D97706" },
  { key: "Entregue", cor: "#10B981", agenda: "#16A34A" },
] as const;
export type PedidoStatus = (typeof PEDIDO_STATUS)[number]["key"];
export const corPedido = (s: string) => PEDIDO_STATUS.find((x) => x.key === s)?.cor ?? "#94A3B8";

export type Lead = {
  id: string;
  numero: string; // WhatsApp canônico (55 + DDD + número)
  nome: string;
  status: LeadStatus;
  responsavel: ResponsavelLead;
  criadoEm: string; // ISO
  ultimoContato: string; // ISO
  resumo?: string;
};

export type TipoEntrega = "Entrega" | "Retirada";

export type PedidoEncomenda = {
  id: string;
  leadId: string;
  produtoId: string;
  produtoNome?: string; // retrato do nome no pedido (o produto pode ser editado/excluído depois)
  quantidade: number;
  mensagem?: string; // escrita na torta / observação do cliente
  tipo: TipoEntrega;
  unidadeId?: string;
  unidadeNome?: string; // retrato da unidade no pedido
  endereco?: { cidade: string; bairro: string; rua: string; numero: string; complemento?: string };
  data: string; // AAAA-MM-DD
  hora: string; // HH:MM
  subtotal: number;
  taxa: number;
  total: number;
  status: PedidoStatus;
  criadoEm: string; // ISO
  origem: "autoatendimento" | "manual";
};

export type Compromisso = { id: string; titulo: string; data: string; hora: string; horaFim: string; contato?: string; notas?: string };

export const numeroPedido = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();
export const enderecoLinha = (e?: PedidoEncomenda["endereco"]) =>
  e ? [`${e.rua}, ${e.numero}`, e.bairro, e.cidade, e.complemento].filter(Boolean).join(" · ") : "";

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
    ped("p-4e5f6a7b-2", "l2", "brigadeiro", 2, "Entrega", diaRel(1), "15:00", "Em fila", ts(-2, "11:05"), { endereco: { cidade: "São José", bairro: "Kobrasol", rua: "Rua Koesa", numero: "430", complemento: "Apto 302" } }),
    ped("p-8c9d0e1f-3", "l3", "bem-casado", 1, "Retirada", diaRel(0), "16:00", "Em produção", ts(-4, "09:40"), { unidadeId: "u-kobrasol" }),
    ped("p-2a3b4c5d-4", "l8", "pudim", 1, "Entrega", diaRel(-3), "11:00", "Entregue", ts(-18, "10:30"), { endereco: { cidade: "Florianópolis", bairro: "Trindade", rua: "Rua Lauro Linhares", numero: "1200" } }),
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

// ── Store local (localStorage, compartilhado entre telas e com a página /encomendar) ──

type Estado = ReturnType<typeof seed>;
const KEY = "jb-encomendas-demo-v1";
let estado: Estado | null = null;
const ouvintes = new Set<() => void>();

function carregar(): Estado {
  if (estado) return estado;
  const base = seed();
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    // Dados salvos por uma versão anterior (sem catálogo/configuração) ganham os padrões.
    const salvo = raw ? (JSON.parse(raw) as Partial<Estado>) : null;
    estado = salvo ? { ...base, ...salvo, config: { ...base.config, ...(salvo.config ?? {}) } } : base;
    // Os flyers viraram WebP (mais leves): fotos salvas com o caminho antigo .jpg são trocadas.
    estado = { ...estado, produtos: estado.produtos.map((p) => (p.foto && /^\/encomendas\/torta-[\w-]+\.jpg$/.test(p.foto) ? { ...p, foto: p.foto.replace(/\.jpg$/, ".webp") } : p)) };
  } catch {
    estado = base;
  }
  return estado;
}
function salvar(novo: Estado): string | null {
  estado = novo;
  let erro: string | null = null;
  try { window.localStorage.setItem(KEY, JSON.stringify(novo)); } catch { erro = "Não foi possível guardar no navegador (espaço cheio?). A alteração vale só até recarregar a página."; }
  ouvintes.forEach((f) => f());
  return erro;
}
if (typeof window !== "undefined") {
  // Pedido feito na página /encomendar (outra aba) aparece no painel sem recarregar.
  window.addEventListener("storage", (e) => { if (e.key === KEY) { estado = null; ouvintes.forEach((f) => f()); } });
}
const VAZIO: Estado = { leads: [], pedidos: [], compromissos: [], categorias: [], produtos: [], config: CONFIG_PADRAO };

const muda = (f: (s: Estado) => Partial<Estado>) => { const s = carregar(); return salvar({ ...s, ...f(s) }); };

export function useEncomendas() {
  const s = useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    carregar,
    () => VAZIO,
  );
  return {
    ...s,
    produtoDe: (id: string) => s.produtos.find((p) => p.id === id),
    unidadeDe: (id?: string) => s.config.unidades.find((u) => u.id === id),
    setLeadStatus: (id: string, status: LeadStatus) => muda((e) => ({ leads: e.leads.map((l) => (l.id === id ? { ...l, status } : l)) })),
    setResponsavel: (id: string, responsavel: ResponsavelLead) => muda((e) => ({ leads: e.leads.map((l) => (l.id === id ? { ...l, responsavel } : l)) })),
    setPedidoStatus: (id: string, status: PedidoStatus) => muda((e) => ({ pedidos: e.pedidos.map((p) => (p.id === id ? { ...p, status } : p)) })),
    addCompromisso: (c: Omit<Compromisso, "id">) => muda((e) => ({ compromissos: [...e.compromissos, { ...c, id: crypto.randomUUID() }] })),
    removeCompromisso: (id: string) => muda((e) => ({ compromissos: e.compromissos.filter((c) => c.id !== id) })),
    /** Cria (sem id existente) ou atualiza um produto. */
    salvarProduto: (p: ProdutoEncomenda) => muda((e) => ({ produtos: e.produtos.some((x) => x.id === p.id) ? e.produtos.map((x) => (x.id === p.id ? p : x)) : [...e.produtos, p] })),
    excluirProduto: (id: string) => muda((e) => ({ produtos: e.produtos.filter((p) => p.id !== id) })),
    salvarCategoria: (c: Categoria) => muda((e) => ({ categorias: e.categorias.some((x) => x.id === c.id) ? e.categorias.map((x) => (x.id === c.id ? c : x)) : [...e.categorias, c] })),
    /** Exclui a categoria; os produtos dela ficam "Sem categoria" (não somem do catálogo). */
    excluirCategoria: (id: string) => muda((e) => ({ categorias: e.categorias.filter((c) => c.id !== id), produtos: e.produtos.map((p) => (p.categoriaId === id ? { ...p, categoriaId: null } : p)) })),
    moverCategoria: (id: string, dir: -1 | 1) => muda((e) => {
      const i = e.categorias.findIndex((c) => c.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= e.categorias.length) return {};
      const cs = [...e.categorias]; [cs[i], cs[j]] = [cs[j], cs[i]];
      return { categorias: cs };
    }),
    salvarConfig: (config: ConfigEncomendas) => muda(() => ({ config })),
    restaurarExemplo: () => salvar(seed()),
  };
}

/** Produtos ativos agrupados pelas categorias, na ordem das categorias ("Sem categoria" por último). */
export function catalogoPorCategoria(categorias: Categoria[], produtos: ProdutoEncomenda[], soAtivos = true) {
  const lista = soAtivos ? produtos.filter((p) => p.ativo) : produtos;
  const grupos = categorias.map((c) => ({ categoria: c as Categoria | null, produtos: lista.filter((p) => p.categoriaId === c.id) }));
  const sem = lista.filter((p) => !p.categoriaId || !categorias.some((c) => c.id === p.categoriaId));
  if (sem.length) grupos.push({ categoria: null, produtos: sem });
  return soAtivos ? grupos.filter((g) => g.produtos.length) : grupos;
}

export type NovoPedido = Pick<PedidoEncomenda, "produtoId" | "quantidade" | "mensagem" | "tipo" | "unidadeId" | "endereco" | "data" | "hora"> & { nome: string; whatsapp: string };

/**
 * Cria o pedido do autoatendimento (como o POST /api/totem/pedido do Cachorrão): acha ou
 * cria o contato pelo WhatsApp, move para "Venda" e registra o pedido em "Verificar pagamento".
 * O total é recalculado aqui a partir do catálogo e da configuração, nunca vem pronto da tela.
 */
export function criarPedidoAutoatendimento(n: NovoPedido): PedidoEncomenda {
  const s = carregar();
  const agora = new Date().toISOString();
  const numero = normalizePhone(n.whatsapp).replace(/^(?!55)/, "55");
  const produto = s.produtos.find((p) => p.id === n.produtoId)!;
  const subtotal = produto.preco * n.quantidade;
  const taxa = n.tipo === "Entrega" ? s.config.taxaEntrega : 0;
  const unidade = n.tipo === "Retirada" ? s.config.unidades.find((u) => u.id === n.unidadeId) : undefined;
  let lead = s.leads.find((l) => l.numero === numero);
  const resumo = [
    `Cliente: ${n.nome}`,
    `Itens: ${n.quantidade}× ${produto.nome}`,
    n.mensagem ? `Observação: ${n.mensagem}` : "",
    `Valor: R$ ${(subtotal + taxa).toFixed(2).replace(".", ",")}`,
    "Pagamento: PIX",
    `${n.tipo}: ${dataBR(n.data)} às ${n.hora}`,
    unidade ? `Unidade: ${unidade.nome}` : "",
  ].filter(Boolean).join("\n");
  const leads = lead
    ? s.leads.map((l) => (l.id === lead!.id ? { ...l, nome: n.nome || l.nome, status: "Venda" as const, ultimoContato: agora, resumo } : l))
    : [...s.leads, (lead = { id: crypto.randomUUID(), numero, nome: n.nome, status: "Venda", responsavel: "I.A", criadoEm: agora, ultimoContato: agora, resumo })];
  const pedido: PedidoEncomenda = {
    id: crypto.randomUUID(), leadId: lead.id, produtoId: produto.id, produtoNome: produto.nome, quantidade: n.quantidade, mensagem: n.mensagem,
    tipo: n.tipo, unidadeId: unidade?.id, unidadeNome: unidade?.nome, endereco: n.tipo === "Entrega" ? n.endereco : undefined, data: n.data, hora: n.hora,
    subtotal, taxa, total: subtotal + taxa, status: "Verificar pagamento", criadoEm: agora, origem: "autoatendimento",
  };
  salvar({ ...s, leads, pedidos: [...s.pedidos, pedido] });
  return pedido;
}

/** Foto enviada pela tela → JPEG reduzido (máx. 900px) em data URL, para caber no navegador. */
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
