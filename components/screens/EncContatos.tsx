"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { brl, foneBR, normalizePhone } from "@/lib/format";
import { corLead, dataBR, useEncomendas, type Lead } from "@/lib/encomendas";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import LeadDetail from "../encomendas/LeadDetail";
import { useApp } from "../store";
import { useIsMobile } from "@/lib/useIsMobile";

/** Encomendas → Contatos: os mesmos contatos do CRM, em tabela para achar pessoas. */
type Col = "data" | "status" | "nome" | "telefone" | "ultimo" | "pedidos";
const COLS: { id: Col; label: string }[] = [
  { id: "data", label: "Data" }, { id: "status", label: "Status" }, { id: "nome", label: "Nome" },
  { id: "telefone", label: "Telefone" }, { id: "ultimo", label: "Último contato" }, { id: "pedidos", label: "Pedidos" },
];
const GRID = "100px 150px minmax(180px,1fr) 150px 150px 90px 92px";

export default function EncContatos() {
  const { canEditPage } = useApp();
  const { leads, pedidos } = useEncomendas();
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "data", dir: -1 });
  const [aberto, setAberto] = useState<string | null>(null);
  const mobile = useIsMobile();

  const qtdDe = (l: Lead) => pedidos.filter((p) => p.leadId === l.id).length;
  const q = busca.trim().toLowerCase(), dig = normalizePhone(busca);
  const linhas = leads
    .filter((l) => !q || l.nome.toLowerCase().includes(q) || (dig.length >= 3 && l.numero.includes(dig)))
    .sort((a, b) => {
      const v = (l: Lead): string | number => ({ data: l.criadoEm, status: l.status, nome: l.nome, telefone: l.numero, ultimo: l.ultimoContato, pedidos: qtdDe(l) })[sort.col];
      const x = v(a), y = v(b);
      return (typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y), "pt", { sensitivity: "base" })) * sort.dir;
    });
  const ordenar = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: col === "data" || col === "ultimo" || col === "pedidos" ? -1 : 1 }));

  const vendas = leads.filter((l) => l.status === "Venda").length;
  const naFila = pedidos.filter((p) => p.status !== "Verificar pagamento");
  const entregues = pedidos.filter((p) => p.status === "Entregue");
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");
  const kpis = [
    { t: "Total de contatos", v: String(leads.length), s: "no WhatsApp e no autoatendimento" },
    { t: "Pedidos", v: String(pedidos.length), s: `${pct(vendas, leads.length)} dos contatos fecharam` },
    { t: "Entregues", v: String(entregues.length), s: `${pct(entregues.length, naFila.length)} dos que entraram na fila` },
    { t: "Faturamento", v: brl(entregues.reduce((s, p) => s + p.total, 0)), s: "pedidos entregues" },
  ];
  const ultimoBR = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");

  return (
    <div style={css("height:100%; display:flex; flex-direction:column;")}>
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:24px 30px 14px; flex:none;")}>
        <div style={{ flex: 1 }}>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Contatos</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>{leads.length} contato{leads.length === 1 ? "" : "s"}</p>
        </div>
        <div style={css("position:relative; width:300px; max-width:100%;")}>
          <Svg size={15} stroke="#9398A6" style={css("position:absolute; left:11px; top:50%; transform:translateY(-50%);")}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone…" style={css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:10px; padding:9px 12px 9px 33px; font-size:13px; outline:none; background:#fff;")} />
        </div>
      </div>

      <div className="m-pad" style={css("flex:1; min-height:0; overflow-y:auto; padding:0 30px 24px; display:flex; flex-direction:column; gap:16px;")}>
        <div className="m-grid-2" style={css("display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; flex:none;")}>
          {kpis.map((k) => (
            <div key={k.t} style={css("background:#fff; border:1px solid #ECEDF1; border-radius:12px; padding:14px 16px;")}>
              <div style={css("font-size:12.5px; font-weight:700; color:#7A8090;")}>{k.t}</div>
              <div style={css("font-size:22px; font-weight:800; margin-top:4px; font-variant-numeric:tabular-nums;")}>{k.v}</div>
              <div style={css("font-size:11.5px; color:#9398A6; margin-top:2px;")}>{k.s}</div>
            </div>
          ))}
        </div>

        {/* Celular: a tabela (960px) não cabe — cartões, com a ordenação num seletor. */}
        {mobile && (
          <div style={css("display:flex; flex-direction:column; gap:10px;")}>
            <div style={css("display:flex; gap:6px; overflow-x:auto; scrollbar-width:none;")}>
              {COLS.filter((c) => c.id !== "telefone").map((c) => {
                const ativo = sort.col === c.id;
                return (
                  <button key={c.id} onClick={() => ordenar(c.id)} style={css(`flex:none; border:1px solid ${ativo ? "#955C6B" : "#E2E3E9"}; background:${ativo ? "#FDF1F4" : "#fff"}; color:${ativo ? "#955C6B" : "#5B6472"}; border-radius:999px; padding:6px 11px; font-size:12.5px; font-weight:700; cursor:pointer; white-space:nowrap;`)}>
                    {c.label}{ativo ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                  </button>
                );
              })}
            </div>
            {linhas.map((l) => (
              <Hoverable key={l.id} onClick={() => setAberto(l.id)} s={css("display:flex; align-items:center; gap:10px; background:#fff; border:1px solid #ECEDF1; border-radius:12px; padding:12px 13px; cursor:pointer;")}>
                <div style={css("flex:1; min-width:0;")}>
                  <div style={css("display:flex; align-items:center; gap:7px; flex-wrap:wrap;")}>
                    <span style={css("font-size:14px; font-weight:800; color:#1B1B28;")}>{l.nome || "Sem nome"}</span>
                    <span style={css(`display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; background:${corLead(l.status)}1A; color:${corLead(l.status)};`)}><span style={css(`width:6px; height:6px; border-radius:50%; background:${corLead(l.status)};`)} />{l.status}</span>
                  </div>
                  <div style={css("font-size:12.5px; color:#7A8090; margin-top:3px;")}>{foneBR(l.numero)} · {qtdDe(l)} pedido{qtdDe(l) === 1 ? "" : "s"}</div>
                  <div style={css("font-size:11.5px; color:#9398A6; margin-top:2px;")}>Último contato {ultimoBR(l.ultimoContato)}</div>
                </div>
                <a href={`https://wa.me/${l.numero}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Abrir conversa no WhatsApp" style={css("flex:none; width:40px; height:40px; display:flex; align-items:center; justify-content:center; color:#1B7F4D; background:#E7F6EE; border-radius:11px;")}>
                  <Svg size={18} sw={2.2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>
                </a>
              </Hoverable>
            ))}
            {linhas.length === 0 && <div style={css("padding:26px 16px; text-align:center; color:#B6BAC4; font-size:13px;")}>Nenhum contato encontrado.</div>}
          </div>
        )}

        {!mobile && <div style={css("border:1px solid #ECEDF1; border-radius:12px; background:#fff; overflow-x:auto; flex:none;")}>
          <div style={css("min-width:960px;")}>
            <div style={css(`display:grid; grid-template-columns:${GRID}; gap:12px; padding:11px 16px; background:#F4F5F7; border-bottom:1px solid #ECEDF1; font-size:11px; font-weight:700; color:#9398A6; letter-spacing:.4px; text-transform:uppercase;`)}>
              {COLS.map((c) => (
                <Hoverable key={c.id} onClick={() => ordenar(c.id)} s={css("display:flex; align-items:center; gap:4px; cursor:pointer; user-select:none;")} hover="color:#5B6472">
                  {c.label}<span style={css("color:#955C6B; font-weight:800;")}>{sort.col === c.id ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
                </Hoverable>
              ))}
              <span style={css("text-align:right;")}>Conversa</span>
            </div>
            {linhas.map((l) => (
              <Hoverable key={l.id} onClick={() => setAberto(l.id)} s={css(`display:grid; grid-template-columns:${GRID}; gap:12px; padding:11px 16px; border-bottom:1px solid #F4F5F7; align-items:center; cursor:pointer; font-size:13px; color:#3A3F4C;`)} hover="background:#FAFAFB">
                <span style={css("color:#7A8090;")}>{dataBR(l.criadoEm)}</span>
                <span><span style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:3px 10px; border-radius:999px; background:${corLead(l.status)}1A; color:${corLead(l.status)}; white-space:nowrap;`)}><span style={css(`width:7px; height:7px; border-radius:50%; background:${corLead(l.status)};`)} />{l.status}</span></span>
                <span style={css("font-weight:700; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{l.nome || "Sem nome"}</span>
                <span style={css("font-variant-numeric:tabular-nums;")}>{foneBR(l.numero)}</span>
                <span style={css("color:#7A8090;")}>{ultimoBR(l.ultimoContato)}</span>
                <span style={css("font-weight:700;")}>{qtdDe(l)}</span>
                <span style={css("text-align:right;")}>
                  <a href={`https://wa.me/${l.numero}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={css("display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:700; color:#1B7F4D; background:#E7F6EE; border-radius:8px; padding:5px 10px; text-decoration:none;")}>
                    <Svg size={13} sw={2.2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>Abrir
                  </a>
                </span>
              </Hoverable>
            ))}
            {linhas.length === 0 && <div style={css("padding:26px 16px; text-align:center; color:#B6BAC4; font-size:13px;")}>Nenhum contato encontrado.</div>}
          </div>
        </div>}
      </div>

      {aberto && <LeadDetail leadId={aberto} canEdit={canEditPage("encomendas-contatos")} onClose={() => setAberto(null)} />}
    </div>
  );
}
