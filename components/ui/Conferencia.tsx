"use client";

import { useEffect, useState } from "react";
import { css } from "@/lib/css";
import { corDaCategoria } from "@/lib/estoque";
import { faltamPreencher, linhasDaTarefa, rotuloRealizado, type LinhaConferencia } from "@/lib/conferencia";
import type { Task } from "@/lib/types";
import { Svg } from "./Svg";
import Hoverable from "./Hoverable";
import Menu, { MenuItem } from "./Menu";
import { useApp } from "../store";

/**
 * Conferência da tarefa: produto | pedido | produzido/separado/recebido | diferença.
 * O realizado é obrigatório para concluir (o store e o servidor bloqueiam). Tarefa concluída
 * fica travada — reabrir libera (o estoque já foi movido com os valores da conclusão).
 * Em produção avulsa (sem ordem) dá para adicionar/remover produtos.
 */
export default function Conferencia({ t }: { t: Task }) {
  const { produtos, updateTask, canEditPage } = useApp();
  const linhas = linhasDaTarefa(t);
  const feita = t.status === "concluida" || t.status === "validada";
  const rot = rotuloRealizado(t.categoria);
  const avulsa = !t.pedidoId && t.categoria !== "expedicao" && t.categoria !== "unidade";
  const travada = feita;
  const salvar = (novas: LinhaConferencia[]) => updateTask(t.id, { conferencia: novas });
  const setFeito = (i: number, v: number | undefined) => salvar(linhas.map((l, j) => (j === i ? { ...l, feito: v } : l)));
  const faltam = faltamPreencher(linhas);
  void canEditPage;

  if (!linhas.length && !avulsa) return null;
  const totPed = linhas.reduce((s, l) => s + l.pedido, 0), totFeito = linhas.reduce((s, l) => s + (l.feito ?? 0), 0);
  const grid = "display:grid; grid-template-columns:minmax(0,1fr) 72px 110px 78px 28px; gap:10px; align-items:center;";

  return (
    <div style={css("margin-top:16px; padding-top:16px; border-top:1px solid #F0F1F4;")}>
      <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;")}>
        <Svg size={15} stroke="#5B6472"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Svg>
        <span style={css("font-size:14px; font-weight:800;")}>Conferência</span>
        {linhas.length > 0 && (faltam
          ? <span style={css("font-size:11.5px; font-weight:700; color:#C25712; background:#FFF1E8; padding:2px 8px; border-radius:999px;")}>{faltam === 1 ? "1 produto sem" : `${faltam} produtos sem`} {rot.toLowerCase()}</span>
          : <span style={css("font-size:11.5px; font-weight:700; color:#1B7F4D; background:#E7F6EE; padding:2px 8px; border-radius:999px;")}>completa</span>)}
        <span style={{ flex: 1 }} />
        {!travada && faltam > 0 && (
          <Hoverable as="button" onClick={() => salvar(linhas.map((l) => (l.feito == null ? { ...l, feito: l.pedido } : l)))} s={css("display:inline-flex; align-items:center; gap:6px; border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:12px; font-weight:700; padding:6px 11px; border-radius:8px;")} hover="background:#F4F4F7">
            <Svg size={13} sw={2.4}><path d="M20 6 9 17l-5-5" /></Svg>Igual ao pedido
          </Hoverable>
        )}
      </div>
      {linhas.length > 0 && (
        <div style={css("border:1px solid #ECEDF1; border-radius:11px; overflow:hidden;")}>
          <div style={css(`${grid} padding:8px 12px; background:#FAFAFB; border-bottom:1px solid #ECEDF1; font-size:10.5px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; color:#9398A6;`)}>
            <span>Produto</span><span style={css("text-align:right;")}>Pedido</span><span style={css("text-align:center;")}>{rot}</span><span style={css("text-align:right;")}>Diferença</span><span />
          </div>
          {linhas.map((l, i) => {
            const p = produtos.find((x) => x.id === l.produtoId);
            const dif = l.feito == null ? null : l.feito - l.pedido;
            return (
              <div key={l.produtoId + i} style={css(`${grid} padding:7px 12px; border-top:${i ? "1px solid #F4F5F7" : "none"};`)}>
                <span style={css("display:flex; align-items:center; gap:7px; min-width:0; font-size:13.5px; font-weight:600; color:#1B1B28;")}>
                  <span style={css(`width:8px; height:8px; flex:none; border-radius:50%; background:${corDaCategoria(p?.categoria ?? "")};`)} />
                  <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{p?.nome ?? "Produto removido"}</span>
                </span>
                <span style={css("text-align:right; font-size:13.5px; font-weight:700; color:#5B6472; font-variant-numeric:tabular-nums;")}>{l.pedido}</span>
                <span style={css("display:flex; justify-content:center;")}>
                  {travada
                    ? <span style={css("font-size:14px; font-weight:800; color:#1B1B28; font-variant-numeric:tabular-nums;")}>{l.feito ?? "—"}</span>
                    : <CampoQtd value={l.feito} onSave={(v) => setFeito(i, v)} />}
                </span>
                <span style={css(`text-align:right; font-size:13px; font-weight:800; font-variant-numeric:tabular-nums; color:${dif == null ? "#C7CAD2" : dif === 0 ? "#1B7F4D" : dif < 0 ? "#CC3338" : "#C25712"};`)}>{dif == null ? "—" : dif === 0 ? "ok" : dif > 0 ? `+${dif}` : dif}</span>
                <span style={css("display:flex; justify-content:center;")}>
                  {avulsa && !travada && (
                    <Hoverable as="button" title="Remover produto" onClick={() => salvar(linhas.filter((_, j) => j !== i))} s={css("width:24px; height:24px; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#C7CAD2;")} hover="background:#FDECEC; color:#CC3338"><Svg size={12} sw={2.4}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
                  )}
                </span>
              </div>
            );
          })}
          <div style={css(`${grid} padding:8px 12px; background:#FAFAFB; border-top:1px solid #ECEDF1; font-size:12px; font-weight:800; color:#5B6472;`)}>
            <span>TOTAL</span><span style={css("text-align:right; font-variant-numeric:tabular-nums;")}>{totPed}</span><span style={css("text-align:center; font-variant-numeric:tabular-nums; color:#1B1B28;")}>{faltam ? "—" : totFeito}</span>
            <span style={css(`text-align:right; font-variant-numeric:tabular-nums; color:${faltam ? "#C7CAD2" : totFeito === totPed ? "#1B7F4D" : totFeito < totPed ? "#CC3338" : "#C25712"};`)}>{faltam ? "—" : totFeito === totPed ? "ok" : totFeito > totPed ? `+${totFeito - totPed}` : totFeito - totPed}</span><span />
          </div>
        </div>
      )}
      {avulsa && !travada && (
        <div style={css("margin-top:8px;")}>
          <Menu trigger={(tg) => (
            <Hoverable as="button" onClick={tg} s={css("display:inline-flex; align-items:center; gap:6px; border:1px dashed #D7DAE0; background:#fff; color:#5B6472; cursor:pointer; font-size:12.5px; font-weight:700; padding:7px 12px; border-radius:9px;")} hover="background:#FAFAFB">
              <Svg size={13} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>Adicionar produto
            </Hoverable>
          )} width={300} z={64} popStyle="max-height:320px; overflow-y:auto;">
            {(c) => [...produtos].filter((p) => !linhas.some((l) => l.produtoId === p.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt")).map((p) => (
              <MenuItem key={p.id} onClick={() => { const q = Number(window.prompt(`Quantidade pedida de ${p.nome}:`, "1")); if (Number.isFinite(q) && q > 0) salvar([...linhas, { produtoId: p.id, pedido: Math.round(q) }]); c(); }}>
                <span style={css(`width:9px; height:9px; border-radius:50%; background:${corDaCategoria(p.categoria)};`)} /><span style={{ flex: 1 }}>{p.nome}</span><span style={css("font-size:11px; color:#9398A6;")}>{p.categoria}</span>
              </MenuItem>
            ))}
          </Menu>
        </div>
      )}
      <p style={css("margin:8px 0 0; font-size:12px; color:#9398A6; line-height:1.5;")}>
        {travada ? "Tarefa concluída: os números estão travados. Reabra a tarefa para corrigir." : `Registre o ${rot.toLowerCase()} de cada produto — só é possível concluir com todos preenchidos. Diferenças aparecem no relatório da ordem.`}
      </p>
    </div>
  );
}

/** Campo numérico que aceita vazio (= ainda não conferido). Enter/blur salva; Esc desfaz. */
function CampoQtd({ value, onSave }: { value?: number; onSave: (v: number | undefined) => void }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => { setV(value == null ? "" : String(value)); }, [value]);
  const commit = () => {
    const n = v.trim() === "" ? undefined : Math.max(0, Math.round(Number(v)));
    if (n !== undefined && !Number.isFinite(n)) { setV(value == null ? "" : String(value)); return; }
    if (n !== value) onSave(n);
  };
  return (
    <input
      value={v}
      inputMode="numeric"
      placeholder="—"
      onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setV(value == null ? "" : String(value)); }}
      onFocus={(e) => e.target.select()}
      style={css(`width:84px; height:32px; box-sizing:border-box; border:1px solid ${value == null ? "#F3B4BC" : "#E2E3E9"}; border-radius:8px; outline:none; text-align:center; font-size:14px; font-weight:800; font-variant-numeric:tabular-nums; color:#1B1B28; background:${value == null ? "#FFF8F9" : "#fff"};`)}
    />
  );
}
