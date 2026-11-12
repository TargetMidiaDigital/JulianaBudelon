"use client";

import { createPortal } from "react-dom";
import { css } from "@/lib/css";
import { foneBR } from "@/lib/format";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { IconeWhatsapp } from "../ui/BotaoWhatsapp";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";

/**
 * Pop-up ao passar o pedido para "Confirmado com o cliente": avisa que o WhatsApp vai abrir
 * com a mensagem pronta. "Abrir WhatsApp" abre a conversa numa aba nova e move o pedido.
 */
export default function ConfirmarWhatsapp({ nome, numero, mensagem, onAbrir, onSoMudar, onClose }: {
  nome: string;
  numero: string;
  mensagem: string;
  onAbrir: () => void;
  onSoMudar: () => void;
  onClose: () => void;
}) {
  useFecharComEsc(true, onClose);
  return createPortal(
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:320; background:rgba(20,24,40,.32);")} />
      <div role="dialog" aria-modal="true" aria-label="Confirmar com o cliente" style={css("position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:321; background:#fff; border:1px solid #E2E3E9; border-radius:16px; box-shadow:0 24px 70px rgba(20,24,40,.32); width:460px; max-width:94vw; max-height:calc(100dvh - 24px); overflow:auto;")}>
        <div style={css("display:flex; align-items:center; gap:10px; padding:16px 20px; border-bottom:1px solid #ECEDF1;")}>
          <span style={css("width:32px; height:32px; flex:none; border-radius:9px; background:rgba(37,211,102,.14); color:#1DA851; display:flex; align-items:center; justify-content:center;")}><IconeWhatsapp size={18} /></span>
          <div style={css("flex:1; min-width:0; font-size:15.5px; font-weight:800; letter-spacing:-0.3px;")}>Confirmar com o cliente</div>
          <Hoverable as="button" onClick={onClose} title="Fechar" s={css("width:30px; height:30px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("padding:16px 20px; display:flex; flex-direction:column; gap:12px;")}>
          <div style={css("font-size:13.5px; color:#5B6472; line-height:1.55;")}>
            Você vai ser direcionado para o WhatsApp de <b style={{ color: "#1B1B28" }}>{nome}</b> ({foneBR(numero)}) com esta mensagem pronta. É só revisar e enviar. O pedido passa para <b style={{ color: "#1B1B28" }}>Confirmado com o cliente</b>.
          </div>
          <div style={css("background:#E7FBEF; border:1px solid #C6EFD6; border-radius:12px; padding:12px 14px; font-size:13px; color:#1B1B28; line-height:1.5; white-space:pre-wrap;")}>{mensagem}</div>
        </div>
        <div style={css("display:flex; gap:10px; align-items:center; padding:0 20px 18px; flex-wrap:wrap;")}>
          <Hoverable as="button" onClick={onSoMudar} title="Muda o status sem abrir o WhatsApp" s={css("border:none; background:transparent; color:#7A8090; cursor:pointer; font-size:12.5px; font-weight:700; padding:8px 4px; text-decoration:underline;")} hover="color:#3A3F4C">Só mudar o status</Hoverable>
          <span style={{ flex: 1 }} />
          <Hoverable as="button" onClick={onClose} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:13.5px; font-weight:700; padding:10px 18px; border-radius:10px;")} hover="background:#F4F4F7">Cancelar</Hoverable>
          <Hoverable as="button" onClick={onAbrir} s={css("border:none; background:#1DA851; color:#fff; cursor:pointer; font-size:13.5px; font-weight:700; padding:10px 18px; border-radius:10px; display:inline-flex; align-items:center; gap:7px;")} hover="filter:brightness(1.08)"><IconeWhatsapp size={16} />Abrir WhatsApp</Hoverable>
        </div>
      </div>
    </>,
    document.body,
  );
}
