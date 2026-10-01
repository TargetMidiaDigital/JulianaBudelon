"use client";

import { useEffect, useState } from "react";
import { css } from "@/lib/css";
import { parseQuantidade } from "@/lib/estoque";

/** Quantidade editável (uma por local). Salva no Enter ou ao sair do campo; Esc desfaz. */
export default function QtdCell({ value, onSave, size = "sm" }: { value: number; onSave: (n: number) => void; size?: "sm" | "lg" }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  const commit = () => {
    const n = parseQuantidade(v);
    if (n == null) { setV(String(value)); return; }
    setV(String(n));
    if (n !== value) onSave(n);
  };
  const dim = size === "lg" ? "width:92px; height:38px; font-size:15px; border-radius:9px;" : "width:64px; height:30px; font-size:13.5px; border-radius:8px;";
  return (
    <input
      value={v}
      inputMode="numeric"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setV(String(value)); }}
      onFocus={(e) => { e.target.select(); e.currentTarget.style.borderColor = "#955C6B"; }}
      onBlurCapture={(e) => { e.currentTarget.style.borderColor = "#E2E3E9"; }}
      style={css(`${dim} box-sizing:border-box; border:1px solid #E2E3E9; outline:none; text-align:center; font-weight:700; font-variant-numeric:tabular-nums; color:${value ? "#1B1B28" : "#9398A6"}; background:#fff;`)}
    />
  );
}
