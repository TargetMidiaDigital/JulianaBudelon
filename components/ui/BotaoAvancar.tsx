"use client";

import { Svg } from "./Svg";

/**
 * Flechinha azul que passa o item para o próximo status (igual à do Cachorrão HD).
 * Fica no canto do card e ao lado do status na lista. Não abre o card ao clicar.
 */
export default function BotaoAvancar({ proximo, onClick, size = 26 }: { proximo: string; onClick: () => void; size?: number }) {
  const titulo = `Passar para "${proximo}"`;
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, border: "none", borderRadius: 8, background: "#2F80ED", color: "#fff", cursor: "pointer", boxShadow: "0 1px 2px rgba(16,24,40,.15)", padding: 0 }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = ".88"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
    >
      <Svg size={Math.round(size * 0.56)} sw={2.6}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
    </button>
  );
}
