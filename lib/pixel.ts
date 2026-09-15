/**
 * Pixel do Facebook (Meta) — o mesmo snippet oficial que vai no <head> de um site,
 * só que carregado sob demanda pela página pública de vagas, com o ID configurado
 * em Recrutamento → Vagas → Página pública (nada fica fixo no código).
 */
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[]; push: unknown; loaded: boolean; version: string };
type W = Window & { fbq?: Fbq; _fbq?: Fbq };

const inicializados = new Set<string>();

export function pixelInit(id: string) {
  if (typeof window === "undefined" || !id) return;
  const w = window as W;
  if (!w.fbq) {
    const n = function (...args: unknown[]) { if (n.callMethod) n.callMethod(...args); else n.queue.push(args); } as Fbq;
    n.queue = []; n.push = n; n.loaded = true; n.version = "2.0";
    w.fbq = n; w._fbq = n;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  if (inicializados.has(id)) return;
  inicializados.add(id);
  w.fbq!("init", id);
}

export function pixelTrack(evento: "PageView" | "Lead", dados?: Record<string, string>) {
  if (typeof window === "undefined") return;
  const w = window as W;
  if (!w.fbq) return;
  if (dados && Object.keys(dados).length) w.fbq("track", evento, dados);
  else w.fbq("track", evento);
}
