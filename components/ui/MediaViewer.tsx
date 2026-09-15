"use client";

import { useFecharComEsc } from "./useFecharComEsc";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { css } from "@/lib/css";
import { downloadFile, fileNameFromUrl } from "@/lib/download";
import { Svg } from "./Svg";
import Hoverable from "./Hoverable";

/**
 * Visualizador em tela cheia (estilo ClickUp): nome, zoom (imagem) e baixar.
 * `pdf` abre no leitor nativo do navegador (iframe); `file` (docx, zip…) não tem
 * pré-visualização — mostra o cartão com o botão de baixar.
 * `nome` sobrescreve o nome deduzido da URL (os anexos guardam o nome original).
 */
export default function MediaViewer({ url, tipo, nome: nomeProp, onClose }: { url: string; tipo: "image" | "video" | "pdf" | "file"; nome?: string; onClose: () => void }) {
  // Na pilha de camadas: aberto de dentro de um drawer, o Esc fecha SÓ o visualizador.
  useFecharComEsc(true, onClose);
  const [zoom, setZoom] = useState(100);
  const nome = nomeProp || fileNameFromUrl(url);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {  document.body.style.overflow = prev; };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const barBtn = "width:34px; height:34px; flex:none; border:none; background:transparent; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#E8E9EE;";
  const clampZoom = (z: number) => Math.max(25, Math.min(400, z));

  return createPortal(
    <div style={css("position:fixed; inset:0; z-index:1000; background:rgba(8,10,16,.94); display:flex; flex-direction:column;")}>
      {/* Barra superior */}
      <div onClick={(e) => e.stopPropagation()} style={css("flex:none; height:54px; display:flex; align-items:center; gap:12px; padding:0 16px; background:#1B1F29; color:#E8E9EE; border-bottom:1px solid #2A2F3B;")}>
        <span style={css("flex:1; min-width:0; font-size:14px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{nome}</span>
        {tipo === "image" && (
          <div style={css("flex:none; display:flex; align-items:center; gap:2px; background:#262B36; border-radius:9px; padding:3px;")}>
            <Hoverable as="button" title="Ajustar" onClick={() => setZoom(100)} s={css(barBtn)} hover="background:#343B49; color:#fff"><Svg size={16} sw={2}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></Svg></Hoverable>
            <Hoverable as="button" title="Diminuir" onClick={() => setZoom((z) => clampZoom(z - 25))} s={css(barBtn)} hover="background:#343B49; color:#fff"><Svg size={16} sw={2.4}><path d="M5 12h14" /></Svg></Hoverable>
            <span style={css("min-width:48px; text-align:center; font-size:13px; font-weight:700;")}>{zoom}%</span>
            <Hoverable as="button" title="Aumentar" onClick={() => setZoom((z) => clampZoom(z + 25))} s={css(barBtn)} hover="background:#343B49; color:#fff"><Svg size={16} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg></Hoverable>
          </div>
        )}
        <span style={{ flex: tipo === "image" ? "none" : 0 }} />
        <Hoverable as="button" onClick={() => downloadFile(url, nome)} s={css("flex:none; display:inline-flex; align-items:center; gap:8px; border:none; background:transparent; color:#E8E9EE; cursor:pointer; font-size:13.5px; font-weight:700; padding:7px 12px; border-radius:9px;")} hover="background:#262B36; color:#fff">
          <Svg size={16} sw={2.2}><path d="M12 3v12M7 11l5 5 5-5M5 21h14" /></Svg>Baixar
        </Hoverable>
        <Hoverable as="button" title="Fechar" onClick={onClose} s={css(barBtn)} hover="background:#262B36; color:#fff"><Svg size={18} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
      </div>

      {/* Conteúdo */}
      <div onClick={onClose} style={css("flex:1; min-height:0; overflow:auto; display:flex; align-items:center; justify-content:center; padding:24px;")}>
        {tipo === "video" ? (
          <video src={url} controls onClick={(e) => e.stopPropagation()} style={css("max-width:90vw; max-height:calc(100vh - 110px); border-radius:8px; outline:none;")} />
        ) : tipo === "pdf" ? (
          // Leitor nativo do navegador. Mesma origem (proxy /api/anexo) → manda o cookie de sessão.
          <iframe src={url} title={nome} onClick={(e) => e.stopPropagation()} style={css("width:min(1100px,92vw); height:calc(100vh - 110px); border:none; border-radius:8px; background:#fff;")} />
        ) : tipo === "file" ? (
          <div onClick={(e) => e.stopPropagation()} style={css("background:#1B1F29; border:1px solid #2A2F3B; border-radius:14px; padding:34px 40px; text-align:center; color:#E8E9EE; max-width:90vw;")}>
            <Svg size={40} sw={1.6} stroke="#6B7383" style={css("margin-bottom:12px;")}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></Svg>
            <div style={css("font-size:14.5px; font-weight:700; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis;")}>{nome}</div>
            <div style={css("font-size:13px; color:#9398A6; margin-bottom:16px;")}>Este tipo de arquivo não tem pré-visualização.</div>
            <Hoverable as="button" onClick={() => downloadFile(url, nome)} s={css("display:inline-flex; align-items:center; gap:8px; border:none; background:#2563EB; color:#fff; cursor:pointer; font-size:13.5px; font-weight:700; padding:9px 16px; border-radius:9px;")} hover="background:#1D4FD8">
              <Svg size={16} sw={2.2} stroke="#fff"><path d="M12 3v12M7 11l5 5 5-5M5 21h14" /></Svg>Baixar
            </Hoverable>
          </div>
        ) : (
          <img src={url} alt={nome} onClick={(e) => e.stopPropagation()} style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center", maxWidth: "88vw", maxHeight: "calc(100vh - 110px)", borderRadius: 8, transition: "transform .12s ease" }} />
        )}
      </div>
    </div>,
    document.body,
  );
}
