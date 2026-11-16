"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { linkAcompanhamento } from "@/lib/encomendas";
import { Svg } from "../ui/Svg";

const linkDe = (pedidoId: string) => linkAcompanhamento(pedidoId, typeof window !== "undefined" ? window.location.origin : "");

function copiar(texto: string, ok: () => void) {
  void navigator.clipboard?.writeText(texto).then(ok).catch(() => window.prompt("Copie o link:", texto));
}

/** Ícone no card do CRM: copia o link de acompanhamento do pedido (para mandar ao cliente). */
export function IconeLinkPedido({ pedidoId, size = 24 }: { pedidoId: string; size?: number }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" title={ok ? "Link copiado!" : "Copiar o link de acompanhamento para o cliente"} aria-label="Copiar o link de acompanhamento do pedido"
      onClick={(e) => { e.stopPropagation(); copiar(linkDe(pedidoId), () => { setOk(true); setTimeout(() => setOk(false), 1600); }); }}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", width: size, height: size, borderRadius: 8, border: "none", cursor: "pointer", background: ok ? "#E7F6EE" : "#EEF2FF", color: ok ? "#1B7F4D" : "#4F46E5" }}>
      <Svg size={Math.round(size * 0.58)} sw={2.4}>{ok ? <path d="M20 6 9 17l-5-5" /> : <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>}</Svg>
    </button>
  );
}

/** Linha do pedido no contato: link de acompanhamento com Copiar e Abrir. */
export function LinkPedidoCliente({ pedidoId }: { pedidoId: string }) {
  const [ok, setOk] = useState(false);
  const link = linkDe(pedidoId);
  const botao = "border:1px solid #E2E3E9; background:#fff; border-radius:8px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer; color:#3A3F4C; text-decoration:none; display:inline-flex; align-items:center; gap:5px;";
  return (
    <span style={css("display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;")}>
      <button type="button" onClick={() => copiar(link, () => { setOk(true); setTimeout(() => setOk(false), 1600); })} style={css(botao + (ok ? "color:#1B7F4D; border-color:#A7E3C4;" : ""))}>{ok ? "Copiado!" : "Copiar link"}</button>
      <a href={link} target="_blank" rel="noopener noreferrer" style={css(botao)}>Abrir<Svg size={11} sw={2.6}><path d="M7 17 17 7M8 7h9v9" /></Svg></a>
      <span style={css("font-size:11.5px; color:#9398A6; font-weight:600;")}>o cliente acompanha o status por ele</span>
    </span>
  );
}
