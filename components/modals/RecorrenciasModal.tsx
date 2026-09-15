"use client";

import { useFecharComEsc } from "../ui/useFecharComEsc";
import { useMemo, useState } from "react";
import { css } from "@/lib/css";
import type { Task } from "@/lib/types";
import { isoParaBR } from "@/lib/recorrencia";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import { Avatar } from "../ui/bits";
import { gestorOf, useApp } from "../store";

/** Painel das tarefas recorrentes. Lê do store (tarefas com `rec`), pausa/retoma e
 *  remove a recorrência (a tarefa em si permanece). Abrir edita no detalhe. */

const SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function regraLabel(t: Task): string {
  const r = t.rec!;
  if (r.freq === "diaria") return "Todo dia";
  if (r.freq === "semanal") return `Toda ${SEMANA[r.diaSemana ?? 0]}`;
  return `Todo dia ${r.diaMes ?? 1} do mês`;
}

export default function RecorrenciasModal() {
  const { recModalScope, setRecModalScope, tasks, team, setRecorrencia, setTaskDetailOpen } = useApp();
  const [confirmarId, setConfirmarId] = useState<string | null>(null);

  const lista = useMemo(() => tasks.filter((t) => t.rec), [tasks]); // ativas ou pausadas (têm regra)

  // Hook ANTES do return antecipado (regra dos hooks).
  useFecharComEsc(!!recModalScope, () => close());
  if (!recModalScope) return null;
  const close = () => { setConfirmarId(null); setRecModalScope(null); };

  return (
    <>
      <div onClick={close} style={css("position:fixed; inset:0; z-index:66; background:rgba(20,24,40,.42);")} />
      <div style={css("position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:67; background:#fff; border-radius:16px; box-shadow:0 24px 70px rgba(20,24,40,.3); width:680px; max-width:96vw; max-height:86vh; display:flex; flex-direction:column; overflow:hidden;")}>
        <div style={css("display:flex; align-items:center; gap:10px; padding:18px 22px; border-bottom:1px solid #ECEDF1;")}>
          <span style={css("width:32px; height:32px; flex:none; border-radius:9px; background:#EAF0FE; color:#2563EB; display:flex; align-items:center; justify-content:center;")}>
            <Svg size={17} sw={2.2}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></Svg>
          </span>
          <h2 style={css("margin:0; font-size:17px; font-weight:800; letter-spacing:-0.3px;")}>Recorrências — Operacional</h2>
          <span style={{ flex: 1 }} />
          <Hoverable as="button" onClick={close} s={css("width:32px; height:32px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={16} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:14px 22px 20px; display:flex; flex-direction:column; gap:10px;")}>
          {lista.length === 0 ? (
            <div style={css("padding:44px 20px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px;")}>
              <span style={css("width:52px; height:52px; border-radius:14px; background:#F2F3F6; color:#B4B8C4; display:flex; align-items:center; justify-content:center;")}>
                <Svg size={24} sw={1.8}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></Svg>
              </span>
              <div style={css("font-size:14.5px; font-weight:800; color:#3A3F4C;")}>Nenhuma recorrência aqui</div>
              <div style={css("font-size:13px; color:#9398A6; font-weight:600; max-width:360px; line-height:1.5;")}>Crie uma em “Nova tarefa”, ou abra uma tarefa e ative a opção <b>Repetir</b>.</div>
            </div>
          ) : (
            lista.map((t) => {
              const r = t.rec!;
              const g = t.gestor ? gestorOf(team, t.gestor) : undefined;
              const confirmar = confirmarId === t.id;
              return (
                <div key={t.id} style={css(`display:flex; align-items:center; gap:12px; border:1px solid #ECEDF1; border-radius:12px; padding:12px 14px; background:${r.ativa ? "#fff" : "#FAFAFB"};`)}>
                  <div style={css("flex:1; min-width:0; cursor:pointer;")} onClick={() => { close(); setTaskDetailOpen(t.id); }}>
                    <div style={css("display:flex; align-items:center; gap:8px;")}>
                      <span style={css(`font-size:14px; font-weight:700; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${r.ativa ? "" : "opacity:.6;"}`)}>{t.titulo}</span>
                      {!r.ativa && <span style={css("flex:none; font-size:10.5px; font-weight:800; color:#8A6D1A; background:#FBF0CF; border-radius:6px; padding:2px 7px; text-transform:uppercase; letter-spacing:.3px;")}>Pausada</span>}
                    </div>
                    <div style={css("display:flex; align-items:center; gap:8px; margin-top:4px; font-size:12px; color:#7A8090; font-weight:600; flex-wrap:wrap;")}>
                      <span style={css("display:inline-flex; align-items:center; gap:4px;")}><Svg size={12} sw={2.2} stroke="#9398A6"><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></Svg>{regraLabel(t)}</span>
                      <span style={css("color:#9398A6;")}>{r.modo === "novo" ? "cria nova (histórico)" : "reusa a mesma"}</span>
                      {g && <span style={css("display:inline-flex; align-items:center; gap:5px;")}><Avatar ini={g.ini} cor={g.cor} src={g.foto} size={16} fontSize={8} />{g.nome}</span>}
                      {r.ativa && r.proxima && <span style={css("color:#2563EB;")}>próxima: {isoParaBR(r.proxima)}</span>}
                    </div>
                  </div>
                  {confirmar ? (
                    <div style={css("display:flex; align-items:center; gap:6px; flex:none;")}>
                      <span style={css("font-size:12px; color:#7A8090; font-weight:600;")}>Remover?</span>
                      <Hoverable as="button" onClick={() => { setConfirmarId(null); void setRecorrencia(t.id, null); }} s={css("border:none; cursor:pointer; background:#E5484D; color:#fff; font-weight:700; font-size:12px; padding:6px 11px; border-radius:8px;")} hover="filter:brightness(1.1)">Sim</Hoverable>
                      <Hoverable as="button" onClick={() => setConfirmarId(null)} s={css("border:1px solid #E2E3E9; cursor:pointer; background:#fff; color:#5B6472; font-weight:700; font-size:12px; padding:6px 11px; border-radius:8px;")} hover="background:#F4F4F7">Não</Hoverable>
                    </div>
                  ) : (
                    <div style={css("display:flex; align-items:center; gap:6px; flex:none;")}>
                      <Hoverable as="button" onClick={() => void setRecorrencia(t.id, { ...r, ativa: !r.ativa })} title={r.ativa ? "Pausar" : "Retomar"} s={css("width:32px; height:32px; border:1px solid #E2E3E9; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#5B6472;")} hover="background:#F2F3F6">
                        {r.ativa
                          ? <Svg size={15} sw={2.2}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></Svg>
                          : <Svg size={15} sw={2.2}><path d="M6 4l14 8-14 8V4z" /></Svg>}
                      </Hoverable>
                      <Hoverable as="button" onClick={() => setConfirmarId(t.id)} title="Remover recorrência" s={css("width:32px; height:32px; border:1px solid #E2E3E9; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#C0455A;")} hover="background:#FDECEC">
                        <Svg size={15} sw={2.2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg>
                      </Hoverable>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
