"use client";

import { useEffect, useState } from "react";
import { css } from "@/lib/css";
import { corDaCategoria } from "@/lib/estoque";
import { linhasDaTarefa, rotuloRealizado, type LinhaConferencia } from "@/lib/conferencia";
import { statusInfo } from "@/lib/theme";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import { useApp } from "../store";

/**
 * Popup ao concluir uma tarefa da ordem: a pessoa registra (ou confirma) o produzido /
 * separado / recebido de cada produto e só então a tarefa é concluída. Atende uma fila
 * (ações em lote abrem uma tarefa por vez).
 */
export default function ConcluirTarefa() {
  const { conclusoesPendentes, tasks } = useApp();
  const item = conclusoesPendentes[0];
  const t = item ? tasks.find((x) => x.id === item.id) : undefined;
  if (!item || !t) return null;
  return <Corpo key={t.id} />;
}

function Corpo() {
  const { conclusoesPendentes, tasks, produtos, resolverConclusao } = useApp();
  const item = conclusoesPendentes[0];
  const t = tasks.find((x) => x.id === item.id)!;
  const rot = rotuloRealizado(t.categoria);
  const [linhas, setLinhas] = useState<LinhaConferencia[]>(() => linhasDaTarefa(t));
  const [txt, setTxt] = useState<string[]>(() => linhasDaTarefa(t).map((l) => (l.feito == null ? "" : String(l.feito))));
  useEffect(() => { setLinhas(linhasDaTarefa(t)); }, [t]);
  const cancelar = () => resolverConclusao(t.id, null);
  useFecharComEsc(true, cancelar);

  const valores = txt.map((v) => (v.trim() === "" ? undefined : Math.max(0, Math.round(Number(v)))));
  const completo = valores.every((v) => typeof v === "number" && Number.isFinite(v));
  const totPed = linhas.reduce((s, l) => s + l.pedido, 0);
  const totFeito = valores.reduce<number>((s, v) => s + (v ?? 0), 0);
  const confirmar = () => { if (completo) resolverConclusao(t.id, linhas.map((l, i) => ({ ...l, feito: valores[i] }))); };
  const destino = item.status === "validada" ? statusInfo.validada.label : statusInfo.concluida.label;
  const grid = "display:grid; grid-template-columns:minmax(0,1fr) 70px 108px 70px; gap:10px; align-items:center;";

  return (
    <>
      <div onClick={cancelar} style={css("position:fixed; inset:0; z-index:90; background:rgba(20,24,40,.42);")} />
      <div style={css("position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:91; width:600px; max-width:94vw; max-height:88vh; display:flex; flex-direction:column; background:#fff; border-radius:16px; box-shadow:0 24px 70px rgba(20,24,40,.35); overflow:hidden;")}>
        <div style={css("display:flex; align-items:flex-start; gap:10px; padding:18px 20px 14px; border-bottom:1px solid #ECEDF1;")}>
          <span style={css("flex:none; width:34px; height:34px; border-radius:9px; background:#E7F6EE; color:#1B7F4D; display:flex; align-items:center; justify-content:center;")}><Svg size={17} sw={2.4}><path d="M20 6 9 17l-5-5" /></Svg></span>
          <div style={css("flex:1; min-width:0;")}>
            <div style={css("font-size:16.5px; font-weight:800; letter-spacing:-0.3px;")}>Confirmar {rot.toLowerCase()} e concluir</div>
            <div style={css("font-size:13px; color:#5B6472; font-weight:600; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{t.titulo}</div>
          </div>
          {conclusoesPendentes.length > 1 && <span style={css("flex:none; font-size:12px; font-weight:700; color:#7A8090; background:#F4F4F7; padding:4px 9px; border-radius:999px;")}>1 de {conclusoesPendentes.length}</span>}
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:14px 20px;")}>
          <p style={css("margin:0 0 12px; font-size:13px; color:#5B6472; line-height:1.5;")}>Informe quanto foi <b>{rot.toLowerCase()}</b> de cada produto. Se bateu com o pedido, use “Igual ao pedido”.</p>
          <div style={css("border:1px solid #ECEDF1; border-radius:11px; overflow:hidden;")}>
            <div style={css(`${grid} padding:8px 12px; background:#FAFAFB; border-bottom:1px solid #ECEDF1; font-size:10.5px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; color:#9398A6;`)}>
              <span>Produto</span><span style={css("text-align:right;")}>Pedido</span><span style={css("text-align:center;")}>{rot}</span><span style={css("text-align:right;")}>Dif.</span>
            </div>
            {linhas.map((l, i) => {
              const p = produtos.find((x) => x.id === l.produtoId);
              const v = valores[i]; const dif = v == null ? null : v - l.pedido;
              return (
                <div key={l.produtoId + i} style={css(`${grid} padding:8px 12px; ${i ? "border-top:1px solid #F4F5F7;" : ""}`)}>
                  <span style={css("display:flex; align-items:center; gap:7px; min-width:0; font-size:13.5px; font-weight:600;")}>
                    <span style={css(`width:8px; height:8px; flex:none; border-radius:50%; background:${corDaCategoria(p?.categoria ?? "")};`)} />
                    <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{p?.nome ?? "Produto removido"}</span>
                  </span>
                  <span style={css("text-align:right; font-size:14px; font-weight:700; color:#5B6472; font-variant-numeric:tabular-nums;")}>{l.pedido}</span>
                  <span style={css("display:flex; justify-content:center;")}>
                    <input autoFocus={i === 0} value={txt[i]} inputMode="numeric" placeholder="—"
                      onChange={(e) => { const nv = e.target.value.replace(/[^\d]/g, ""); setTxt((a) => a.map((x, j) => (j === i ? nv : x))); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (completo) confirmar(); } }}
                      onFocus={(e) => e.target.select()}
                      style={css(`width:90px; height:36px; box-sizing:border-box; border:1px solid ${v == null ? "#F3B4BC" : "#E2E3E9"}; border-radius:9px; outline:none; text-align:center; font-size:15px; font-weight:800; font-variant-numeric:tabular-nums; background:${v == null ? "#FFF8F9" : "#fff"};`)} />
                  </span>
                  <span style={css(`text-align:right; font-size:13px; font-weight:800; font-variant-numeric:tabular-nums; color:${dif == null ? "#C7CAD2" : dif === 0 ? "#1B7F4D" : dif < 0 ? "#CC3338" : "#C25712"};`)}>{dif == null ? "—" : dif === 0 ? "ok" : dif > 0 ? `+${dif}` : dif}</span>
                </div>
              );
            })}
            <div style={css(`${grid} padding:8px 12px; background:#FAFAFB; border-top:1px solid #ECEDF1; font-size:12px; font-weight:800; color:#5B6472;`)}>
              <span>TOTAL</span><span style={css("text-align:right;")}>{totPed}</span><span style={css("text-align:center; color:#1B1B28;")}>{completo ? totFeito : "—"}</span>
              <span style={css(`text-align:right; color:${!completo ? "#C7CAD2" : totFeito === totPed ? "#1B7F4D" : totFeito < totPed ? "#CC3338" : "#C25712"};`)}>{!completo ? "—" : totFeito === totPed ? "ok" : totFeito > totPed ? `+${totFeito - totPed}` : totFeito - totPed}</span>
            </div>
          </div>
          <Hoverable as="button" onClick={() => setTxt(linhas.map((l, i) => (txt[i].trim() === "" ? String(l.pedido) : txt[i])))} s={css("margin-top:10px; display:inline-flex; align-items:center; gap:6px; border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:12.5px; font-weight:700; padding:7px 12px; border-radius:9px;")} hover="background:#F4F4F7">
            <Svg size={13} sw={2.4}><path d="M20 6 9 17l-5-5" /></Svg>Igual ao pedido
          </Hoverable>
        </div>
        <div style={css("display:flex; align-items:center; gap:10px; padding:14px 20px; border-top:1px solid #ECEDF1;")}>
          <span style={css("flex:1; font-size:12px; color:#9398A6; font-weight:600;")}>{completo ? `A tarefa vai para "${destino}".` : "Preencha todos os produtos para concluir."}</span>
          <Hoverable as="button" onClick={cancelar} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:13.5px; font-weight:700; padding:10px 18px; border-radius:10px;")} hover="background:#F4F4F7">Cancelar</Hoverable>
          <Hoverable as="button" onClick={confirmar} {...{ disabled: !completo }} s={css(`border:none; background:#1B7F4D; color:#fff; cursor:${completo ? "pointer" : "not-allowed"}; opacity:${completo ? 1 : 0.45}; font-size:13.5px; font-weight:700; padding:10px 18px; border-radius:10px;`)} hover={completo ? "filter:brightness(1.1)" : undefined}>Confirmar e concluir</Hoverable>
        </div>
      </div>
    </>
  );
}
