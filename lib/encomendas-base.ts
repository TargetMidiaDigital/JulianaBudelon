import type { Task } from "./types";
import { brl, foneBR, normalizePhone } from "./format";

/**
 * Encomendas — parte compartilhada (tela, página pública e servidor): tipos, catálogo padrão,
 * configuração, horários e status. Sem React e sem "use client": as rotas /api/encomendas usam.
 *
 * Histórico: começou como PRIMEIRA VERSÃO, SEM BANCO: tudo no navegador (localStorage), com
 * dados de exemplo. Espelha o fluxo do Cachorrão HD (totem /encomendar → CRM de contatos →
 * pedidos → agenda), trocando a caixa de mini dogs por um catálogo de produtos em
 * categorias (começa com as tortas "Camadas de Felicidade" do PDF Encomendas - Juliana
 * Budelon): o cliente ESCOLHE O PRODUTO e depois percorre o funil. Catálogo, unidades de
 * retirada, entrega e horários são editáveis em Encomendas → Autoatendimento.
 */

// ── Catálogo ────────────────────────────────────────────────────────────────

export type Categoria = {
  id: string;
  nome: string;
  /** Frase curta no card da vitrine (ex.: "Servem de 15 a 20 fatias"). */
  descricao?: string;
  /** Capa do card na vitrine; vazio = foto do primeiro produto da categoria. */
  foto?: string | null;
  /** false = escondida da página do cliente (com os produtos dela). */
  ativa?: boolean;
  /** Card em destaque na vitrine: ocupa a largura de dois cards. */
  destaque?: boolean;
};
export const categoriaAtiva = (c: Categoria) => c.ativa !== false;

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
  /** Produto do Estoque que esta encomenda movimenta (produção soma na Fábrica → loja recebe → entregue dá baixa). */
  produtoEstoqueId?: string | null;
  /** Tempo mínimo de preparo em dias (0 = só a antecedência geral): com 2, pedido hoje só para depois de amanhã em diante. */
  preparoDias?: number;
};

/**
 * Descrição em itens, um abaixo do outro: cada linha é um item (aceita "- " ou "• " no começo,
 * como lista de markdown). Texto de uma linha só vira um item.
 */
export const itensDescricao = (d?: string | null) =>
  (d ?? "").split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim()).filter(Boolean);

/** Frase corrida do catálogo ("A, B e C, finalizado com D.") → um item por linha. */
function emLinhas(frase: string): string {
  if (frase.includes("\n")) return frase; // já em itens
  return frase.trim().replace(/\.$/, "").split(/\.\s+/).map(frasePorItens).join("\n");
}
function frasePorItens(limpa: string): string {
  const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  if (/^finalizad[oa]\s/i.test(limpa)) return maiuscula(limpa); // "Finalizado com A e B" fica inteiro
  const i = limpa.search(/,\s+finalizad[oa]/i);
  const corpo = i >= 0 ? limpa.slice(0, i) : limpa;
  const fim = i >= 0 ? limpa.slice(i).replace(/^,\s+/, "") : "";
  const partes = corpo.split(/,\s+/);
  const ultima = partes.pop()!;
  const k = ultima.lastIndexOf(" e ");
  // "A e B" no último item vira dois — menos quando o segundo começa com "de" ("branco e de chocolate").
  if (k > 0 && !/^de\s/.test(ultima.slice(k + 3))) partes.push(ultima.slice(0, k), ultima.slice(k + 3));
  else partes.push(ultima);
  return [...partes, ...(fim ? [fim] : [])].map(maiuscula).join("\n");
}

export const CATEGORIA_PADRAO: Categoria = { id: "camadas-de-felicidade", nome: "Camadas de Felicidade" };

const torta = (id: string, nome: string, preco: number, peso: string, camadas: string[]): ProdutoEncomenda => ({
  id, nome: `Torta de ${nome}`, categoriaId: CATEGORIA_PADRAO.id, preco, porcoes: "8 a 10 porções", peso, camadas, foto: `/encomendas/torta-${id}.webp`, ativo: true,
});

export const PRODUTOS_PADRAO: ProdutoEncomenda[] = [
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

// ── Catálogo de Natal 2026 (PDF "CATALOGO-NATAL2026-JB") ────────────────────
// Fotos recortadas do PDF em /public/encomendas/natal/. Encomendas com 48 h de antecedência.

export const CATEGORIAS_NATAL: Categoria[] = [
  { id: "natal-cheesecakes", nome: "Cheesecakes", descricao: "Servem de 15 a 20 fatias", destaque: true },
  { id: "natal-sobremesas", nome: "Sobremesas", descricao: "Para a mesa da ceia" },
  { id: "natal-cake-box-especial", nome: "Cake Box Especial Fatias", descricao: "As maiores, para a família toda" },
  { id: "natal-cake-box", nome: "Cake Box", descricao: "Tortas de 1,2 a 1,3 kg" },
  { id: "natal-chocotones", nome: "Chocotones", descricao: "Recheados e finalizados" },
  { id: "natal-empadoes", nome: "Empadões", descricao: "Vendidos congelados · 4 a 6 porções" },
];

const natal = (categoriaId: string, id: string, nome: string, preco: number, peso: string, descricao: string, foto = id, porcoes = ""): ProdutoEncomenda => ({
  id: `natal-${id}`, nome, categoriaId, preco, porcoes, peso, descricao: emLinhas(descricao), camadas: [], foto: `/encomendas/natal/${foto}.webp`, ativo: true,
});
const cheese = (id: string, nome: string, preco: number, peso: string, d: string) => natal("natal-cheesecakes", id, nome, preco, peso, d, id, "15 a 20 fatias");
const sobre = (id: string, nome: string, preco: number, peso: string, d: string) => natal("natal-sobremesas", `sobremesa-${id}`, nome, preco, peso, d);
const especial = (id: string, nome: string, preco: number, peso: string, d: string) => natal("natal-cake-box-especial", `especial-${id}`, `Cake Box Especial ${nome}`, preco, peso, d);
const cakebox = (id: string, nome: string, preco: number, peso: string, d: string) => natal("natal-cake-box", `cakebox-${id}`, `Cake Box ${nome}`, preco, peso, d);
const chocotone = (id: string, nome: string, preco: number, peso: string, d: string) => natal("natal-chocotones", `chocotone-${id}`, nome, preco, peso, d);
const EMPADAO_INFO = "Produto vendido somente congelado. Peso aproximado de 1 kg. Verificar disponibilidade do sabor.";
const empadao = (id: string, nome: string, preco: number) => natal("natal-empadoes", `empadao-${id}`, `Empadão de ${nome}`, preco, "1 kg", EMPADAO_INFO, "empadao", "4 a 6 porções");

export const PRODUTOS_NATAL: ProdutoEncomenda[] = [
  cheese("cheesecake-pistache", "Cheesecake Pistache", 230, "2,3 kg", "Massa amanteigada por fora, massa de cream cheese por dentro, creme de chocolate branco, creme de pistache JB e pistaches picados."),
  cheese("cheesecake-frutas-vermelhas", "Cheesecake Frutas Vermelhas", 230, "2,3 kg", "Massa amanteigada por fora, massa de cream cheese por dentro, creme de chocolate branco, geleia de frutas vermelhas e frutas frescas."),
  cheese("bolo-piscina-red-velvet", "Bolo Piscina Red Velvet", 190, "2 kg", "Massa Red Velvet fofinha e creme de cream cheese com chocolate branco, finalizado com frutas vermelhas."),

  sobre("folhata-de-morango", "Folhata de Morango", 129, "800 g", "Creme de cinco leites, biscoito folhado crocante e morangos frescos."),
  sobre("bombom-de-uva", "Bombom de Uva", 110, "1 kg", "Creme belga e uvas sem sementes, finalizado com ganache meio amarga, uvas e raspas de chocolate branco."),
  sobre("pavetonne", "Pavetonne", 129, "900 g", "Creme de Ninho, pedaços de chocotone e creme de três leites, finalizado com nuvem de Nutella e barrinhas de Kinder."),
  sobre("raffaello", "Raffaello", 125, "900 g", "Creme de Raffaello com chocolate branco, amêndoas e coco\nMassa branca\nMousse de Raffaello com pedaços de bombom e coco\nFinalizado com bombons Raffaello"),
  sobre("morango-com-suspiro", "Morango com Suspiro", 110, "900 g", "Creme belga, massa branca fofinha, morangos picados e buttercreme. Finalizado com suspiros e morangos."),
  sobre("ferrero", "Ferrero", 129, "900 g", "Mousse de Ferrero meio amargo, pedaços de Ferrero, massa de chocolate fofinha e creme de avelã crocante com amendoim, finalizado com avelãs e Ferrero."),
  sobre("mineira", "Mineira", 105, "900 g", "Creme de abacaxi com coco fresco e massa branca fofinha, finalizado com buttercreme, abacaxi e coco em flocos."),
  sobre("quatro-leites", "Quatro Leites", 100, "900 g", "Creme de quatro leites e massa branca fofinha, finalizado com raspas de chocolate branco."),
  sobre("kinder", "Kinder", 129, "900 g", "Creme de chocolate blend, massa de chocolate, creme de chocolate branco e camadas de Kinder Barrinha, finalizado com ganache de chocolate ao leite e Kinder Barrinha."),
  sobre("banoffee", "Banoffee", 110, "900 g", "Farofa amanteigada crocante, creme de doce de leite e rodelas de banana, finalizado com buttercreme e farofa amanteigada."),
  sobre("red-velvet", "Red Velvet", 110, "900 g", "Creme de cream cheese com chocolate branco e camadas de massa Red Velvet fofinha, finalizado com morangos e mirtilos."),
  sobre("bombom-de-morango", "Bombom de Morango", 110, "1 kg", "Creme belga, massa de chocolate fofinha, morangos picados e ganache cremosa meio amarga, finalizado com flocos de chocolate e morangos."),
  sobre("morango-com-nata", "Morango com Nata", 110, "900 g", "Creme belga, massa branca fofinha, morangos picados e buttercreme, finalizado com suspiros e morangos."),
  sobre("pave-de-nozes", "Pavê de Nozes", 110, "900 g", "Creme de nata com nozes, bolacha de leite e creme de doce de leite, finalizado com nozes picadas."),
  sobre("bueno", "Bueno", 129, "900 g", "Ganache meio amargo e mousse de Bueno White, finalizado com pedaços de Bueno White."),

  especial("morango-com-nata", "Morango com Nata", 359.9, "2,3 kg", "Creme belga, pão de ló, morangos frescos, buttercreme e suspiros, finalizado com morangos frescos e suspiros."),
  especial("pistache-nuvem", "Pistache Nuvem", 359.9, "2,35 kg", "Massa branca, creme de pistache, creme belga e creme nuvem de pistache, finalizado com creme nuvem de pistache e pistache triturado."),
  especial("morango-cravejado", "Morango Cravejado", 369.6, "2,5 kg", "Massa branca, creme belga, morangos frescos, buttercreme e cobertura cravejada, finalizado com 8 mini morangos cravejados."),
  especial("bem-casado", "Bem Casado", 359.9, "2,3 kg", "Massa branca, creme de Ninho e creme de doce de leite, finalizado com 11 brigadeiros de Ninho."),
  especial("pudim", "Pudim", 359.9, "2,3 kg", "Creme belga, pão de ló, creme de doce de leite e pudim de leite, finalizado com 5 mini pudins."),
  especial("marta-rocha", "Marta Rocha", 359.9, "2,5 kg", "Pão de ló branco, pão de ló de chocolate, creme de nozes e creme de ameixa, finalizado com creme de ovos."),
  especial("mineira", "Mineira", 359.9, "2,5 kg", "Pão de ló, creme belga com abacaxi e coco e buttercreme, finalizado com pedaços de abacaxi e coco em flocos."),
  especial("pistache-chocolate", "Pistache Chocolate", 359.9, "2,5 kg", "Pão de ló de chocolate, creme de chocolate e creme de pistache, finalizado com pistache."),

  cakebox("morango-cravejado", "Morango Cravejado", 179.9, "1,3 kg", "Massa branca, creme belga, morangos frescos e buttercreme, com cobertura cravejada, finalizado com 5 mini morangos cravejados."),
  cakebox("bem-casado", "Bem Casado", 169.9, "1,3 kg", "Creme de Ninho, massa de bolo fofinha e creme de doce de leite caseiro, finalizado com 5 mini brigadeiros de Ninho."),
  cakebox("pudim", "Pudim", 169.9, "1,2 kg", "Camadas de creme, pão de ló, creme de doce de leite e pudim de leite, finalizado com 2 mini pudins."),
  cakebox("pavetonne", "Pavêtonne", 169.9, "1,3 kg", "Creme de Ninho, pedaços de chocotone e creme de três leites, finalizado com nuvem de Nutella e barrinhas de Kinder."),
  cakebox("duo-chocolates", "Duo Chocolates", 159.9, "1,3 kg", "Creme belga branco, massa de chocolate fofinha e creme belga de chocolate, finalizado com brigadeiros brancos e tradicionais."),
  cakebox("pistache-nuvem", "Pistache Nuvem", 169.9, "1,3 kg", "Massa branca, creme de pistache, creme belga e creme nuvem de pistache, finalizado com creme nuvem de pistache e pistache triturado."),
  cakebox("banoffee", "Banoffee", 169.9, "1,3 kg", "Farofa amanteigada, creme de doce de leite caseiro, bananas em rodelas e buttercreme."),
  cakebox("pistache-chocolate", "Pistache Chocolate", 169.9, "1,3 kg", "Creme de chocolate, massa de chocolate molhadinha e creme de pistache, finalizado com pistache picado."),
  cakebox("morango", "Morango", 159.9, "1,2 kg", "Creme belga, pão de ló, morangos frescos, buttercreme e suspiros, finalizado com buttercreme e suspiros."),
  cakebox("mineira", "Mineira", 159.9, "1,3 kg", "Creme belga com abacaxi e coco fresco, pão de ló e buttercreme, finalizado com buttercreme, abacaxi e coco em flocos."),
  cakebox("prestigio", "Prestígio", 169.9, "1,3 kg", "Massa de chocolate fofinha, creme de coco fresco e creme de chocolate, finalizado com coco e chocolate Prestígio."),
  cakebox("marta-rocha", "Marta Rocha", 169.9, "1,3 kg", "Camadas de pão de ló branco e de chocolate, creme de nozes e creme de ameixa, finalizado com creme de ovos."),

  chocotone("pistache", "Chocotone de Pistache", 129.9, "800 g", "Chocotone recheado com creme de chocolate branco e creme de pistache, finalizado com creme de pistache e pistache picado."),
  chocotone("kinder-mix", "Chocotone de Kinder Mix", 139.9, "900 g", "Chocotone recheado com creme de chocolate branco, creme de chocolate blend e creme belga, finalizado com Kinder Bueno White, Kinder Bueno Black, Kinder Ovo, Kinder Barrinha e brigadeiros."),
  chocotone("nutellinho", "Chocotone de Nutellinho", 129.9, "900 g", "Chocotone recheado com creme de Ninho, finalizado com creme belga, Ninho e um pote de Nutella de 140 g."),

  empadao("camarao-com-requeijao", "Camarão com Requeijão", 105),
  empadao("file-quatro-queijos", "Filé Quatro Queijos", 100),
  empadao("frango-com-requeijao", "Frango com Requeijão", 90),
  empadao("frango-sem-requeijao", "Frango sem Requeijão", 90),
  empadao("frango-com-palmito", "Frango com Palmito", 90),
  empadao("palmito-cremoso", "Palmito Cremoso", 90),
  empadao("carne-de-panela-com-requeijao", "Carne de Panela com Requeijão", 90),
];

// ── Configuração do autoatendimento (editável em Autoatendimento → Configurações) ──

export type DiaKey = "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab";
export const DIAS: { key: DiaKey; label: string; curto: string }[] = [
  { key: "dom", label: "Domingo", curto: "Dom" }, { key: "seg", label: "Segunda", curto: "Seg" }, { key: "ter", label: "Terça", curto: "Ter" },
  { key: "qua", label: "Quarta", curto: "Qua" }, { key: "qui", label: "Quinta", curto: "Qui" }, { key: "sex", label: "Sexta", curto: "Sex" }, { key: "sab", label: "Sábado", curto: "Sáb" },
];

export type Intervalo = { inicio: string; fim: string }; // "HH:MM"
export type JanelaDia = { ativo: boolean; intervalos: Intervalo[] };
export type UnidadeRetirada = {
  id: string; nome: string; endereco: string; ativo: boolean;
  /** Horário de funcionamento da loja: a retirada só é oferecida dentro dele. Sem = usa os horários gerais. */
  horarios?: Record<DiaKey, JanelaDia>;
};

export type ConfigEncomendas = {
  retiradaAtiva: boolean;
  unidades: UnidadeRetirada[];
  entregaAtiva: boolean;
  taxaEntrega: number;
  antecedenciaHoras: number;
  intervaloMin: number;
  maxPorPedido: number;
  janelas: Record<DiaKey, JanelaDia>;
  /** Primeira tela da página do cliente (vitrine de categorias e faixa de destaque). */
  vitrine: Vitrine;
  pixChave: string; // vazio = PIX de exemplo
  pixNome: string;
  pixCidade: string;
  whatsappContato: string;
};

export type CorDestaque = "rose" | "natal" | "verde" | "dourado" | "chocolate";
export const CORES_DESTAQUE: { key: CorDestaque; nome: string; de: string; ate: string }[] = [
  { key: "rose", nome: "Rosé", de: "#B0717F", ate: "#5E2F3E" },
  { key: "natal", nome: "Vermelho Natal", de: "#C0392B", ate: "#6E1414" },
  { key: "verde", nome: "Verde", de: "#2F7D55", ate: "#14432C" },
  { key: "dourado", nome: "Dourado", de: "#C79A3F", ate: "#7A5512" },
  { key: "chocolate", nome: "Chocolate", de: "#7B5544", ate: "#3B231A" },
];
export type Vitrine = {
  titulo: string;
  subtitulo: string;
  destaqueAtivo: boolean;
  destaqueTitulo: string;
  destaqueTexto: string;
  destaqueCor: CorDestaque;
  /** Mostra "a partir de R$ …" no card da categoria. */
  mostrarPreco: boolean;
  /** Mostra "N opções" no card da categoria. */
  mostrarQuantidade: boolean;
};
export const VITRINE_PADRAO: Vitrine = {
  titulo: "O que você vai querer?",
  subtitulo: "Escolha uma categoria para ver os produtos.",
  destaqueAtivo: true,
  destaqueTitulo: "Natal 2026",
  destaqueTexto: "Encomende com 48 h de antecedência e retire na loja mais perto de você.",
  destaqueCor: "natal",
  mostrarPreco: true,
  mostrarQuantidade: true,
};
/** Vitrine com os padrões para campos que ainda não existiam na configuração salva. */
export const vitrineDe = (cfg: { vitrine?: Partial<Vitrine> } | null | undefined): Vitrine => ({ ...VITRINE_PADRAO, ...(cfg?.vitrine ?? {}) });

const dia = (inicio: string, fim: string): JanelaDia => ({ ativo: true, intervalos: [{ inicio, fim }] });
export const CONFIG_PADRAO: ConfigEncomendas = {
  retiradaAtiva: true,
  // Lojas da Ju Budelon (as mesmas do estoque, sem a Fábrica). Por ora só retirada, sem entrega.
  unidades: [
    { id: "u-centro", nome: "Centro", endereco: "", ativo: true },
    { id: "u-santa-monica", nome: "Santa Mônica", endereco: "", ativo: true },
    { id: "u-coqueiros", nome: "Coqueiros", endereco: "", ativo: true },
    { id: "u-areias", nome: "Areias", endereco: "", ativo: true },
    { id: "u-rocado", nome: "Roçado", endereco: "", ativo: true },
    { id: "u-pagani", nome: "Pagani", endereco: "", ativo: true },
  ],
  entregaAtiva: false,
  taxaEntrega: 15,
  antecedenciaHoras: 48,
  intervaloMin: 60,
  maxPorPedido: 5,
  janelas: { dom: { ativo: false, intervalos: [] }, seg: dia("09:00", "18:00"), ter: dia("09:00", "18:00"), qua: dia("09:00", "18:00"), qui: dia("09:00", "18:00"), sex: dia("09:00", "18:00"), sab: dia("09:00", "14:00") },
  vitrine: VITRINE_PADRAO,
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

/**
 * Horários de uma janela: cada bloco fatiado a cada `intervaloMin`, sem repetir. Com `fimIncluso`
 * (horários gerais) o fim também é oferecido; no horário de funcionamento de uma loja, não (a loja fecha).
 */
export function horariosDaJanela(j: JanelaDia | undefined, intervaloMin: number, fimIncluso = true): string[] {
  if (!j?.ativo) return [];
  const passo = Math.max(5, intervaloMin || 60);
  const set = new Set<number>();
  for (const b of j.intervalos) for (let m = paraMin(b.inicio); fimIncluso ? m <= paraMin(b.fim) : m < paraMin(b.fim); m += passo) set.add(m);
  return [...set].sort((a, b) => a - b).map(deMin);
}
/** Horários de retirada/entrega do dia: os da loja escolhida (se ela tem horário próprio) ou os gerais. */
export const horariosDoDia = (cfg: ConfigEncomendas, iso: string, unidade?: UnidadeRetirada | null) =>
  unidade?.horarios ? horariosDaJanela(unidade.horarios[diaKeyDe(iso)], cfg.intervaloMin, false) : horariosDaJanela(cfg.janelas[diaKeyDe(iso)], cfg.intervaloMin);

/** "Seg a Sex 09:00–18:00 · Sáb 09:00–14:00" (dias fechados ficam de fora). */
export function resumoHorario(j: Record<DiaKey, JanelaDia> | undefined): string {
  if (!j) return "";
  const ordem: DiaKey[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
  const curto = (k: DiaKey) => DIAS.find((d) => d.key === k)!.curto;
  const txt = (k: DiaKey) => (j[k]?.ativo && j[k].intervalos.length ? j[k].intervalos.map((b) => `${b.inicio}–${b.fim}`).join(", ") : "");
  const grupos: { de: DiaKey; ate: DiaKey; t: string }[] = [];
  for (const k of ordem) {
    const t = txt(k), g = grupos[grupos.length - 1];
    if (g && g.t === t) g.ate = k; else grupos.push({ de: k, ate: k, t });
  }
  return grupos.filter((g) => g.t).map((g) => `${curto(g.de)}${g.de === g.ate ? "" : ` a ${curto(g.ate)}`} ${g.t}`).join(" · ") || "Fechada";
}

/** Instante de uma data + hora de Brasília (UTC−3, sem horário de verão): igual no navegador e no servidor (UTC). */
export const instanteBR = (iso: string, hora: string) => new Date(`${iso}T${hora}:00-03:00`);

/** Dia de hoje em Brasília (AAAA-MM-DD) + N dias — igual no navegador e no servidor. */
export const diaBR = (agora = new Date(), mais = 0) => new Date(agora.getTime() - 3 * 3600_000 + mais * 86400_000).toISOString().slice(0, 10);

/** O horário respeita a antecedência mínima (a geral, em horas, e o preparo do produto, em dias)? */
export const respeitaAntecedencia = (cfg: ConfigEncomendas, iso: string, hora: string, agora = new Date(), preparoDias = 0) =>
  instanteBR(iso, hora).getTime() - agora.getTime() >= cfg.antecedenciaHoras * 3600_000 && iso >= diaBR(agora, preparoDias);

/** "2 dias de preparo" (texto para a tela). */
export const textoPreparo = (dias?: number) => (dias && dias > 0 ? `${dias} dia${dias === 1 ? "" : "s"} de preparo` : "");

/** Problemas que impedem salvar a configuração (mensagens para a tela). */
export function validarConfig(c: ConfigEncomendas): string | null {
  if (!c.retiradaAtiva && !c.entregaAtiva) return "Ligue pelo menos uma forma de receber: retirada ou entrega.";
  if (c.retiradaAtiva && !c.unidades.some((u) => u.ativo && u.nome.trim())) return "A retirada está ligada, mas não há nenhuma loja ativa. Adicione uma loja ou desligue a retirada.";
  if (c.unidades.some((u) => !u.nome.trim())) return "Toda loja precisa de um nome.";
  for (const u of c.unidades) {
    if (!u.horarios) continue;
    for (const d of DIAS) {
      const j = u.horarios[d.key];
      if (j?.ativo && j.intervalos.some((b) => paraMin(b.fim) <= paraMin(b.inicio))) return `Horário inválido em ${u.nome || "uma loja"} (${d.label.toLowerCase()}): o fim precisa ser depois do início.`;
    }
    if (u.ativo && !DIAS.some((d) => horariosDaJanela(u.horarios![d.key], c.intervaloMin, false).length)) return `${u.nome || "Uma loja"} está ativa mas sem nenhum dia aberto no horário de funcionamento.`;
  }
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
  { key: "Confirmado com o cliente", cor: "#0EA5E9", agenda: "#0369A1" },
  { key: "Em produção", cor: "#F97316", agenda: "#D97706" },
  { key: "Pronto para retirada", cor: "#8B5CF6", agenda: "#7C3AED" },
  { key: "Entregue", cor: "#10B981", agenda: "#16A34A" },
] as const;
export type PedidoStatus = (typeof PEDIDO_STATUS)[number]["key"];
/**
 * No CRM só a primeira mudança é manual (pagamento conferido → "Confirmado com o cliente").
 * Depois o pedido anda sozinho, pelas tarefas: Produção em produção → "Em produção";
 * loja marcou Recebido → "Pronto para retirada"; loja marcou Entregue → "Entregue".
 */
export const mudancaManualPermitida = (de: PedidoStatus, para: PedidoStatus) => de === "Verificar pagamento" && para === "Confirmado com o cliente";
/** Posição no funil (para só avançar, nunca voltar). */
export const ordemPedido = (s: string) => PEDIDO_STATUS.findIndex((x) => x.key === s);

/** Próximo status do pedido no funil (null em "Entregue"). */
export const proximoPedido = (s: PedidoStatus): PedidoStatus | null => {
  const i = PEDIDO_STATUS.findIndex((x) => x.key === s);
  return i >= 0 && i < PEDIDO_STATUS.length - 1 ? PEDIDO_STATUS[i + 1].key : null;
};
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

/** Um produto do pedido (o pedido é um carrinho: um ou mais produtos). Nome e preço são o retrato da hora do pedido. */
export type ItemPedido = { produtoId: string; produtoNome: string; quantidade: number; preco: number; mensagem?: string };

export type PedidoEncomenda = {
  id: string;
  leadId: string;
  /** Produtos do pedido. Pedidos antigos (de um produto só) não têm: use `itensDoPedido`. */
  itens?: ItemPedido[];
  // Primeiro produto e total de unidades (compatibilidade com os pedidos de um produto só).
  produtoId: string;
  produtoNome?: string; // retrato do nome no pedido (o produto pode ser editado/excluído depois)
  quantidade: number;
  mensagem?: string; // pedidos antigos: escrita na torta / observação do cliente (nos novos, fica em cada item)
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
  /** Tarefas da loja (Lojas → Encomendas) e da produção já criadas — evita duplicar se o status voltar e avançar de novo. */
  tarefasCriadas?: boolean;
  /** Baixa já dada no estoque da loja (status Entregue) — volta a false se o status sair de Entregue. */
  estoqueBaixado?: boolean;
};

export type Compromisso = { id: string; titulo: string; data: string; hora: string; horaFim: string; contato?: string; notas?: string };

/** Produtos do pedido — os pedidos antigos (um produto só, sem `itens`) viram um item. */
export function itensDoPedido(p: Pick<PedidoEncomenda, "itens" | "produtoId" | "produtoNome" | "quantidade" | "subtotal" | "mensagem">): ItemPedido[] {
  if (p.itens?.length) return p.itens;
  return [{ produtoId: p.produtoId, produtoNome: p.produtoNome ?? "Produto", quantidade: p.quantidade, preco: p.quantidade ? Math.round((p.subtotal / p.quantidade) * 100) / 100 : 0, mensagem: p.mensagem }];
}
/** "2× Cheesecake Pistache, 1× Empadão de Frango" */
export const resumoItens = (itens: Pick<ItemPedido, "quantidade" | "produtoNome">[]) => itens.map((i) => `${i.quantidade}× ${i.produtoNome}`).join(", ");
/** Versão curta para títulos e cards: "2× Cheesecake Pistache + 2 itens". */
export const resumoItensCurto = (itens: Pick<ItemPedido, "quantidade" | "produtoNome">[]) =>
  itens.length ? `${itens[0].quantidade}× ${itens[0].produtoNome}${itens.length > 1 ? ` + ${itens.length - 1} ${itens.length === 2 ? "item" : "itens"}` : ""}` : "";
/** O pedido tem esse produto (em qualquer item)? */
export const pedidoTemProduto = (p: Pick<PedidoEncomenda, "itens" | "produtoId">, produtoId: string) => p.produtoId === produtoId || !!p.itens?.some((i) => i.produtoId === produtoId);
/** Máximo de produtos diferentes num pedido. */
export const MAX_ITENS_PEDIDO = 20;

export const numeroPedido = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();
export const enderecoLinha = (e?: PedidoEncomenda["endereco"]) =>
  e ? [`${e.rua}, ${e.numero}`, e.bairro, e.cidade, e.complemento].filter(Boolean).join(" · ") : "";

// ── Regras compartilhadas (tela de demonstração e servidor) ─────────────────

/** Produtos ativos agrupados pelas categorias, na ordem das categorias ("Sem categoria" por último). */
export function catalogoPorCategoria(categorias: Categoria[], produtos: ProdutoEncomenda[], soAtivos = true) {
  // Na página do cliente, categoria oculta esconde também os produtos dela.
  const ocultas = new Set(categorias.filter((c) => !categoriaAtiva(c)).map((c) => c.id));
  const lista = soAtivos ? produtos.filter((p) => p.ativo && !(p.categoriaId && ocultas.has(p.categoriaId))) : produtos;
  if (soAtivos) categorias = categorias.filter(categoriaAtiva);
  const grupos = categorias.map((c) => ({ categoria: c as Categoria | null, produtos: lista.filter((p) => p.categoriaId === c.id) }));
  const sem = lista.filter((p) => !p.categoriaId || !categorias.some((c) => c.id === p.categoriaId));
  if (sem.length) grupos.push({ categoria: null, produtos: sem });
  return soAtivos ? grupos.filter((g) => g.produtos.length) : grupos;
}

/** Item do carrinho como a tela manda: preço e nome saem do catálogo, no servidor. */
export type ItemNovo = { produtoId: string; quantidade: number; mensagem?: string };
export type NovoPedido = Pick<PedidoEncomenda, "tipo" | "unidadeId" | "endereco" | "data" | "hora"> & { itens: ItemNovo[]; nome: string; whatsapp: string };

/** Produto do carrinho que pede mais dias de preparo (decide a primeira data possível). */
export function maiorPreparo(itens: { produtoId: string }[], produtoDe: (id: string) => ProdutoEncomenda | undefined): { dias: number; produto?: ProdutoEncomenda } {
  let r: { dias: number; produto?: ProdutoEncomenda } = { dias: 0 };
  for (const i of itens) { const p = produtoDe(i.produtoId); if (p?.preparoDias && p.preparoDias > r.dias) r = { dias: p.preparoDias, produto: p }; }
  return r;
}

/** WhatsApp canônico (55 + DDD + número). */
export const numeroCanonico = (whatsapp: string) => normalizePhone(whatsapp).replace(/^(?!55)/, "55");

/**
 * Confere o pedido do autoatendimento contra o catálogo e a configuração e calcula os valores.
 * O total SEMPRE sai daqui (nunca vem pronto da tela). Devolve a mensagem de erro ou os dados.
 */
export function validarNovoPedido(n: NovoPedido, produtos: ProdutoEncomenda[], cfg: ConfigEncomendas, agora = new Date()):
  | { erro: string }
  | { itens: ItemPedido[]; unidade?: UnidadeRetirada; quantidade: number; numero: string; nome: string; subtotal: number; taxa: number; total: number; resumo: string } {
  const lista = Array.isArray(n.itens) ? n.itens : [];
  if (!lista.length) return { erro: "Seu pedido está vazio. Escolha pelo menos um produto." };
  if (lista.length > MAX_ITENS_PEDIDO) return { erro: `O pedido pode ter até ${MAX_ITENS_PEDIDO} produtos.` };
  const itens: ItemPedido[] = [];
  for (const it of lista) {
    const produto = produtos.find((p) => p.id === it?.produtoId && p.ativo);
    if (!produto) return { erro: "Um dos produtos do seu pedido não está mais disponível. Tire ele do pedido e tente de novo." };
    const quantidade = Math.floor(Number(it.quantidade));
    if (!(quantidade >= 1) || quantidade > cfg.maxPorPedido) return { erro: `A quantidade de ${produto.nome} precisa ser de 1 a ${cfg.maxPorPedido}.` };
    const mensagem = (typeof it.mensagem === "string" ? it.mensagem : "").trim().slice(0, 300) || undefined;
    itens.push({ produtoId: produto.id, produtoNome: produto.nome, quantidade, preco: produto.preco, mensagem });
  }
  let unidade: UnidadeRetirada | undefined;
  if (n.tipo === "Retirada") {
    if (!cfg.retiradaAtiva) return { erro: "A retirada não está disponível no momento." };
    unidade = cfg.unidades.find((u) => u.id === n.unidadeId && u.ativo && u.nome.trim());
    if (!unidade) return { erro: "Escolha uma loja para a retirada." };
  } else if (n.tipo === "Entrega") {
    if (!cfg.entregaAtiva) return { erro: "A entrega não está disponível no momento." };
    const e = n.endereco;
    if (!e || e.cidade.trim().length < 3 || e.bairro.trim().length < 2 || e.rua.trim().length < 3 || !e.numero.trim()) return { erro: "Preencha o endereço de entrega." };
  } else return { erro: "Escolha retirada ou entrega." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.data ?? "") || !/^\d{2}:\d{2}$/.test(n.hora ?? "")) return { erro: "Escolha a data e o horário." };
  if (!horariosDoDia(cfg, n.data, unidade).includes(n.hora)) return { erro: unidade?.horarios ? `Esse horário está fora do funcionamento da loja ${unidade.nome}. Escolha outro.` : "Esse horário não está disponível. Escolha outro." };
  const prep = maiorPreparo(itens, (id) => produtos.find((p) => p.id === id));
  if (!respeitaAntecedencia(cfg, n.data, n.hora, agora, prep.dias)) {
    return { erro: prep.produto ? `${prep.produto.nome} precisa de ${textoPreparo(prep.dias)}: escolha a partir de ${dataBR(diaBR(agora, prep.dias))}.` : `Os pedidos precisam de ${cfg.antecedenciaHoras} h de antecedência. Escolha outro horário.` };
  }
  const nome = (n.nome ?? "").trim().slice(0, 80);
  if (nome.length < 2) return { erro: "Informe seu nome." };
  if (normalizePhone(n.whatsapp).length < 10) return { erro: "Informe um WhatsApp válido, com DDD." };
  const subtotal = Math.round(itens.reduce((s, i) => s + i.preco * i.quantidade, 0) * 100) / 100;
  const taxa = n.tipo === "Entrega" ? cfg.taxaEntrega : 0;
  const total = Math.round((subtotal + taxa) * 100) / 100;
  const resumo = [
    `Cliente: ${nome}`,
    `Itens: ${resumoItens(itens)}`,
    ...itens.filter((i) => i.mensagem).map((i) => `Observação (${i.produtoNome}): ${i.mensagem}`),
    `Valor: ${brl(total)}`,
    "Pagamento: PIX",
    `${n.tipo}: ${dataBR(n.data)} às ${n.hora}`,
    unidade ? `Loja: ${unidade.nome}` : "",
  ].filter(Boolean).join("\n");
  return { itens, unidade, quantidade: itens.reduce((s, i) => s + i.quantidade, 0), numero: numeroCanonico(n.whatsapp), nome, subtotal, taxa, total, resumo };
}

/** Pedido novo (autoatendimento) a partir do que `validarNovoPedido` aprovou — o mesmo no demo e no servidor. */
export function montarPedidoNovo(n: NovoPedido, v: Exclude<ReturnType<typeof validarNovoPedido>, { erro: string }>, leadId: string, agora: string): PedidoEncomenda {
  return {
    id: crypto.randomUUID(), leadId, itens: v.itens, produtoId: v.itens[0].produtoId, produtoNome: v.itens[0].produtoNome, quantidade: v.quantidade,
    tipo: n.tipo, unidadeId: v.unidade?.id, unidadeNome: v.unidade?.nome, endereco: n.tipo === "Entrega" ? n.endereco : undefined, data: n.data, hora: n.hora,
    subtotal: v.subtotal, taxa: v.taxa, total: v.total, status: "Verificar pagamento", criadoEm: agora, origem: "autoatendimento",
  };
}

/** Pagamento confirmado: o pedido sai de "Verificar pagamento" para "Confirmado com o cliente" (ou direto para a produção). */
export const confirmaPagamento = (de: PedidoStatus, para: PedidoStatus) => de === "Verificar pagamento" && (para === "Confirmado com o cliente" || para === "Em produção");

/** Primeiro nome com a inicial maiúscula ("maria da silva" → "Maria"). */
const primeiroNomeCliente = (nome: string) => {
  const p = nome.trim().split(/\s+/)[0] ?? "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
};

/** Mensagem pronta para confirmar a encomenda com o cliente pelo WhatsApp (pagamento já conferido). */
export function mensagemConfirmacaoPedido(x: { nome: string; empresa: string; pedido: Pick<PedidoEncomenda, "id" | "status" | "total" | "taxa" | "subtotal" | "itens" | "produtoId" | "produtoNome" | "quantidade" | "mensagem" | "tipo" | "data" | "hora" | "unidadeNome" | "endereco">; link?: string }): string {
  const nome = primeiroNomeCliente(x.nome);
  const p = x.pedido;
  const quando = `${dataBR(p.data)} às ${p.hora}`;
  const onde = p.tipo === "Retirada"
    ? `Retirada: ${quando}${p.unidadeNome ? ` na loja ${p.unidadeNome}` : ""}`
    : `Entrega: ${quando}${p.endereco ? ` em ${enderecoLinha(p.endereco)}` : ""}`;
  // Antes de conferir o PIX não dá para dizer que o pagamento foi validado.
  const pago = p.status !== "Verificar pagamento";
  return [
    `Oi${nome ? `, ${nome}` : ""}, tudo bem? Aqui é da ${x.empresa || "Ju Budelon"}.`,
    pago
      ? "Acabamos de verificar o seu pagamento: a sua encomenda está confirmada e já está em processo!"
      : "Recebemos a sua encomenda e estamos verificando o pagamento. Assim que confirmar, ela entra em processo.",
    [
      `Pedido #${numeroPedido(p.id)}`,
      ...itensDoPedido(p).map((i) => `• ${i.quantidade}× ${i.produtoNome}${i.mensagem ? ` (obs.: ${i.mensagem})` : ""}`),
      p.taxa > 0 ? `• Taxa de entrega: ${brl(p.taxa)}` : "",
      `• ${onde}`,
      `• Valor total: ${brl(p.total)} (PIX)`,
    ].filter(Boolean).join("\n"),
    x.link ? `Acompanhe o andamento do seu pedido por aqui:\n${x.link}` : "",
    "Pode confirmar se está tudo certinho? Qualquer dúvida, é só chamar por aqui!",
  ].filter(Boolean).join("\n\n");
}

/** Link do WhatsApp (wa.me) com o texto pronto. null sem número. */
export const linkWhatsapp = (numero: string, texto: string) => {
  const n = numero.replace(/\D/g, "");
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
};

/** Unidade de retirada → local do estoque/tarefas (u-centro → centro). */
export const localDaUnidade = (unidadeId: string | undefined, locais: { id: string }[]) => {
  const id = (unidadeId ?? "").replace(/^u-/, "");
  return locais.some((l) => l.id === id) ? id : undefined;
};

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Tarefas do pedido com pagamento confirmado:
 *  - Produção (categoria "operacional"): produzir até a data/hora de retirada; com produto do Estoque,
 *    a conferência faz a conclusão somar na Fábrica.
 *  - Lojas → Encomendas (categoria "encomenda"): a loja confere o que chegou ("Recebido" move o estoque
 *    Fábrica → loja) e entrega ao cliente; o "Entregue" no CRM dá a baixa na loja.
 */
export function tarefasDaEncomenda(
  p: PedidoEncomenda,
  x: { cliente: string; numero?: string; estoqueDe: (produtoId: string) => string | null | undefined; local?: string; responsavel: string; agora: { date: string; hora: string }; base: number },
): Task[] {
  const venc = dataBR(p.data);
  const num = numeroPedido(p.id);
  const loja = p.unidadeNome ?? "Loja";
  const lista = itensDoPedido(p);
  const itensLi = lista.map((i) => `<li>${i.quantidade}× ${escHtml(i.produtoNome)}${i.mensagem ? ` — <em>obs.: ${escHtml(i.mensagem)}</em>` : ""}</li>`).join("");
  const log = () => [{ id: crypto.randomUUID(), message: `🎂 Criada automaticamente pelo CRM de Encomendas (pedido #${num}, pagamento confirmado).`, author: "sistema", created_at: new Date().toISOString(), tipo: "log" as const }];
  // Conferência: uma linha por item do Estoque (produtos repetidos somam).
  const porEstoque = new Map<string, number>();
  for (const i of lista) { const e = x.estoqueDe(i.produtoId); if (e) porEstoque.set(e, (porEstoque.get(e) ?? 0) + i.quantidade); }
  const conferencia = porEstoque.size ? [...porEstoque].map(([produtoId, pedido]) => ({ produtoId, pedido })) : undefined;
  const umSo = conferencia?.length === 1 ? conferencia[0] : undefined;
  const comum = { gestor: x.responsavel, status: "verificar" as const, prio: "normal" as const, tipo: "Encomenda", local: x.local, criada: x.agora.date, criadaHora: x.agora.hora, venc, vencHora: p.hora, conferencia };
  const fone = x.numero ? ` · ${foneBR(x.numero)}` : "";
  const producao: Task = {
    ...comum,
    // O id do pedido vai no id da tarefa: quando a Produção coloca "Em produção", o pedido acompanha no CRM.
    id: `t-${x.base}-encp-${p.id}`,
    titulo: `Encomenda - ${resumoItensCurto(lista)} - ${x.cliente} - ${venc}`,
    categoria: "operacional",
    produtoId: umSo?.produtoId,
    quantidade: umSo?.pedido,
    desc:
      `<p><strong>Encomenda #${num}</strong> — produzir:</p><ul>${itensLi}</ul>` +
      `<p><strong>Sai para a loja ${escHtml(loja)}</strong>: retirada do cliente em <strong>${venc} às ${p.hora}</strong>. A encomenda precisa estar pronta e na loja antes disso.</p>` +
      `<p><strong>Cliente:</strong> ${escHtml(x.cliente)}</p>`,
    comentarios: log(),
  };
  const lojaT: Task = {
    ...comum,
    // O id do pedido vai no id da tarefa: a tela da loja mostra a foto e os dados do pedido.
    id: `t-${x.base}-encl-${p.id}`,
    titulo: `Encomenda - ${x.cliente} - ${loja} - ${venc}`,
    categoria: "encomenda",
    desc:
      `<p><strong>Encomenda #${num}</strong> · retirada na loja <strong>${escHtml(loja)}</strong> em <strong>${venc} às ${p.hora}</strong>.</p>` +
      `<p><strong>Cliente:</strong> ${escHtml(x.cliente)}${fone}</p>` +
      `<ul>${itensLi}</ul>` +
      `<p><strong>Valor:</strong> ${brl(p.total)} (PIX)</p>` +
      `<p>Quando a encomenda chegar da produção, marque <strong>Recebido</strong> e confira a quantidade (entra no estoque da loja; no CRM o pedido fica <strong>Pronto para retirada</strong>). Ao entregar ao cliente, marque <strong>Entregue</strong>: o estoque da loja dá baixa e o CRM acompanha.</p>`,
    comentarios: log(),
  };
  return [producao, lojaT];
}

/** Unidades do pedido por item do Estoque (produtos sem item de estoque ficam de fora; repetidos somam). */
export function quantidadesPorEstoque(p: Parameters<typeof itensDoPedido>[0], estoqueDe: (produtoId: string) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of itensDoPedido(p)) { const e = estoqueDe(i.produtoId); if (e) m.set(e, (m.get(e) ?? 0) + i.quantidade); }
  return m;
}

/** Efeito do status no estoque da loja: 1 = dar baixa (foi para Entregue), −1 = devolver (saiu de Entregue), 0 = nada. */
export function efeitoEstoque(p: Pick<PedidoEncomenda, "estoqueBaixado">, para: PedidoStatus): 1 | -1 | 0 {
  if (para === "Entregue" && !p.estoqueBaixado) return 1;
  if (para !== "Entregue" && p.estoqueBaixado) return -1;
  return 0;
}


// ── PIX copia-e-cola (BR Code estático do Banco Central, com valor) ─────────

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 .\-]/g, "").trim();
const campoEmv = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, "0")}${valor}`;

/** CRC16-CCITT (0xFFFF, polinômio 0x1021) — o campo 63 do BR Code. */
function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Chave PIX no formato do DICT: chave aleatória (UUID) como está; e-mail em minúsculas;
 * celular "+55…" só com dígitos; CPF/CNPJ sem pontuação.
 */
export function chavePixNormalizada(chave: string): string {
  const c = (chave ?? "").trim();
  if (!c) return "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return c.toLowerCase();
  if (c.includes("@")) return c.toLowerCase();
  if (c.startsWith("+")) return "+" + c.replace(/\D/g, "");
  if (/^[\d.\-/\s()]+$/.test(c)) return c.replace(/\D/g, "");
  return c;
}

/**
 * Código PIX copia-e-cola (o mesmo conteúdo do QR) para a chave da configuração, com o valor do
 * pedido e o número do pedido como identificador (txid) — aparece no extrato de quem recebe.
 * null quando a chave não está configurada.
 */
export function pixCopiaECola(cfg: Pick<ConfigEncomendas, "pixChave" | "pixNome" | "pixCidade">, valor: number, txid: string): string | null {
  const chave = chavePixNormalizada(cfg.pixChave);
  if (!chave) return null;
  const nome = (semAcento(cfg.pixNome).toUpperCase() || "JU BUDELON").slice(0, 25);
  const cidade = (semAcento(cfg.pixCidade).toUpperCase() || "FLORIANOPOLIS").slice(0, 15);
  const id = (txid.replace(/[^A-Za-z0-9]/g, "") || "***").slice(0, 25);
  const corpo =
    campoEmv("00", "01") +
    campoEmv("26", campoEmv("00", "br.gov.bcb.pix") + campoEmv("01", chave)) +
    campoEmv("52", "0000") +
    campoEmv("53", "986") +
    (valor > 0 ? campoEmv("54", valor.toFixed(2)) : "") +
    campoEmv("58", "BR") +
    campoEmv("59", nome) +
    campoEmv("60", cidade) +
    campoEmv("62", campoEmv("05", id)) +
    "6304";
  return corpo + crc16(corpo);
}

// ── Acompanhamento do pedido pelo cliente (/pedido/[id], estilo app de delivery) ─────

/**
 * O que a página pública de acompanhamento mostra. O link leva o id do pedido (UUID aleatório):
 * só quem recebeu o link vê. Nada de telefone nem endereço completo do cliente.
 */
export type Acompanhamento = {
  id: string;
  numero: string;
  status: PedidoStatus;
  cliente: string; // primeiro nome
  itens: { nome: string; quantidade: number; foto: string | null; preco: number }[];
  tipo: TipoEntrega;
  data: string;
  hora: string;
  total: number;
  criadoEm: string;
  unidade?: { nome: string; endereco: string; horario: string };
  bairro?: string; // entrega: só o bairro
};

/** Pedido com id de UUID (os do banco). Os do modo demo ("p-…") só abrem no navegador do demo. */
export const idAcompanhamentoValido = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const linkAcompanhamento = (pedidoId: string, origem: string) => `${origem.replace(/\/$/, "")}/pedido/${encodeURIComponent(pedidoId)}`;

export function montarAcompanhamento(p: PedidoEncomenda, x: { fotoDe: (produtoId: string) => string | null | undefined; clienteNome: string; cfg: ConfigEncomendas }): Acompanhamento {
  const u = p.tipo === "Retirada" ? x.cfg.unidades.find((y) => y.id === p.unidadeId) : undefined;
  const primeiro = x.clienteNome.trim().split(/\s+/)[0] ?? "";
  return {
    id: p.id, numero: numeroPedido(p.id), status: p.status, cliente: primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : "",
    itens: itensDoPedido(p).map((i) => ({ nome: i.produtoNome || "Encomenda", quantidade: i.quantidade, foto: x.fotoDe(i.produtoId) ?? null, preco: i.preco })),
    tipo: p.tipo, data: p.data, hora: p.hora, total: p.total, criadoEm: p.criadoEm,
    unidade: p.tipo === "Retirada" ? { nome: u?.nome || p.unidadeNome || "", endereco: u?.endereco ?? "", horario: resumoHorario(u?.horarios) } : undefined,
    bairro: p.tipo === "Entrega" ? p.endereco?.bairro : undefined,
  };
}

/** Etapas na linguagem do cliente (a mesma ordem do funil do CRM). */
export function etapasCliente(a: Pick<Acompanhamento, "tipo" | "unidade">): { status: PedidoStatus; titulo: string; texto: string }[] {
  const retirada = a.tipo === "Retirada";
  const loja = a.unidade?.nome ? `na loja ${a.unidade.nome}` : "na loja";
  return [
    { status: "Verificar pagamento", titulo: "Pedido recebido", texto: "Estamos conferindo o seu pagamento." },
    { status: "Confirmado com o cliente", titulo: "Pagamento confirmado", texto: "Seu pedido está confirmado e na fila da produção." },
    { status: "Em produção", titulo: "Em produção", texto: "Nossa equipe está preparando a sua encomenda com carinho." },
    { status: "Pronto para retirada", titulo: retirada ? "Pronto para retirada" : "Pronto para entrega", texto: retirada ? `Já está ${loja} esperando por você.` : "Seu pedido está pronto e logo sai para entrega." },
    { status: "Entregue", titulo: retirada ? "Retirado" : "Entregue", texto: "Pedido entregue. Bom apetite!" },
  ];
}
