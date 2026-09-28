// Extração de texto de .docx — USO SERVER-SIDE. Copiado do CRM do Cachorrão HD (lib/docx.ts).
//
//
// Currículo em Word não tinha leitura automática: o file-parser do OpenRouter só
// aceita PDF, e a visão do modelo só aceita imagem. A saída óbvia seria converter
// o .docx em foto ou PDF, mas isso exige LibreOffice headless, que não roda em
// serverless — e ainda passaria por OCR, perdendo precisão.
//
// Um .docx é um ZIP com o texto em `word/document.xml`. Extrair direto é mais
// simples, mais fiel (nada de OCR) e não precisa de dependência nova: só `zlib`,
// que já vem no Node.
//
// ⚠️ Não vale para `.doc` (Word 97-2003): aquele é um formato binário antigo, não
// é ZIP, e não tem como ser lido assim.

import { inflateRawSync } from 'node:zlib'

const EOCD = 0x06054b50 // fim do diretório central
const CEN = 0x02014b50 // entrada do diretório central
const ALVO = 'word/document.xml'

/** Um currículo não passa disso; o corte evita mandar um documento gigante ao LLM. */
const MAX_CHARS = 20_000

/**
 * Acha `word/document.xml` pelo DIRETÓRIO CENTRAL do ZIP, e não varrendo os
 * headers locais: quando o Word grava com data descriptor, o tamanho no header
 * local vem zerado e a leitura sairia vazia. No diretório central o tamanho está
 * sempre correto.
 */
function extrairDocumentXml(buf: Buffer): Buffer | null {
  // O EOCD fica no fim, depois de um comentário de até 64 KB.
  let eocd = -1
  const minimo = Math.max(0, buf.length - 66_000)
  for (let i = buf.length - 22; i >= minimo; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break }
  }
  if (eocd < 0) return null

  const total = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)

  for (let n = 0; n < total; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CEN) return null
    const metodo = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOff = buf.readUInt32LE(p + 42)
    const nome = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')

    if (nome === ALVO) {
      // Os tamanhos de `extra` do header LOCAL costumam diferir do central.
      const lnameLen = buf.readUInt16LE(localOff + 26)
      const lextraLen = buf.readUInt16LE(localOff + 28)
      const ini = localOff + 30 + lnameLen + lextraLen
      const dados = buf.subarray(ini, ini + compSize)
      if (metodo === 0) return Buffer.from(dados)
      if (metodo === 8) return inflateRawSync(dados)
      return null // método de compressão que não usamos
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

/**
 * Texto corrido de um .docx. Devolve '' quando o arquivo não é um .docx válido
 * ou não tem texto — quem chama decide o que dizer ao usuário.
 */
export function textoDeDocx(buf: Buffer): string {
  let xml: Buffer | null
  try {
    xml = extrairDocumentXml(buf)
  } catch {
    return ''
  }
  if (!xml) return ''

  const texto = xml
    .toString('utf8')
    // Quebra de parágrafo e de linha viram \n ANTES de remover as tags, senão o
    // currículo inteiro colapsa numa linha só e o modelo perde a estrutura.
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // `&amp;` por último: senão "&amp;lt;" viraria "<".
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return texto.length > MAX_CHARS ? `${texto.slice(0, MAX_CHARS)}\n\n[documento truncado]` : texto
}
