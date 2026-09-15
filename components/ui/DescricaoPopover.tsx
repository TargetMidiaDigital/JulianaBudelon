"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { css } from "@/lib/css";
import { Svg } from "./Svg";
import Hoverable from "./Hoverable";
import CommentBody from "./CommentBody";

/**
 * Popover (mesma estética da coluna Automação/Comentários) que mostra a DESCRIÇÃO
 * rica da tarefa — com imagens/vídeos. Somente leitura; a edição rica acontece no
 * detalhe da tarefa. A célula mostra um preview em texto puro + ícone.
 */
export default function DescricaoPopover({ title, html, preview, heading = "Descrição" }: { title: string; html?: string; preview: string; heading?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number | null; bottom: number | null; left: number; maxH: number }>({ top: 0, bottom: null, left: 0, maxH: 0 });

  const W = 520, margin = 8, H = 640;
  const temConteudo = !!(html && html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim());

  const abrir = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.min(Math.max(margin, r.left), window.innerWidth - W - margin);
      const spaceBelow = window.innerHeight - r.bottom - margin - 6;
      const spaceAbove = r.top - margin - 6;
      if (spaceBelow >= spaceAbove) setPos({ top: r.bottom + 6, bottom: null, left, maxH: Math.min(H, spaceBelow) });
      else setPos({ top: null, bottom: window.innerHeight - r.top + 6, left, maxH: Math.min(H, spaceAbove) });
    }
    setOpen(true);
  };
  const close = () => setOpen(false);

  return (
    <div ref={wrapRef} style={{ minWidth: 0 }}>
      <Hoverable onClick={abrir} title={`Ver ${heading.toLowerCase()}`} s={css("display:flex; align-items:center; gap:6px; min-width:0; cursor:pointer; padding:4px 7px; margin:-4px -7px; border-radius:7px;")} hover="background:#EDEEF2">
        <Svg size={13} sw={2} stroke="#9398A6" style={css("flex:none;")}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></Svg>
        <span style={css(`font-size:12.5px; font-weight:600; color:#5B6472; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`)}>{preview || "—"}</span>
      </Hoverable>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div onClick={close} style={css("position:fixed; inset:0; z-index:299;")} />
          <div style={css(`position:fixed; ${pos.top != null ? `top:${pos.top}px` : `bottom:${pos.bottom}px`}; left:${pos.left}px; width:${W}px; max-width:calc(100vw - 16px); max-height:${pos.maxH}px; z-index:300; background:#fff; border:1px solid #E2E3E9; border-radius:14px; box-shadow:0 18px 50px rgba(20,24,40,.22); display:flex; flex-direction:column; overflow:hidden;`)}>
            <div style={css("display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid #ECEDF1; flex:none;")}>
              <div style={css("flex:1; min-width:0;")}>
                <div style={css("font-size:15px; font-weight:800; letter-spacing:-0.3px;")}>{heading}</div>
                <div style={css("font-size:12px; color:#9398A6; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{title}</div>
              </div>
              <Hoverable as="button" onClick={close} s={css("width:30px; height:30px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
            </div>
            <div style={css("flex:1; min-height:0; overflow-y:auto; padding:16px 18px; background:#FAFAFB;")}>
              {temConteudo
                ? <CommentBody html={html as string} boxStyle="background:#fff; border:1px solid #ECEDF1; border-radius:10px; padding:11px 13px; font-size:13.5px; line-height:1.6; color:#3A3F4C; overflow-wrap:anywhere;" />
                : <div style={css("margin:auto; text-align:center; color:#9398A6; font-size:13px; padding:20px 0;")}>Sem {heading.toLowerCase()}.</div>}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
