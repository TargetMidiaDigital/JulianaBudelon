"use client";

import { useState, type CSSProperties, type ElementType } from "react";
import { merge } from "@/lib/css";

type HoverableProps = {
  as?: ElementType;
  /** Base style as a CSS string or style object. */
  s?: string | CSSProperties;
  /** Hover style as a CSS string or style object (the design's `style-hover`). */
  hover?: string | CSSProperties;
  children?: React.ReactNode;
  // Anything else (onClick, href, title, type, etc.) is forwarded.
  [key: string]: unknown;
};

/**
 * Renders an element that merges a hover style on mouse-over — a direct port of
 * the design's `style-hover` attribute, which React's inline styles can't do.
 */
export default function Hoverable({
  as,
  s,
  hover,
  children,
  ...rest
}: HoverableProps) {
  const Tag = (as ?? "div") as ElementType;
  const [h, setH] = useState(false);
  // Ao sair do hover, o React só APAGA a longhand do hover (ex.: borderColor); o navegador
  // então cai em currentColor (texto escuro), não na cor do `border` base — a borda "ficava
  // presa" escura. Repete a cor do shorthand base no estado normal para a borda voltar.
  const base = merge(s);
  const hov = merge(hover);
  const reset: CSSProperties = {};
  if (!h && hov.borderColor && base.border && !base.borderColor) reset.borderColor = String(base.border).trim().split(/\s+/).pop();
  return (
    <Tag
      style={h ? { ...base, ...hov } : { ...base, ...reset }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
