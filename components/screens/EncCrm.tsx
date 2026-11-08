"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { brl, foneBR, normalizePhone } from "@/lib/format";
import { LEAD_STATUS, corPedido, useEncomendas, type Lead, type LeadStatus } from "@/lib/encomendas";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import LeadDetail, { RESP_COR, Seletor } from "../encomendas/LeadDetail";
import { useApp } from "../store";
import { useIsMobile } from "@/lib/useIsMobile";

/** Encomendas → CRM: contatos pelo funil de atendimento até a venda (como o CRM do Cachorrão). */
export default function EncCrm() {
  const { canEditPage } = useApp();
  const editavel = canEditPage("encomendas-crm");
  const { leads, pedidos, produtoDe, setLeadStatus } = useEncomendas();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [recolhidas, setRecolhidas] = useState<Record<string, boolean>>({});
  const mobile = useIsMobile();
  const [abaStatus, setAbaStatus] = useState<LeadStatus>("Novo contato");

  const q = busca.trim().toLowerCase();
  const dig = normalizePhone(busca);
  const visiveis = leads
    .filter((l) => !q || l.nome.toLowerCase().includes(q) || (dig.length >= 3 && l.numero.includes(dig)))
    .sort((a, b) => b.ultimoContato.localeCompare(a.ultimoContato));
  const proximo = (s: LeadStatus): LeadStatus | null => {
    const i = LEAD_STATUS.findIndex((x) => x.key === s);
    return i >= 0 && i < 3 ? LEAD_STATUS[i + 1].key : null; // avança até "Venda"; Desqualificado/Perdido só pelo menu
  };

  const cartao = (l: Lead) => {
    const ultimo = pedidos.filter((p) => p.leadId === l.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
    const prod = ultimo && produtoDe(ultimo.produtoId);
    const prox = proximo(l.status);
    return (
      <Hoverable key={l.id} onClick={() => setAberto(l.id)} s={css("background:#fff; border:1px solid #ECEDF1; border-radius:12px; padding:12px 13px; box-shadow:0 1px 2px rgba(16,24,40,.04); cursor:pointer;")} hover="box-shadow:0 2px 8px rgba(16,24,40,.08)">
        <div style={css("display:flex; align-items:flex-start; gap:8px;")}>
          <div style={css("flex:1; min-width:0;")}>
            <div style={css("font-size:14px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{l.nome || foneBR(l.numero)}</div>
            <div style={css("font-size:12.5px; color:#7A8090; margin-top:2px;")}>{foneBR(l.numero)}</div>
          </div>
          <span style={css(`flex:none; font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px; background:${RESP_COR[l.responsavel].bg}; color:${RESP_COR[l.responsavel].fg};`)}>{l.responsavel}</span>
        </div>
        {ultimo && (
          <div style={css(`margin-top:9px; display:flex; align-items:center; gap:7px; font-size:12px; color:#3A3F4C; background:#FAFAFB; border-left:3px solid ${corPedido(ultimo.status)}; border-radius:7px; padding:6px 8px;`)}>
            <span style={css("flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600;")}>{ultimo.quantidade}× {(prod?.nome ?? ultimo.produtoNome ?? "Produto removido").replace(/^Torta de /, "")}</span>
            <span style={css("font-weight:800; flex:none;")}>{brl(ultimo.total)}</span>
          </div>
        )}
        {editavel && (
          <div style={css("display:flex; align-items:center; gap:6px; margin-top:10px;")}>
            <Seletor valor={l.status} cor={LEAD_STATUS.find((s) => s.key === l.status)!.cor} opcoes={LEAD_STATUS.map((s) => ({ v: s.key, cor: s.cor }))} onChange={(v) => setLeadStatus(l.id, v as LeadStatus)} />
            <span style={{ flex: 1 }} />
            {prox && (
              <Hoverable as="button" title={`Passar para "${prox}"`} onClick={(e: React.MouseEvent) => { e.stopPropagation(); setLeadStatus(l.id, prox); }} s={css("width:30px; height:30px; flex:none; border:1px solid #E2E3E9; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#5B6472;")} hover="background:#F4F4F7; color:#1B1B28">
                <Svg size={15} sw={2.4}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
              </Hoverable>
            )}
          </div>
        )}
      </Hoverable>
    );
  };

  return (
    <div style={css("height:100%; display:flex; flex-direction:column;")}>
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:24px 30px 14px; flex:none;")}>
        <div>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>CRM</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>Contatos pelo funil de atendimento, até a venda</p>
        </div>
      </div>
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:12px; padding:0 30px 12px; flex:none;")}>
        <div style={css("position:relative; width:320px; max-width:100%;")}>
          <Svg size={15} stroke="#9398A6" style={css("position:absolute; left:11px; top:50%; transform:translateY(-50%);")}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone…" style={css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:10px; padding:9px 12px 9px 33px; font-size:13px; outline:none; background:#fff;")} />
        </div>
        <span style={css("font-size:12.5px; font-weight:700; color:#9398A6;")}>{visiveis.length} contato{visiveis.length === 1 ? "" : "s"}</span>
      </div>

      {/* Celular: as colunas de 290px não cabem — vira abas por status + lista vertical. */}
      {mobile && (
        <div style={css("flex:1; min-height:0; display:flex; flex-direction:column;")}>
          <div className="m-pad" style={css("flex:none; display:flex; gap:7px; overflow-x:auto; padding:0 30px 10px; scrollbar-width:none;")}>
            {LEAD_STATUS.map((st) => {
              const n = visiveis.filter((l) => l.status === st.key).length;
              const ativo = st.key === abaStatus;
              return (
                <button key={st.key} onClick={() => setAbaStatus(st.key)} style={css(`flex:none; display:inline-flex; align-items:center; gap:6px; border:1px solid ${ativo ? st.cor : "#E2E3E9"}; background:${ativo ? `${st.cor}1A` : "#fff"}; color:${ativo ? "#1B1B28" : "#5B6472"}; border-radius:999px; padding:7px 12px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap;`)}>
                  <span style={css(`width:8px; height:8px; border-radius:50%; background:${st.cor};`)} />{st.key}
                  <span style={css("font-size:12px; color:#9398A6;")}>{n}</span>
                </button>
              );
            })}
          </div>
          <div className="m-pad" style={css("flex:1; min-height:0; overflow-y:auto; padding:2px 30px 24px; display:flex; flex-direction:column; gap:10px;")}>
            {visiveis.filter((l) => l.status === abaStatus).map(cartao)}
            {!visiveis.some((l) => l.status === abaStatus) && <div style={css("padding:26px 8px; text-align:center; color:#B6BAC4; font-size:13px;")}>Sem contatos em “{abaStatus}”.</div>}
          </div>
        </div>
      )}

      {!mobile && <div className="m-pad" style={css("flex:1; min-height:0; padding:0 30px 24px; display:flex; flex-direction:column;")}>
        <div style={css("flex:1; min-height:0; overflow-x:auto; overflow-y:hidden; padding:8px 0 8px;")}>
          <div style={css("display:flex; gap:16px; height:100%; align-items:stretch;")}>
            {LEAD_STATUS.map((st) => {
              const col = visiveis.filter((l) => l.status === st.key);
              if (recolhidas[st.key]) {
                return (
                  <Hoverable key={st.key} onClick={() => setRecolhidas((r) => ({ ...r, [st.key]: false }))} title="Expandir coluna" s={css("align-self:stretch; display:flex; flex-direction:column; align-items:center; gap:11px; background:#F4F5F7; border-radius:14px; width:46px; flex:none; padding:14px 0 16px; cursor:pointer;")} hover="background:#EDEEF2">
                    <span style={css(`width:9px; height:9px; border-radius:50%; background:${st.cor};`)} />
                    <span style={css("font-size:12.5px; font-weight:700; color:#9398A6;")}>{col.length}</span>
                    <span style={css("writing-mode:vertical-rl; transform:rotate(180deg); font-weight:700; font-size:13.5px; color:#3A3F4C; white-space:nowrap;")}>{st.key}</span>
                  </Hoverable>
                );
              }
              return (
                <div key={st.key} style={css("width:290px; flex:none; display:flex; flex-direction:column; min-height:0; background:#F4F5F7; border-radius:14px;")}>
                  <Hoverable onClick={() => setRecolhidas((r) => ({ ...r, [st.key]: true }))} title="Recolher coluna" s={css("flex:none; display:flex; align-items:center; gap:9px; margin:6px 6px 0; padding:12px 12px 11px; cursor:pointer; border-radius:10px;")} hover="background:#EDEEF2">
                    <span style={css(`width:9px; height:9px; border-radius:50%; background:${st.cor};`)} />
                    <span style={css("font-weight:700; font-size:13.5px; color:#3A3F4C;")}>{st.key}</span>
                    <span style={css("font-size:12.5px; font-weight:700; color:#9398A6;")}>{col.length}</span>
                  </Hoverable>
                  <div style={css("flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding:4px 12px 10px;")}>
                    {col.map(cartao)}
                    {col.length === 0 && <div style={css("padding:16px 8px; text-align:center; color:#B6BAC4; font-size:12.5px;")}>Sem contatos</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>}

      {aberto && <LeadDetail leadId={aberto} canEdit={editavel} onClose={() => setAberto(null)} />}
    </div>
  );
}
