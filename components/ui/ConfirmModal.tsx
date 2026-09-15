"use client";

import { useFecharComEsc } from "./useFecharComEsc";
import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { css } from "@/lib/css";
import { Svg } from "./Svg";
import Hoverable from "./Hoverable";

/**
 * Confirmação simples (Confirmar / Cancelar), sem digitação — para ações que
 * pedem só um "tem certeza?". Usa portal no document.body. `danger` deixa o
 * botão de confirmar vermelho.
 */
export default function ConfirmModal({ titulo, mensagem, confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger, onConfirm, onClose }: {
  titulo: string;
  mensagem: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useFecharComEsc(true, onClose);
  const cor = danger ? "#CC3338" : "#955C6B";
  return createPortal(
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:320; background:rgba(20,24,40,.32);")} />
      <div style={css("position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:321; background:#fff; border:1px solid #E2E3E9; border-radius:16px; box-shadow:0 24px 70px rgba(20,24,40,.32); width:420px; max-width:94vw; overflow:hidden;")}>
        <div style={css("display:flex; align-items:center; gap:10px; padding:16px 20px; border-bottom:1px solid #ECEDF1;")}>
          <div style={css("flex:1; min-width:0; font-size:15.5px; font-weight:800; letter-spacing:-0.3px;")}>{titulo}</div>
          <Hoverable as="button" onClick={onClose} s={css("width:30px; height:30px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("padding:18px 20px;")}>
          <p style={css("margin:0; font-size:13.5px; color:#5B6472; line-height:1.55;")}>{mensagem}</p>
        </div>
        <div style={css("display:flex; gap:10px; justify-content:flex-end; padding:0 20px 18px;")}>
          <Hoverable as="button" onClick={onClose} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:13.5px; font-weight:700; padding:10px 18px; border-radius:10px;")} hover="background:#F4F4F7">{cancelLabel}</Hoverable>
          <Hoverable as="button" onClick={onConfirm} s={css(`border:none; background:${cor}; color:#fff; cursor:pointer; font-size:13.5px; font-weight:700; padding:10px 18px; border-radius:10px;`)} hover="filter:brightness(1.1)">{confirmLabel}</Hoverable>
        </div>
      </div>
    </>,
    document.body,
  );
}
