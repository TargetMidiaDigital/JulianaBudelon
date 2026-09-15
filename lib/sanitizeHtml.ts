/**
 * Sanitizador HTML leve (sem dependência), para os comentários ricos de tarefa.
 * Whitelist de tags/atributos; remove scripts, handlers `on*` e URLs `javascript:`.
 * Regex puro → roda igual no servidor (SSR) e no browser (sem jsdom/DOMPurify,
 * que quebra no SSR serverless).
 */
const ALLOWED_TAGS = new Set([
  "p", "br", "div", "span", "b", "strong", "i", "em", "u",
  "s", "strike", "del", "code", "pre", "blockquote",
  "a", "img", "video", "audio", "source", "ul", "ol", "li",
]);

// Atributos permitidos por tag (além disso, alguns são sempre forçados — ver abaixo).
// `style` é permitido em qualquer tag, mas filtrado para um subconjunto seguro.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href"]),
  img: new Set(["src", "alt", "width", "height"]),
  video: new Set(["src", "width", "height", "poster"]),
  audio: new Set(["src"]),
  source: new Set(["src", "type"]),
};

// Propriedades de estilo permitidas (alinhamento, tamanho da fonte e da mídia).
const ALLOWED_STYLE = new Set([
  "text-align", "font-size", "font-weight", "font-style", "text-decoration",
  "width", "max-width", "height", "margin", "margin-left", "margin-right", "display", "float",
]);

/** Mantém só declarações de estilo seguras (sem url()/expression/posicionamento). */
function cleanStyle(value: string): string {
  return value
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d) => {
      const i = d.indexOf(":");
      if (i < 0) return false;
      const prop = d.slice(0, i).trim().toLowerCase();
      const val = d.slice(i + 1).trim().toLowerCase();
      if (!ALLOWED_STYLE.has(prop)) return false;
      if (/url\(|expression|javascript:|[<>]/.test(val)) return false;
      return true;
    })
    .join("; ");
}

export function sanitizeHtml(input?: string | null): string {
  if (!input) return "";
  let html = String(input);

  // 1) Remove blocos perigosos por inteiro (tag + conteúdo).
  html = html.replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, "");

  // 2) Processa cada tag: descarta as não permitidas (mantém o texto) e limpa atributos.
  html = html.replace(/<(\/?)\s*([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (_m, slash: string, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (slash) return `</${name}>`;

    const allowed = ALLOWED_ATTRS[name] ?? new Set<string>();
    const kept: string[] = [];
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(attrs))) {
      const attr = a[1].toLowerCase();
      let val = a[3] ?? a[4] ?? a[5] ?? "";
      if (attr.startsWith("on")) continue;          // handlers de evento
      if (attr === "style") {                        // estilo: filtra para o subconjunto seguro
        const clean = cleanStyle(val);
        if (clean) kept.push(`style="${clean.replace(/"/g, "&quot;")}"`);
        continue;
      }
      if (!allowed.has(attr)) continue;             // fora da whitelist da tag
      if ((attr === "href" || attr === "src") && /^\s*(javascript|data\s*:\s*text\/html|vbscript):/i.test(val)) continue;
      val = val.replace(/"/g, "&quot;");
      kept.push(`${attr}="${val}"`);
    }

    // Reforços de segurança/UX.
    if (name === "a") kept.push('target="_blank"', 'rel="noopener noreferrer"');
    if (name === "video") kept.push("controls", "playsinline", 'preload="metadata"');
    if (name === "audio") kept.push("controls", 'preload="metadata"');

    return `<${name}${kept.length ? " " + kept.join(" ") : ""}>`;
  });

  return html;
}
