/**
 * Grupos de WhatsApp que recebem as notificações automáticas (tabela `whatsapp_grupos`,
 * Configurações → WhatsApp). Mesmo desenho do CRM do Cachorrão HD (types/grupo.ts):
 * `ativo` é o interruptor geral; `setores` diz DE QUE assunto o grupo quer ser avisado.
 * Sem segredo aqui — compartilhado entre servidor e navegador.
 */

export const SETORES_GRUPO = [
  {
    value: "recrutamento",
    label: "Recrutamento",
    descricao: "Candidatura nova chegando pela página de vagas no Banco de Talentos.",
  },
] as const;

export type SetorGrupo = (typeof SETORES_GRUPO)[number]["value"];

/** Setor de quem não escolheu nada. */
export const SETOR_PADRAO: SetorGrupo = "recrutamento";

const VALIDOS = SETORES_GRUPO.map((s) => s.value) as readonly string[];

/** Sanitiza a lista vinda do cliente: só setores conhecidos, sem repetição, nunca vazia. */
export function normalizarSetores(raw: unknown): SetorGrupo[] {
  if (!Array.isArray(raw)) return [SETOR_PADRAO];
  const limpos = Array.from(new Set(raw.map((s) => String(s ?? "").trim().toLowerCase()).filter((s) => VALIDOS.includes(s)))) as SetorGrupo[];
  return limpos.length ? limpos : [SETOR_PADRAO];
}

/**
 * Normaliza o JID do grupo. O usuário cola de qualquer jeito ("120363...", "120363...@g.us",
 * com espaço) — sem o sufixo a Uazapi trataria como telefone e a mensagem sumiria em silêncio.
 */
export function normalizarJid(bruto: unknown): string | null {
  const s = String(bruto ?? "").trim();
  if (!s) return null;
  const semSufixo = s.replace(/@g\.us$/i, "");
  if (!/^[\d-]{10,}$/.test(semSufixo)) return null;
  return `${semSufixo}@g.us`;
}

export interface GrupoWhatsApp {
  id: string;
  nome: string;
  grupo_id: string;
  ativo: boolean;
  setores: SetorGrupo[];
  created_at: string;
}

/** O que a tela de WhatsApp recebe sobre a instância (sem o token). */
export type WhatsAppConfigPublica = { url: string; configurado: boolean };
