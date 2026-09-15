"use client";

import { useRef, useState } from "react";
import { css } from "@/lib/css";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { downloadFile } from "@/lib/download";
import { Svg } from "./Svg";
import MediaViewer from "./MediaViewer";

/**
 * Renderiza o comentário rico (HTML sanitizado). Vídeos mantêm os controles
 * nativos. Imagens mostram um botão de baixar no canto ao passar o mouse.
 * Clicar DENTRO da mídia (não nos controles/play/download) abre o visualizador
 * em tela cheia (nome + zoom + baixar), estilo ClickUp.
 */
export default function CommentBody({ html, boxStyle }: { html: string; boxStyle?: string }) {
  const clean = sanitizeHtml(html);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<{ url: string; tipo: "image" | "video" } | null>(null);
  const [hov, setHov] = useState<{ top: number; left: number; url: string } | null>(null);

  const onOver = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "IMG" && wrapRef.current) {
      const cr = wrapRef.current.getBoundingClientRect();
      const ir = t.getBoundingClientRect();
      setHov({ top: ir.top - cr.top + 8, left: ir.right - cr.left - 38, url: (t as HTMLImageElement).src });
    } else if (!t.closest("[data-dl]")) {
      // saiu da imagem (e não está sobre o próprio botão) → esconde o download
      setHov(null);
    }
  };

  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "IMG") {
      e.preventDefault();                                                  // se a mídia estiver dentro de <a>, não abre nova aba
      setViewer({ url: (t as HTMLImageElement).src, tipo: "image" });
      return;
    }
    if (t.tagName === "VIDEO") {
      const v = t as HTMLVideoElement;
      const r = v.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (y > r.height - 44) return;                                       // barra de controles
      if (v.paused && Math.hypot(x - r.width / 2, y - r.height / 2) < 46) return; // play central
      e.preventDefault();
      setViewer({ url: v.currentSrc || v.src, tipo: "video" });
    }
  };

  return (
    <div ref={wrapRef} onMouseOver={onOver} onMouseLeave={() => setHov(null)} style={css(`position:relative; ${boxStyle ?? "background:#fff; border:1px solid #ECEDF1; border-radius:9px; padding:9px 12px; font-size:13px; line-height:1.5; color:#3A3F4C; overflow-wrap:anywhere;"}`)}>
      <div className="cm-rich" onClick={onClick} dangerouslySetInnerHTML={{ __html: clean }} />
      {hov && (
        <button
          data-dl="1"
          onClick={(e) => { e.stopPropagation(); downloadFile(hov.url); }}
          title="Baixar imagem"
          style={css(`position:absolute; top:${hov.top}px; left:${hov.left}px; z-index:2; width:30px; height:30px; border:none; cursor:pointer; border-radius:8px; background:rgba(20,24,40,.6); color:#fff; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px);`)}
        >
          <Svg size={15} sw={2.2}><path d="M12 3v12M7 11l5 5 5-5M5 21h14" /></Svg>
        </button>
      )}
      {viewer && <MediaViewer url={viewer.url} tipo={viewer.tipo} onClose={() => setViewer(null)} />}
    </div>
  );
}
