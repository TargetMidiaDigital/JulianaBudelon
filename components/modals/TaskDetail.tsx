"use client";

import { useFecharComEsc } from "../ui/useFecharComEsc";
import { useState } from "react";
import { css } from "@/lib/css";
import { prioInfo, statusInfo } from "@/lib/theme";
import type { Task, TaskStatus } from "@/lib/types";
import { Avatar } from "../ui/bits";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import DatePicker from "../ui/DatePicker";
import EditableTitle from "../ui/EditableTitle";
import CommentEditor from "../ui/CommentEditor";
import CampoExpansivel from "../ui/CampoExpansivel";
import CommentBody from "../ui/CommentBody";
import LogLine from "../ui/LogLine";
import { DEFAULT_DUE_TIME } from "@/lib/format";
import { PRIO_ORDER, gestorOf, responsaveisDoScope, statusEscolhiveis, useApp } from "../store";
import { pedidoStatusInfo } from "@/lib/pedido";
import { corDaCategoria } from "@/lib/estoque";
import { ehExpedicao } from "@/lib/tarefas";
import QtdCell from "../ui/QtdCell";

export default function TaskDetail() {
  const { tasks, taskDetailOpen } = useApp();
  const t = tasks.find((x) => x.id === taskDetailOpen);
  if (!t) return null;
  return <TaskDetailBody key={t.id} t={t} />;
}

function TaskDetailBody({ t }: { t: Task }) {
  const { team, pedidos, produtos, setTaskDetailOpen, updateTask, currentUser, podeTrocarResp, canSeeAll } = useApp();
  const pedido = t.pedidoId ? pedidos.find((p) => p.id === t.pedidoId) : undefined;
  const produto = t.produtoId ? produtos.find((p) => p.id === t.produtoId) : undefined;
  const statusOpts: TaskStatus[] = statusEscolhiveis(canSeeAll, ehExpedicao(t)); // sem "Atrasada"; Expedição sem "Em produção"
  // Botão "›": avança para o próximo status do fluxo (A verificar → Em produção → Concluída → Validada).
  // "Atrasada" também segue para Concluída; "Validada" só para quem vê tudo (Head/Admin).
  const PROXIMO: Partial<Record<TaskStatus, TaskStatus>> = { verificar: ehExpedicao(t) ? "concluida" : "em andamento", "em andamento": "concluida", atrasada: "concluida", concluida: "validada" };
  const proximo = PROXIMO[t.status];
  const podeAvancar = !!proximo && (proximo !== "validada" || canSeeAll);
  const close = () => setTaskDetailOpen(null);
  useFecharComEsc(true, close);
  const g = gestorOf(team, t.gestor);

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
              <span style={css(`flex:none; width:34px; height:34px; border-radius:9px; background:${statusInfo[t.status].bg}; color:${statusInfo[t.status].fg}; display:flex; align-items:center; justify-content:center;`)}><Svg size={17} sw={2.2}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Svg></span>
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
                {podeAvancar && proximo && (
                  <Hoverable as="button" onClick={() => updateTask(t.id, { status: proximo })} title={`Avançar para "${statusInfo[proximo].label}"`} s={css(`display:inline-flex; align-items:center; gap:5px; height:28px; padding:0 10px 0 8px; margin-left:4px; border:1px solid ${statusInfo[proximo].dot}55; background:#fff; color:${statusInfo[proximo].fg}; border-radius:7px; cursor:pointer; font-size:12px; font-weight:700;`)} hover={`background:${statusInfo[proximo].bg}`}>
                    <Svg size={13} sw={2.6}><path d="m9 6 6 6-6 6" /></Svg>
                    {statusInfo[proximo].label}
                  </Hoverable>
                )}
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
              {!ehExpedicao(t) && (
                <Row label="Produto">
                  <Menu trigger={(tg) => (
                    <span onClick={tg} style={css(`display:inline-flex; align-items:center; gap:7px; font-size:13.5px; font-weight:600; color:${produto ? "#1B1B28" : "#9398A6"}; cursor:pointer; padding:5px 9px; border-radius:7px;`)}>
                      {produto && <span style={css(`width:8px; height:8px; border-radius:50%; background:${corDaCategoria(produto.categoria)};`)} />}
                      {produto?.nome ?? "Definir produto"}
                      <Svg size={11} sw={2.4} stroke="#9398A6" style={css("flex:none;")}><path d="m6 9 6 6 6-6" /></Svg>
                    </span>
                  )} width={300} z={64} popStyle="max-height:320px; overflow-y:auto;">
                    {(c) => (
                      <>
                        <MenuItem checked={!t.produtoId} onClick={() => { updateTask(t.id, { produtoId: undefined }); c(); }}><span style={{ flex: 1, color: "#9398A6" }}>— Nenhum —</span></MenuItem>
                        {[...produtos].sort((a, b) => a.nome.localeCompare(b.nome, "pt")).map((p) => (
                          <MenuItem key={p.id} checked={t.produtoId === p.id} onClick={() => { updateTask(t.id, { produtoId: p.id }); c(); }}>
                            <span style={css(`width:9px; height:9px; border-radius:50%; background:${corDaCategoria(p.categoria)};`)} /><span style={{ flex: 1 }}>{p.nome}</span><span style={css("font-size:11px; color:#9398A6;")}>{p.categoria}</span>
                          </MenuItem>
                        ))}
                      </>
                    )}
                  </Menu>
                </Row>
              )}
              {!ehExpedicao(t) && (
                <Row label="Quantidade">
                  <span style={css("display:inline-flex; align-items:center; gap:10px;")}>
                    <QtdCell size="lg" value={t.quantidade ?? 0} onSave={(n) => updateTask(t.id, { quantidade: n })} />
                    <span style={css("font-size:12px; color:#9398A6; font-weight:600;")}>{t.status === "concluida" || t.status === "validada" ? "somada ao estoque da Fábrica" : "soma no estoque da Fábrica ao concluir"}</span>
                  </span>
                </Row>
              )}
              <Row label="Tipo">
                <EditableTitle value={t.tipo ?? ""} placeholder="Sem tipo" onSave={(v) => updateTask(t.id, { tipo: v })} textStyle="font-size:13.5px; font-weight:600; color:#3A3F4C;" />
              </Row>
              {pedido && (
                <Row label="Ordem de serviço">
                  <span style={css("display:inline-flex; align-items:center; gap:8px; min-width:0;")}>
                    <span style={css("font-size:13.5px; font-weight:700; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{pedido.titulo}</span>
                    <span style={css(`display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; padding:3px 9px; border-radius:7px; background:${pedidoStatusInfo(pedido.status).bg}; color:${pedidoStatusInfo(pedido.status).fg};`)}><span style={css(`width:6px; height:6px; border-radius:50%; background:${pedidoStatusInfo(pedido.status).dot};`)} />{pedidoStatusInfo(pedido.status).label}</span>
                  </span>
                </Row>
              )}
              <Row label="Última atualização"><span style={css("font-size:13.5px; font-weight:600; color:#5B6472;")}>{t.atualizada ? `${t.atualizada}${t.atualizadaHora ? ` ${t.atualizadaHora}` : ""}` : "—"}</span></Row>
              <Row label="Data de vencimento">
                <DatePicker date={t.venc} time={t.vencHora} align="left" z={66} onSave={(d, h) => updateTask(t.id, { venc: d, vencHora: h })} trigger={(toggle) => (
                  <Hoverable onClick={toggle} s={css("display:inline-flex; align-items:center; gap:7px; font-size:13.5px; font-weight:700; color:#5B6472; cursor:pointer; padding:5px 9px; border-radius:7px;")} hover="background:#F2F3F6"><Svg size={14}><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>{t.venc} {t.vencHora || DEFAULT_DUE_TIME}</Hoverable>
                )} />
              </Row>
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
