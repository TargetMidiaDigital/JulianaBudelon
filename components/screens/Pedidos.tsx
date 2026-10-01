"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { daysUntil } from "@/lib/format";
import { ACCENT, BRAND } from "@/lib/theme";
import { LOCAIS_ESTOQUE } from "@/lib/estoque";
import { PEDIDO_STATUS, PEDIDO_STATUS_ORDER, pedidoStatusInfo, produtosNoPedido, totalPedido, totalPorLocal } from "@/lib/pedido";
import type { Pedido, PedidoStatus } from "@/lib/types";
import { ehExpedicao, ehProducao, ehUnidade } from "@/lib/tarefas";
import { gestorOf, useApp } from "../store";
import { Avatar } from "../ui/bits";
import RespHover from "../ui/RespHover";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import DatePicker from "../ui/DatePicker";
import EditableTitle from "../ui/EditableTitle";
import ConfirmModal from "../ui/ConfirmModal";
import PedidoForm from "../modals/PedidoForm";
import PedidoDetail from "../modals/PedidoDetail";

type SortKey = "titulo" | "status" | "itens" | "entrega" | "criada";
type GroupBy = "status" | "none";
const GROUP_OPTS: { key: GroupBy; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "none", label: "Sem agrupamento" },
];
const stop = (e: React.MouseEvent) => e.stopPropagation();

// Colunas: Ordem (travada) · Status · Itens · um local por coluna (unidades a receber) · Entrega · Criado por · Criada · ações
const COL_W = { titulo: 260, status: 150, itens: 130, tarefas: 96, exped: 96, receb: 96, local: 80, entrega: 130, autor: 70, criada: 130, acoes: 40 };
const GRID = `${COL_W.titulo}px ${COL_W.status}px ${COL_W.itens}px ${COL_W.tarefas}px ${COL_W.exped}px ${COL_W.receb}px ${LOCAIS_ESTOQUE.map(() => `${COL_W.local}px`).join(" ")} ${COL_W.entrega}px ${COL_W.autor}px ${COL_W.criada}px ${COL_W.acoes}px`;
const NCOLS = 10 + LOCAIS_ESTOQUE.length;
const GRID_MIN = COL_W.titulo + COL_W.status + COL_W.itens + COL_W.tarefas + COL_W.exped + COL_W.receb + COL_W.local * LOCAIS_ESTOQUE.length + COL_W.entrega + COL_W.autor + COL_W.criada + COL_W.acoes + 14 * (NCOLS - 1) + 36;
const fixa = (fundo: string, z: number) => `position:sticky; left:0; z-index:${z}; background:${fundo}; padding-left:18px; margin-left:-18px;`;

const dataHora = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "—";

/** Operacional → Ordem de Serviço: o que cada unidade precisa receber, por ordem. */
export default function Pedidos() {
  const { pedidos, team, tasks, updatePedido, removePedido, canEditPage, canSeeAll, pedidoDetailOpen, setPedidoDetailOpen } = useApp();
  const editavel = canEditPage("pedidos");

  const [formOpen, setFormOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiarLink = async (id: string) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/?pedido=${id}`); setCopiedId(id); setTimeout(() => setCopiedId(null), 1200); } catch { /* ignore */ }
  };
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [filtroStatus, setFiltroStatus] = useState<PedidoStatus | "">("");
  const [mostrarValidadas, setMostrarValidadas] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [confirmDel, setConfirmDel] = useState<Pedido | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "criada", dir: -1 });
  const toggleSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: 1 }));

  // Validadas saem da visão por padrão (como em Produção); o ícone na toolbar mostra/esconde.
  const lista = pedidos.filter((p) => (filtroStatus ? p.status === filtroStatus : mostrarValidadas || p.status !== "validada"));
  // "Validada" só no seletor para Head/Admin, como nas tarefas.
  const statusOpts = canSeeAll ? PEDIDO_STATUS : PEDIDO_STATUS.filter((s) => s.key !== "validada");
  const sortRows = (rows: Pedido[]): Pedido[] =>
    [...rows].sort((a, b) => {
      const r =
        sort.key === "titulo" ? a.titulo.localeCompare(b.titulo, "pt")
        : sort.key === "status" ? PEDIDO_STATUS_ORDER.indexOf(a.status) - PEDIDO_STATUS_ORDER.indexOf(b.status)
        : sort.key === "itens" ? totalPedido(a.itens) - totalPedido(b.itens)
        : sort.key === "entrega" ? (daysUntil(a.entrega ?? "") ?? 9e9) - (daysUntil(b.entrega ?? "") ?? 9e9)
        : (a.criada ?? "").localeCompare(b.criada ?? "");
      return r * sort.dir;
    });

  const statusCols: PedidoStatus[] = filtroStatus ? [filtroStatus] : mostrarValidadas ? PEDIDO_STATUS_ORDER : PEDIDO_STATUS_ORDER.filter((s) => s !== "validada");
  const groups =
    groupBy === "none"
      ? [{ key: "all", label: "Todas", bg: "#EFF0F4", fg: "#5B6472", dot: "#9398A6", itens: lista }]
      : statusCols.map((s) => { const si = pedidoStatusInfo(s); return { key: s, label: si.label, bg: si.bg, fg: si.fg, dot: si.dot, itens: lista.filter((p) => p.status === s) }; }).filter((g) => g.itens.length);

  const cols: { id: string; label: string; key?: SortKey; center?: boolean }[] = [
    { id: "titulo", label: "Ordem", key: "titulo" },
    { id: "status", label: "Status", key: "status" },
    { id: "itens", label: "Itens", key: "itens" },
    { id: "tarefas", label: "Produção", center: true }, // tarefas de produção concluídas / total
    { id: "exped", label: "Expedição", center: true }, // tarefas de expedição concluídas / total
    { id: "receb", label: "Unidades", center: true }, // conferências das lojas concluídas / total
    ...LOCAIS_ESTOQUE.map((l) => ({ id: l.id, label: l.label, center: true })),
    { id: "entrega", label: "Entrega", key: "entrega" },
    { id: "autor", label: "Por", center: true },
    { id: "criada", label: "Criada", key: "criada" },
    { id: "acoes", label: "" },
  ];

  const renderRow = (p: Pedido) => {
    const si = pedidoStatusInfo(p.status);
    const autor = gestorOf(team, p.criadoPor);
    const totais = totalPorLocal(p.itens);
    const daOrdem = tasks.filter((t) => t.pedidoId === p.id);
    const feita = (t: { status: string }) => t.status === "concluida" || t.status === "validada";
    const tf = daOrdem.filter(ehProducao), feitas = tf.filter(feita).length;
    const te = daOrdem.filter(ehExpedicao), feitasE = te.filter(feita).length;
    const tu = daOrdem.filter(ehUnidade), feitasU = tu.filter(feita).length;
    const progresso = (lista: typeof tf, ok: number, rotulo: string) => (
      <span title={lista.length ? `${ok} de ${lista.length} tarefas de ${rotulo} concluídas` : `Sem tarefas de ${rotulo}`} style={css(`text-align:center; font-size:12.5px; font-weight:700; font-variant-numeric:tabular-nums; color:${!lista.length ? "#D5D8DF" : ok === lista.length ? "#1B7F4D" : "#5B6472"};`)}>{lista.length ? `${ok}/${lista.length}` : "—"}</span>
    );
    const late = p.entrega ? (daysUntil(p.entrega) ?? 0) < 0 && p.status !== "concluida" && p.status !== "validada" : false;
    return (
      <Hoverable key={p.id} onClick={() => setPedidoDetailOpen(p.id)} s={css(`display:grid; grid-template-columns:${GRID}; gap:14px; padding:11px 18px; border-bottom:1px solid #F4F5F7; align-items:center; cursor:pointer;`)} hover="background:#FAFAFB">
        <div style={css(`${fixa("#fff", 1)} align-self:stretch; display:flex; align-items:center; gap:6px; min-width:0;`)}>
          <Hoverable as="button" title={copiedId === p.id ? "Link copiado!" : "Copiar link da ordem"} onClick={(e: React.MouseEvent) => { e.stopPropagation(); copiarLink(p.id); }} s={css(`flex:none; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:none; background:transparent; border-radius:7px; cursor:pointer; color:${copiedId === p.id ? "#1B7F4D" : "#C7CAD2"};`)} hover="background:#FDF1F4; color:#955C6B">
            {copiedId === p.id
              ? <Svg size={15} sw={2.4}><path d="M20 6 9 17l-5-5" /></Svg>
              : <Svg size={14} sw={2.2}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Svg>}
          </Hoverable>
          {editavel
            ? <EditableTitle fill value={p.titulo} onSave={(v) => updatePedido(p.id, { titulo: v })} textStyle="font-weight:600; font-size:13.5px;" />
            : <span style={css("display:block; font-weight:600; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{p.titulo}</span>}
        </div>
        <div onClick={stop} style={{ minWidth: 0 }}>
          {editavel ? (
            <Menu trigger={(tg) => (
              <span onClick={tg} style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:4px 10px; border-radius:7px; cursor:pointer; background:${si.bg}; color:${si.fg};`)}>
                <span style={css(`width:7px; height:7px; border-radius:50%; background:${si.dot};`)} />{si.label}
                <Svg size={11} sw={2.4} stroke="currentColor" style={css("flex:none; opacity:.55;")}><path d="m6 9 6 6 6-6" /></Svg>
              </span>
            )} width={190}>
              {(close) => statusOpts.map((s) => (
                <MenuItem key={s.key} checked={p.status === s.key} onClick={() => { updatePedido(p.id, { status: s.key }); close(); }}>
                  <span style={css(`width:9px; height:9px; border-radius:50%; background:${s.dot};`)} /><span style={{ flex: 1 }}>{s.label}</span>
                </MenuItem>
              ))}
            </Menu>
          ) : (
            <span style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:4px 10px; border-radius:7px; background:${si.bg}; color:${si.fg};`)}><span style={css(`width:7px; height:7px; border-radius:50%; background:${si.dot};`)} />{si.label}</span>
          )}
        </div>
        <span style={css("font-size:12.5px; color:#5B6472; font-weight:600; white-space:nowrap;")}>{produtosNoPedido(p.itens)} prod. · <strong style={css("color:#1B1B28;")}>{totalPedido(p.itens)} un.</strong></span>
        {progresso(tf, feitas, "produção")}
        {progresso(te, feitasE, "expedição")}
        {progresso(tu, feitasU, "recebimento nas unidades")}
        {LOCAIS_ESTOQUE.map((l) => (
          <span key={l.id} style={css(`text-align:center; font-size:13px; font-weight:700; font-variant-numeric:tabular-nums; color:${totais[l.id] ? "#1B1B28" : "#D5D8DF"};`)}>{totais[l.id]}</span>
        ))}
        <div onClick={stop} style={{ minWidth: 0 }}>
          {editavel ? (
            <DatePicker date={p.entrega ?? ""} align="left" onSave={(d) => updatePedido(p.id, { entrega: d })} trigger={(toggle) => (
              <Hoverable onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:${late ? "#CC3338" : p.entrega ? "#5B6472" : "#9398A6"}; cursor:pointer; padding:4px 7px; border-radius:7px; max-width:100%;`)} hover="background:#EDEEF2">
                <Svg size={13} style={css("flex:none; opacity:.75;")}><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>
                <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{p.entrega || "Definir"}</span>
              </Hoverable>
            )} />
          ) : <span style={css(`font-size:12.5px; font-weight:700; color:${late ? "#CC3338" : "#5B6472"};`)}>{p.entrega || "—"}</span>}
        </div>
        <div style={css("display:flex; justify-content:center;")}><RespHover member={autor}><Avatar ini={autor.ini} cor={autor.cor} src={autor.foto} size={26} fontSize={11} /></RespHover></div>
        <span style={css("font-size:12.5px; color:#7A8090; font-weight:600;")}>{dataHora(p.criada)}</span>
        <div onClick={stop} style={css("display:flex; justify-content:center;")}>
          {editavel && (
            <Hoverable as="button" title="Excluir ordem" onClick={() => setConfirmDel(p)} s={css("flex:none; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:none; background:transparent; border-radius:7px; cursor:pointer; color:#C7CAD2;")} hover="background:#FDECEC; color:#CC3338">
              <Svg size={15} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></Svg>
            </Hoverable>
          )}
        </div>
      </Hoverable>
    );
  };

  return (
    <div style={css("height:100%; display:flex; flex-direction:column;")}>
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:24px 30px 18px;")}>
        <div style={{ flex: 1 }}>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Ordem de Serviço</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>{lista.length} {lista.length === 1 ? "ordem" : "ordens"}{groupBy === "none" ? "" : " · agrupadas por status"}</p>
        </div>
      </div>

      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:12px; padding:0 30px 16px;")}>
        {editavel && (
          <Hoverable as="button" onClick={() => setFormOpen(true)} s={css(`display:flex; align-items:center; gap:7px; border:none; cursor:pointer; background:${BRAND}; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:10px;`)} hover="filter:brightness(1.12)">
            <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>
            Nova ordem
          </Hoverable>
        )}
        <span style={{ flex: 1 }} />
        <Hoverable as="button" onClick={() => setMostrarValidadas((v) => !v)} title={mostrarValidadas ? "Ocultar ordens validadas" : "Mostrar ordens validadas"} s={css(`display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; flex:none; border:1px solid ${mostrarValidadas ? "#2563EB" : "#E2E3E9"}; background:${mostrarValidadas ? "#EAF0FE" : "#fff"}; color:${mostrarValidadas ? "#2563EB" : "#5B6472"}; cursor:pointer; border-radius:10px;`)} hover={mostrarValidadas ? undefined : "background:#FAFAFB"}>
          <Svg size={17} sw={2.2}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>
        </Hoverable>
        <Menu align="right" width={220} trigger={(toggle) => (
          <Hoverable as="button" onClick={toggle} s={css("display:inline-flex; align-items:center; gap:8px; background:#fff; border:1px solid #E2E3E9; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:8px 14px; border-radius:10px;")} hover="background:#FAFAFB">
            <Svg size={15} stroke={ACCENT}><rect x="3" y="4" width="7" height="7" rx="1.6" /><rect x="14" y="4" width="7" height="7" rx="1.6" /><rect x="3" y="15" width="7" height="5" rx="1.6" /><rect x="14" y="15" width="7" height="5" rx="1.6" /></Svg>
            <span style={css("color:#9398A6; font-weight:600;")}>Agrupar por</span> {GROUP_OPTS.find((o) => o.key === groupBy)?.label}
            <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
          </Hoverable>
        )}>
          {(close) => GROUP_OPTS.map((o) => (
            <MenuItem key={o.key} checked={groupBy === o.key} accent={ACCENT} onClick={() => { setGroupBy(o.key); close(); }}><span style={{ flex: 1 }}>{o.label}</span></MenuItem>
          ))}
        </Menu>
        <Menu align="right" width={200} trigger={(toggle) => (
          <Hoverable as="button" onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:8px; background:${filtroStatus ? "#FDF1F4" : "#fff"}; border:1px solid ${filtroStatus ? ACCENT : "#E2E3E9"}; color:${filtroStatus ? ACCENT : "#3A3F4C"}; cursor:pointer; font-size:13px; font-weight:700; padding:8px 14px; border-radius:10px;`)} hover={filtroStatus ? undefined : "background:#FAFAFB"}>
            <Svg size={15} sw={2.2}><path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5z" /></Svg>
            {filtroStatus ? pedidoStatusInfo(filtroStatus).label : "Status"}
            <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
          </Hoverable>
        )}>
          {(close) => (
            <>
              <MenuItem checked={!filtroStatus} accent={ACCENT} onClick={() => { setFiltroStatus(""); close(); }}><span style={{ flex: 1 }}>Todos</span></MenuItem>
              {PEDIDO_STATUS.map((s) => (
                <MenuItem key={s.key} checked={filtroStatus === s.key} accent={ACCENT} onClick={() => { setFiltroStatus(s.key); close(); }}>
                  <span style={css(`width:9px; height:9px; border-radius:50%; background:${s.dot};`)} /><span style={{ flex: 1 }}>{s.label}</span>
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      </div>

      {lista.length === 0 ? (
        <div style={css("flex:1; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px 30px; gap:14px;")}>
          <span style={css("width:56px; height:56px; border-radius:16px; background:#F2F3F6; display:flex; align-items:center; justify-content:center; color:#B4B8C4;")}>
            <Svg size={26} sw={1.8}><path d="M9 5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 13h6M9 17h4" /></Svg>
          </span>
          <div style={css("font-size:15.5px; font-weight:800; color:#3A3F4C; letter-spacing:-0.2px;")}>{filtroStatus || pedidos.length ? "Nenhuma ordem nesta visão" : "Nenhuma ordem de serviço"}</div>
          <div style={css("font-size:13px; color:#9398A6; font-weight:600; max-width:360px; line-height:1.5;")}>
            {filtroStatus || pedidos.length ? "Ajuste o filtro de status ou mostre as ordens validadas." : editavel ? "Use “Nova ordem” para montar o que cada unidade precisa receber." : "Quando houver ordens, elas aparecem aqui."}
          </div>
        </div>
      ) : (
        <div className="m-pad" style={css("flex:1; min-height:0; padding:18px 30px 0; display:flex; flex-direction:column; transform:translateZ(0);")}>
          <div style={css("flex:1; min-height:0; overflow:auto; padding:0 0 16px;")}>
            {groups.map((grp) => {
              const semGrupo = groupBy === "none";
              const open = semGrupo || !collapsed[grp.key];
              return (
                <div key={grp.key} style={css(semGrupo ? "" : "padding-bottom:22px;")}>
                  <div style={css(`position:sticky; top:0; z-index:20; background:#F7F7F9; min-width:${GRID_MIN}px;`)}>
                    {!semGrupo && (
                      <div style={css("position:sticky; left:0; width:max-content; max-width:100%; background:#F7F7F9; display:flex; align-items:center; gap:10px; padding:2px 0 9px;")}>
                        <Hoverable as="button" onClick={() => setCollapsed((c) => ({ ...c, [grp.key]: !c[grp.key] }))} s={css("width:26px; height:26px; flex:none; border:1px solid #E2E3E9; background:#fff; border-radius:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#5B6472;")} hover="background:#F2F3F6">
                          <Svg size={14} sw={2.4} style={css(`transform:rotate(${open ? 0 : -90}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
                        </Hoverable>
                        <span style={css(`display:inline-flex; align-items:center; gap:7px; background:${grp.bg}; color:${grp.fg}; font-size:12.5px; font-weight:800; padding:4px 12px; border-radius:8px; letter-spacing:0.3px; text-transform:uppercase;`)}>
                          <span style={css(`width:9px; height:9px; border-radius:50%; background:${grp.dot};`)} />{grp.label}
                        </span>
                        <span style={css("font-size:13px; color:#9398A6; font-weight:700;")}>{grp.itens.length}</span>
                      </div>
                    )}
                    {open && (
                      <div style={css(`display:grid; grid-template-columns:${GRID}; gap:14px; padding:10px 18px; border:1px solid #ECEDF1; background:#FAFAFB; border-radius:12px 12px 0 0; font-size:11px; font-weight:700; color:#9398A6; letter-spacing:0.4px; text-transform:uppercase;`)}>
                        {cols.map((col) => col.key ? (
                          <Hoverable key={col.id} onClick={() => toggleSort(col.key!)} s={css(`${col.id === "titulo" ? fixa("#FAFAFB", 5) : ""} display:flex; align-items:center; gap:4px; overflow:hidden; cursor:pointer; user-select:none; min-width:0;`)} hover="color:#5B6472">
                            <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{col.label}</span>
                            <span style={css(`color:${ACCENT}; font-weight:800;`)}>{sort.key === col.key ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
                          </Hoverable>
                        ) : <span key={col.id} style={css(`overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${col.center ? "text-align:center;" : ""}`)}>{col.label}</span>)}
                      </div>
                    )}
                  </div>
                  {open && (
                    <div style={css(`background:#fff; border:1px solid #ECEDF1; border-top:none; border-radius:0 0 12px 12px; min-width:${GRID_MIN}px;`)}>
                      {sortRows(grp.itens).map(renderRow)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PedidoDetail id={pedidoDetailOpen} onClose={() => setPedidoDetailOpen(null)} />
      <PedidoForm open={formOpen} onClose={() => setFormOpen(false)} onCriada={(id) => setPedidoDetailOpen(id)} />

      {confirmDel && (
        <ConfirmModal
          danger
          titulo="Excluir ordem de serviço"
          confirmLabel="Excluir"
          mensagem={(() => { const d = tasks.filter((t) => t.pedidoId === confirmDel.id); const np = d.filter(ehProducao).length, ne = d.filter(ehExpedicao).length, nu = d.filter(ehUnidade).length; return (<>Tem certeza que deseja excluir <strong style={css("color:#1B1B28;")}>{confirmDel.titulo}</strong>?{d.length > 0 && <> As <strong style={css("color:#1B1B28;")}>{np} {np === 1 ? "tarefa" : "tarefas"} de produção, {ne} de expedição e {nu} das unidades</strong> geradas por ela também serão excluídas.</>} Essa ação não pode ser desfeita.</>); })()}
          onConfirm={() => { removePedido(confirmDel.id); setConfirmDel(null); }}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
