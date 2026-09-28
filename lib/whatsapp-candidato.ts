/**
 * Atalho para falar com o candidato no WhatsApp, com a mensagem de primeiro contato já
 * escrita. Portado do CRM do Cachorrão HD (lib/whatsappCandidato.ts).
 *
 * O link `wa.me` aceita `?text=`, então o WhatsApp abre com o texto pronto e a pessoa do RH
 * só revisa e envia — sem copiar nome e vaga de uma tela para a outra, que é onde o erro
 * acontece (mandar "vaga de Atendente" para quem se candidatou a Auxiliar de Cozinha).
 */

/** Só o primeiro nome, com a inicial maiúscula ("cintia dos santos" → "Cintia"). */
export function primeiroNome(nome: string | null | undefined): string {
  const parte = String(nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!parte) return "";
  return parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase();
}

export interface CandidatoContato {
  nome: string;
  fone?: string | null;
  vaga?: string | null;
}

/** O texto que vai pré-preenchido na conversa. */
export function mensagemPrimeiroContato(c: CandidatoContato, empresa: string): string {
  const nome = primeiroNome(c.nome);
  const abertura = nome ? `Olá, ${nome}!` : "Olá!";
  // Sem vaga a frase precisa continuar de pé: "candidatura para a vaga de undefined" seria pior.
  const vaga = c.vaga ? ` para a vaga de ${c.vaga}` : "";
  return `${abertura} Aqui é da ${empresa || "Ju Budelon"}. Recebemos o seu currículo${vaga} e gostaríamos de conversar com você. Podemos falar por aqui?`;
}

/** Link pronto para abrir a conversa. null quando o candidato não tem WhatsApp. */
export function linkWhatsappCandidato(c: CandidatoContato, empresa: string): string | null {
  const numero = (c.fone ?? "").replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagemPrimeiroContato(c, empresa))}`;
}
