"use client";

import { useFecharComEsc } from "../ui/useFecharComEsc";
import { useState } from "react";
import { css } from "@/lib/css";
import { prioInfo, statusInfo } from "@/lib/theme";
import type { Task, TaskStatus, RecConfig } from "@/lib/types";
import { Avatar } from "../ui/bits";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import ClientMenuList from "../ui/ClientMenuList";
import DatePicker from "../ui/DatePicker";
import EditableTitle from "../ui/EditableTitle";
import CommentEditor from "../ui/CommentEditor";
import CampoExpansivel from "../ui/CampoExpansivel";
import CommentBody from "../ui/CommentBody";
import LogLine from "../ui/LogLine";
import { DEFAULT_DUE_TIME } from "@/lib/format";
import { PRIO_ORDER, STATUS_ORDER, gestorOf, responsaveisDoScope, useApp } from "../store";
import { clientLetter, clienteDe, CLIENTE_INTERNO } from "@/lib/selectors";

export default function TaskDetail() {
  const { tasks, taskDetailOpen } = useApp();
  const t = tasks.find((x) => x.id === taskDetailOpen);
  if (!t) return null;
  return <TaskDetailBody key={t.id} t={t} />;
}

function TaskDetailBody({ t }: { t: Task }) {
  const { clients, clientesInativos, team, setTaskDetailOpen, updateTask, setRecorrencia, currentUser, podeTrocarResp, canSeeAll } = useApp();
  const statusOpts: TaskStatus[] = canSeeAll ? [...STATUS_ORDER, "validada"] : STATUS_ORDER;
  const close = () => setTaskDetailOpen(null);
  useFecharComEsc(true, close);
  // Exibição inclui inativos (tarefa antiga com cliente desativado mantém logo+nome);
  // a seleção de cliente (menu abaixo) continua só com ativos.
  const cl = clienteDe([...clients, ...clientesInativos], t.cliente);
  const g = gestorOf(team, t.gestor);
  const clienteNome = cl?.nome ?? (t.cliente || "-");

  // Link compartilhável da tarefa — só quem está logado e com acesso consegue abrir.
  const [linkCopied, setLinkCopied] = useState(false);
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?tarefa=${t.id}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch { /* ignore */ }
  };

  // Descrição editável — salva automaticamente ao sair da caixa (onBlur).
  const [desc, setDesc] = useState(t.desc ?? "");
  const dirty = desc !== (t.desc ?? "");
  const salvar = () => { if (dirty) updateTask(t.id, { desc: desc || undefined }); };

  // Comentários.
  const comentarios = t.comentarios ?? [];
  const [editId, setEditId] = useState<string | null>(null);
  const authorOf = (a: string) => {
    const m = team.find((x) => x.id === a);
    if (m) return { nome: m.nome, ini: m.ini, cor: m.cor, foto: m.foto };
    if (a === "sistema") return { nome: "Sistema", ini: "⚙", cor: "#9398A6", foto: undefined };
    if (a) return { nome: a, ini: (a[0] || "?").toUpperCase(), cor: "#5B6472", foto: undefined };
    return { nome: "—", ini: "?", cor: "#9398A6", foto: undefined };
  };
  const fmtData = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const addComentario = ({ html, message }: { html: string; message: string }) => {
    const novo = { id: crypto.randomUUID(), message, html, author: currentUser.id, created_at: new Date().toISOString() };
    updateTask(t.id, { comentarios: [...comentarios, novo] });
  };
  const salvarEdicao = (id: string, { html, message }: { html: string; message: string }) => {
    updateTask(t.id, { comentarios: comentarios.map((c) => (c.id === id ? { ...c, html, message } : c)) });
    setEditId(null);
  };
  const excluirComentario = (id: string) => {
    updateTask(t.id, { comentarios: comentarios.filter((c) => c.id !== id) });
  };

  return (
    <>
      <div onClick={close} style={css("position:fixed; inset:0; z-index:62; background:rgba(20,24,40,.32);")} />
      <div className="m-drawer m-stack" style={css("position:fixed; top:0; right:0; bottom:0; z-index:63; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:1000px; max-width:96vw; display:flex; overflow:hidden;")}>
        <div style={css("flex:1.4; min-width:0; display:flex; flex-direction:column; border-right:1px solid #ECEDF1;")}>
          <div style={css("flex:1; min-height:0; overflow-y:auto; padding:22px 24px; display:flex; flex-direction:column;")}>
            <div style={css("display:flex; align-items:center; gap:11px; margin-bottom:20px;")}>
              <Avatar ini={clientLetter(clienteNome)} cor={cl?.cor ?? "#475569"} src={cl?.logo} size={34} radius="9px" fontSize={14} />
              <div style={css("flex:1; min-width:0;")}>
                <EditableTitle fill value={t.titulo} onSave={(v) => updateTask(t.id, { titulo: v })} textStyle="margin:0; font-size:21px; font-weight:800; letter-spacing:-0.4px;" pencilSize={15} />
              </div>
              <Hoverable as="button" onClick={copiarLink} title="Copiar link da tarefa" s={css("flex:none; display:inline-flex; align-items:center; gap:7px; border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:12.5px; font-weight:700; padding:7px 12px; border-radius:9px;")} hover="background:#FAFAFB">
                <Svg size={14} sw={2.2}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Svg>
                {linkCopied ? "Link copiado!" : "Copiar link"}
              </Hoverable>
            </div>
            <div style={css("display:flex; flex-direction:column; gap:2px;")}>
              <Row label="Data criada"><span style={css("font-size:13.5px; font-weight:600; color:#5B6472;")}>{t.criada}{t.criadaHora ? ` ${t.criadaHora}` : ""}</span></Row>
              <Row label="Status">
                <Menu trigger={(tg) => (
                  <span onClick={tg} style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; padding:5px 11px; border-radius:7px; cursor:pointer; background:${statusInfo[t.status].bg}; color:${statusInfo[t.status].fg};`)}><span style={css(`width:7px; height:7px; border-radius:50%; background:${statusInfo[t.status].dot};`)} />{statusInfo[t.status].label}<Svg size={11} sw={2.4} style={css("flex:none; opacity:.6;")}><path d="m6 9 6 6 6-6" /></Svg></span>
                )} width={190} z={64}>
                  {(c) => statusOpts.map((s) => (<MenuItem key={s} checked={t.status === s} onClick={() => { updateTask(t.id, { status: s }); c(); }}><span style={css(`width:9px; height:9px; border-radius:50%; background:${statusInfo[s].dot};`)} /><span style={{ flex: 1 }}>{statusInfo[s].label}</span></MenuItem>))}
                </Menu>
              </Row>
              <Row label="Prioridade">
                <Menu trigger={(tg) => (
                  <span onClick={tg} style={css(`display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:700; color:${prioInfo[t.prio].fg}; cursor:pointer; padding:5px 9px; border-radius:7px;`)}><Svg size={14}><path d="M5 21V4h11l-2.2 4 2.2 4H5" /></Svg>{prioInfo[t.prio].label}<Svg size={11} sw={2.4} style={css("flex:none; opacity:.45;")}><path d="m6 9 6 6 6-6" /></Svg></span>
                )} width={160} z={64}>
                  {(c) => PRIO_ORDER.map((p) => (<MenuItem key={p} checked={t.prio === p} onClick={() => { updateTask(t.id, { prio: p }); c(); }}><Svg size={13} stroke={prioInfo[p].dot}><path d="M5 21V4h11l-2.2 4 2.2 4H5" /></Svg><span style={{ flex: 1 }}>{prioInfo[p].label}</span></MenuItem>))}
                </Menu>
              </Row>
              <Row label="Responsável">
                {podeTrocarResp() ? (
                  <Menu trigger={(tg) => (
                    <span onClick={tg} style={css("display:inline-flex; align-items:center; gap:8px; cursor:pointer; padding:4px 9px 4px 4px; border-radius:999px;")}><Avatar ini={g.ini} cor={g.cor} src={g.foto} size={24} fontSize={10.5} /><span style={css("font-size:13.5px; font-weight:600;")}>{g.nome}</span><Svg size={11} sw={2.4} stroke="#9398A6" style={css("flex:none;")}><path d="m6 9 6 6 6-6" /></Svg></span>
                  )} width={180} z={64}>
                    {(c) => responsaveisDoScope(team, t.categoria).map((m) => (<MenuItem key={m.id} checked={t.gestor === m.id} onClick={() => { updateTask(t.id, { gestor: m.id }); c(); }}><Avatar ini={m.ini} cor={m.cor} src={m.foto} size={22} fontSize={10} /><span style={{ flex: 1 }}>{m.nome}</span></MenuItem>))}
                  </Menu>
                ) : (
                  <span style={css("display:inline-flex; align-items:center; gap:8px; padding:4px 9px 4px 4px;")}><Avatar ini={g.ini} cor={g.cor} src={g.foto} size={24} fontSize={10.5} /><span style={css("font-size:13.5px; font-weight:600;")}>{g.nome}</span></span>
                )}
              </Row>
              <Row label="Cliente">
                <Menu trigger={(tg) => (
                  <span onClick={tg} style={css("display:inline-flex; align-items:center; gap:7px; font-size:13.5px; font-weight:600; cursor:pointer; padding:5px 9px 5px 5px; border-radius:7px;")}>{cl ? <Avatar ini={clientLetter(cl.nome)} cor={cl.cor} src={cl.logo} size={22} radius="6px" fontSize={10} /> : null}{clienteNome}<Svg size={11} sw={2.4} stroke="#9398A6" style={css("flex:none;")}><path d="m6 9 6 6 6-6" /></Svg></span>
                )} width={230} z={64} popStyle="max-height:260px; overflow-y:auto;">
                  {(c) => <ClientMenuList clients={[CLIENTE_INTERNO, ...clients]} selectedId={t.cliente} onSelect={(id) => { updateTask(t.id, { cliente: id }); c(); }} />}
                </Menu>
              </Row>
              <Row label="Tipo">
                <EditableTitle value={t.tipo ?? ""} placeholder="Sem tipo" onSave={(v) => updateTask(t.id, { tipo: v })} textStyle="font-size:13.5px; font-weight:600; color:#3A3F4C;" />
              </Row>
              <Row label="Última atualização"><span style={css("font-size:13.5px; font-weight:600; color:#5B6472;")}>{t.atualizada ? `${t.atualizada}${t.atualizadaHora ? ` ${t.atualizadaHora}` : ""}` : "—"}</span></Row>
              <Row label="Data de vencimento">
                <DatePicker date={t.venc} time={t.vencHora} align="left" z={66} onSave={(d, h) => updateTask(t.id, { venc: d, vencHora: h })} trigger={(toggle) => (
                  <Hoverable onClick={toggle} s={css("display:inline-flex; align-items:center; gap:7px; font-size:13.5px; font-weight:700; color:#5B6472; cursor:pointer; padding:5px 9px; border-radius:7px;")} hover="background:#F2F3F6"><Svg size={14}><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>{t.venc} {t.vencHora || DEFAULT_DUE_TIME}</Hoverable>
                )} />
              </Row>
              <Row label="Repetir"><RecRow t={t} onSalvar={(rec) => setRecorrencia(t.id, rec)} /></Row>
            </div>
            {/* `min-height` (e não `min-height:0`) é o que garante a Descrição legível. */}
            <div style={css("margin-top:18px; padding-top:18px; border-top:1px solid #F0F1F4; flex:1; min-height:300px; display:flex; flex-direction:column;")}>
              <CampoExpansivel
                titulo="Descrição"
                icone={<Svg size={15} stroke="#5B6472"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>}
              >
                <CommentEditor taskId={t.id} hideActions fill zoomOnClick placeholder="Descreva o que precisa ser feito… (arraste imagens ou vídeos)" initialHtml={t.desc} onChange={(html) => setDesc(html)} onBlur={salvar} />
              </CampoExpansivel>
            </div>
          </div>
        </div>
        <div style={css("flex:1; min-width:0; display:flex; flex-direction:column; background:#FAFAFB;")}>
          <div style={css("display:flex; align-items:center; gap:9px; padding:14px 22px; border-bottom:1px solid #ECEDF1; height:60px;")}><span style={css("font-weight:800; font-size:15px;")}>Comentário</span><span style={{ flex: 1 }} /><Hoverable as="button" onClick={close} s={css("width:30px; height:30px; border:1px solid #ECEDF1; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable></div>
          <div style={css("flex:1; overflow-y:auto; padding:18px 20px; display:flex; flex-direction:column; gap:16px;")}>
            {comentarios.length === 0 ? (
              <div style={css("flex:1; display:flex; align-items:center; justify-content:center; text-align:center; color:#9398A6; padding:30px 10px;")}>
                <div>
                  <Svg size={30} sw={1.6} stroke="#C7CAD2" style={css("margin-bottom:8px;")}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>
                  <div style={css("font-size:13px; font-weight:600;")}>Ainda não há comentários.</div>
                </div>
              </div>
            ) : (
              comentarios.map((cm) => {
                if (cm.tipo === "log") return <LogLine key={cm.id} c={cm} />;
                const a = authorOf(cm.author);
                const editing = editId === cm.id;
                return (
                  <div key={cm.id} style={css("display:flex; gap:11px;")}>
                    <Avatar ini={a.ini} cor={a.cor} src={a.foto} size={30} fontSize={11} />
                    <div style={css("flex:1; min-width:0;")}>
                      <div style={css("display:flex; align-items:baseline; gap:8px; margin-bottom:4px;")}>
                        <span style={css("font-size:13px; font-weight:700;")}>{a.nome}</span>
                        {cm.created_at && <span style={css("font-size:11px; color:#9398A6; font-weight:500;")}>{fmtData(cm.created_at)}</span>}
                        <span style={{ flex: 1 }} />
                        {!editing && (
                          <span style={css("display:inline-flex; gap:4px;")}>
                            <Hoverable as="button" title="Editar" onClick={() => setEditId(cm.id)} s={css("width:24px; height:24px; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9398A6;")} hover="background:#FDF1F4; color:#955C6B"><Svg size={13} sw={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg></Hoverable>
                            <Hoverable as="button" title="Excluir" onClick={() => excluirComentario(cm.id)} s={css("width:24px; height:24px; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#C7CAD2;")} hover="background:#FDECEC; color:#CC3338"><Svg size={13} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg></Hoverable>
                          </span>
                        )}
                      </div>
                      {editing ? (
                        <CommentEditor taskId={t.id} editing autoFocus initialHtml={cm.html ?? cm.message} onCancel={() => setEditId(null)} onSubmit={(p) => salvarEdicao(cm.id, p)} />
                      ) : cm.html ? (
                        <CommentBody html={cm.html} boxStyle="font-size:13px; font-weight:500; color:#3A3F4C; background:#fff; border:1px solid #ECEDF1; border-radius:9px; padding:9px 12px; line-height:1.55; word-break:break-word;" />
                      ) : (
                        <div style={css("font-size:13px; font-weight:500; color:#3A3F4C; background:#fff; border:1px solid #ECEDF1; border-radius:9px; padding:9px 12px; line-height:1.55; white-space:pre-wrap; word-break:break-word;")}>{cm.message}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div style={css("flex:none; padding:13px 18px; border-top:1px solid #ECEDF1; background:#fff;")}>
            <CommentEditor taskId={t.id} onSubmit={addComentario} />
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={css("display:flex; align-items:center; gap:14px; padding:9px 0;")}>
      <span style={css("width:120px; flex:none; font-size:13px; color:#7A8090; font-weight:600;")}>{label}</span>
      {children}
    </div>
  );
}

const REC_SEMANA = ["todo domingo", "toda segunda", "toda terça", "toda quarta", "toda quinta", "toda sexta", "todo sábado"];
const REC_AB = ["D", "S", "T", "Q", "Q", "S", "S"];
const REC_FREQ_LABEL: Record<"diaria" | "semanal" | "mensal", string> = { diaria: "Diária", semanal: "Semanal", mensal: "Mensal" };
function recResumo(r: RecConfig): string {
  if (r.freq === "diaria") return "todo dia";
  if (r.freq === "semanal") return REC_SEMANA[r.diaSemana ?? 0];
  return `todo dia ${r.diaMes ?? 1} do mês`;
}
const RepeatIcon = () => <Svg size={13} sw={2.2}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></Svg>;
const miniBtn = "display:inline-flex; align-items:center; gap:5px; border:1px solid #E2E3E9; background:#fff; cursor:pointer; font-size:12px; font-weight:700; color:#5B6472; padding:5px 9px; border-radius:7px;";

/** Editor de recorrência dentro do detalhe da tarefa (torna qualquer tarefa recorrente). */
function RecRow({ t, onSalvar }: { t: Task; onSalvar: (rec: RecConfig | null) => void }) {
  const r = t.rec;
  const [editando, setEditando] = useState(false);
  const [freq, setFreq] = useState<"diaria" | "semanal" | "mensal">(r?.freq ?? "semanal");
  const [diaSemana, setDiaSemana] = useState(r?.diaSemana ?? 1);
  const [diaMes, setDiaMes] = useState(r?.diaMes ?? 1);
  const [prazo, setPrazo] = useState(r?.prazoDias ?? 0);
  const [modo, setModo] = useState<"novo" | "reagendar">(r?.modo ?? "novo");

  const abrir = () => {
    setFreq(r?.freq ?? "semanal"); setDiaSemana(r?.diaSemana ?? 1); setDiaMes(r?.diaMes ?? 1); setPrazo(r?.prazoDias ?? 0); setModo(r?.modo ?? "novo");
    setEditando(true);
  };
  const salvar = () => {
    onSalvar({ ativa: true, freq, prazoDias: prazo, modo, diaSemana: freq === "semanal" ? diaSemana : undefined, diaMes: freq === "mensal" ? diaMes : undefined });
    setEditando(false);
  };

  if (!editando) {
    if (!r) return <Hoverable as="button" onClick={abrir} s={css(miniBtn)} hover="background:#F2F3F6"><RepeatIcon />Configurar</Hoverable>;
    return (
      <div style={css("display:flex; align-items:center; gap:7px; flex-wrap:wrap;")}>
        <span style={css(`display:inline-flex; align-items:center; gap:5px; font-size:13.5px; font-weight:700; color:${r.ativa ? "#1B1B28" : "#9398A6"};`)}><RepeatIcon />{recResumo(r)}{r.ativa ? "" : " (pausada)"}</span>
        <Hoverable as="button" onClick={abrir} s={css(miniBtn)} hover="background:#F2F3F6">Editar</Hoverable>
        <Hoverable as="button" onClick={() => onSalvar({ ...r, ativa: !r.ativa })} s={css(miniBtn)} hover="background:#F2F3F6">{r.ativa ? "Pausar" : "Retomar"}</Hoverable>
        <Hoverable as="button" onClick={() => onSalvar(null)} s={css(miniBtn + "color:#C0455A;")} hover="background:#FDECEC">Remover</Hoverable>
      </div>
    );
  }

  return (
    <div style={css("border:1px solid #ECEDF1; background:#FAFBFC; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:11px; width:100%;")}>
      <div style={css("display:flex; gap:7px;")}>
        {(["diaria", "semanal", "mensal"] as const).map((f) => (
          <Hoverable key={f} as="button" onClick={() => setFreq(f)} s={css(`flex:1; padding:8px; border:1px solid ${freq === f ? "#1B1B28" : "#E2E3E9"}; background:${freq === f ? "#1B1B28" : "#fff"}; color:${freq === f ? "#fff" : "#5B6472"}; font-weight:700; font-size:12.5px; border-radius:8px; cursor:pointer;`)} hover={freq === f ? undefined : "background:#F2F3F6"}>{REC_FREQ_LABEL[f]}</Hoverable>
        ))}
      </div>
      {freq === "semanal" && (
        <div style={css("display:flex; gap:5px;")}>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <Hoverable key={d} as="button" onClick={() => setDiaSemana(d)} title={REC_SEMANA[d]} s={css(`width:32px; height:32px; border-radius:8px; border:1px solid ${diaSemana === d ? "#1B1B28" : "#E2E3E9"}; background:${diaSemana === d ? "#1B1B28" : "#fff"}; color:${diaSemana === d ? "#fff" : "#5B6472"}; font-weight:700; font-size:12px; cursor:pointer;`)} hover={diaSemana === d ? undefined : "background:#F2F3F6"}>{REC_AB[d]}</Hoverable>
          ))}
        </div>
      )}
      {freq === "mensal" && (
        <div style={css("display:flex; align-items:center; gap:8px; font-size:13px; color:#1B1B28;")}>
          <span>Dia</span>
          <input type="number" min={1} max={31} value={diaMes} onChange={(e) => setDiaMes(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} style={css("width:70px; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:8px; font-size:13px; padding:7px 9px; outline:none; text-align:center;")} />
          <span style={css("color:#9398A6; font-size:11.5px;")}>(clampa ao último dia do mês)</span>
        </div>
      )}
      <div style={css("display:flex; align-items:center; gap:8px; font-size:13px; color:#1B1B28;")}>
        <span>Vence</span>
        <input type="number" min={0} max={365} value={prazo} onChange={(e) => setPrazo(Math.max(0, Math.min(365, Number(e.target.value) || 0)))} style={css("width:60px; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:8px; font-size:13px; padding:7px 9px; outline:none; text-align:center;")} />
        <span>dia(s) após criada</span>
      </div>
      <div style={css("display:flex; gap:7px;")}>
        {([["novo", "Com histórico"], ["reagendar", "Sem histórico"]] as const).map(([m, tit]) => (
          <Hoverable key={m} as="button" onClick={() => setModo(m)} s={css(`flex:1; padding:8px 10px; border:1px solid ${modo === m ? "#1B1B28" : "#E2E3E9"}; background:${modo === m ? "#FDF1F4" : "#fff"}; color:${modo === m ? "#1B1B28" : "#5B6472"}; font-weight:700; font-size:12px; border-radius:8px; cursor:pointer;`)} hover={modo === m ? undefined : "background:#F7F8FA"}>{tit}</Hoverable>
        ))}
      </div>
      <div style={css("display:flex; gap:8px; margin-top:2px;")}>
        <Hoverable as="button" onClick={salvar} s={css("border:none; cursor:pointer; background:#1B1B28; color:#fff; font-weight:700; font-size:12.5px; padding:8px 16px; border-radius:8px;")} hover="filter:brightness(1.15)">Salvar</Hoverable>
        <Hoverable as="button" onClick={() => setEditando(false)} s={css("border:1px solid #E2E3E9; cursor:pointer; background:#fff; color:#5B6472; font-weight:700; font-size:12.5px; padding:8px 16px; border-radius:8px;")} hover="background:#F4F4F7">Cancelar</Hoverable>
      </div>
    </div>
  );
}
