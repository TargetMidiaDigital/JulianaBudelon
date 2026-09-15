/**
 * Devolve a URL só se for segura para usar em `href` — bloqueia `javascript:`,
 * `data:`, `vbscript:` etc. (que executariam ao clicar e poderiam roubar a
 * sessão). Aceita http(s), mailto, tel e caminhos relativos. Caso contrário
 * retorna `undefined` (o link fica inerte). Use em todo `<a href={valorDoUsuário}>`.
 */
export function safeHref(url?: string | null): string | undefined {
  const raw = (url ?? "").trim();
  if (!raw) return undefined;
  // Para checar o esquema, remove espaços/controle que o mascaram (ex.: "java\tscript:").
  const probe = raw.replace(/\s+/g, "").toLowerCase();
  if (/^(\/|#|\.\/|\.\.\/)/.test(probe)) return raw;       // caminho relativo / âncora
  if (/^(https?:|mailto:|tel:)/.test(probe)) return raw;   // esquemas permitidos
  if (!/^[a-z][a-z0-9+.-]*:/.test(probe)) return raw;      // sem esquema → ok (vira https no uso)
  return undefined;                                        // javascript:, data:, vbscript:, …
}
