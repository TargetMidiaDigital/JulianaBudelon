"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { clientLetter, clienteDe, CLIENTE_INTERNO } from "@/lib/selectors";
import { DEFAULT_DUE_TIME, daysUntil, parseBR, prazoLabel } from "@/lib/format";
import { ACCENT, BRAND, prioInfo, statusInfo } from "@/lib/theme";
import type { Task, TaskStatus } from "@/lib/types";
import type { ListGroupBy } from "../store";
import {
  PRIO_ORDER,
  STATUS_ORDER,
  filterByGestor,
  gestorOf,
  responsaveisDoScope,
  useApp,
} from "../store";
import { Avatar } from "../ui/bits";
import RespHover from "../ui/RespHover";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import DatePicker from "../ui/DatePicker";
import CommentsPopover from "../ui/CommentsPopover";
import DescricaoPopover from "../ui/DescricaoPopover";
import ClientMenuList from "../ui/ClientMenuList";
import EditableTitle from "../ui/EditableTitle";
import FiltroTarefas from "../FiltroTarefas";
import BulkActionsBar, { SelectCheck, BULK_BTN } from "../ui/BulkActionsBar";

type SortKey = "criada" | "atualizada" | "venc" | "resp" | "prio" | "status" | "titulo" | "cliente" | "com";
type ResizeCol = "tarefa" | "descricao" | "com";
const DEFAULT_COL_W: Record<ResizeCol, number> = { tarefa: 280, descricao: 200, com: 240 };

// Stop a cell's click from bubbling to the row (which opens the task detail).
const stop = (e: React.MouseEvent) => e.stopPropagation();

// Descrição pode ser HTML (editor rico) → texto puro p/ a célula da tabela.
const descText = (h?: string) => (h ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export const GROUP_OPTS: { key: ListGroupBy; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "responsavel", label: "Responsável" },
  { key: "prioridade", label: "Prioridade" },
  { key: "vencimento", label: "Data de vencimento" },
  { key: "tipo", label: "Tipo de tarefa" },
  { key: "none", label: "Sem agrupamento" },
];

// Colors for the "Tipo de tarefa" grouping.
const TIPO_COR: Record<string, string> = {
  Otimização: "#955C6B",
  Criativo: "#DB2777",
  Financeiro: "#1B7F4D",
  Configuração: "#2563EB",
  Relatório: "#C2410C",
  Reunião: "#0891B2",
  Interno: "#7C3AED",
};
const tipoCor = (t: string) => TIPO_COR[t] ?? "#7A8090";

export default function ListaView({
  selectable = false,
}: {
  /** Liga a seleção múltipla + barra de edição em lote. */
  selectable?: boolean;
} = {}) {
  const {
    tasks,
    team,
    clients,
    clientesInativos,
    globalGestor,
    globalCliente,
    globalStatus,
    globalPrio,
    listView,
    setListView,
    listGroupBy,
    setListGroupBy,
    updateTask,
    removeTask,
    setTaskDetailOpen,
    setTaskFormOpen,
    setRecModalScope,
    podeTrocarResp,
    canSeeAll,
    canEditPage,
  } = useApp();
  const scope = "operacional";
  const editavel = canEditPage("listaview");
  const abrir = setTaskDetailOpen;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showValidadas, setShowValidadas] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Task | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiarLink = async (id: string) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/?tarefa=${id}`); setCopiedId(id); setTimeout(() => setCopiedId(null), 1200); } catch { /* ignore */ }
  };
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const toggleSort = (k: SortKey) =>
    setSort((s) => (s && s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: 1 }));

  // Seleção múltipla (estilo ClickUp).
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) =>
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setMany = (ids: string[], on: boolean) =>
    setSel((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const clearSel = () => setSel(new Set());
  const applyBulk = (patch: Partial<Task>) => {
    const ids = [...sel].filter(() => !("gestor" in patch) || podeTrocarResp());
    ids.forEach((id) => updateTask(id, patch));
  };

  // Largura ajustável das colunas Tarefa, Descrição e Comentário (alça no cabeçalho).
  const [colW, setColW] = useState<Record<ResizeCol, number>>(DEFAULT_COL_W);
  const startResize = (col: ResizeCol) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colW[col];
    const onMove = (ev: MouseEvent) =>
      setColW((c) => ({ ...c, [col]: Math.max(120, startW + ev.clientX - startX) }));
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  type ColDef = { id: string; label: string; key?: SortKey; resize?: ResizeCol; w: string; min: number };
  const colDefs: ColDef[] = [
    // Sem coluna de seleção: o checkbox entra DENTRO da célula de Tarefa (uma célula
    // travada só não tem emenda por onde o conteúdo das outras colunas aparece ao rolar).
    { id: "tarefa", label: "Tarefa", key: "titulo", resize: "tarefa", w: `${colW.tarefa + (selectable ? 58 : 0)}px`, min: colW.tarefa + (selectable ? 58 : 0) },
    { id: "cliente", label: "Cliente", key: "cliente", w: "210px", min: 210 },
    { id: "resp", label: "Resp.", key: "resp", w: "70px", min: 70 },
    { id: "prio", label: "Prioridade", key: "prio", w: "130px", min: 130 },
    { id: "status", label: "Status", key: "status", w: "150px", min: 150 },
    { id: "descricao", label: "Descrição", resize: "descricao", w: `${colW.descricao}px`, min: colW.descricao },
    { id: "com", label: "Comentário", key: "com", resize: "com", w: `${colW.com}px`, min: colW.com },
    { id: "criada", label: "Criada", key: "criada", w: "150px", min: 150 },
    { id: "atualizada", label: "Última atualização", key: "atualizada", w: "172px", min: 168 },
    { id: "venc", label: "Vencimento", key: "venc", w: "172px", min: 172 },
    { id: "acoes", label: "", w: "40px", min: 40 },
  ];
  /**
   * Estilo da ÚNICA célula travada (Tarefa, com o checkbox dentro). `fundo` precisa ser
   * opaco: as demais colunas deslizam por baixo dela. `left:0` é a posição natural.
   */
  const fixa = (id: string, fundo: string, z: number): string =>
    id !== "tarefa" ? "" : `position:sticky; left:0; z-index:${z}; background:${fundo}; padding-left:18px;`;

  const GRID = colDefs.map((c) => c.w).join(" ");
  const GRID_MIN = colDefs.reduce((s, c) => s + c.min, 0) + 14 * (colDefs.length - 1) + 36;

  let tsBase = filterByGestor(tasks, globalGestor);
  if (globalCliente) tsBase = tsBase.filter((t) => t.cliente === globalCliente);
  if (globalStatus) tsBase = tsBase.filter((t) => t.status === globalStatus);
  if (globalPrio) tsBase = tsBase.filter((t) => t.prio === globalPrio);
  // Tarefas validadas saem da visão por padrão; o ícone na toolbar mostra/esconde.
  const ts = showValidadas ? tsBase : tsBase.filter((t) => t.status !== "validada");
  // "Validada" só no seletor p/ Head/Admin; coluna no quadro só quando o toggle liga.
  const statusOpts: TaskStatus[] = canSeeAll ? [...STATUS_ORDER, "validada"] : STATUS_ORDER;
  const statusCols: TaskStatus[] = showValidadas ? [...STATUS_ORDER, "validada"] : STATUS_ORDER;

  // Exibição resolve contra ativos + inativos (tarefas antigas com cliente já
  // desativado ainda mostram logo e nome); a SELEÇÃO abaixo segue só com ativos.
  const clientesAll = [...clients, ...clientesInativos];
  const clientName = (id: string) => clienteDe(clientesAll, id)?.nome ?? (id || "-");

  // Data (dd/mm/yyyy) + hora (hh:mm) → timestamp comparável (ordena considerando a hora).
  const dtMs = (d?: string, h?: string): number => {
    if (!d) return 0;
    const base = parseBR(d)?.getTime();
    if (base == null) return 0;
    const m = /^(\d{1,2}):(\d{2})/.exec(h ?? "");
    return base + (m ? (Number(m[1]) * 60 + Number(m[2])) * 60000 : 0);
  };

  const sortVal = (t: Task, key: SortKey): string | number => {
    switch (key) {
      case "criada": return dtMs(t.criada, t.criadaHora);
      case "atualizada": return t.atualizada ? dtMs(t.atualizada, t.atualizadaHora) : 0;
      case "venc": return dtMs(t.venc, t.vencHora);
      case "resp": return gestorOf(team, t.gestor).nome;
      case "prio": return PRIO_ORDER.indexOf(t.prio);
      case "status": return STATUS_ORDER.indexOf(t.status);
      case "titulo": return t.titulo;
      case "cliente": return clientName(t.cliente);
      case "com": return t.comentarios?.[t.comentarios.length - 1]?.message ?? "";
    }
  };
  const sortRows = (rows: Task[]): Task[] => {
    if (!sort) return rows;
    const k = sort.key;
    return [...rows].sort((a, b) => {
      const av = sortVal(a, k), bv = sortVal(b, k);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
      return String(av).localeCompare(String(bv), "pt") * sort.dir;
    });
  };

  // build groups
  type Group = { key: string; label: string; dot: string; bg: string; fg: string; tasks: Task[] };
  let groups: Group[] = [];
  if (listGroupBy === "none") {
    groups = [{ key: "all", label: "Todas", dot: "#9398A6", bg: "#EFF0F4", fg: "#5B6472", tasks: ts }];
  } else if (listGroupBy === "status") {
    groups = statusCols.map((st) => ({
      key: st, label: statusInfo[st].label, dot: statusInfo[st].dot, bg: statusInfo[st].bg, fg: statusInfo[st].fg,
      tasks: ts.filter((t) => t.status === st),
    }));
  } else if (listGroupBy === "prioridade") {
    groups = PRIO_ORDER.map((p) => ({
      key: p, label: prioInfo[p].label, dot: prioInfo[p].dot, bg: prioInfo[p].fg + "1A", fg: prioInfo[p].fg,
      tasks: ts.filter((t) => t.prio === p),
    }));
  } else if (listGroupBy === "responsavel") {
    groups = team.map((g) => ({
      key: g.id, label: g.nome, dot: g.cor, bg: g.cor + "1A", fg: g.cor,
      tasks: ts.filter((t) => t.gestor === g.id),
    }));
  } else if (listGroupBy === "tipo") {
    const tipos: string[] = [];
    ts.forEach((t) => { const tp = t.tipo || "Sem tipo"; if (!tipos.includes(tp)) tipos.push(tp); });
    groups = tipos.map((tp) => ({
      key: tp, label: tp, dot: tipoCor(tp), bg: tipoCor(tp) + "1A", fg: tipoCor(tp),
      tasks: ts.filter((t) => (t.tipo || "Sem tipo") === tp),
    }));
  } else {
    // vencimento — group by due date, ordered ascending
    const dates = Array.from(new Set(ts.map((t) => t.venc))).sort((a, b) => (parseBR(a)?.getTime() ?? 0) - (parseBR(b)?.getTime() ?? 0));
    groups = dates.map((d) => {
      const n = daysUntil(d) ?? 0;
      const dot = n < 0 ? "#E5484D" : n === 0 ? "#F76808" : "#9398A6";
      const fg = n < 0 ? "#CC3338" : n === 0 ? "#C25712" : "#5B6472";
      return { key: d || "sem-data", label: d || "Sem data", dot, bg: fg + "14", fg, tasks: ts.filter((t) => t.venc === d) };
    });
  }
  // No Quadro agrupado por status/prioridade, mostra TODAS as colunas (mesmo vazias).
  const showEmptyGroups = listView === "board" && (listGroupBy === "status" || listGroupBy === "prioridade");
  if (!showEmptyGroups) groups = groups.filter((g) => g.tasks.length);

  const semTarefas = ts.length === 0;
  const filtroAtivo = globalCliente !== "" || globalStatus !== "" || globalPrio !== "" || globalGestor !== "todos";

  const renderRow = (t: Task) => {
    const g = gestorOf(team, t.gestor);
    const late = (daysUntil(t.venc) ?? 0) < 0;
    return (
      <Hoverable key={t.id} onClick={() => abrir(t.id)} s={css(`display:grid; grid-template-columns:${GRID}; gap:14px; padding:13px 18px 13px 0; border-bottom:1px solid #F4F5F7; align-items:center; cursor:pointer; ${sel.has(t.id) ? "background:#FDF1F4;" : ""}`)} hover="background:#FAFAFB">
        <div style={css(`${fixa("tarefa", sel.has(t.id) ? "#FDF1F4" : "#fff", 1)} display:flex; align-items:center; align-self:stretch; gap:9px; min-width:0;`)}>
          {selectable && (
            <span onClick={stop} style={css("flex:none; display:flex; align-items:center; margin-right:5px;")}>
              <SelectCheck checked={sel.has(t.id)} onClick={(e) => { e.stopPropagation(); toggleSel(t.id); }} />
            </span>
          )}
          <Hoverable as="button" title={copiedId === t.id ? "Link copiado!" : "Copiar link da tarefa"} onClick={(e: React.MouseEvent) => { e.stopPropagation(); copiarLink(t.id); }} s={css(`flex:none; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:none; background:transparent; border-radius:7px; cursor:pointer; color:${copiedId === t.id ? "#1B7F4D" : "#C7CAD2"};`)} hover="background:#FDF1F4; color:#955C6B">
            {copiedId === t.id
              ? <Svg size={15} sw={2.4}><path d="M20 6 9 17l-5-5" /></Svg>
              : <Svg size={14} sw={2.2}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Svg>}
          </Hoverable>
          <div style={{ flex: 1, minWidth: 0 }}><EditableTitle fill value={t.titulo} onSave={(v) => updateTask(t.id, { titulo: v })} textStyle="font-weight:600; font-size:13.5px;" /></div>
          {t.rec && (
            <span title={t.rec.ativa ? "Tarefa recorrente" : "Recorrência pausada"} style={css(`flex:none; display:inline-flex; color:${t.rec.ativa ? "#2563EB" : "#B6BAC4"};`)}>
              <Svg size={13} sw={2.2}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></Svg>
            </span>
          )}
        </div>
        <div onClick={stop} style={{ minWidth: 0 }}>
          <Menu trigger={(tg) => (
            <span onClick={tg} style={css("display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; cursor:pointer; padding:4px 8px; border-radius:7px; max-width:100%;")}>
              {(() => { const cl = clienteDe(clientesAll, t.cliente); return cl ? <Avatar ini={clientLetter(cl.nome)} cor={cl.cor} src={cl.logo} size={20} radius="6px" fontSize={9} /> : null; })()}<span style={css("flex:1; min-width:0; overflow-wrap:anywhere;")}>{clientName(t.cliente)}</span>
              <Svg size={11} sw={2.4} stroke="currentColor" style={css("flex:none; opacity:.45;")}><path d="m6 9 6 6 6-6" /></Svg>
            </span>
          )} width={230} popStyle="max-height:320px; overflow-y:auto;">
            {(close) => (
              <ClientMenuList clients={[CLIENTE_INTERNO, ...clients]} selectedId={t.cliente} onSelect={(id) => { updateTask(t.id, { cliente: id }); close(); }} avatarSize={20} avatarFont={9} />
            )}
          </Menu>
        </div>
        <div onClick={stop} style={css("display:flex; justify-content:center;")}>
          {podeTrocarResp() ? (
            <Menu trigger={(tg) => (<span onClick={tg} style={css("display:inline-flex; align-items:center; gap:4px; cursor:pointer;")}><RespHover member={g}><Avatar ini={g.ini} cor={g.cor} src={g.foto} size={26} fontSize={11} /></RespHover><Svg size={11} sw={2.4} stroke="#9398A6" style={css("flex:none;")}><path d="m6 9 6 6 6-6" /></Svg></span>)} width={180}>
              {(close) => responsaveisDoScope(team, scope).map((m) => (
                <MenuItem key={m.id} checked={t.gestor === m.id} onClick={() => { updateTask(t.id, { gestor: m.id }); close(); }}>
                  <Avatar ini={m.ini} cor={m.cor} src={m.foto} size={22} fontSize={10} /><span style={{ flex: 1 }}>{m.nome}</span>
                </MenuItem>
              ))}
            </Menu>
          ) : (
            <RespHover member={g}><Avatar ini={g.ini} cor={g.cor} src={g.foto} size={26} fontSize={11} /></RespHover>
          )}
        </div>
        <div onClick={stop} style={{ minWidth: 0 }}>
          <Menu trigger={(tg) => (
            <span onClick={tg} style={css(`display:inline-flex; align-items:center; gap:6px; color:${prioInfo[t.prio].fg}; cursor:pointer; padding:3px 7px; border-radius:7px; font-size:12.5px; font-weight:700;`)}>
              <Svg size={14}><path d="M5 21V4h11l-2.2 4 2.2 4H5" /></Svg>{prioInfo[t.prio].label}
              <Svg size={11} sw={2.4} stroke="currentColor" style={css("flex:none; opacity:.5;")}><path d="m6 9 6 6 6-6" /></Svg>
            </span>
          )} width={170}>
            {(close) => PRIO_ORDER.map((p) => (
              <MenuItem key={p} checked={t.prio === p} onClick={() => { updateTask(t.id, { prio: p }); close(); }}>
                <Svg size={13} stroke={prioInfo[p].dot}><path d="M5 21V4h11l-2.2 4 2.2 4H5" /></Svg><span style={{ flex: 1 }}>{prioInfo[p].label}</span>
              </MenuItem>
            ))}
          </Menu>
        </div>
        <div onClick={stop} style={{ minWidth: 0 }}>
          <Menu trigger={(tg) => (
            <span onClick={tg} style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:4px 10px; border-radius:7px; cursor:pointer; background:${statusInfo[t.status].bg}; color:${statusInfo[t.status].fg};`)}>
              <span style={css(`width:7px; height:7px; border-radius:50%; background:${statusInfo[t.status].dot};`)} />{statusInfo[t.status].label}
              <Svg size={11} sw={2.4} stroke="currentColor" style={css("flex:none; opacity:.55;")}><path d="m6 9 6 6 6-6" /></Svg>
            </span>
          )} width={195}>
            {(close) => statusOpts.map((s) => (
              <MenuItem key={s} checked={t.status === s} onClick={() => { updateTask(t.id, { status: s }); close(); }}>
                <span style={css(`width:9px; height:9px; border-radius:50%; background:${statusInfo[s].dot};`)} /><span style={{ flex: 1 }}>{statusInfo[s].label}</span>
              </MenuItem>
            ))}
          </Menu>
        </div>
        <div onClick={stop} style={{ minWidth: 0 }}>
          <DescricaoPopover title={t.titulo} html={t.desc} preview={descText(t.desc)} />
        </div>
        <div onClick={stop} style={{ minWidth: 0 }}>
          <CommentsPopover title={t.titulo} comentarios={t.comentarios} onChange={(c) => updateTask(t.id, { comentarios: c })} />
        </div>
        <span style={css("font-size:12.5px; color:#7A8090; font-weight:600;")}>{t.criada}{t.criadaHora ? ` ${t.criadaHora}` : ""}</span>
        <span style={css("font-size:12.5px; color:#7A8090; font-weight:600;")}>{t.atualizada ? `${t.atualizada}${t.atualizadaHora ? ` ${t.atualizadaHora}` : ""}` : "—"}</span>
        <div onClick={stop} style={{ minWidth: 0 }}>
          <DatePicker
            date={t.venc}
            time={t.vencHora}
            align="left"
            onSave={(d, h) => updateTask(t.id, { venc: d, vencHora: h })}
            trigger={(toggle) => (
              <Hoverable onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:${late ? "#CC3338" : "#5B6472"}; cursor:pointer; padding:4px 7px; border-radius:7px; max-width:100%;`)} hover="background:#EDEEF2">
                <Svg size={13} style={css("flex:none; opacity:.75;")}><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>
                <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{t.venc ? `${t.venc} ${t.vencHora || DEFAULT_DUE_TIME}` : "Definir"}</span>
                <Svg size={11} sw={2.4} stroke="#9398A6" style={css("flex:none;")}><path d="m6 9 6 6 6-6" /></Svg>
              </Hoverable>
            )}
          />
        </div>
        <div onClick={stop} style={css("display:flex; justify-content:center;")}>
          {editavel && (
          <Hoverable
            as="button"
            title="Excluir tarefa"
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); setConfirmDel(t); }}
            s={css("flex:none; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:none; background:transparent; border-radius:7px; cursor:pointer; color:#C7CAD2;")}
            hover="background:#FDECEC; color:#CC3338"
          >
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
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Tarefas</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>{ts.length} tarefas{listGroupBy === "none" ? "" : ` · agrupadas por ${GROUP_OPTS.find((o) => o.key === listGroupBy)?.label.toLowerCase()}`}</p>
        </div>
      </div>

      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:12px; padding:0 30px 16px;")}>
        {editavel && (
          <Hoverable
            as="button"
            onClick={() => setTaskFormOpen(true)}
            s={css(`display:flex; align-items:center; gap:7px; border:none; cursor:pointer; background:${BRAND}; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:10px;`)}
            hover="filter:brightness(1.12)"
          >
            <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>
            Nova tarefa
          </Hoverable>
        )}
        <Hoverable
          as="button"
          onClick={() => setRecModalScope(scope)}
          title="Tarefas recorrentes"
          s={css("display:flex; align-items:center; gap:7px; border:1px solid #E2E3E9; cursor:pointer; background:#fff; color:#5B6472; font-weight:700; font-size:13px; padding:9px 14px; border-radius:10px;")}
          hover="background:#F4F4F7"
        >
          <Svg size={15} sw={2.2}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></Svg>
          Recorrências
        </Hoverable>
        <div style={css("display:flex; gap:3px; background:#EDEEF2; border-radius:10px; padding:3px;")}>
          {(["list", "board"] as const).map((v) => {
            const active = listView === v;
            return (
              <button
                key={v}
                onClick={() => setListView(v)}
                style={css(`display:flex; align-items:center; gap:6px; border:none; cursor:pointer; font-size:13px; font-weight:600; padding:7px 13px; border-radius:8px; background:${active ? "#fff" : "transparent"}; color:${active ? "#1B1B28" : "#5B6472"}; box-shadow:${active ? "0 1px 2px rgba(16,24,40,.10)" : "none"};`)}
              >
                {v === "list" ? (
                  <Svg size={14}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>
                ) : (
                  <Svg size={14}><rect x="3" y="4" width="5" height="16" rx="1.4" /><rect x="10" y="4" width="5" height="11" rx="1.4" /><rect x="17" y="4" width="4" height="14" rx="1.4" /></Svg>
                )}
                {v === "list" ? "Lista" : "Quadro"}
              </button>
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        <Hoverable
          as="button"
          onClick={() => setShowValidadas((v) => !v)}
          title={showValidadas ? "Ocultar tarefas validadas" : "Mostrar tarefas validadas"}
          s={css(`display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; flex:none; border:1px solid ${showValidadas ? "#2563EB" : "#E2E3E9"}; background:${showValidadas ? "#EAF0FE" : "#fff"}; color:${showValidadas ? "#2563EB" : "#5B6472"}; cursor:pointer; border-radius:10px;`)}
          hover={showValidadas ? undefined : "background:#FAFAFB"}
        >
          <Svg size={17} sw={2.2}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>
        </Hoverable>
        <Menu
          align="right"
          width={220}
          trigger={(toggle) => (
            <Hoverable
              as="button"
              onClick={toggle}
              s={css("display:inline-flex; align-items:center; gap:8px; background:#fff; border:1px solid #E2E3E9; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:8px 14px; border-radius:10px;")}
              hover="background:#FAFAFB"
            >
              <Svg size={15} stroke={ACCENT}><rect x="3" y="4" width="7" height="7" rx="1.6" /><rect x="14" y="4" width="7" height="7" rx="1.6" /><rect x="3" y="15" width="7" height="5" rx="1.6" /><rect x="14" y="15" width="7" height="5" rx="1.6" /></Svg>
              <span style={css("color:#9398A6; font-weight:600;")}>Agrupar por</span> {GROUP_OPTS.find((o) => o.key === listGroupBy)?.label}
              <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
            </Hoverable>
          )}
        >
          {(close) => (
            <>
              <div style={css("font-size:11px; font-weight:700; color:#9398A6; letter-spacing:0.5px; text-transform:uppercase; padding:7px 10px 5px;")}>Agrupar por</div>
              {GROUP_OPTS.map((o) => (
                <MenuItem key={o.key} checked={listGroupBy === o.key} accent={ACCENT} onClick={() => { setListGroupBy(o.key); close(); }}>
                  <span style={{ flex: 1 }}>{o.label}</span>
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
        <FiltroTarefas />
      </div>

      {semTarefas ? (
        <div style={css("flex:1; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px 30px; gap:14px;")}>
          <span style={css("width:56px; height:56px; border-radius:16px; background:#F2F3F6; display:flex; align-items:center; justify-content:center; color:#B4B8C4;")}>
            <Svg size={26} sw={1.8}><path d="M9 11l3 3 8-8" /><path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></Svg>
          </span>
          <div style={css("font-size:15.5px; font-weight:800; color:#3A3F4C; letter-spacing:-0.2px;")}>
            {filtroAtivo ? "Nenhuma tarefa com esses filtros" : "Nenhuma tarefa por aqui"}
          </div>
          <div style={css("font-size:13px; color:#9398A6; font-weight:600; max-width:340px; line-height:1.5;")}>
            {filtroAtivo
              ? "Ajuste ou limpe os filtros no botão “Filtrar” para ver mais tarefas."
              : "Quando houver tarefas, elas aparecem aqui."}
          </div>
        </div>
      ) : listView === "list" ? (
        <div style={css("flex:1; min-height:0; padding:18px 30px 0; display:flex; flex-direction:column; transform:translateZ(0);")}>
          {/* O respiro de topo fica no wrapper de FORA do scroller: o cabeçalho sticky
              gruda no topo REAL. O translateZ(0) força camada própria e mata o rastro de
              repintura da coluna fixa durante a rolagem. */}
          <div style={css("flex:1; min-height:0; overflow:auto; padding:0 0 16px;")}>
          {groups.map((grp) => {
            const semGrupo = listGroupBy === "none";
            const open = semGrupo || !collapsed[grp.key];
            return (
              <div key={grp.key} style={css(semGrupo ? "" : "padding-bottom:22px;")}>
                <div style={css(`position:sticky; top:0; z-index:20; background:#F7F7F9; min-width:${GRID_MIN}px;`)}>
                {!semGrupo && (
                <div style={css("position:sticky; left:0; width:max-content; max-width:100%; background:#F7F7F9; display:flex; align-items:center; gap:10px; padding:2px 0 9px;")}>
                  <Hoverable
                    as="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [grp.key]: !c[grp.key] }))}
                    s={css("width:26px; height:26px; flex:none; border:1px solid #E2E3E9; background:#fff; border-radius:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#5B6472;")}
                    hover="background:#F2F3F6"
                  >
                    <Svg size={14} sw={2.4} style={css(`transform:rotate(${open ? 0 : -90}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
                  </Hoverable>
                  <span style={css(`display:inline-flex; align-items:center; gap:7px; background:${grp.bg}; color:${grp.fg}; font-size:12.5px; font-weight:800; padding:4px 12px; border-radius:8px; letter-spacing:0.3px; text-transform:uppercase;`)}>
                    <span style={css(`width:9px; height:9px; border-radius:50%; background:${grp.dot};`)} />
                    {grp.label}
                  </span>
                  <span style={css("font-size:13px; color:#9398A6; font-weight:700;")}>{grp.tasks.length}</span>
                </div>
                )}
                {open && (
                    <div style={css(`display:grid; grid-template-columns:${GRID}; gap:14px; padding:10px 18px 10px 0; border:1px solid #ECEDF1; background:#FAFAFB; border-radius:12px 12px 0 0; font-size:11px; font-weight:700; color:#9398A6; letter-spacing:0.4px; text-transform:uppercase;`)}>
                      {colDefs.map((col) => {
                        const ids = grp.tasks.map((t) => t.id);
                        const allSel = ids.length > 0 && ids.every((id) => sel.has(id));
                        const someSel = ids.some((id) => sel.has(id));
                        return (
                        <div key={col.id} style={css(`${fixa(col.id, "#FAFAFB", 5) || "position:relative;"} display:flex; align-items:center; min-width:0;`)}>
                          {col.id === "tarefa" && selectable && (
                            <span onClick={stop} style={css("flex:none; display:flex; align-items:center; margin-right:5px;")}>
                              <SelectCheck checked={allSel} indeterminate={!allSel && someSel} onClick={(e) => { e.stopPropagation(); setMany(ids, !allSel); }} />
                            </span>
                          )}
                          {col.key ? (
                            <Hoverable onClick={() => toggleSort(col.key!)} s={css("display:flex; align-items:center; gap:4px; overflow:hidden; cursor:pointer; user-select:none; flex:1; min-width:0;")} hover="color:#5B6472">
                              <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{col.label}</span>
                              <span style={css(`color:${ACCENT}; font-weight:800;`)}>{sort?.key === col.key ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
                            </Hoverable>
                          ) : (
                            <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;")}>{col.label}</span>
                          )}
                          {col.resize && (
                            <div onMouseDown={startResize(col.resize)} title="Arraste para redimensionar" style={css("position:absolute; top:-10px; bottom:-10px; right:-7px; width:12px; cursor:col-resize; z-index:2;")} />
                          )}
                        </div>
                        );
                      })}
                    </div>
                )}
                </div>
                {open && (
                  <div style={css(`background:#fff; border:1px solid #ECEDF1; border-top:none; border-radius:0 0 12px 12px; min-width:${GRID_MIN}px;`)}>
                    {sortRows(grp.tasks).map((t) => renderRow(t))}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        <BoardView groups={groups} statusOpts={statusOpts} />
      )}

      {selectable && listView === "list" && (
        <BulkActionsBar count={sel.size} onClear={clearSel}>
          {/* Status */}
          <Menu align="left" width={195} trigger={(tg) => (
            <Hoverable as="button" onClick={tg} s={css(BULK_BTN)} hover="background:#FAFAFB">
              <Svg size={14} sw={2.4} stroke="#5B6472"><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>
              Status
              <Svg size={12} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
            </Hoverable>
          )}>
            {(close) => statusOpts.map((s) => (
              <MenuItem key={s} onClick={() => { applyBulk({ status: s }); close(); }}>
                <span style={css(`width:9px; height:9px; border-radius:50%; background:${statusInfo[s].dot};`)} /><span style={{ flex: 1 }}>{statusInfo[s].label}</span>
              </MenuItem>
            ))}
          </Menu>
          {/* Responsável */}
          {podeTrocarResp() && (
          <Menu align="left" width={200} trigger={(tg) => (
            <Hoverable as="button" onClick={tg} s={css(BULK_BTN)} hover="background:#FAFAFB">
              <Svg size={15} sw={2.2} stroke="#5B6472"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></Svg>
              Responsável
              <Svg size={12} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
            </Hoverable>
          )}>
            {(close) => responsaveisDoScope(team, scope).map((m) => (
              <MenuItem key={m.id} onClick={() => { applyBulk({ gestor: m.id }); close(); }}>
                <Avatar ini={m.ini} cor={m.cor} src={m.foto} size={22} fontSize={10} /><span style={{ flex: 1 }}>{m.nome}</span>
              </MenuItem>
            ))}
          </Menu>
          )}
          {/* Vencimento */}
          <DatePicker
            date=""
            align="left"
            onSave={(d, h) => applyBulk({ venc: d, vencHora: h })}
            trigger={(toggle) => (
              <Hoverable as="button" onClick={toggle} s={css(BULK_BTN)} hover="background:#FAFAFB">
                <Svg size={14} stroke="#5B6472"><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>
                Vencimento
                <Svg size={12} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
              </Hoverable>
            )}
          />
        </BulkActionsBar>
      )}

      {confirmDel && (
        <>
          <div onClick={() => setConfirmDel(null)} style={css("position:fixed; inset:0; z-index:70; background:rgba(20,24,40,.32);")} />
          <div style={css("position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:71; background:#fff; border:1px solid #E2E3E9; border-radius:16px; box-shadow:0 24px 70px rgba(20,24,40,.32); width:420px; max-width:92vw; padding:22px 24px;")}>
            <div style={css("display:flex; align-items:center; gap:12px; margin-bottom:12px;")}>
              <span style={css("width:38px; height:38px; flex:none; border-radius:50%; background:#FDECEC; display:flex; align-items:center; justify-content:center; color:#CC3338;")}>
                <Svg size={19} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></Svg>
              </span>
              <h2 style={css("margin:0; font-size:17px; font-weight:800; letter-spacing:-0.2px;")}>Excluir tarefa</h2>
            </div>
            <p style={css("margin:0 0 20px; font-size:13.5px; color:#5B6472; line-height:1.5;")}>
              Tem certeza que deseja excluir <strong style={css("color:#1B1B28;")}>{confirmDel.titulo}</strong>?
              <br />
              Essa ação não pode ser desfeita.
            </p>
            <div style={css("display:flex; justify-content:flex-end; gap:10px;")}>
              <Hoverable as="button" onClick={() => setConfirmDel(null)} s={css("border:1px solid #E2E3E9; background:#fff; border-radius:9px; padding:9px 16px; font-size:13.5px; font-weight:700; color:#5B6472; cursor:pointer;")} hover="background:#F4F4F7">Cancelar</Hoverable>
              <Hoverable as="button" onClick={() => { removeTask(confirmDel.id); setConfirmDel(null); }} s={css("border:none; background:#CC3338; color:#fff; border-radius:9px; padding:9px 18px; font-size:13.5px; font-weight:700; cursor:pointer;")} hover="filter:brightness(1.08)">Excluir</Hoverable>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type BoardGroup = { key: string; label: string; dot: string; tasks: Task[] };

function BoardView({ groups, statusOpts }: { groups: BoardGroup[]; statusOpts: TaskStatus[] }) {
  const { team, clients, clientesInativos, updateTask, setTaskDetailOpen } = useApp();
  const abrir = setTaskDetailOpen;
  const clientName = (id: string) => clienteDe([...clients, ...clientesInativos], id);
  // Colunas recolhidas (clicar no cabeçalho recolhe/expande).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));
  return (
    <div style={css("flex:1; min-height:0; display:flex; flex-direction:column; padding:18px 30px 28px;")}>
      <div style={css("flex:1; min-height:0; display:flex; gap:14px; align-items:start; overflow:auto; padding-bottom:8px;")}>
        {groups.map((grp) => {
          if (collapsed[grp.key]) {
            return (
              <Hoverable key={grp.key} onClick={() => toggle(grp.key)} title="Expandir coluna" s={css("align-self:stretch; min-height:160px; display:flex; flex-direction:column; align-items:center; gap:11px; background:#F2F3F6; border-radius:13px; width:46px; flex:none; padding:14px 0 16px; cursor:pointer;")} hover="background:#EAEBEF">
                <span style={css(`width:9px; height:9px; border-radius:50%; flex:none; background:${grp.dot};`)} />
                <span style={css("font-size:12px; font-weight:700; color:#9398A6;")}>{grp.tasks.length}</span>
                <span style={css("writing-mode:vertical-rl; transform:rotate(180deg); font-weight:700; font-size:13px; color:#3A3F4C; white-space:nowrap; letter-spacing:0.2px;")}>{grp.label}</span>
              </Hoverable>
            );
          }
          return (
            <div key={grp.key} style={css("display:flex; flex-direction:column; background:#F2F3F6; border-radius:13px; width:280px; flex:none;")}>
              <Hoverable onClick={() => toggle(grp.key)} title="Recolher coluna" s={css("display:flex; align-items:center; gap:8px; padding:13px 14px 11px; flex:none; cursor:pointer; border-radius:13px 13px 0 0;")} hover="background:#EAEBEF">
                <span style={css(`width:9px; height:9px; border-radius:50%; background:${grp.dot};`)} />
                <span style={css("font-weight:700; font-size:13px; color:#3A3F4C;")}>{grp.label}</span>
                <span style={css("font-size:12px; font-weight:700; color:#9398A6;")}>{grp.tasks.length}</span>
              </Hoverable>
              <div style={css("padding:0 10px 12px; display:flex; flex-direction:column; gap:9px;")}>
                {grp.tasks.map((t) => {
                  const cl = clientName(t.cliente);
                  const g = gestorOf(team, t.gestor);
                  const late = (daysUntil(t.venc) ?? 0) < 0;
                  const si = statusInfo[t.status];
                  return (
                    <div key={t.id} style={css("background:#fff; border:1px solid #ECEDF1; border-radius:12px; padding:13px 14px; position:relative;")}>
                      <div style={css(`position:absolute; left:0; top:12px; bottom:12px; width:3px; border-radius:0 3px 3px 0; background:${si.dot};`)} />
                      <div onClick={() => abrir(t.id)} style={css(`font-size:10.5px; font-weight:800; color:${cl?.cor ?? "#9398A6"}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`)}>{cl?.nome ?? (t.cliente || "-")}</div>
                      <div onClick={() => abrir(t.id)} style={css("font-size:13.5px; font-weight:700; line-height:1.35; margin-bottom:12px; cursor:pointer; color:#1B1B28;")}>{t.titulo}</div>
                      <div style={css("display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin-bottom:12px;")}>
                        <Menu trigger={(tg) => (
                          <span onClick={tg} style={css(`display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; padding:4px 9px; border-radius:999px; cursor:pointer; background:${si.bg}; color:${si.fg};`)}><span style={css(`width:6px; height:6px; border-radius:50%; background:${si.dot};`)} />{si.label}</span>
                        )} width={185}>
                          {(close) => statusOpts.map((s) => (
                            <MenuItem key={s} checked={t.status === s} onClick={() => { updateTask(t.id, { status: s }); close(); }}>
                              <span style={css(`width:9px; height:9px; border-radius:50%; background:${statusInfo[s].dot};`)} /><span style={{ flex: 1 }}>{statusInfo[s].label}</span>
                            </MenuItem>
                          ))}
                        </Menu>
                        <span style={css(`display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:4px 8px; border-radius:999px; color:${prioInfo[t.prio].fg}; background:${prioInfo[t.prio].fg}14;`)}>
                          <Svg size={12}><path d="M5 21V4h11l-2.2 4 2.2 4H5" /></Svg>{prioInfo[t.prio].label}
                        </span>
                      </div>
                      <div style={css("display:flex; align-items:center; gap:8px; padding-top:11px; border-top:1px solid #F0F1F4;")}>
                        <Svg size={13} stroke={late ? "#CC3338" : "#7A8090"}><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>
                        <span style={css(`font-size:12px; font-weight:700; color:${late ? "#CC3338" : "#7A8090"};`)}>{prazoLabel(t.venc)}</span>
                        <span style={{ flex: 1 }} />
                        <RespHover member={g}><Avatar ini={g.ini} cor={g.cor} src={g.foto} size={24} fontSize={10} /></RespHover>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
