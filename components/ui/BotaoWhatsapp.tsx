"use client";

import { linkWhatsappCandidato, mensagemPrimeiroContato, type CandidatoContato } from "@/lib/whatsapp-candidato";
import { useApp } from "../store";

/** Glifo do WhatsApp (o app não tem ícones de marca; um balão genérico não é reconhecido de relance). */
export function IconeWhatsapp({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14 0-.31-.01-.47-.01-.17 0-.44.06-.67.31-.23.25-.87.86-.87 2.09s.9 2.43 1.02 2.6c.12.16 1.76 2.69 4.26 3.77.6.26 1.06.41 1.42.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}

/**
 * Abre a conversa no WhatsApp com a mensagem de primeiro contato pronta — igual ao botão
 * da tabela do Banco de Talentos do Cachorrão HD. `stopPropagation` porque a linha/card
 * inteiro abre o detalhe do candidato.
 */
export default function BotaoWhatsapp({ candidato, size = 28 }: { candidato: CandidatoContato; size?: number }) {
  const { workspace } = useApp();
  const href = linkWhatsappCandidato(candidato, workspace.nome);
  if (!href) return null;
  const msg = mensagemPrimeiroContato(candidato, workspace.nome);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Mandar no WhatsApp: "${msg}"`}
      aria-label={`Mandar mensagem no WhatsApp para ${candidato.nome}`}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", width: size, height: size, borderRadius: 8, background: "rgba(37,211,102,.14)", color: "#1DA851", textDecoration: "none" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(37,211,102,.28)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(37,211,102,.14)"; }}
    >
      <IconeWhatsapp size={Math.round(size * 0.54)} />
    </a>
  );
}
