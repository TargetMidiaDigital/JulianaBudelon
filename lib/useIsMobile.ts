"use client";

import { useEffect, useState } from "react";

/**
 * `true` quando a viewport é de celular (≤768px) — o MESMO breakpoint das classes
 * utilitárias mobile em app/globals.css. Usado só onde a estrutura muda de verdade
 * (Sidebar vira overlay, Shell tira a borda); o resto do reflow é CSS.
 *
 * No cliente já nasce com o valor real (matchMedia na inicialização): sem isto o
 * primeiro quadro saía com o layout de computador e "pulava" para o de celular. No
 * servidor é `false` — os componentes que usam este hook só montam no cliente (depois
 * do login), então não há divergência de hidratação. Acima do breakpoint é sempre `false`.
 */
const QUERY = "(max-width: 768px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches);

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
