"use client";

import { css } from "@/lib/css";

const COR = "#D7DAE0";
const COL = 20; // largura de um nível de indentação

/**
 * Linhas-guia da árvore de subtarefas (│ ├ └), no mesmo traço do menu lateral.
 *
 * `guides[i]` = o ancestral do nível `i` ainda tem irmão abaixo, então o tronco
 * daquele nível continua descendo por esta linha. O último elemento é o cotovelo
 * da própria linha: `true` vira "├" (tem irmão embaixo), `false` vira "└".
 *
 * `sangra` estica o tronco por cima do padding vertical da linha. Sem isso a
 * árvore sai pontilhada — cada linha desenharia só o pedaço do seu conteúdo e
 * sobrariam buracos do tamanho do padding entre uma e outra.
 */
export default function TreeGuides({ guides, sangra = 0 }: { guides: boolean[]; sangra?: number }) {
  if (guides.length === 0) return null;
  return (
    <span aria-hidden style={css(`flex:none; align-self:stretch; display:flex; width:${guides.length * COL}px;`)}>
      {guides.map((cont, i) => {
        const ultimo = i === guides.length - 1;
        // Nos níveis intermediários o tronco só aparece se o ancestral continua;
        // no nível da própria linha ele sempre desce ao menos até o cotovelo.
        const tronco = ultimo || cont;
        // "└" para no meio da linha; "│" e "├" atravessam até embaixo.
        const meio = ultimo && !cont;
        return (
          <span key={i} style={css(`position:relative; width:${COL}px; align-self:stretch;`)}>
            {tronco && (
              <span
                style={css(
                  `position:absolute; left:9px; top:${-sangra}px; ${meio ? `height:calc(50% + ${sangra}px);` : `bottom:${-sangra}px;`} border-left:1.5px solid ${COR};`,
                )}
              />
            )}
            {ultimo && <span style={css(`position:absolute; left:9px; top:50%; width:13px; border-top:1.5px solid ${COR};`)} />}
          </span>
        );
      })}
    </span>
  );
}
