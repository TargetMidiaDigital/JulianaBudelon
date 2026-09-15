"use client";

import { useFecharComEsc } from "./useFecharComEsc";
import { useEffect, useState } from "react";
import { css } from "@/lib/css";
import Hoverable from "./Hoverable";
import { Svg } from "./Svg";

/**
 * Bloco de campo (título + editor) com botão de tela cheia.
 *
 * O editor NÃO é remontado ao expandir: o mesmo nó continua na mesma posição da árvore
 * e só o wrapper troca de estilo. Se fosse um overlay com um segundo editor, o texto em
 * digitação — e a posição do cursor — se perderiam na troca, que é justamente o momento
 * em que a pessoa está no meio de um texto longo.
 */
export default function CampoExpansivel({
  titulo,
  icone,
  children,
  alturaMinima = 0,
}: {
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
  /** Piso do campo no modo normal (o editor encolhe se o container apertar). */
  alturaMinima?: number;
}) {
  const [cheio, setCheio] = useState(false);

  // Esc fecha pela pilha de camadas: aberto de dentro de um drawer, fecha SÓ a tela
  // cheia — o drawer continua. Com o campo aberto o fundo não rola.
  useFecharComEsc(cheio, () => setCheio(false));
  useEffect(() => {
    if (!cheio) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, [cheio]);

  const botao = (
    <Hoverable
      as="button"
      title={cheio ? "Reduzir" : "Expandir para tela cheia"}
      onClick={() => setCheio((v) => !v)}
      s={css(
        cheio
          ? "flex:none; width:30px; height:30px; border:1px solid #E2E3E9; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#5B6472;"
          : "position:absolute; right:10px; bottom:52px; z-index:2; width:26px; height:26px; border:none; background:transparent; border-radius:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9398A6;",
      )}
      hover={cheio ? "background:#F4F4F7" : "background:#F0F1F4; color:#3A3F4C"}
    >
      {cheio
        ? <Svg size={14}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></Svg>
        : <Svg size={14}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg>}
    </Hoverable>
  );

  return (
    <div
      style={css(
        cheio
          // Fundo cinza e a "folha" centralizada abaixo — leitura de documento, não de
          // formulário. z-index acima dos drawers e menus (119-200) e abaixo do
          // visualizador de mídia (1000), para o zoom da imagem continuar por cima.
          ? "position:fixed; inset:0; z-index:500; background:#F1F3F4; display:flex; flex-direction:column;"
          : `flex:1; ${alturaMinima ? `min-height:${alturaMinima}px;` : "min-height:0;"} display:flex; flex-direction:column;`,
      )}
    >
      <div
        style={css(
          cheio
            ? "flex:none; display:flex; align-items:center; gap:8px; padding:11px 20px; background:#fff; border-bottom:1px solid #E3E5E8;"
            : "flex:none; display:flex; align-items:center; gap:8px; margin-bottom:9px;",
        )}
      >
        {icone}
        <span style={css(`font-weight:700; ${cheio ? "font-size:15px;" : "font-size:13.5px;"}`)}>{titulo}</span>
        <span style={{ flex: 1 }} />
        {cheio && <span style={css("font-size:11.5px; color:#9398A6; font-weight:600;")}>Esc para fechar</span>}
        {cheio && botao}
      </div>

      {/* A árvore é a MESMA nos dois modos — outer › área › folha › editor. Só os estilos
          mudam. Acrescentar um wrapper só no modo cheio remontaria o editor e levaria
          junto o texto em digitação e a posição do cursor. */}
      <div
        style={css(
          cheio
            ? "flex:1; min-height:0; overflow-y:auto; padding:26px 24px 40px; display:flex; justify-content:center;"
            : "position:relative; flex:1; min-height:0;",
        )}
      >
        <div
          style={css(
            cheio
              ? "width:100%; max-width:900px; box-shadow:0 1px 3px rgba(60,64,67,.22), 0 6px 16px rgba(60,64,67,.14); border-radius:12px; display:flex; flex-direction:column;"
              : "height:100%; display:flex; flex-direction:column;",
          )}
        >
          {children}
        </div>
        {!cheio && botao}
      </div>
    </div>
  );
}
