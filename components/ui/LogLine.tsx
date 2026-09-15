"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { safeHref } from "@/lib/safeHref";
import { ACCENT } from "@/lib/theme";
import type { Comentario } from "@/lib/types";
import { Svg } from "./Svg";
import Hoverable from "./Hoverable";

/** dd/mm, HH:MM (fuso de Brasília) — igual ao log das automações de conta. */
function fmt(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** URLs viram links clicáveis, mantendo o visual discreto. */
function linkify(msg: string): React.ReactNode {
  return msg.split(/(https?:\/\/\S+)/g).map((p, i) =>
    /^https?:\/\//.test(p)
      ? <a key={i} href={safeHref(p)} target="_blank" rel="noreferrer" style={{ color: ACCENT, textDecoration: "underline", wordBreak: "break-all" }}>{p}</a>
      : p,
  );
}

/**
 * Linha de log de atividade — estilo discreto único do app (o mesmo das
 * "Automações" da conta de anúncios): ícone + texto cinza + horário, sem balão.
 * Usado em tarefas, clientes, leads e contas para `Comentario` com `tipo: "log"`.
 */
export default function LogLine({ c, onDelete }: { c: Comentario; onDelete?: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={css("display:flex; align-items:flex-start; gap:8px; padding:2px 2px;")}>
      <Svg size={13} sw={1.8} stroke="#B6BAC6" style={css("flex:none; margin-top:2px;")}><path d="M12 8V4H8" /><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></Svg>
      <span style={css("flex:1; min-width:0; font-size:12px; color:#9398A6; font-weight:500; line-height:1.45; white-space:pre-wrap; overflow-wrap:anywhere;")}>{linkify(c.message)}</span>
      {c.created_at && <span style={css("flex:none; font-size:11px; color:#B6BAC6; margin-top:1px;")}>{fmt(c.created_at)}</span>}
      {onDelete && hover && (
        <Hoverable as="button" title="Excluir" onClick={onDelete} s={css("width:22px; height:22px; flex:none; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#C7CAD2;")} hover="background:#FDECEC; color:#CC3338"><Svg size={12} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg></Hoverable>
      )}
    </div>
  );
}
