/** Abre Configurações já numa aba (ex.: "lojas", a partir de RH → Vagas ou de Encomendas). */
export const ABA_CONFIG_KEY = "jb.config.aba";
export function pedirAbaConfig(aba: string) {
  try { sessionStorage.setItem(ABA_CONFIG_KEY, aba); } catch { /* sem sessionStorage */ }
}
/** Lê (e apaga) a aba pedida. */
export function abaConfigPedida(): string | null {
  try { const a = sessionStorage.getItem(ABA_CONFIG_KEY); sessionStorage.removeItem(ABA_CONFIG_KEY); return a; } catch { return null; }
}
