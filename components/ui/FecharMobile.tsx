"use client";

import { css } from "@/lib/css";
import { useIsMobile } from "@/lib/useIsMobile";
import { Svg } from "./Svg";

/**
 * X fixo no canto do painel, só no celular.
 *
 * No celular os drawers de 2 colunas (.m-drawer.m-stack) ocupam a tela toda — não sobra
 * fundo para tocar — e empilham as colunas: o X do cabeçalho de "Comentário" vai parar lá
 * embaixo, depois de todo o conteúdo. Este botão fica sempre visível, mesmo rolando.
 * Vai DENTRO do drawer (position:fixed sem transform no pai = relativo à tela); o
 * cabeçalho do painel ganha a classe `m-pr-fechar` para o título não passar por baixo dele.
 */
export default function FecharMobile({ onClose }: { onClose: () => void }) {
  const mobile = useIsMobile();
  if (!mobile) return null;
  return (
    <button onClick={onClose} title="Fechar" aria-label="Fechar" style={css("position:fixed; top:calc(env(safe-area-inset-top) + 12px); right:12px; z-index:5; width:38px; height:38px; border:1px solid #ECEDF1; background:#fff; border-radius:50%; box-shadow:0 2px 10px rgba(20,24,40,.14); cursor:pointer; display:flex; align-items:center; justify-content:center; color:#3A3F4C;")}>
      <Svg size={17} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg>
    </button>
  );
}
