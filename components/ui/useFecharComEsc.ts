"use client";

import { useEffect, useRef } from "react";

/**
 * Esc fecha a camada de cima — e SÓ ela.
 *
 * Drawers, modais, visualizador de mídia e telas cheias se empilham (um confirm dentro
 * de um drawer, uma imagem aberta de dentro de uma tarefa). Se cada um ouvisse o teclado
 * por conta própria, um Esc fecharia tudo de uma vez. Aqui há UM ouvinte e uma pilha:
 * quem montou por último é o topo, e é o único que responde.
 *
 * Primeiro Esc dentro de um campo de texto só tira o foco (o editor de comentário e o
 * mapa mental usam isso para confirmar a edição); o segundo fecha a camada.
 */
type Camada = { fechar: () => void };
const pilha: Camada[] = [];
let ouvindo = false;

function ouvir() {
  if (ouvindo || typeof window === "undefined") return;
  ouvindo = true;
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !pilha.length) return;
    const el = document.activeElement as HTMLElement | null;
    if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) {
      el.blur();
      return;
    }
    e.preventDefault();
    pilha[pilha.length - 1].fechar();
  });
}

export function useFecharComEsc(aberto: boolean, fechar: () => void) {
  const ref = useRef(fechar);
  ref.current = fechar;
  useEffect(() => {
    if (!aberto) return;
    ouvir();
    const camada: Camada = { fechar: () => ref.current() };
    pilha.push(camada);
    return () => {
      const i = pilha.indexOf(camada);
      if (i >= 0) pilha.splice(i, 1);
    };
  }, [aberto]);
}
