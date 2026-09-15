import type { CSSProperties } from "react";

/**
 * Parse a CSS declaration string ("display:flex; gap:8px") into a React style
 * object. Lets us port the design's inline-style strings with high fidelity.
 * Results are cached because the same static strings are parsed repeatedly.
 */
const cache = new Map<string, CSSProperties>();

function toCamel(prop: string): string {
  if (prop.startsWith("--")) return prop; // CSS custom property
  return prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function css(decl: string | undefined | null): CSSProperties {
  if (!decl) return {};
  const cached = cache.get(decl);
  if (cached) return cached;

  const out: Record<string, string> = {};
  // Split on ';' but not inside parentheses (e.g. rgba(), calc()).
  let depth = 0;
  let cur = "";
  const parts: string[] = [];
  for (const ch of decl) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === ";" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);

  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!prop || !value) continue;
    out[toCamel(prop)] = value;
  }
  const result = out as CSSProperties;
  cache.set(decl, result);
  return result;
}

/** Merge several CSS strings / style objects into one style object. */
export function merge(
  ...items: (string | CSSProperties | undefined | null | false)[]
): CSSProperties {
  let out: CSSProperties = {};
  for (const it of items) {
    if (!it) continue;
    out = { ...out, ...(typeof it === "string" ? css(it) : it) };
  }
  return out;
}
