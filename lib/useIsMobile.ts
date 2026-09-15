"use client";

import { useEffect, useState } from "react";

/**
 * `true` quando a viewport é de celular (≤768px) — o MESMO breakpoint das classes
 * utilitárias mobile em app/globals.css. Usado só onde a estrutura muda de verdade
 * (Sidebar vira overlay, Shell tira a borda); o resto do reflow é CSS.
 *
 * SSR-safe: retorna `false` no servidor e no primeiro paint, então o desktop (e a
 * hidratação) seguem o caminho de hoje; no cliente, o matchMedia atualiza logo em
 * seguida. Acima do breakpoint o valor é sempre `false` → desktop intocado.
 */
const QUERY = "(max-width: 768px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange(); // estado inicial real no cliente
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
