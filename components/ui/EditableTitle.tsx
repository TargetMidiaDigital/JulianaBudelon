"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { Svg } from "./Svg";
import Hoverable from "./Hoverable";

/**
 * Texto com lápis para edição inline (mesmo padrão dos comentários).
 * Clica no lápis → vira input; Enter/blur salva, Esc cancela.
 * Lápis e input fazem stopPropagation p/ não disparar o clique da linha/cartão.
 *  - `fill`: ocupa a largura do container (célula de tabela, com reticências).
 *  - `textStyle`: CSS do texto exibido (fonte/peso). Reaproveitado no input.
 */
export default function EditableTitle({
  value,
  onSave,
  textStyle = "",
  pencilSize = 13,
  fill = false,
  wrap = false,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  textStyle?: string;
  pencilSize?: number;
  fill?: boolean;
  /** Permite o texto exibido quebrar em várias linhas (em vez de reticências). */
  wrap?: boolean;
  /** Texto fraco mostrado quando o valor está vazio. */
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const start = (e: React.MouseEvent) => { e.stopPropagation(); setV(value); setEditing(true); };
  const commit = () => { const nv = v.trim(); if (nv && nv !== value) onSave(nv); setEditing(false); };
  const cancel = () => { setEditing(false); setV(value); };

  if (editing) {
    return (
      <input
        autoFocus
        value={v}
        onClick={stop}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        style={css(`${textStyle} width:100%; box-sizing:border-box; border:1px solid #C7CBD6; border-radius:7px; padding:3px 8px; outline:none; background:#fff; color:#1B1B28;`)}
      />
    );
  }
  return (
    <span style={css(`${fill ? "display:flex; width:100%;" : "display:inline-flex; max-width:100%;"} ${wrap ? "align-items:flex-start;" : "align-items:center;"} gap:6px; min-width:0;`)}>
      <span style={css(`${textStyle} ${fill ? "flex:1;" : ""} min-width:0; ${wrap ? "white-space:normal; word-break:break-word; line-height:1.5;" : "overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"} ${!value && placeholder ? "color:#B6BAC4;" : ""}`)}>{value || placeholder || ""}</span>
      <Hoverable as="button" title="Editar nome" onClick={start} s={css("flex:none; width:22px; height:22px; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9398A6;")} hover="background:#FDF1F4; color:#955C6B">
        <Svg size={pencilSize} sw={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>
      </Hoverable>
    </span>
  );
}
