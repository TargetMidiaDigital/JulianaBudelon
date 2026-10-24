"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { css } from "@/lib/css";
import { useFecharComEsc } from "./useFecharComEsc";
import type { Diagrama, No } from "@/lib/treinamentos";

/**
 * Fluxograma em raias (estilo Miro) para os guias de Treinamentos. Layout em grade fixa:
 * cada raia é uma faixa horizontal (quem faz), cada nó ocupa uma coluna/linha dela, e as
 * setas são traçadas com ângulos retos entre as bordas dos nós (SVG por cima das raias).
 * Formas: início/fim (pílula), etapa (cartão), sistema (tracejado, automático) e decisão
 * (losango). Encolhe para caber na largura (até 72%); além disso rola na horizontal, e o
 * botão "Ampliar" abre o diagrama em tela cheia.
 */

const ROTULO_W = 96; // coluna com o nome da raia
const COL_W = 172;
const NO_W = 142;
const NO_H = 70;
const DEC_W = 136;
const DEC_H = 86;
const LINHA_H = 104;

type Caixa = { no: No; cx: number; cy: number; w: number; h: number; cor: string };

const ESCALA_MIN = 0.72;

/** Medidas do desenho (raias, caixas e setas) — usadas pelo quadro e pelo ajuste de escala. */
function montar(d: Diagrama) {
  // Raias: topo acumulado
  let topo = 0;
  const raias = d.raias.map((r) => {
    const h = (r.linhas ?? 1) * LINHA_H;
    const out = { ...r, top: topo, h };
    topo += h;
    return out;
  });
  const altura = topo;
  const nCols = Math.max(...d.nos.map((n) => n.col)) + 1;
  const largura = ROTULO_W + nCols * COL_W + 8;

  const caixas = new Map<string, Caixa>();
  for (const n of d.nos) {
    const r = raias.find((x) => x.id === n.raia);
    if (!r) continue;
    const dec = n.forma === "decisao";
    caixas.set(n.id, {
      no: n, cor: r.cor,
      cx: ROTULO_W + n.col * COL_W + COL_W / 2,
      cy: r.top + (n.linha ?? 0) * LINHA_H + LINHA_H / 2,
      w: dec ? DEC_W : NO_W, h: dec ? DEC_H : NO_H,
    });
  }

  const setas = d.setas.flatMap((s) => {
    const a = caixas.get(s.de), b = caixas.get(s.para);
    if (!a || !b) return [];
    return [{ ...s, ...rota(a, b) }];
  });
  return { raias, altura, largura, caixas, setas };
}

export default function Fluxograma({ d }: { d: Diagrama }) {
  const m = montar(d);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [disp, setDisp] = useState(0);
  const [cheio, setCheio] = useState(false);
  useLayoutEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const medir = () => setDisp(el.clientWidth - 24);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const escala = disp ? Math.min(1, Math.max(ESCALA_MIN, disp / m.largura)) : 1;
  const rola = disp > 0 && m.largura * escala > disp + 1;
  return (
    <div style={css("border:1px solid #ECEDF1; border-radius:14px; background:#FBFBFC; position:relative;")}>
      <button onClick={() => setCheio(true)} title="Ver o fluxo em tela cheia" style={css("position:absolute; top:-34px; right:0; display:inline-flex; align-items:center; gap:6px; border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:12px; font-weight:700; padding:5px 10px; border-radius:8px;")}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>Ampliar
      </button>
      <div ref={caixaRef} style={css("overflow-x:auto; padding:12px;")}>
        <Quadro m={m} escala={escala} />
      </div>
      {rola && <div style={css("padding:0 14px 6px; font-size:11.5px; color:#9398A6; font-weight:600;")}>Arraste para o lado para ver o fluxo inteiro, ou clique em Ampliar.</div>}
      <Legenda />
      {cheio && <TelaCheia m={m} titulo={d.titulo} onFechar={() => setCheio(false)} />}
    </div>
  );
}

function TelaCheia({ m, titulo, onFechar }: { m: ReturnType<typeof montar>; titulo?: string; onFechar: () => void }) {
  useFecharComEsc(true, onFechar);
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1200));
  useLayoutEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const escala = Math.min(1.15, Math.max(0.6, (w - 64) / m.largura));
  return createPortal(
    <div style={css("position:fixed; inset:0; z-index:330; background:#fff; display:flex; flex-direction:column;")}>
      <div style={css("display:flex; align-items:center; gap:10px; padding:14px 24px; border-bottom:1px solid #ECEDF1;")}>
        <div style={css("flex:1; font-size:15px; font-weight:800; color:#1B1B28;")}>{titulo ?? "Fluxo do processo"}</div>
        <button onClick={onFechar} style={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:7px 14px; border-radius:9px;")}>Fechar (Esc)</button>
      </div>
      <div style={css("flex:1; overflow:auto; padding:28px 32px;")}>
        <Quadro m={m} escala={escala} />
      </div>
      <Legenda />
    </div>,
    document.body,
  );
}

function Quadro({ m, escala }: { m: ReturnType<typeof montar>; escala: number }) {
  const { raias, altura, largura, caixas, setas } = m;
  return (
    <div style={{ width: largura * escala, height: altura * escala, minWidth: largura * escala }}>
        <div style={{ position: "relative", width: largura, height: altura, transform: `scale(${escala})`, transformOrigin: "0 0" }}>
          {/* Raias */}
          {raias.map((r, i) => (
            <div key={r.id} style={css(`position:absolute; left:0; right:0; top:${r.top}px; height:${r.h}px; background:${i % 2 ? "#F6F7F9" : "#fff"}; border-left:1px solid #ECEDF1; border-right:1px solid #ECEDF1; border-bottom:1px solid #ECEDF1; border-top:${i ? "0" : "1px"} solid #ECEDF1; border-radius:${raias.length === 1 ? "10px" : i === 0 ? "10px 10px 0 0" : i === raias.length - 1 ? "0 0 10px 10px" : "0"};`)}>
              <div style={css(`position:absolute; left:0; top:0; bottom:0; width:${ROTULO_W - 10}px; display:flex; align-items:center; gap:7px; padding:0 10px; border-right:1px solid #ECEDF1;`)}>
                <span style={css(`width:4px; align-self:stretch; margin:12px 0; border-radius:3px; background:${r.cor}; flex:none;`)} />
                <span style={css(`font-size:11.5px; font-weight:800; color:${r.cor}; line-height:1.2;`)}>{r.rotulo}</span>
              </div>
            </div>
          ))}

          {/* Setas */}
          <svg width={largura} height={altura} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
            <defs>
              <marker id="fx-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 10 5 0 10z" fill="#6B7180" />
              </marker>
            </defs>
            {setas.map((s, i) => (
              <path key={i} d={s.d} fill="none" stroke="#6B7180" strokeWidth={1.6} strokeDasharray={s.tracejada ? "5 4" : undefined} strokeLinejoin="round" markerEnd="url(#fx-seta)" />
            ))}
          </svg>

          {/* Rótulos das setas */}
          {setas.filter((s) => s.rotulo).map((s, i) => (
            <span key={i} style={css(`position:absolute; left:${s.lx}px; top:${s.ly}px; transform:translate(-50%,-50%); background:#fff; border:1px solid #E2E3E9; border-radius:999px; padding:1px 7px; font-size:10.5px; font-weight:800; color:#3A3F4C; white-space:nowrap; ${s.rotulo === "Sim" ? "color:#1B7F4D; border-color:#BFE3CC;" : s.rotulo === "Não" ? "color:#CC3338; border-color:#F3C6C8;" : ""}`)}>{s.rotulo}</span>
          ))}

          {/* Nós */}
          {[...caixas.values()].map((c) => <NoView key={c.no.id} c={c} />)}
        </div>
    </div>
  );
}

function NoView({ c }: { c: Caixa }) {
  const { no, cor } = c;
  const base = `position:absolute; left:${c.cx - c.w / 2}px; top:${c.cy - c.h / 2}px; width:${c.w}px; height:${c.h}px; display:flex; align-items:center; justify-content:center; text-align:center; box-sizing:border-box; font-size:11.5px; line-height:1.3; font-weight:700;`;
  if (no.forma === "decisao") {
    return (
      <div style={css(base)}>
        <svg width={c.w} height={c.h} style={{ position: "absolute", inset: 0 }}>
          <polygon points={`${c.w / 2},1 ${c.w - 1},${c.h / 2} ${c.w / 2},${c.h - 1} 1,${c.h / 2}`} fill="#FFF4D6" stroke="#E0A526" strokeWidth={1.5} />
        </svg>
        <span style={css("position:relative; padding:0 26px; color:#5C3D00; font-size:11px;")}>{no.texto}</span>
      </div>
    );
  }
  if (no.forma === "inicio" || no.forma === "fim") {
    return <div style={css(`${base} border-radius:999px; background:${cor}; color:#fff; padding:0 12px; box-shadow:0 2px 6px rgba(20,24,40,.12);`)}>{no.texto}</div>;
  }
  if (no.forma === "sistema") {
    return (
      <div style={css(`${base} flex-direction:column; gap:3px; border-radius:10px; background:#F1F4F9; border:1.5px dashed #9AA6BC; color:#2E3A50; padding:0 10px;`)}>
        <span style={css("font-size:9px; font-weight:800; letter-spacing:.5px; color:#6B7A93; text-transform:uppercase;")}>automático</span>
        <span>{no.texto}</span>
      </div>
    );
  }
  return <div style={css(`${base} border-radius:10px; background:#fff; border:1.5px solid ${cor}66; border-left:5px solid ${cor}; color:#1B1B28; padding:0 10px; box-shadow:0 2px 6px rgba(20,24,40,.06);`)}>{no.texto}</div>;
}

/** Caminho com ângulos retos entre as bordas de dois nós + ponto do rótulo. */
function rota(a: Caixa, b: Caixa): { d: string; lx: number; ly: number } {
  const aR = a.cx + a.w / 2, aT = a.cy - a.h / 2, aB = a.cy + a.h / 2;
  const bL = b.cx - b.w / 2, bT = b.cy - b.h / 2, bB = b.cy + b.h / 2;
  const ponta = 2; // folga para a ponta da seta não entrar no nó
  // Decisão com destino acima/abaixo: sai pelo vértice de cima/de baixo (como no Miro).
  if (a.no.forma === "decisao" && b.cx > a.cx && Math.abs(a.cy - b.cy) >= 1) {
    const sy = b.cy < a.cy ? aT : aB;
    return { d: `M${a.cx} ${sy} V${b.cy} H${bL - ponta}`, lx: a.cx + 26, ly: b.cy - 12 };
  }
  if (b.cx > a.cx) {
    if (Math.abs(a.cy - b.cy) < 1) return { d: `M${aR} ${a.cy} H${bL - ponta}`, lx: (aR + bL) / 2, ly: a.cy - 11 };
    // Desce/sobe no vão logo antes do destino e entra pela esquerda.
    const x = ROTULO_W + b.no.col * COL_W; // divisa entre a coluna anterior e a do destino
    return { d: `M${aR} ${a.cy} H${x} V${b.cy} H${bL - ponta}`, lx: x + (bL - x) / 2, ly: b.cy - 11 };
  }
  if (b.cx === a.cx) {
    return b.cy > a.cy
      ? { d: `M${a.cx} ${aB} V${bT - ponta}`, lx: a.cx + 30, ly: (aB + bT) / 2 }
      : { d: `M${a.cx} ${aT} V${bB + ponta}`, lx: a.cx + 34, ly: (aT + bB) / 2 };
  }
  // Volta para trás: sai por baixo, passa por baixo dos dois e sobe no destino.
  const y = Math.max(aB, bB) + 14;
  return { d: `M${a.cx} ${aB} V${y} H${b.cx} V${bB + ponta}`, lx: (a.cx + b.cx) / 2, ly: y };
}

function Legenda() {
  const item = (forma: React.ReactNode, rotulo: string) => (
    <span style={css("display:inline-flex; align-items:center; gap:6px;")}>{forma}{rotulo}</span>
  );
  return (
    <div style={css("display:flex; flex-wrap:wrap; gap:14px; padding:9px 14px; border-top:1px solid #ECEDF1; font-size:11.5px; font-weight:700; color:#7A8090;")}>
      {item(<span style={css("width:22px; height:10px; border-radius:999px; background:#955C6B;")} />, "Início / fim")}
      {item(<span style={css("width:18px; height:12px; border-radius:3px; background:#fff; border:1.5px solid #C9CCD5; border-left:4px solid #955C6B;")} />, "Etapa (alguém faz)")}
      {item(<span style={css("width:18px; height:12px; border-radius:3px; background:#F1F4F9; border:1.5px dashed #9AA6BC;")} />, "Automático (o sistema faz)")}
      {item(<svg width="16" height="14"><polygon points="8,1 15,7 8,13 1,7" fill="#FFF4D6" stroke="#E0A526" strokeWidth="1.5" /></svg>, "Decisão")}
      {item(<svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#6B7180" strokeWidth="1.6" strokeDasharray="5 4" /></svg>, "Caminho eventual")}
    </div>
  );
}
