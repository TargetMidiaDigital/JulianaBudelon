"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { css } from "@/lib/css";
import type { Comentario } from "@/lib/types";
import CommentEditor from "./CommentEditor";
import CommentBody from "./CommentBody";
import { Avatar } from "./bits";
import { Svg } from "./Svg";
import Hoverable from "./Hoverable";
import LogLine from "./LogLine";
import { useApp } from "../store";

function fmtData(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Popover de comentários ancorado no próprio gatilho (igual ao DatePicker):
 * abre abaixo da célula via portal, com flip/clamp e max-height para nunca
 * cortar e ficar sempre em primeiro plano. Genérico: serve p/ tarefas e designs.
 */
export default function CommentsPopover({
  title,
  comentarios,
  onChange,
  readOnly = false,
  heading = "Comentários",
}: {
  title: string;
  comentarios?: Comentario[];
  onChange: (comentarios: Comentario[]) => void;
  readOnly?: boolean;
  heading?: string;
}) {
  const { team, currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number | null; bottom: number | null; left: number; maxH: number }>({ top: 0, bottom: null, left: 0, maxH: 0 });

  const comments = comentarios ?? [];
  const W = 520, margin = 8, H = 960;

  const abrir = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.min(Math.max(margin, r.left), window.innerWidth - W - margin);
      // Ancora SEMPRE na célula: abre logo abaixo; se houver mais espaço acima,
      // abre por cima. A altura é limitada ao espaço do lado escolhido (rola se
      // o conteúdo for maior) — nunca solta o popup no topo da tela.
      const spaceBelow = window.innerHeight - r.bottom - margin - 6;
      const spaceAbove = r.top - margin - 6;
      if (spaceBelow >= spaceAbove) {
        setPos({ top: r.bottom + 6, bottom: null, left, maxH: Math.min(H, spaceBelow) });
      } else {
        setPos({ top: null, bottom: window.innerHeight - r.top + 6, left, maxH: Math.min(H, spaceAbove) });
      }
    }
    setOpen(true);
  };
  const close = () => { setOpen(false); setEditId(null); };

  const enviar = (p: { html: string; message: string }) => {
    const novo: Comentario = { id: `c-${Date.now()}`, message: p.message, html: p.html, author: currentUser.id, created_at: new Date().toISOString() };
    onChange([...comments, novo]);
  };
  const salvarEdicao = (id: string, p: { html: string; message: string }) => {
    onChange(comments.map((c) => (c.id === id ? { ...c, message: p.message, html: p.html } : c)));
    setEditId(null);
  };
  const excluir = (id: string) => onChange(comments.filter((c) => c.id !== id));

  const autorDe = (id: string) => {
    const m = team.find((x) => x.id === id);
    return { nome: m?.nome ?? id, ini: m?.ini ?? (id.trim()[0]?.toUpperCase() ?? "?"), cor: m?.cor ?? "#5B6472" };
  };
  const previa = comments.length ? (comments.length === 1 ? comments[0].message : `${comments.length} comentários`) : "—";

  return (
    <div ref={wrapRef} style={{ minWidth: 0 }}>
      <Hoverable onClick={abrir} title="Ver comentários" s={css("display:flex; align-items:center; gap:6px; min-width:0; cursor:pointer; padding:4px 7px; margin:-4px -7px; border-radius:7px;")} hover="background:#EDEEF2">
        <Svg size={13} sw={2} stroke="#9398A6" style={css("flex:none;")}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.7 8.7 0 0 1-3.9-.9L3 20.5l1.4-5.4a8.5 8.5 0 0 1-.9-3.6A8.38 8.38 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5z" /></Svg>
        <span style={css("font-size:12.5px; font-weight:600; color:#5B6472; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{previa}</span>
      </Hoverable>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div onClick={close} style={css("position:fixed; inset:0; z-index:299;")} />
          <div style={css(`position:fixed; ${pos.top != null ? `top:${pos.top}px` : `bottom:${pos.bottom}px`}; left:${pos.left}px; width:${W}px; max-width:calc(100vw - 16px); max-height:${pos.maxH}px; z-index:300; background:#fff; border:1px solid #E2E3E9; border-radius:14px; box-shadow:0 18px 50px rgba(20,24,40,.22); display:flex; flex-direction:column; overflow:hidden;`)}>
            <div style={css("display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid #ECEDF1; flex:none;")}>
              <div style={css("flex:1; min-width:0;")}>
                <div style={css("font-size:15px; font-weight:800; letter-spacing:-0.3px;")}>{heading}</div>
                <div style={css("font-size:12px; color:#9398A6; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{title}</div>
              </div>
              <Hoverable as="button" onClick={close} s={css("width:30px; height:30px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
            </div>

            <div style={css("flex:1; min-height:0; overflow-y:auto; padding:16px 18px; display:flex; flex-direction:column; gap:14px; background:#FAFAFB;")}>
              {comments.length === 0 ? (
                <div style={css("margin:auto; text-align:center; color:#9398A6; font-size:13px;")}>{readOnly ? "Nenhuma automação registrada ainda." : "Nenhum comentário ainda."}</div>
              ) : readOnly ? (
                comments.map((c) => (
                  <div key={c.id} style={css("display:flex; align-items:flex-start; gap:8px;")}>
                    <Svg size={13} sw={1.8} stroke="#B6BAC6" style={css("flex:none; margin-top:2px;")}><path d="M12 8V4H8" /><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></Svg>
                    <span style={css("flex:1; min-width:0; font-size:12.5px; color:#7A8090; font-weight:500; line-height:1.5; white-space:pre-wrap; overflow-wrap:anywhere;")}>{c.message}</span>
                    <span style={css("flex:none; font-size:11px; color:#B6BAC6; margin-top:1px;")}>{fmtData(c.created_at)}</span>
                  </div>
                ))
              ) : (
                comments.map((c) => {
                  if (c.tipo === "log") return <LogLine key={c.id} c={c} />;
                  const a = autorDe(c.author);
                  const editing = editId === c.id;
                  return (
                    <div key={c.id} style={css("display:flex; gap:10px;")}>
                      <Avatar ini={a.ini} cor={a.cor} size={30} fontSize={11} />
                      <div style={css("flex:1; min-width:0;")}>
                        <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:4px;")}>
                          <span style={css("font-size:12.5px; font-weight:700; color:#1B1B28;")}>{a.nome}</span>
                          <span style={css("font-size:11px; color:#9398A6; font-weight:500;")}>{fmtData(c.created_at)}</span>
                          <span style={{ flex: 1 }} />
                          {!editing && !readOnly && (
                            <span style={css("display:inline-flex; gap:4px;")}>
                              <Hoverable as="button" title="Editar" onClick={() => setEditId(c.id)} s={css("width:24px; height:24px; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9398A6;")} hover="background:#FDF1F4; color:#955C6B"><Svg size={13} sw={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg></Hoverable>
                              <Hoverable as="button" title="Excluir" onClick={() => excluir(c.id)} s={css("width:24px; height:24px; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#C7CAD2;")} hover="background:#FDECEC; color:#CC3338"><Svg size={13} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg></Hoverable>
                            </span>
                          )}
                        </div>
                        {editing ? (
                          <CommentEditor taskId="comentario" editing autoFocus initialHtml={c.html ?? c.message} onCancel={() => setEditId(null)} onSubmit={(p) => salvarEdicao(c.id, p)} />
                        ) : c.html ? (
                          <CommentBody html={c.html} boxStyle="background:#fff; border:1px solid #ECEDF1; border-radius:10px; padding:9px 12px; font-size:13px; line-height:1.5; color:#3A3F4C; overflow-wrap:anywhere;" />
                        ) : (
                          <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:10px; padding:9px 12px; font-size:13px; line-height:1.5; color:#3A3F4C; white-space:pre-wrap; overflow-wrap:anywhere;")}>{c.message}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {!readOnly && (
            <div style={css("flex:none; padding:12px 18px; border-top:1px solid #ECEDF1;")}>
              <CommentEditor taskId="comentario" onSubmit={enviar} />
            </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
