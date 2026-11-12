"use client";

import { useState } from "react";
import { useMudarStatusPedido } from "./useStatusPedido";
import { css } from "@/lib/css";
import { brl, foneBR } from "@/lib/format";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Foto } from "./FunilEncomenda";
import { LinkWhatsapp } from "../ui/BotaoWhatsapp";
import { useApp } from "../store";
import {
  LEAD_STATUS, PEDIDO_STATUS, corLead, corPedido, dataBR, enderecoLinha, linkWhatsapp, mensagemConfirmacaoPedido, numeroPedido, useEncomendas,
  type LeadStatus, type PedidoStatus, type ResponsavelLead,
} from "@/lib/encomendas";

const dataHora = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às") : "—");
export const RESP_COR: Record<ResponsavelLead, { bg: string; fg: string }> = {
  "I.A": { bg: "rgba(59,130,246,.12)", fg: "#3B82F6" },
  Humano: { bg: "rgba(16,185,129,.12)", fg: "#10B981" },
};

/** Drawer do contato (CRM, Contatos e Agenda): dados, funil e os pedidos dele. */
export default function LeadDetail({ leadId, pedidoAberto, canEdit, onClose }: {
  leadId: string;
  pedidoAberto?: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  useFecharComEsc(true, onClose);
  const { leads, pedidos, config, produtoDe, unidadeDe, setLeadStatus, setResponsavel } = useEncomendas();
  const setPedidoStatus = useMudarStatusPedido();
  const { workspace } = useApp();
  const lead = leads.find((l) => l.id === leadId);
  const meus = pedidos.filter((p) => p.leadId === leadId).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const [aberto, setAberto] = useState<string | null>(pedidoAberto ?? (meus.length === 1 ? meus[0].id : null));
  if (!lead) return null;
  const faturamento = meus.reduce((s, p) => s + p.total, 0);
  // Mensagem de confirmação: do pedido aberto; senão do mais recente ainda não entregue.
  const alvo = meus.find((p) => p.id === aberto) ?? meus.find((p) => p.status !== "Entregue") ?? meus[0];
  const msgWpp = alvo
    ? mensagemConfirmacaoPedido({ nome: lead.nome, empresa: workspace.nome, pedido: { ...alvo, unidadeNome: alvo.unidadeNome ?? unidadeDe(alvo.unidadeId)?.nome }, produto: produtoDe(alvo.produtoId)?.nome ?? alvo.produtoNome ?? "encomenda" })
    : `Oi${lead.nome ? `, ${lead.nome.trim().split(/\s+/)[0]}` : ""}, tudo bem? Aqui é da ${workspace.nome || "Ju Budelon"}.`;
  const hrefWpp = linkWhatsapp(lead.numero, msgWpp);

  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:62; background:rgba(20,24,40,.32);")} />
      <div className="m-drawer" style={css("position:fixed; top:0; right:0; bottom:0; z-index:63; background:#FAFAFB; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:640px; max-width:96vw; display:flex; flex-direction:column;")}>
        <div style={css("flex:none; display:flex; align-items:center; gap:12px; padding:18px 22px; background:#fff; border-bottom:1px solid #ECEDF1;")}>
          <div style={css("flex:1; min-width:0;")}>
            <div style={css("display:flex; align-items:center; gap:8px; flex-wrap:wrap;")}>
              <h2 style={css("margin:0; font-size:20px; font-weight:800; letter-spacing:-.3px;")}>{lead.nome || foneBR(lead.numero)}</h2>
              <span style={css(`font-size:11.5px; font-weight:700; padding:3px 9px; border-radius:999px; background:${RESP_COR[lead.responsavel].bg}; color:${RESP_COR[lead.responsavel].fg};`)}>{lead.responsavel}</span>
            </div>
            <div style={css("font-size:12.5px; color:#9398A6; font-weight:600; margin-top:2px;")}>Detalhes do contato</div>
          </div>
          <Hoverable as="button" onClick={onClose} title="Fechar" s={css("flex:none; width:34px; height:34px; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={16} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>

        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:18px 22px 28px; display:flex; flex-direction:column; gap:14px;")}>
          <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:12px;")}>
            <Stat titulo="Quantidade de pedidos" valor={String(meus.length)} />
            <Stat titulo="Faturamento" valor={brl(faturamento)} />
          </div>

          {lead.resumo && (
            <Card titulo="Resumo do pedido">
              {lead.resumo.split("\n").map((l, i) => {
                const [k, ...v] = l.split(": ");
                return <Linha key={i} k={k} v={v.join(": ")} />;
              })}
            </Card>
          )}

          <Card titulo="Contato">
            <Linha k="Nome" v={lead.nome || "—"} />
            <Linha k="Telefone" v={
              <span style={css("display:inline-flex; align-items:center; gap:8px;")}>
                {foneBR(lead.numero)}
                {hrefWpp && <LinkWhatsapp href={hrefWpp} mensagem={msgWpp} para={lead.nome || foneBR(lead.numero)} size={26} />}
              </span>
            } />
          </Card>

          <Card titulo="Atividade">
            <Linha k="Responsável" v={
              <Seletor disabled={!canEdit} valor={lead.responsavel} cor={RESP_COR[lead.responsavel].fg} opcoes={(["I.A", "Humano"] as const).map((r) => ({ v: r, cor: RESP_COR[r].fg }))} onChange={(v) => setResponsavel(lead.id, v as ResponsavelLead)} />
            } />
            <Linha k="Status" v={
              <Seletor disabled={!canEdit} valor={lead.status} cor={corLead(lead.status)} opcoes={LEAD_STATUS.map((s) => ({ v: s.key, cor: s.cor }))} onChange={(v) => setLeadStatus(lead.id, v as LeadStatus)} />
            } />
            <Linha k="Último contato" v={dataHora(lead.ultimoContato)} />
            <Linha k="Criado em" v={dataHora(lead.criadoEm)} />
          </Card>

          <div>
            <div style={css("font-size:12px; font-weight:800; letter-spacing:.3px; text-transform:uppercase; color:#9398A6; margin:4px 0 8px;")}>Pedidos do cliente</div>
            {meus.length === 0 && <div style={css("font-size:13px; color:#B6BAC4; background:#fff; border:1px solid #ECEDF1; border-radius:12px; padding:14px;")}>Nenhum pedido ainda.</div>}
            <div style={css("display:flex; flex-direction:column; gap:8px;")}>
              {meus.map((p) => {
                const prod = produtoDe(p.produtoId);
                const nomeProd = prod?.nome ?? p.produtoNome ?? "Produto removido";
                const ab = aberto === p.id;
                return (
                  <div key={p.id} style={css(`background:#fff; border:1px solid #ECEDF1; border-left:4px solid ${corPedido(p.status)}; border-radius:12px; overflow:hidden;`)}>
                    <Hoverable onClick={() => setAberto(ab ? null : p.id)} s={css("display:flex; align-items:center; gap:12px; padding:10px 12px; cursor:pointer;")} hover="background:#FAFAFB">
                      <span style={css("width:44px; height:44px; border-radius:10px; overflow:hidden; flex:none;")}><Foto src={prod?.foto ?? null} alt="" proporcao="1/1" cortar miniatura /></span>
                      <div style={css("flex:1; min-width:0;")}>
                        <div style={css("font-size:13.5px; font-weight:800; line-height:1.3;")}>{p.quantidade}× {nomeProd}</div>
                        <div style={css("font-size:12px; color:#7A8090; margin-top:2px;")}>{p.tipo} · {dataBR(p.data)} às {p.hora} · #{numeroPedido(p.id)}</div>
                      </div>
                      <div style={css("text-align:right; flex:none;")}>
                        <div style={css("font-size:13.5px; font-weight:800;")}>{brl(p.total)}</div>
                        <span style={css(`display:inline-block; margin-top:3px; font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; background:${corPedido(p.status)}1F; color:${corPedido(p.status)};`)}>{p.status}</span>
                      </div>
                    </Hoverable>
                    {ab && (
                      <div style={css("border-top:1px solid #F0F1F4; padding:10px 14px 12px; display:flex; flex-direction:column; gap:2px;")}>
                        <Linha k="Status do pedido" v={
                          <Seletor disabled={!canEdit} valor={p.status} cor={corPedido(p.status)} opcoes={PEDIDO_STATUS.map((s) => ({ v: s.key, cor: s.cor }))} onChange={(v) => setPedidoStatus(p.id, v as PedidoStatus)} />
                        } />
                        <Linha k="Itens" v={`${p.quantidade}× ${nomeProd} (${brl(p.subtotal / p.quantidade)} cada)`} />
                        {p.mensagem && <Linha k="Observação" v={p.mensagem} />}
                        <Linha k="Subtotal" v={brl(p.subtotal)} />
                        {p.taxa > 0 && <Linha k="Taxa de entrega" v={brl(p.taxa)} />}
                        <Linha k="Total" v={brl(p.total)} />
                        <Linha k="Pagamento" v="PIX" />
                        <Linha k="Modalidade" v={p.tipo} />
                        {p.tipo === "Retirada" && <Linha k="Unidade" v={p.unidadeNome ?? unidadeDe(p.unidadeId)?.nome ?? "—"} />}
                        {p.tipo === "Entrega" && <Linha k="Endereço" v={enderecoLinha(p.endereco)} />}
                        <Linha k={p.tipo === "Entrega" ? "Entrega em" : "Retirada em"} v={`${dataBR(p.data)} às ${p.hora}`} />
                        <Linha k="Registrado em" v={`${dataHora(p.criadoEm)}${p.origem === "autoatendimento" ? " · autoatendimento" : ""}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!config.pixChave && meus.some((p) => p.status === "Verificar pagamento") && (
              <div style={css("margin-top:10px; font-size:12px; color:#7A8090;")}>Confirmou o PIX? Mude o pedido para <b>Em fila</b> — ele entra na fila de produção e aparece em amarelo na Agenda. Depois, use o botão do WhatsApp ao lado do telefone para confirmar com o cliente e mude para <b>Confirmado com o cliente</b>.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:12px; padding:12px 14px;")}>
      <div style={css("font-size:12px; font-weight:700; color:#9398A6;")}>{titulo}</div>
      <div style={css("font-size:20px; font-weight:800; margin-top:3px; font-variant-numeric:tabular-nums;")}>{valor}</div>
    </div>
  );
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:12px; padding:12px 14px;")}>
      <div style={css("font-size:12px; font-weight:800; letter-spacing:.3px; text-transform:uppercase; color:#9398A6; margin-bottom:6px;")}>{titulo}</div>
      <div style={css("display:flex; flex-direction:column; gap:2px;")}>{children}</div>
    </div>
  );
}

function Linha({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={css("display:flex; align-items:center; gap:12px; padding:5px 0; font-size:13px;")}>
      <span style={css("width:112px; flex:none; color:#7A8090; font-weight:600;")}>{k}</span>
      <span style={css("flex:1; min-width:0; color:#1B1B28; font-weight:600; word-break:break-word;")}>{v}</span>
    </div>
  );
}

/** Pílula colorida com menu de opções (status / responsável). */
export function Seletor({ valor, cor, opcoes, onChange, disabled }: { valor: string; cor: string; opcoes: { v: string; cor: string }[]; onChange: (v: string) => void; disabled?: boolean }) {
  const pilula = (tg?: () => void) => (
    <span onClick={(e) => { e.stopPropagation(); tg?.(); }} style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:4px 10px; border-radius:999px; background:${cor}1F; color:${cor}; cursor:${disabled ? "default" : "pointer"}; white-space:nowrap;`)}>
      <span style={css(`width:7px; height:7px; border-radius:50%; background:${cor};`)} />{valor}
      {!disabled && <Svg size={11} sw={2.6} style={css("opacity:.7;")}><path d="m6 9 6 6 6-6" /></Svg>}
    </span>
  );
  if (disabled) return pilula();
  // O menu abre num portal, mas o clique ainda borbulha pela árvore do React: sem o
  // stopPropagation, escolher um status dentro de um cartão abriria o drawer do cartão.
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex" }}>
      <Menu z={210} width={200} trigger={(tg) => pilula(tg)}>
        {(c) => opcoes.map((o) => (
          <MenuItem key={o.v} checked={o.v === valor} onClick={() => { onChange(o.v); c(); }}>
            <span style={css(`width:9px; height:9px; border-radius:50%; flex:none; background:${o.cor};`)} />
            <span style={{ flex: 1 }}>{o.v}</span>
          </MenuItem>
        ))}
      </Menu>
    </span>
  );
}
