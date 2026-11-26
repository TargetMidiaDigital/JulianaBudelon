"use client";

import { useEffect, useRef } from "react";
import { Playfair_Display } from "next/font/google";
import { corClara, type BioLink, type BioPagina, type BioTamanho } from "@/lib/bio";
import { pixelInit, pixelTrack } from "@/lib/pixel";

/** Fonte "elegante" do nome (como no Link na Bio do Instituto). */
const serifada = Playfair_Display({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });

const TITULO: Record<"sans" | "serif", Record<BioTamanho, number>> = { sans: { sm: 20, md: 24, lg: 30 }, serif: { sm: 26, md: 32, lg: 40 } };
const BIO: Record<BioTamanho, number> = { sm: 13, md: 15, lg: 17 };
const BTN: Record<BioTamanho, number> = { sm: 13.5, md: 14.5, lg: 16.5 };
const BTN_SUB: Record<BioTamanho, number> = { sm: 11.5, md: 12.5, lg: 14 };
const BTN_ALT: Record<BioTamanho, number> = { sm: 56, md: 64, lg: 72 };

/**
 * A página "Link na Bio" como o visitante vê: capa/foto, nome, bio e os botões.
 * Usada na página pública (/bio) e na prévia do painel (preview = links não navegam, sem pixel).
 * Na página pública com banco, o botão passa pelo contador de cliques: `${baseLink}${id}`.
 * Sem banco (demo), `aoClicar` conta o clique no navegador.
 */
export default function BioView({ pagina, links, preview, baseLink, aoClicar, aoVisitar }: {
  pagina: BioPagina;
  links: BioLink[];
  preview?: boolean;
  baseLink?: string;
  aoClicar?: (l: BioLink) => void;
  aoVisitar?: () => void;
}) {
  // Pixel da Meta: PageView (e o evento extra da página) uma vez.
  const pixelFeito = useRef(false);
  useEffect(() => {
    const id = pagina.pixelId.trim();
    if (preview || !/^\d{6,20}$/.test(id) || pixelFeito.current) return;
    pixelFeito.current = true;
    pixelInit(id);
    pixelTrack("PageView");
    if (pagina.eventoPagina !== "PageView") pixelTrack(pagina.eventoPagina);
  }, [pagina.pixelId, pagina.eventoPagina, preview]);

  // Visita: uma vez a cada 30 min por navegador (a página fica em cache, então conta por aqui).
  useEffect(() => {
    if (preview) return;
    try {
      const ult = Number(sessionStorage.getItem("jb_bio_visita") || 0);
      if (Date.now() - ult < 30 * 60_000) return;
      sessionStorage.setItem("jb_bio_visita", String(Date.now()));
    } catch {}
    if (aoVisitar) aoVisitar();
    else void fetch("/api/bio/visita", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: document.referrer }), keepalive: true }).catch(() => {});
  }, [preview, aoVisitar]);

  const clara = corClara(pagina.corFundo);
  const fg = clara ? "#2B1F24" : "#FFFFFF";
  const suave = clara ? "rgba(43,31,36,.72)" : "rgba(255,255,255,.82)";
  const visiveis = links.filter((l) => l.ativo && l.titulo.trim() && l.url.trim()).sort((a, b) => a.ordem - b.ordem);
  const destaque = pagina.layout === "destaque";
  const serif = pagina.fonteTitulo !== "sans";
  const iniciais = (pagina.titulo || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const botaoClaro = corClara(pagina.corBotao);

  const clicar = (e: React.MouseEvent, l: BioLink) => {
    if (preview) { e.preventDefault(); return; }
    if (l.eventoMeta !== "none") pixelTrack(l.eventoMeta, { content_name: l.titulo });
    aoClicar?.(l);
  };
  const destino = (l: BioLink) => (baseLink ? `${baseLink}${l.id}` : l.url);
  const externo = (l: BioLink) => !preview && !(baseLink ? false : l.url.startsWith("/"));

  const avatar = (tam: number, sombra: boolean) => (
    <div style={{ width: tam, height: tam, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: tam / 3.6, fontWeight: 800, background: pagina.corBotao, color: pagina.corTextoBotao, flex: "none", boxShadow: sombra ? `0 0 0 4px ${pagina.corFundo}, 0 10px 30px rgba(0,0,0,.18)` : undefined }}>
      {pagina.avatar ? <img src={pagina.avatar} alt={pagina.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : iniciais}
    </div>
  );

  return (
    <div style={{ minHeight: preview ? "100%" : "100dvh", background: `radial-gradient(120% 70% at 50% 0%, ${pagina.corFundo}ee 0%, ${pagina.corFundo} 55%), ${pagina.corFundo}`, color: fg, fontFamily: "inherit" }}>
      <div style={{ margin: "0 auto", width: "100%", maxWidth: 560, paddingBottom: 40 }}>
        {destaque ? (
          pagina.avatar ? (
            <img src={pagina.avatar} alt={pagina.titulo} style={{ width: "100%", aspectRatio: "4 / 5", maxHeight: preview ? 520 : "78vh", objectFit: "cover", objectPosition: "top", display: "block", maskImage: "linear-gradient(to bottom, #000 58%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, #000 58%, transparent 100%)" }} />
          ) : (
            <div style={{ paddingTop: 48, display: "flex", justifyContent: "center" }}>{avatar(112, false)}</div>
          )
        ) : pagina.capa ? (
          <img src={pagina.capa} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ height: 40 }} />
        )}

        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative", marginTop: destaque && pagina.avatar ? -96 : 0 }}>
          {!destaque && <div style={{ marginTop: pagina.capa ? -56 : 8 }}>{avatar(112, true)}</div>}

          {pagina.titulo && (
            <h1 className={serif ? serifada.className : undefined} style={{ margin: destaque ? "12px 0 0" : "16px 0 0", lineHeight: 1.15, fontSize: TITULO[serif ? "serif" : "sans"][pagina.tamTitulo], fontWeight: serif ? 600 : 800, letterSpacing: "-0.01em" }}>
              {pagina.titulo}
            </h1>
          )}
          {pagina.bio && (
            <p style={{ margin: "8px 0 0", fontSize: BIO[pagina.tamBio], lineHeight: 1.6, whiteSpace: "pre-line", maxWidth: 440, color: destaque ? fg : suave, opacity: destaque ? 0.9 : 1 }}>{pagina.bio}</p>
          )}

          <nav style={{ marginTop: 28, width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            {visiveis.length === 0 && (
              <p style={{ border: `1px dashed ${suave}`, color: suave, borderRadius: 16, padding: "24px 16px", fontSize: 14, fontWeight: 600, margin: 0 }}>Nenhum botão ativo ainda.</p>
            )}
            {visiveis.map((l) => (
              <a key={l.id} href={destino(l)} target={externo(l) ? "_blank" : undefined} rel="noopener noreferrer" onClick={(e) => clicar(e, l)} className="jb-bio-btn"
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", minHeight: BTN_ALT[pagina.tamBotao], borderRadius: 16, padding: 8, textDecoration: "none",
                  background: pagina.corBotao, color: pagina.corTextoBotao,
                  border: botaoClaro ? "1px solid #F0E2E6" : "1px solid transparent",
                  boxShadow: botaoClaro ? "0 6px 18px rgba(149,92,107,.10)" : "0 4px 14px rgba(0,0,0,.10)",
                }}>
                {l.imagem ? <img src={l.imagem} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flex: "none" }} /> : <span style={{ width: 4, flex: "none" }} />}
                <span style={{ flex: 1, minWidth: 0, padding: "2px 0", textAlign: "center" }}>
                  <span style={{ display: "block", fontSize: BTN[pagina.tamBotao], fontWeight: 650, lineHeight: 1.3, overflowWrap: "anywhere" }}>{l.titulo}</span>
                  {l.subtitulo && <span style={{ display: "block", fontSize: BTN_SUB[pagina.tamBotao], fontWeight: 500, opacity: 0.68, marginTop: 2, overflowWrap: "anywhere" }}>{l.subtitulo}</span>}
                </span>
                <span style={{ width: l.imagem ? 28 : 4, flex: "none" }} />
              </a>
            ))}
          </nav>

          {pagina.instagram && (
            <a href={preview ? undefined : `https://instagram.com/${pagina.instagram}`} target="_blank" rel="noopener noreferrer" onClick={(e) => preview && e.preventDefault()}
              style={{ marginTop: 32, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: fg, textDecoration: "none", opacity: 0.9 }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
              </svg>
              @{pagina.instagram}
            </a>
          )}
        </div>
      </div>
      <style>{`.jb-bio-btn{transition:transform .15s ease}.jb-bio-btn:hover{transform:translateY(-2px)}.jb-bio-btn:active{transform:none}`}</style>
    </div>
  );
}
