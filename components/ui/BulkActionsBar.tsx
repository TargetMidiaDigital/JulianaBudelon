"use client";

import type { ReactNode } from "react";
import { css } from "@/lib/css";
import { BRAND } from "@/lib/theme";
import { Svg } from "./Svg";
import Hoverable from "./Hoverable";

/**
 * Caixinha de seleção (estilo ClickUp) usada nas tabelas de tarefas/designs.
 * `checked` marca; `indeterminate` mostra o tracinho (alguns selecionados).
 */
export function SelectCheck({
  checked,
  indeterminate = false,
  onClick,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const on = checked || indeterminate;
  return (
    <span
      onClick={onClick}
      style={css(
        `width:18px; height:18px; flex:none; border-radius:5px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .12s ease, border-color .12s ease; border:1.5px solid ${on ? BRAND : "#C7CAD2"}; background:${on ? BRAND : "#fff"};`,
      )}
    >
      {checked ? (
        <Svg size={12} sw={3} stroke="#fff"><path d="m5 12 5 5 9-10" /></Svg>
      ) : indeterminate ? (
        <span style={css("width:8px; height:2px; border-radius:1px; background:#fff;")} />
      ) : null}
    </span>
  );
}

/** Estilo dos botões de ação dentro da barra (mesma linguagem dos botões da toolbar). */
export const BULK_BTN =
  "display:inline-flex; align-items:center; gap:7px; background:#fff; border:1px solid #E2E3E9; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:8px 13px; border-radius:10px;";

/**
 * Barra de ações em lote flutuante no rodapé (centralizada). Aparece quando há
 * ≥1 item selecionado. Cada tela injeta seus controles (Status/Responsável/Datas)
 * como `children`.
 */
export default function BulkActionsBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count <= 0) return null;
  return (
    <div style={css("position:fixed; left:0; right:0; bottom:24px; z-index:55; display:flex; justify-content:center; pointer-events:none; padding:0 16px;")}>
      <div style={css("pointer-events:auto; display:flex; align-items:center; gap:10px; max-width:100%; background:#fff; border:1px solid #E2E3E9; border-radius:14px; padding:9px 12px 9px 16px; box-shadow:0 18px 46px rgba(20,24,40,.22);")}>
        <span style={css("font-size:13px; font-weight:800; color:#1B1B28; white-space:nowrap;")}>
          {count} {count === 1 ? "selecionada" : "selecionadas"}
        </span>
        <Hoverable
          as="button"
          onClick={onClear}
          title="Limpar seleção"
          s={css("width:26px; height:26px; flex:none; border:none; background:#F2F3F6; color:#5B6472; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;")}
          hover="background:#E7E9EE"
        >
          <Svg size={14} sw={2.4}><path d="M6 6l12 12M18 6 6 18" /></Svg>
        </Hoverable>
        <span style={css("width:1px; height:24px; flex:none; background:#ECEDF1;")} />
        {children}
      </div>
    </div>
  );
}
