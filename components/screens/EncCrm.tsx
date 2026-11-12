"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { brl, foneBR, normalizePhone } from "@/lib/format";
import { PEDIDO_STATUS, corPedido, proximoPedido, dataBR, useEncomendas, type PedidoEncomenda, type PedidoStatus, type ResponsavelLead } from "@/lib/encomendas";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import LeadDetail, { RESP_COR, Seletor } from "../encomendas/LeadDetail";
import { useApp } from "../store";
import { useIsMobile } from "@/lib/useIsMobile";
import { useMudarStatusPedido } from "../encomendas/useStatusPedido";
import BotaoAvancar from "../ui/BotaoAvancar";

const RESPONSAVEIS: ResponsavelLead[] = ["I.A", "Humano"];

/** Encomendas → CRM: um cartão por pedido, nas colunas do status do pedido (como o CRM do Cachorrão). */
export default function EncCrm() {
  const { canEditPage } = useApp();
  const editavel = canEditPage("encomendas-crm");
  const { leads, pedidos, produtoDe, setResponsavel } = useEncomendas();
  const { mudar: setPedidoStatus, popup: popupStatus } = useMudarStatusPedido();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<{ lead: string; pedido: string } | null>(null);
  const [recolhidas, setRecolhidas] = useState<Record<string, boolean>>({});
  const mobile = useIsMobile();
  const [abaStatus, setAbaStatus] = useState<PedidoStatus>("Verificar pagamento");

  const q = busca.trim().toLowerCase();
  const dig = normalizePhone(busca);
  const leadDe = (id: string) => leads.find((l) => l.id === id);
  const visiveis = pedidos.filter((p) => {
    if (!q) return true;
    const l = leadDe(p.leadId);
    return !!l && (l.nome.toLowerCase().includes(q) || (dig.length >= 3 && l.numero.includes(dig)));
  });
  // Abertos: o mais próximo da data de entrega primeiro. Entregues: o mais recente primeiro.
  const daColuna = (st: PedidoStatus) =>
    visiveis
      .filter((p) => p.status === st)
      .sort((a, b) => {
        const c = `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`);
        return st === "Entregue" ? -c : c;
      });

  const chip = (conteudo: React.ReactNode) => (
    <span style={css("display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:#3A3F4C; background:#F2F3F6; border-radius:7px; padding:4px 8px; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis;")}>{conteudo}</span>
  );

  const cartao = (p: PedidoEncomenda) => {
    const l = leadDe(p.leadId);
    const prod = produtoDe(p.produtoId);
    const nomeProd = (prod?.nome ?? p.produtoNome ?? "Produto removido").replace(/^Torta de /, "");
    const local = p.tipo === "Retirada" ? p.unidadeNome : p.endereco?.bairro;
    const cor = corPedido(p.status);
    return (
      <Hoverable key={p.id} onClick={() => setAberto({ lead: p.leadId, pedido: p.id })} s={css(`background:#fff; border:1px solid #ECEDF1; border-left:3px solid ${cor}; border-radius:12px; padding:12px 13px; box-shadow:0 1px 2px rgba(16,24,40,.04); cursor:pointer;`)} hover="box-shadow:0 2px 8px rgba(16,24,40,.08)">
        <div style={css("display:flex; align-items:flex-start; gap:8px;")}>
          <div style={css("flex:1; min-width:0;")}>
            <div style={css("font-size:14px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{l?.nome || (l ? foneBR(l.numero) : "Contato removido")}</div>
            {l && <div style={css("font-size:12.5px; color:#7A8090; margin-top:2px;")}>{foneBR(l.numero)}</div>}
          </div>
          <span style={css("flex:none; font-size:13.5px; font-weight:800;")}>{brl(p.total)}</span>
        </div>
        <div style={css("display:flex; flex-wrap:wrap; gap:6px; margin-top:9px;")}>
          {chip(<>{p.quantidade}× {nomeProd}</>)}
          {chip(<><Svg size={12} sw={2.2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>{dataBR(p.data)} · {p.hora}</>)}
          {chip(<>{p.tipo === "Retirada" ? "📍" : "🛵"} {p.tipo}{local ? ` · ${local}` : ""}</>)}
        </div>
        <div style={css("display:flex; align-items:center; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid #F0F1F4; flex-wrap:wrap;")}>
          <Seletor disabled={!editavel} valor={p.status} cor={cor} opcoes={PEDIDO_STATUS.map((s) => ({ v: s.key, cor: s.cor }))} onChange={(v) => setPedidoStatus(p.id, v as PedidoStatus)} />
          {l && <Seletor disabled={!editavel} valor={l.responsavel} cor={RESP_COR[l.responsavel].fg} opcoes={RESPONSAVEIS.map((r) => ({ v: r, cor: RESP_COR[r].fg }))} onChange={(v) => setResponsavel(l.id, v as ResponsavelLead)} />}
          <span style={{ flex: 1 }} />
          {editavel && proximoPedido(p.status) && <BotaoAvancar proximo={proximoPedido(p.status)!} onClick={() => setPedidoStatus(p.id, proximoPedido(p.status)!)} />}
        </div>
      </Hoverable>
    );
  };

  return (
    <div style={css("height:100%; display:flex; flex-direction:column;")}>
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:24px 30px 14px; flex:none;")}>
        <div>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>CRM</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>Pedidos de encomenda, do pagamento à entrega</p>
        </div>
      </div>
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:12px; padding:0 30px 12px; flex:none;")}>
        <div style={css("position:relative; width:320px; max-width:100%;")}>
          <Svg size={15} stroke="#9398A6" style={css("position:absolute; left:11px; top:50%; transform:translateY(-50%);")}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone…" style={css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:10px; padding:9px 12px 9px 33px; font-size:13px; outline:none; background:#fff;")} />
        </div>
        <span style={css("font-size:12.5px; font-weight:700; color:#9398A6;")}>{visiveis.length} pedido{visiveis.length === 1 ? "" : "s"}</span>
      </div>

      {/* Celular: as colunas de 290px não cabem — vira abas por status + lista vertical. */}
      {mobile && (
        <div style={css("flex:1; min-height:0; display:flex; flex-direction:column;")}>
          <div className="m-pad" style={css("flex:none; display:flex; gap:7px; overflow-x:auto; padding:0 30px 10px; scrollbar-width:none;")}>
            {PEDIDO_STATUS.map((st) => {
              const n = visiveis.filter((p) => p.status === st.key).length;
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
            {daColuna(abaStatus).map(cartao)}
            {!visiveis.some((p) => p.status === abaStatus) && <div style={css("padding:26px 8px; text-align:center; color:#B6BAC4; font-size:13px;")}>Sem pedidos em “{abaStatus}”.</div>}
          </div>
        </div>
      )}

      {!mobile && <div className="m-pad" style={css("flex:1; min-height:0; padding:0 30px 24px; display:flex; flex-direction:column;")}>
        <div style={css("flex:1; min-height:0; overflow-x:auto; overflow-y:hidden; padding:8px 0 8px;")}>
          <div style={css("display:flex; gap:16px; height:100%; align-items:flex-start;")}>
            {PEDIDO_STATUS.map((st) => {
              const col = daColuna(st.key);
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
                <div key={st.key} style={css("width:300px; flex:none; display:flex; flex-direction:column; max-height:100%; background:#F4F5F7; border-radius:14px;")}>
                  <Hoverable onClick={() => setRecolhidas((r) => ({ ...r, [st.key]: true }))} title="Recolher coluna" s={css("flex:none; display:flex; align-items:center; gap:9px; margin:6px 6px 0; padding:12px 12px 11px; cursor:pointer; border-radius:10px;")} hover="background:#EDEEF2">
                    <span style={css(`width:9px; height:9px; border-radius:50%; background:${st.cor};`)} />
                    <span style={css("font-weight:700; font-size:13.5px; color:#3A3F4C;")}>{st.key}</span>
                    <span style={{ flex: 1 }} />
                    <span style={css("font-size:12.5px; font-weight:700; color:#9398A6;")}>{col.length}</span>
                  </Hoverable>
                  <div style={css("flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding:4px 12px 12px;")}>
                    {col.map(cartao)}
                    {col.length === 0 && <div style={css("padding:16px 8px 20px; text-align:center; color:#B6BAC4; font-size:12.5px;")}>Sem pedidos</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>}

      {popupStatus}
      {aberto && <LeadDetail leadId={aberto.lead} pedidoAberto={aberto.pedido} canEdit={editavel} onClose={() => setAberto(null)} />}
    </div>
  );
}
