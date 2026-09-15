"use client";

import { useFecharComEsc } from "../ui/useFecharComEsc";
import { useRef, useState } from "react";
import { css } from "@/lib/css";
import { foneBR, normalizarWhatsapp } from "@/lib/format";
import { uploadLocal } from "@/lib/upload";
import type { Anexo, Comentario, Talento } from "@/lib/types";
import { TALENTO_STATUS, QUALIDADE_TALENTO, corDeTexto, type TalentoOpt } from "@/lib/talento-dims";
import { unidadeLabel, vagaLabel } from "@/lib/localdb";
import { Avatar } from "../ui/bits";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import CommentEditor from "../ui/CommentEditor";
import CommentBody from "../ui/CommentBody";
import LogLine from "../ui/LogLine";
import MediaViewer from "../ui/MediaViewer";
import EditableTitle from "../ui/EditableTitle";
import ConfirmModal from "../ui/ConfirmModal";
import { useApp } from "../store";

/** Como o anexo é exibido no visualizador: imagem/vídeo/pdf têm preview; o resto é "file". */
function tipoDoAnexo(a: Anexo): "image" | "video" | "pdf" | "file" {
  const m = (a.mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m === "application/pdf" || /\.pdf$/i.test(a.nome)) return "pdf";
  return "file";
}

// Status como opções coloridas (mesmo shape das demais dims).
const STATUS_OPTS: TalentoOpt[] = TALENTO_STATUS.map((s) => ({ v: s.key, cor: s.dot, label: s.label }));

/** Dropdown colorido. */
function DropField({ value, options, onSelect, width = 210, clearable = false }: { value?: string; options: TalentoOpt[]; onSelect: (v: string) => void; width?: number; clearable?: boolean }) {
  const cur = options.find((o) => o.v === value);
  const bg = cur?.cor;
  return (
    <Menu z={66} width={width} popStyle="max-height:300px; overflow-y:auto;" trigger={(tg) => (
      <span onClick={tg} style={css(
        bg
          ? `display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700; padding:5px 11px; border-radius:7px; cursor:pointer; background:${bg}22; color:#3A3F4C;`
          : "display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700; padding:5px 11px; border-radius:7px; cursor:pointer; background:#EDEEF2; color:#5B6472;"
      )}>
        {bg && <span style={css(`width:7px; height:7px; border-radius:50%; flex:none; background:${bg};`)} />}
        {cur?.label ?? value ?? "—"}
        <Svg size={11} sw={2.4} stroke="#9398A6" style={css("flex:none; opacity:.6;")}><path d="m6 9 6 6 6-6" /></Svg>
      </span>
    )}>
      {(c) => (
        <>
          {clearable && (
            <MenuItem checked={!value} onClick={() => { onSelect(""); c(); }}>
              <span style={{ flex: 1, color: "#9398A6" }}>— Nenhum —</span>
            </MenuItem>
          )}
          {options.map((o) => (
            <MenuItem key={o.v} checked={value === o.v} onClick={() => { onSelect(o.v); c(); }}>
              <span style={css(`width:10px; height:10px; border-radius:50%; flex:none; background:${o.cor};`)} />
              <span style={{ flex: 1 }}>{o.label ?? o.v}</span>
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  );
}

export default function TalentoDetail({ talento, canEdit = true, onClose, onPatch, onDelete }: {
  talento: Talento;
  canEdit?: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<Talento>) => void;
  onDelete?: () => void;
}) {
  useFecharComEsc(true, onClose);
  const { team, currentUser, unidades, vagas } = useApp();
  const l = talento;
  // Vagas cadastradas (Recrutamento → Vagas) como opções; a atual entra mesmo se sem vínculo.
  const vagaOpts: TalentoOpt[] = vagas.map((v) => ({ v: v.id, cor: corDeTexto(v.titulo), label: `${vagaLabel(v)} · ${unidadeLabel(unidades.find((u) => u.id === v.unidadeId))}` }));
  if (l.vaga && !l.vagaId) vagaOpts.unshift({ v: "__atual__", cor: corDeTexto(l.vaga), label: `${l.vaga} (sem vínculo)` });
  const escolherVaga = (id: string) => {
    if (!id) { onPatch({ vagaId: undefined, vaga: undefined, unidadeId: undefined, turno: undefined }); return; }
    if (id === "__atual__") return;
    const v = vagas.find((x) => x.id === id);
    if (v) onPatch({ vagaId: v.id, vaga: v.titulo, unidadeId: v.unidadeId, turno: v.turno });
  };
  const unidade = unidades.find((u) => u.id === l.unidadeId);
  const comentarios = l.comentarios ?? [];
  const anexos = l.anexos ?? [];
  const [editId, setEditId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verAnexo, setVerAnexo] = useState<Anexo | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const enviarAnexos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setEnviando(true);
    try {
      const novos: Anexo[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 4 * 1024 * 1024) { window.alert(`"${file.name}" é muito grande (limite ~4 MB nesta fase).`); continue; }
        try {
          const r = await uploadLocal(file);
          novos.push({ id: crypto.randomUUID(), nome: r.nome, url: r.url, mime: r.mime, tamanho: file.size, criadoEm: new Date().toISOString(), autor: currentUser.id });
        } catch {
          window.alert(`Falha ao ler "${file.name}".`);
        }
      }
      if (novos.length) onPatch({ anexos: [...anexos, ...novos] });
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const removerAnexo = (id: string) => onPatch({ anexos: anexos.filter((a) => a.id !== id) });
  const fmtBytes = (n?: number) => !n ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

  const authorOf = (a: string) => {
    const m = team.find((x) => x.id === a);
    if (m) return { nome: m.nome, ini: m.ini, cor: m.cor, foto: m.foto };
    if (a) return { nome: a, ini: (a[0] || "?").toUpperCase(), cor: "#5B6472", foto: undefined };
    return { nome: "—", ini: "?", cor: "#9398A6", foto: undefined };
  };
  const fmtData = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const addComentario = ({ html, message }: { html: string; message: string }) => {
    const novo: Comentario = { id: crypto.randomUUID(), message, html, author: currentUser.id, created_at: new Date().toISOString() };
    onPatch({ comentarios: [...comentarios, novo] });
  };
  const salvarEdicao = (id: string, { html, message }: { html: string; message: string }) => {
    onPatch({ comentarios: comentarios.map((c) => (c.id === id ? { ...c, html, message } : c)) });
    setEditId(null);
  };
  const excluirComentario = (id: string) => {
    onPatch({ comentarios: comentarios.filter((c) => c.id !== id) });
  };

  const wa = (l.fone ?? "").replace(/\D/g, "");

  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:62; background:rgba(20,24,40,.32);")} />
      <div className="m-drawer m-stack" style={css("position:fixed; top:0; right:0; bottom:0; z-index:63; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:920px; max-width:96vw; display:flex; overflow:hidden;")}>
        {/* Coluna esquerda — dados do candidato */}
        <div style={css("flex:1.3; min-width:0; display:flex; flex-direction:column; border-right:1px solid #ECEDF1;")}>
          <div style={css("flex:1; min-height:0; overflow-y:auto; padding:22px 24px; display:flex; flex-direction:column;")}>
            <div style={css("display:flex; align-items:flex-start; gap:12px; margin-bottom:18px;")}>
              <div style={css("flex:1; min-width:0;")}>
                {canEdit
                  ? <EditableTitle fill value={l.nome} onSave={(v) => onPatch({ nome: v })} textStyle="margin:0; font-size:21px; font-weight:800; letter-spacing:-0.4px;" pencilSize={15} />
                  : <h2 style={css("margin:0; font-size:21px; font-weight:800; letter-spacing:-0.4px;")}>{l.nome}</h2>}
                {l.vaga && <div style={css("font-size:12.5px; font-weight:600; color:#9398A6; margin-top:3px;")}>{l.vaga}{unidade ? ` · ${unidadeLabel(unidade)}` : ""}{l.origem === "linkbio" ? " · via página de vagas" : ""}</div>}
              </div>
              {canEdit && onDelete && (
                <Hoverable as="button" title="Excluir candidato" onClick={() => setConfirmDel(true)} s={css("flex:none; width:32px; height:32px; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#C7CAD2;")} hover="background:#FDECEC; color:#CC3338; border-color:#F3C2C4">
                  <Svg size={15} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></Svg>
                </Hoverable>
              )}
            </div>

            <div style={css("display:flex; flex-direction:column; gap:2px;")}>
              <Row label="Data criada"><Plain>{fmtData(l.criada) || "—"}</Plain></Row>
              <Row label="Status"><DropField value={l.status} options={STATUS_OPTS} onSelect={(v) => onPatch({ status: v })} width={220} /></Row>
              <Row label="Vaga"><DropField clearable value={l.vagaId ?? (l.vaga ? "__atual__" : undefined)} options={vagaOpts} onSelect={escolherVaga} width={300} /></Row>
              <Row label="Unidade"><Plain>{unidade ? unidadeLabel(unidade) : "—"}</Plain></Row>
              <Row label="Qualidade"><DropField clearable value={l.qualidade} options={QUALIDADE_TALENTO} onSelect={(v) => onPatch({ qualidade: v })} width={200} /></Row>
              <Row label="WhatsApp">
                <div style={css("display:flex; align-items:center; gap:10px; flex-wrap:wrap;")}>
                  {wa ? (
                    <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={css("display:inline-flex; align-items:center; gap:7px; font-size:13.5px; font-weight:700; color:#1B7F4D; text-decoration:none;")}>
                      <Svg size={15} stroke="#1B7F4D"><path d="M21 15.5a2 2 0 0 1-2 2 16 16 0 0 1-14-14 2 2 0 0 1 2-2h2.6a1 1 0 0 1 1 .76l.7 2.8a1 1 0 0 1-.27.95l-1.2 1.2a13 13 0 0 0 5 5l1.2-1.2a1 1 0 0 1 .95-.27l2.8.7a1 1 0 0 1 .76 1z" /></Svg>
                      {foneBR(l.fone)}
                    </a>
                  ) : <Plain>—</Plain>}
                  {canEdit && <EditableTitle value="" placeholder="" onSave={(v) => onPatch({ fone: normalizarWhatsapp(v) })} textStyle="font-size:12px;" pencilSize={12} />}
                </div>
              </Row>
            </div>

            {/* Currículo / Anexos */}
            <div style={css("margin-top:20px; padding-top:16px; border-top:1px solid #F0F1F4;")}>
              <div style={css("display:flex; align-items:center; gap:10px; margin-bottom:10px;")}>
                <span style={css("font-size:12px; font-weight:800; letter-spacing:0.3px; text-transform:uppercase; color:#9398A6;")}>Currículo / Anexos</span>
                <span style={{ flex: 1 }} />
                {canEdit && (
                  <Hoverable as="button" onClick={() => fileRef.current?.click()} s={css("display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:#2563EB; background:#EAF0FE; border:none; border-radius:8px; padding:6px 11px; cursor:pointer;")} hover="background:#DCE7FD">
                    <Svg size={14} stroke="#2563EB" sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>{enviando ? "Enviando…" : "Adicionar"}
                  </Hoverable>
                )}
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.zip" onChange={(e) => enviarAnexos(e.target.files)} style={{ display: "none" }} />
              {anexos.length === 0 ? (
                <div style={css("font-size:12.5px; color:#B6BAC4; padding:4px 0;")}>Nenhum anexo. Adicione o currículo (PDF, DOC…).</div>
              ) : (
                <div style={css("display:flex; flex-direction:column; gap:8px;")}>
                  {anexos.map((a) => (
                    <div key={a.id} style={css("display:flex; align-items:center; gap:10px; border:1px solid #ECEDF1; border-radius:10px; padding:9px 12px;")}>
                      <Svg size={16} stroke="#5B6472" style={css("flex:none;")}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></Svg>
                      <Hoverable onClick={() => setVerAnexo(a)} title="Visualizar" s={css("flex:1; min-width:0; font-size:13px; font-weight:700; color:#1B1B28; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")} hover="color:#2563EB">{a.nome}</Hoverable>
                      {a.tamanho ? <span style={css("font-size:11.5px; color:#9398A6; flex:none;")}>{fmtBytes(a.tamanho)}</span> : null}
                      {canEdit && <Hoverable as="button" title="Remover" onClick={() => removerAnexo(a.id)} s={css("width:26px; height:26px; flex:none; border:none; background:transparent; border-radius:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#C7CAD2;")} hover="background:#FDECEC; color:#CC3338"><Svg size={14} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg></Hoverable>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna direita — comentários */}
        <div style={css("flex:1; min-width:0; display:flex; flex-direction:column; background:#FAFAFB;")}>
          <div style={css("display:flex; align-items:center; gap:9px; padding:14px 22px; border-bottom:1px solid #ECEDF1; height:60px;")}>
            <span style={css("font-weight:800; font-size:15px;")}>Comentário</span>
            <span style={{ flex: 1 }} />
            <Hoverable as="button" onClick={onClose} s={css("width:30px; height:30px; border:1px solid #ECEDF1; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
          </div>
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
                        {!editing && canEdit && (
                          <span style={css("display:inline-flex; gap:4px;")}>
                            <Hoverable as="button" title="Editar" onClick={() => setEditId(cm.id)} s={css("width:24px; height:24px; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9398A6;")} hover="background:#FDF1F4; color:#955C6B"><Svg size={13} sw={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg></Hoverable>
                            <Hoverable as="button" title="Excluir" onClick={() => excluirComentario(cm.id)} s={css("width:24px; height:24px; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#C7CAD2;")} hover="background:#FDECEC; color:#CC3338"><Svg size={13} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg></Hoverable>
                          </span>
                        )}
                      </div>
                      {editing ? (
                        <CommentEditor taskId={l.id} editing autoFocus initialHtml={cm.html ?? cm.message} onCancel={() => setEditId(null)} onSubmit={(p) => salvarEdicao(cm.id, p)} />
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
          {canEdit && (
            <div style={css("flex:none; padding:13px 18px; border-top:1px solid #ECEDF1; background:#fff;")}>
              <CommentEditor taskId={l.id} onSubmit={addComentario} />
            </div>
          )}
        </div>
      </div>
      {verAnexo && <MediaViewer url={verAnexo.url} tipo={tipoDoAnexo(verAnexo)} nome={verAnexo.nome} onClose={() => setVerAnexo(null)} />}
      {confirmDel && onDelete && (
        <ConfirmModal
          titulo="Excluir candidato"
          mensagem={<>Tem certeza que deseja excluir <strong style={css("color:#1B1B28;")}>{l.nome}</strong> do banco de talentos? Essa ação não pode ser desfeita.</>}
          confirmLabel="Excluir"
          danger
          onConfirm={() => { setConfirmDel(false); onDelete(); }}
          onClose={() => setConfirmDel(false)}
        />
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={css("display:flex; align-items:flex-start; gap:14px; padding:9px 0;")}>
      <span style={css("width:110px; flex:none; font-size:13px; color:#7A8090; font-weight:600; padding-top:4px;")}>{label}</span>
      <div style={css("flex:1; min-width:0; padding-top:2px;")}>{children}</div>
    </div>
  );
}

function Plain({ children }: { children: React.ReactNode }) {
  return <span style={css("font-size:13.5px; font-weight:600; color:#3A3F4C; display:block;")}>{children}</span>;
}
