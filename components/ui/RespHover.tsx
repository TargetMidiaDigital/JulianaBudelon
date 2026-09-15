"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { css } from "@/lib/css";
import { Avatar } from "./bits";

type Membro = { nome: string; cargo?: string; ini: string; cor: string; foto?: string };

/**
 * Envolve um avatar de responsável: ao passar o mouse, mostra um cartão flutuante
 * com foto + nome + cargo. Renderiza via portal (não é cortado por overflow de tabela).
 */
export default function RespHover({ member, children }: { member: Membro; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const show = () => { const r = ref.current?.getBoundingClientRect(); if (r) setPos({ top: r.top, left: r.left + r.width / 2 }); };
  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={() => setPos(null)} style={{ display: "inline-flex" }}>
      {children}
      {pos && typeof document !== "undefined" && createPortal(
        <div style={css(`position:fixed; top:${pos.top - 10}px; left:${pos.left}px; transform:translate(-50%,-100%); z-index:2147483000; background:#fff; border:1px solid #E2E3E9; box-shadow:0 10px 26px rgba(20,24,40,.18); border-radius:12px; padding:9px 12px; display:flex; align-items:center; gap:11px; white-space:nowrap; pointer-events:none;`)}>
          <Avatar ini={member.ini} cor={member.cor} src={member.foto} size={40} fontSize={16} />
          <div>
            <div style={css("font-size:13.5px; font-weight:800; color:#1B1B28;")}>{member.nome}</div>
            {member.cargo && <div style={css("font-size:12px; color:#7A8090; margin-top:2px;")}>{member.cargo}</div>}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
