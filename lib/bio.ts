/**
 * Marketing → Link na Bio: tipos, valores padrão e regras usadas pelo painel e pela página
 * pública (/bio). Sem "use client": a página pública lê isto no servidor.
 * (Mesmo desenho do Link na Bio do Instituto, adaptado à Ju Budelon.)
 */

export const BIO_PATH = "/bio";

export type BioTamanho = "sm" | "md" | "lg";
export type BioEventoPagina = "PageView" | "ViewContent" | "Lead";
export type BioEventoClique = "Contact" | "Lead" | "CompleteRegistration" | "Schedule" | "InitiateCheckout" | "ViewContent" | "none";

export type BioPagina = {
  publicada: boolean;
  titulo: string;
  bio: string;
  avatar: string | null;
  capa: string | null;
  corFundo: string;
  corBotao: string;
  corTextoBotao: string;
  instagram: string;
  pixelId: string;
  eventoPagina: BioEventoPagina;
  layout: "destaque" | "classico";
  fonteTitulo: "serif" | "sans";
  tamTitulo: BioTamanho;
  tamBio: BioTamanho;
  tamBotao: BioTamanho;
};

export type BioLink = {
  id: string;
  titulo: string;
  subtitulo: string;
  url: string;
  imagem: string | null;
  ativo: boolean;
  ordem: number;
  cliques: number;
  eventoMeta: BioEventoClique;
};

/** Uma visita à página ou um clique num botão (relatório). */
export type BioEvento = { linkId: string | null; tipo: "view" | "click"; aparelho: string; origem: string; em: string };

export const BIO_PAGINA_PADRAO: BioPagina = {
  publicada: true,
  titulo: "Ju Budelon",
  bio: "Cozinha Criativa 💗 Escolha por onde quer pedir:",
  avatar: "/logo.png",
  capa: null,
  corFundo: "#FBE4E9",
  corBotao: "#FFFFFF",
  corTextoBotao: "#955C6B",
  instagram: "jubudelon",
  pixelId: "",
  eventoPagina: "PageView",
  layout: "classico",
  fonteTitulo: "serif",
  tamTitulo: "md",
  tamBio: "md",
  tamBotao: "md",
};

/** Os 3 botões do início (o iFood vai com a busca até colar o link da loja). */
export const BIO_LINKS_PADRAO: BioLink[] = [
  { id: "bio-instagram", titulo: "Instagram", subtitulo: "@jubudelon", url: "https://instagram.com/jubudelon", imagem: null, ativo: true, ordem: 0, cliques: 0, eventoMeta: "Contact" },
  { id: "bio-ifood", titulo: "Peça pelo iFood", subtitulo: "Entrega na sua casa", url: "https://www.ifood.com.br/busca?q=ju%20budelon", imagem: null, ativo: true, ordem: 1, cliques: 0, eventoMeta: "InitiateCheckout" },
  { id: "bio-encomendas", titulo: "Faça sua encomenda", subtitulo: "Bolos e doces para retirar na loja", url: "/encomendar", imagem: null, ativo: true, ordem: 2, cliques: 0, eventoMeta: "InitiateCheckout" },
];

/** Eventos do Pixel ao abrir a página. O PageView sai sempre; os outros vão junto com ele. */
export const BIO_EVENTOS_PAGINA: { v: BioEventoPagina; label: string; dica: string }[] = [
  { v: "PageView", label: "PageView", dica: "Visualização da página (padrão)" },
  { v: "ViewContent", label: "ViewContent", dica: "PageView + visualização de conteúdo" },
  { v: "Lead", label: "Lead", dica: "PageView + lead (cadastro)" },
];

/** Eventos do Pixel ao tocar num botão. */
export const BIO_EVENTOS_CLIQUE: { v: BioEventoClique; label: string; dica: string }[] = [
  { v: "Contact", label: "Contato", dica: "Contact — falou com a empresa (padrão)" },
  { v: "InitiateCheckout", label: "Início de compra", dica: "InitiateCheckout — foi pedir (iFood, encomenda)" },
  { v: "Lead", label: "Cadastro (Lead)", dica: "Lead — demonstrou interesse" },
  { v: "CompleteRegistration", label: "Cadastro completo", dica: "CompleteRegistration" },
  { v: "Schedule", label: "Agendamento", dica: "Schedule — marcou horário" },
  { v: "ViewContent", label: "Ver conteúdo", dica: "ViewContent" },
  { v: "none", label: "Nenhum", dica: "Não envia evento" },
];
const EV_PAGINA = new Set(BIO_EVENTOS_PAGINA.map((e) => e.v));
const EV_CLIQUE = new Set(BIO_EVENTOS_CLIQUE.map((e) => e.v));
export const eventoPaginaDe = (v: unknown): BioEventoPagina => (EV_PAGINA.has(v as BioEventoPagina) ? (v as BioEventoPagina) : "PageView");
export const eventoCliqueDe = (v: unknown): BioEventoClique => (EV_CLIQUE.has(v as BioEventoClique) ? (v as BioEventoClique) : "Contact");
export const rotuloEventoClique = (v: BioEventoClique) => BIO_EVENTOS_CLIQUE.find((e) => e.v === v)?.label ?? v;

/** Temas prontos (fundo · botão · texto do botão), nas cores da Ju. */
export const BIO_TEMAS: { nome: string; fundo: string; botao: string; texto: string }[] = [
  { nome: "Ju Budelon", fundo: "#FBE4E9", botao: "#FFFFFF", texto: "#955C6B" },
  { nome: "Vinho", fundo: "#955C6B", botao: "#FFFFFF", texto: "#6E3F4C" },
  { nome: "Rosa", fundo: "#F5ABBA", botao: "#FFF6F8", texto: "#7A3F50" },
  { nome: "Creme", fundo: "#F7EFE6", botao: "#FFFFFF", texto: "#5B4636" },
  { nome: "Claro", fundo: "#F5F6F8", botao: "#955C6B", texto: "#FFFFFF" },
  { nome: "Noite", fundo: "#1B1B28", botao: "#2A2A3A", texto: "#F9FAFB" },
];

const COR = /^#[0-9a-f]{6}$/i;
const TAM = new Set(["sm", "md", "lg"]);
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
// URL do Storage (https) ou da pasta public ("/logo.png"); data-URL só no modo demo (imagem fica no navegador).
const img = (v: unknown) => (typeof v === "string" && ((/^(https:\/\/|\/)/.test(v) && v.length < 1000) || (/^data:image\//.test(v) && v.length < 2_000_000)) ? v : null);

/** Objeto cru (jsonb / localStorage / corpo da API) → página válida (campos desconhecidos caem). */
export function paginaDe(raw: unknown): BioPagina {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const p = BIO_PAGINA_PADRAO;
  const tam = (v: unknown, d: BioTamanho): BioTamanho => (TAM.has(v as string) ? (v as BioTamanho) : d);
  return {
    publicada: typeof o.publicada === "boolean" ? o.publicada : p.publicada,
    titulo: "titulo" in o ? texto(o.titulo, 60) : p.titulo,
    bio: "bio" in o ? texto(o.bio, 300) : p.bio,
    avatar: "avatar" in o ? img(o.avatar) : p.avatar,
    capa: "capa" in o ? img(o.capa) : p.capa,
    corFundo: COR.test(String(o.corFundo)) ? String(o.corFundo) : p.corFundo,
    corBotao: COR.test(String(o.corBotao)) ? String(o.corBotao) : p.corBotao,
    corTextoBotao: COR.test(String(o.corTextoBotao)) ? String(o.corTextoBotao) : p.corTextoBotao,
    instagram: "instagram" in o ? texto(o.instagram, 40).replace(/[^\w.]/g, "") : p.instagram,
    pixelId: "pixelId" in o ? texto(o.pixelId, 20).replace(/\D/g, "") : p.pixelId,
    eventoPagina: eventoPaginaDe(o.eventoPagina),
    layout: o.layout === "destaque" ? "destaque" : o.layout === "classico" ? "classico" : p.layout,
    fonteTitulo: o.fonteTitulo === "sans" ? "sans" : o.fonteTitulo === "serif" ? "serif" : p.fonteTitulo,
    tamTitulo: tam(o.tamTitulo, p.tamTitulo),
    tamBio: tam(o.tamBio, p.tamBio),
    tamBotao: tam(o.tamBotao, p.tamBotao),
  };
}

/** Campos editáveis de um botão (o resto — id, ordem, cliques — é do sistema). */
export type BioLinkEntrada = Pick<BioLink, "titulo" | "subtitulo" | "url" | "imagem" | "ativo" | "eventoMeta">;
export function linkEntradaDe(raw: unknown): BioLinkEntrada | null {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const titulo = texto(o.titulo, 90).trim();
  const url = normalizarUrl(texto(o.url, 1000));
  if (!titulo || !urlValida(url)) return null;
  return { titulo, subtitulo: texto(o.subtitulo, 90).trim(), url, imagem: img(o.imagem), ativo: o.ativo !== false, eventoMeta: eventoCliqueDe(o.eventoMeta) };
}

/** Cor clara? (decide se o texto sobre o fundo fica escuro ou branco) */
export function corClara(hex: string) {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

/**
 * Endereço digitado → link que abre: "instagram.com/x" ganha https://; telefone vira wa.me;
 * "@usuario" vira o perfil do Instagram; "/encomendar" (página deste sistema) fica como está.
 */
export function normalizarUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^\/[\w\-/?=&.%]*$/.test(v)) return v;
  if (/^@[\w.]+$/.test(v)) return `https://instagram.com/${v.slice(1)}`;
  const dig = v.replace(/\D/g, "");
  if (/^[\d\s()+-]+$/.test(v) && dig.length >= 10) return `https://wa.me/${dig.startsWith("55") ? dig : "55" + dig}`;
  return `https://${v}`;
}

export function urlValida(url: string): boolean {
  if (/^\/[\w\-/?=&.%]*$/.test(url)) return true;
  try {
    const u = new URL(url);
    if (!["http:", "https:", "mailto:", "tel:"].includes(u.protocol)) return false;
    return u.protocol === "http:" || u.protocol === "https:" ? u.hostname.includes(".") : true;
  } catch {
    return false;
  }
}

/** Texto curto para o tipo de destino (ajuda a conferir o link). */
export function tipoDoLink(url: string): string {
  if (url.startsWith("/encomendar")) return "Encomendas (este sistema)";
  if (url.startsWith("/vagas")) return "Vagas (este sistema)";
  if (url.startsWith("/")) return "Página deste sistema";
  if (/wa\.me|whatsapp/i.test(url)) return "WhatsApp";
  if (/instagram\.com/i.test(url)) return "Instagram";
  if (/ifood/i.test(url)) return "iFood";
  if (/youtube\.com|youtu\.be/i.test(url)) return "YouTube";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ── Modo demonstração (sem banco): tudo no navegador ──────────────────────────
const CHAVE_DEMO = "jb-bio-demo-v1";
export type BioDemo = { pagina: BioPagina; links: BioLink[]; eventos: BioEvento[] };

export function lerBioDemo(): BioDemo {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAVE_DEMO) || "null") as Partial<BioDemo> | null;
    if (raw && Array.isArray(raw.links)) return { pagina: paginaDe(raw.pagina), links: raw.links, eventos: Array.isArray(raw.eventos) ? raw.eventos.slice(-5000) : [] };
  } catch {}
  return { pagina: { ...BIO_PAGINA_PADRAO }, links: BIO_LINKS_PADRAO.map((l) => ({ ...l })), eventos: [] };
}

export function gravarBioDemo(d: BioDemo) {
  try { localStorage.setItem(CHAVE_DEMO, JSON.stringify({ ...d, eventos: d.eventos.slice(-5000) })); } catch {}
}

export const aparelhoDe = (ua: string): "mobile" | "desktop" => (/Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? "mobile" : "desktop");

/** Instagram/Facebook pelo navegador interno do app (user-agent) ou pelo site de origem. */
export function origemDe(ua: string, referer: string | null | undefined): string {
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  if (referer) {
    try {
      const host = new URL(referer).hostname.replace(/^(www|l|m)\./, "");
      if (/instagram\.com$/.test(host)) return "instagram";
      if (/facebook\.com$/.test(host)) return "facebook";
      if (host && !/localhost|vercel\.app|gerencia\.tech|jubudelon/.test(host)) return host;
    } catch {}
  }
  return "direto";
}
