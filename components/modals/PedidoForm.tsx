"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { formatBR, TODAY } from "@/lib/format";
import { produtosNoPedido, totalPedido, totalPorLocal, type Itens } from "@/lib/pedido";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import DatePicker from "../ui/DatePicker";
import MatrizPedido from "../ui/MatrizPedido";
import { useApp } from "../store";

/** Drawer "Nova ordem de serviço": título, entrega e a matriz produto × unidade. */
export default function PedidoForm({ open, onClose, onCriada }: { open: boolean; onClose: () => void; onCriada?: (id: string) => void }) {
  const { produtos, addPedido } = useApp();
  const [titulo, setTitulo] = useState("");
  const [entrega, setEntrega] = useState("");
  const [itens, setItens] = useState<Itens>({});
  const [busca, setBusca] = useState("");

  const close = () => { onClose(); setTitulo(""); setEntrega(""); setItens({}); setBusca(""); };
  useFecharComEsc(open, close);
  if (!open) return null;

  const padrao = `Pedido ${formatBR(TODAY)}`;
  const nProd = produtosNoPedido(itens), nUn = totalPedido(itens);
  const tot = totalPorLocal(itens);
  const nUnid = Object.entries(tot).filter(([l, n]) => l !== "fabrica" && n > 0).length; // lojas que recebem (a Fábrica não gera expedição/recebimento)
  const nTarefasProd = Object.values(itens).reduce((s, q) => s + Object.values(q).filter((n) => n > 0).length, 0); // produto × unidade
  const valido = nUn > 0 && !!entrega;
  const submit = () => {
    if (!valido) return;
    const p = addPedido({ titulo: (titulo.trim() || padrao), entrega, itens });
    close();
    onCriada?.(p.id);
  };

  return (
    <>
      <div onClick={close} style={css("position:fixed; inset:0; z-index:64; background:rgba(20,24,40,.32);")} />
      <div className="m-drawer" style={css("position:fixed; top:0; right:0; bottom:0; z-index:65; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:1060px; max-width:96vw; display:flex; flex-direction:column; overflow:hidden;")}>
        <div style={css("display:flex; align-items:center; gap:10px; padding:18px 24px; border-bottom:1px solid #ECEDF1;")}>
          <h2 style={css("margin:0; font-size:18px; font-weight:800; letter-spacing:-0.3px;")}>Nova ordem de serviço</h2>
          <span style={{ flex: 1 }} />
          <Hoverable as="button" onClick={close} s={css("width:32px; height:32px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={16} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:16px;")}>
          <div className="m-wrap" style={css("display:flex; gap:14px; align-items:flex-end;")}>
            <div style={css("flex:1; min-width:220px;")}>
              <label style={lbl}>Título</label>
              <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={padrao} style={css(inp)} />
            </div>
            <div>
              <label style={lbl}>Entrega <span style={{ color: "#E5484D" }}>*</span></label>
              <DatePicker date={entrega} align="left" z={80} onSave={(d) => setEntrega(d)} trigger={(toggle) => (
                <Hoverable onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:7px; height:40px; box-sizing:border-box; border:1px solid ${entrega ? "#E2E3E9" : "#F3B4BC"}; border-radius:10px; padding:0 13px; font-size:13.5px; font-weight:600; color:${entrega ? "#1B1B28" : "#9398A6"}; cursor:pointer; background:#fff;`)} hover="background:#FAFAFB">
                  <Svg size={14} stroke="#7A8090"><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>
                  {entrega || "Definir data"}
                  {entrega && <span onClick={(e) => { e.stopPropagation(); setEntrega(""); }} title="Limpar" style={css("display:inline-flex; color:#9398A6; margin-left:2px;")}><Svg size={12} sw={2.4}><path d="M6 6l12 12M18 6 6 18" /></Svg></span>}
                </Hoverable>
              )} />
            </div>
            <div style={css("display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #E2E3E9; border-radius:10px; padding:0 12px; height:40px; box-sizing:border-box; width:240px;")}>
              <Svg size={15} sw={2.2} stroke="#9398A6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto" style={css("flex:1; min-width:0; border:none; outline:none; background:transparent; font-size:13px; font-weight:600; color:#1B1B28;")} />
            </div>
          </div>
          <div>
            <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px;")}>
              <span style={css("font-size:13.5px; font-weight:800;")}>Quantidade por unidade</span>
              <span style={css("font-size:12.5px; color:#9398A6; font-weight:600;")}>Preencha o que cada unidade precisa receber. Em branco = 0.</span>
            </div>
            <MatrizPedido produtos={produtos} itens={itens} onChange={setItens} editavel busca={busca} />
          </div>
        </div>
        <div style={css("flex:none; padding:16px 24px; border-top:1px solid #ECEDF1; display:flex; align-items:center; gap:10px;")}>
          <span style={css("font-size:13px; font-weight:700; color:#5B6472;")}>{nProd} {nProd === 1 ? "produto" : "produtos"} · <strong style={css("color:#1B1B28;")}>{nUn} un.</strong>{nProd > 0 && <span style={css("color:#9398A6; font-weight:600;")}> · gera {nTarefasProd} {nTarefasProd === 1 ? "tarefa" : "tarefas"} de produção, {nUnid} de expedição e {nUnid} de recebimento{entrega ? `, vencendo em ${entrega}` : ""}</span>}</span>
          {!entrega && nUn > 0 && <span style={css("font-size:12.5px; font-weight:700; color:#CC3338;")}>Defina a data de entrega.</span>}
          <span style={{ flex: 1 }} />
          <Hoverable as="button" onClick={close} s={css("border:1px solid #E2E3E9; cursor:pointer; background:#fff; color:#5B6472; font-weight:700; font-size:14px; padding:12px 20px; border-radius:11px;")} hover="background:#F4F4F7">Cancelar</Hoverable>
          <Hoverable as="button" onClick={submit} {...{ disabled: !valido }} s={css(`border:none; cursor:${valido ? "pointer" : "not-allowed"}; opacity:${valido ? 1 : 0.5}; background:#1B1B28; color:#fff; font-weight:700; font-size:14px; padding:12px 26px; border-radius:11px;`)} hover={valido ? "filter:brightness(1.15)" : undefined}>Criar ordem</Hoverable>
        </div>
      </div>
    </>
  );
}

const inp = "width:100%; box-sizing:border-box; height:40px; border:1px solid #E2E3E9; border-radius:10px; font-size:13.5px; padding:0 13px; outline:none;";
const lbl = css("display:block; font-size:13px; font-weight:700; margin-bottom:6px;");
