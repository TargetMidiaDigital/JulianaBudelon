"use client";

import { useState, useRef, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { css } from "@/lib/css";

/**
 * Self-contained dropdown: renders a trigger and a popover. O popover é
 * renderizado num PORTAL (position:fixed no body) para escapar de containers
 * com overflow (listas roláveis, drawers) que cortariam o menu. Posiciona
 * abaixo do trigger e, se faltar espaço, abre para cima; a altura é limitada
 * ao espaço visível. Mantém a API (trigger/children/align/width/z/popStyle).
 */
export default function Menu({
  trigger,
  children,
  align = "left",
  width,
  z = 200, // popover vai pro portal (document.body); precisa ficar acima de drawers/modais
  popStyle,
}: {
  trigger: (toggle: () => void, open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: number;
  z?: number;
  popStyle?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top?: number; bottom?: number; left?: number; right?: number; maxH: number } | null>(null);
  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open) { setBox(null); return; }
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const spaceBelow = vh - r.bottom, spaceAbove = r.top;
    const horiz = align === "right" ? { right: vw - r.right } : { left: r.left };
    // Abre para cima quando há pouco espaço embaixo e mais espaço em cima.
    if (spaceBelow < 280 && spaceAbove > spaceBelow) {
      setBox({ bottom: vh - r.top + 5, ...horiz, maxH: spaceAbove - 12 });
    } else {
      setBox({ top: r.bottom + 5, ...horiz, maxH: spaceBelow - 12 });
    }
  }, [open, align]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {trigger(() => setOpen((v) => !v), open)}
      {open && box && typeof document !== "undefined" &&
        createPortal(
          <>
            <div onClick={close} style={css(`position:fixed; inset:0; z-index:${z - 1};`)} />
            <div
              style={css(
                `position:fixed; ${box.top != null ? `top:${box.top}px;` : `bottom:${box.bottom}px;`} ${box.left != null ? `left:${box.left}px;` : `right:${box.right}px;`} z-index:${z}; background:#fff; border:1px solid #E2E3E9; border-radius:10px; box-shadow:0 12px 34px rgba(20,24,40,.18); padding:5px; ${width ? `min-width:${width}px;` : ""} ${popStyle ?? ""} max-height:${Math.max(160, box.maxH)}px; overflow-y:auto;`,
              )}
            >
              {children(close)}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

/** A single option row inside a Menu. */
export function MenuItem({
  children,
  onClick,
  checked,
  accent = "#16A34A",
}: {
  children: ReactNode;
  onClick: () => void;
  checked?: boolean;
  accent?: string;
}) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={css(
        `display:flex; align-items:center; gap:9px; padding:8px 9px; border-radius:7px; cursor:pointer; font-size:12.5px; font-weight:600; color:#3A3F4C; background:${h ? "#F4F4F7" : "transparent"};`,
      )}
    >
      {children}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={accent}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flex: "none", opacity: checked ? 1 : 0, marginLeft: "auto" }}
      >
        <path d="m5 12 5 5 9-10" />
      </svg>
    </div>
  );
}
