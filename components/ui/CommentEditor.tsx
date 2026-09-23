"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { css } from "@/lib/css";
import { ACCENT } from "@/lib/theme";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { uploadArquivo, LIMITE_ANEXO, type UploadResult } from "@/lib/upload";
import { Svg } from "./Svg";
import Hoverable from "./Hoverable";
import MediaViewer from "./MediaViewer";

type Payload = { html: string; message: string };
type Media = HTMLImageElement | HTMLVideoElement;

// Documentos aceitos como anexo (além de imagem/vídeo): entram como um "chip" de link.
const ANEXO_DOC = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|rtf|odt|ods|odp|zip)$/i;
// Por extensão também: `.m4a` costuma chegar com `type` vazio no Windows.
const ANEXO_AUDIO = /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i;
const aceitaAnexo = (f: File) =>
  f.type.startsWith("image/") || f.type.startsWith("video/") || f.type.startsWith("audio/") ||
  ANEXO_DOC.test(f.name) || ANEXO_AUDIO.test(f.name);

/**
 * Detecta uma imagem/vídeo arrastado/colado de fora (de um site) a partir do
 * DataTransfer/Clipboard. Só retorna quando é claramente mídia (tag <img>/<video>
 * no HTML, ou uma URL/data: com extensão de mídia) — um link/texto comum continua
 * sendo colado como texto.
 */
function externalMediaUrl(getData: (type: string) => string): string | null {
  const html = getData("text/html");
  if (html) {
    const m = html.match(/<(?:img|video|source)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
    if (m && m[1]) return m[1];
  }
  const uri = (getData("text/uri-list") || getData("text/plain") || "")
    .split(/\r?\n/).map((s) => s.trim()).find((s) => s && !s.startsWith("#"));
  if (uri && (/^data:(image|video)\//i.test(uri) ||
      (/^https?:\/\//i.test(uri) && /\.(png|jpe?g|gif|webp|bmp|svg|avif|mp4|webm|mov|m4v)(\?|#|$)/i.test(uri)))) return uri;
  return null;
}

const FONT_SIZES = [13, 17, 22]; // pequeno / médio / grande
const MEDIA_SIZES: { label: string; pct: number }[] = [
  { label: "P", pct: 30 }, { label: "M", pct: 60 }, { label: "G", pct: 100 },
];

/**
 * Editor rico de comentário (contentEditable):
 *  - anexo inline de imagem/vídeo (botão, colar ou arrastar-e-soltar);
 *  - mover a mídia pelo texto (drag nativo);
 *  - selecionar a mídia → barra com alinhamento (esq/centro/dir) e tamanho (P/M/G);
 *  - selecionar texto → barra com negrito/itálico/sublinhado/tachado, listas,
 *    alinhamento e 3 tamanhos de fonte.
 *
 * Sem backend nesta fase: os arquivos viram data-URL (lib/upload.ts).
 */
export default function CommentEditor({
  taskId,
  initialHtml,
  onSubmit,
  onCancel,
  onChange,
  editing = false,
  autoFocus = false,
  hideActions = false,
  placeholder = "Escreva um comentário… (arraste imagens ou vídeos aqui)",
  minHeight = 48,
  fill = false,
  onBlur,
  zoomOnClick = false,
}: {
  /** Pasta do upload no Storage (id da tarefa/candidato). */
  taskId?: string;
  initialHtml?: string;
  onSubmit?: (p: Payload) => void;
  onCancel?: () => void;
  /** Modo controlado (ex.: descrição): dispara a cada edição com o HTML atual. */
  onChange?: (html: string) => void;
  editing?: boolean;
  autoFocus?: boolean;
  /** Esconde os botões Enviar/Cancelar (mantém só o anexo de imagem/vídeo). */
  hideActions?: boolean;
  placeholder?: string;
  minHeight?: number;
  /** Cresce para preencher a altura do container (ex.: descrição de tarefa). */
  fill?: boolean;
  /** Chamado ao sair do editor (ex.: salvar a descrição ao perder o foco). */
  onBlur?: () => void;
  /** Clicar numa imagem/vídeo abre o visualizador (zoom) em vez de selecionar p/ editar. */
  zoomOnClick?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const selMedia = useRef<Media | null>(null);
  const [empty, setEmpty] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; tipo: "image" | "video" } | null>(null); // lightbox (zoomOnClick)
  const [bar, setBar] = useState<{ top: number; bottom: number; left: number } | null>(null);   // toolbar de texto
  const [mbar, setMbar] = useState<{ top: number; bottom: number; left: number } | null>(null); // toolbar de mídia
  const [mrect, setMrect] = useState<{ top: number; left: number; width: number; height: number } | null>(null); // alça de redimensionar
  const barRef = useRef<HTMLDivElement>(null);
  const mbarRef = useRef<HTMLDivElement>(null);

  // Mantém a toolbar dentro da tela (mede a largura real e ajusta antes de pintar).
  const clampBar = (el: HTMLDivElement | null, pos: { top: number; bottom: number; left: number } | null) => {
    if (!el || !pos) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(pos.left - w / 2, vw - w - 8));
    let top = pos.top - h - 8;
    if (top < 8) top = Math.min(pos.bottom + 8, vh - h - 8);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  };
  useLayoutEffect(() => clampBar(barRef.current, bar), [bar]);
  useLayoutEffect(() => clampBar(mbarRef.current, mbar), [mbar]);

  // Conteúdo inicial (modo edição) + foco.
  useEffect(() => {
    if (ref.current && initialHtml != null) {
      ref.current.innerHTML = sanitizeHtml(initialHtml);
      refreshEmpty();
    }
    if (autoFocus) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toolbar de texto (seleção).
  useEffect(() => {
    const onSel = () => updateBar();
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mídia selecionada: acompanha scroll/resize; clique fora limpa.
  useEffect(() => {
    if (!mbar) return;
    const sync = () => positionMediaBar();
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.("[data-mediabar]")) return;
      if (ref.current?.contains(t) && /^(IMG|VIDEO)$/.test(t.tagName)) return;
      clearMedia();
    };
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
      document.removeEventListener("mousedown", onDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mbar]);

  const hasContent = () => {
    const el = ref.current;
    return !!el && (!!el.textContent?.trim() || !!el.querySelector("img,video"));
  };
  const refreshEmpty = () => {
    setEmpty(!hasContent());
    if (onChange && ref.current) onChange(hasContent() ? sanitizeHtml(ref.current.innerHTML) : "");
  };

  // ── Toolbar de texto ──────────────────────────────────────────────────────
  const updateBar = () => {
    if (selMedia.current) { setBar(null); return; }
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) {
      setBar(null);
      return;
    }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) { setBar(null); return; }
    setBar({ top: r.top, bottom: r.bottom, left: r.left + r.width / 2 });
  };

  const exec = (cmd: string, useCss = false) => {
    ref.current?.focus();
    try { document.execCommand("styleWithCSS", false, useCss ? "true" : "false"); } catch { /* noop */ }
    document.execCommand(cmd);
    refreshEmpty();
    updateBar();
  };

  const setFontSize = (px: number) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);

    // Se a seleção cobre itens de lista, aplica no <li> inteiro para a bolinha/número
    // acompanhar o tamanho (senão o marcador fica com o tamanho padrão).
    const lis = Array.from(el.querySelectorAll("li")).filter((li) => range.intersectsNode(li));
    if (lis.length) {
      lis.forEach((li) => {
        (li as HTMLElement).style.fontSize = `${px}px`;
        li.querySelectorAll<HTMLElement>("[style*='font-size']").forEach((n) => { n.style.fontSize = ""; });
      });
      refreshEmpty();
      updateBar();
      return;
    }

    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
    try {
      range.surroundContents(span);
    } catch {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    const nr = document.createRange();
    nr.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(nr);
    refreshEmpty();
    updateBar();
  };

  // ── Toolbar de mídia ──────────────────────────────────────────────────────
  const positionMediaBar = () => {
    const m = selMedia.current;
    if (!m || !document.contains(m)) { clearMedia(); return; }
    const r = m.getBoundingClientRect();
    setMbar({ top: r.top, bottom: r.bottom, left: r.left + r.width / 2 });
    setMrect({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  // Redimensionamento manual (arrastar a alça do canto inferior direito).
  const onHandleDown = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = selMedia.current;
    if (!el) return;
    const startX = e.clientX;
    const startW = el.getBoundingClientRect().width;
    const maxW = ref.current?.clientWidth ?? 600;
    const move = (ev: MouseEvent) => {
      const w = Math.max(40, Math.min(maxW, Math.round(startW + (ev.clientX - startX))));
      el.removeAttribute("width"); el.removeAttribute("height");
      el.style.width = `${w}px`;
      el.style.maxWidth = "100%";
      positionMediaBar();
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      refreshEmpty();
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
  const selectMedia = (el: Media) => {
    if (selMedia.current && selMedia.current !== el) selMedia.current.classList.remove("cm-sel");
    selMedia.current = el;
    el.classList.add("cm-sel");
    setBar(null);
    positionMediaBar();
  };
  const clearMedia = () => {
    selMedia.current?.classList.remove("cm-sel");
    selMedia.current = null;
    setMbar(null);
    setMrect(null);
  };
  const alignMedia = (dir: "left" | "center" | "right") => {
    const el = selMedia.current;
    if (!el) return;
    el.style.display = "block";
    el.style.margin = dir === "center" ? "6px auto" : dir === "right" ? "6px 0 6px auto" : "6px auto 6px 0";
    positionMediaBar();
    refreshEmpty();
  };
  const sizeMedia = (pct: number) => {
    const el = selMedia.current;
    if (!el) return;
    el.removeAttribute("width"); el.removeAttribute("height");
    el.style.width = `${pct}%`;
    el.style.maxWidth = "100%";
    positionMediaBar();
    refreshEmpty();
  };

  // ── Inserção / upload ─────────────────────────────────────────────────────
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const insertNodeAtCaret = (node: Node) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    let range = savedRange.current;
    if (!range || !el.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    range.deleteContents();
    range.insertNode(node);
    const br = document.createElement("br");
    node.parentNode?.insertBefore(br, node.nextSibling);
    const after = document.createRange();
    after.setStartAfter(br);
    after.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(after);
    savedRange.current = after.cloneRange();
    refreshEmpty();
  };

  // Imagens grandes são redimensionadas/recomprimidas no navegador (o dado fica
  // no localStorage nesta fase, então quanto menor, melhor).
  const LIMITE_ARQ = LIMITE_ANEXO();
  const comprimirImagem = async (file: File): Promise<File> => {
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size <= 600 * 1024) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
      return file;
    }
  };

  const upload = async (file0: File): Promise<UploadResult | null> => {
    const file = await comprimirImagem(file0);
    if (file.size > LIMITE_ARQ) {
      window.alert(file.type.startsWith("video/")
        ? `Vídeo muito grande para anexar aqui (limite ${Math.round(LIMITE_ARQ / 1048576)} MB). Comprima o vídeo ou envie por link.`
        : file.type.startsWith("image/")
        ? "Imagem muito grande mesmo após compressão. Tente uma imagem menor."
        : `Arquivo muito grande para anexar aqui (limite ${Math.round(LIMITE_ARQ / 1048576)} MB).`);
      return null;
    }
    try {
      return await uploadArquivo(file, { dir: "tarefas", id: taskId });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Falha ao enviar o arquivo.");
      return null;
    }
  };

  const insertMedia = (r: { url: string; tipo: string; nome?: string }) => {
    if (r.tipo === "video") {
      const v = document.createElement("video");
      v.src = r.url; v.controls = true; v.setAttribute("draggable", "true"); v.style.maxWidth = "100%";
      insertNodeAtCaret(v);
    } else if (r.tipo === "audio") {
      const a = document.createElement("audio");
      a.src = r.url; a.controls = true; a.preload = "metadata"; a.setAttribute("draggable", "true");
      insertNodeAtCaret(a);
    } else if (r.tipo === "file") {
      // Documento (PDF etc): não tem preview inline — vira um link clicável.
      const a = document.createElement("a");
      a.href = r.url; a.textContent = `📎 ${r.nome ?? "arquivo"}`;
      insertNodeAtCaret(a);
    } else {
      const img = document.createElement("img");
      img.src = r.url; img.style.maxWidth = "100%";
      insertNodeAtCaret(img);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter(aceitaAnexo);
    if (!list.length) return;
    setUploading(true);
    try {
      for (const file of list) {
        const r = await upload(file);
        if (r) insertMedia(r);
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * Imagem/vídeo arrastado ou colado de um SITE (não é arquivo). data:/blob: →
   * lê no cliente; http(s) → insere a URL direto (sem servidor para re-hospedar).
   */
  const handleExternalMedia = async (url: string) => {
    setUploading(true);
    try {
      if (/^(data:|blob:)/i.test(url)) {
        const blob = await fetch(url).then((x) => x.blob()).catch(() => null);
        if (blob && (blob.type.startsWith("image/") || blob.type.startsWith("video/"))) {
          const r = await upload(new File([blob], "colado", { type: blob.type }));
          if (r) insertMedia(r);
        } else {
          window.alert("Não foi possível ler a imagem colada.");
        }
      } else {
        const isVideo = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
        insertMedia({ url, tipo: isVideo ? "video" : "image" });
      }
    } finally {
      setUploading(false);
    }
  };

  const setCaretFromPoint = (clientX: number, clientY: number) => {
    const doc = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    let range: Range | null = null;
    if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(clientX, clientY);
    else if (doc.caretPositionFromPoint) {
      const p = doc.caretPositionFromPoint(clientX, clientY);
      if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); range.collapse(true); }
    }
    if (range && ref.current?.contains(range.commonAncestorContainer)) savedRange.current = range;
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void handleFiles(e.target.files);
    e.target.value = "";
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || []).filter(aceitaAnexo);
    if (files.length) { e.preventDefault(); void handleFiles(files); return; }
    const media = externalMediaUrl((t) => e.clipboardData.getData(t));
    if (media) { e.preventDefault(); saveSelection(); void handleExternalMedia(media); }
  };

  const onDragOver = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types || []);
    if (types.includes("Files")) { e.preventDefault(); setDragging(true); }
    else if (types.includes("text/html") || types.includes("text/uri-list")) { e.preventDefault(); }
  };
  const onDragLeave = (e: React.DragEvent) => { if (e.currentTarget === e.target) setDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files || []).filter(aceitaAnexo);
    if (files.length) {
      e.preventDefault();
      setDragging(false);
      setCaretFromPoint(e.clientX, e.clientY);
      void handleFiles(files);
      return;
    }
    const media = externalMediaUrl((t) => e.dataTransfer.getData(t));
    if (media) {
      e.preventDefault();
      setDragging(false);
      setCaretFromPoint(e.clientX, e.clientY);
      void handleExternalMedia(media);
      return;
    }
    setDragging(false);
  };

  const onEditorClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "IMG" || t.tagName === "VIDEO") {
      // Em campos de leitura (descrição): clicar dá ZOOM.
      if (zoomOnClick) {
        e.preventDefault();
        const url = t.tagName === "VIDEO" ? ((t as HTMLVideoElement).currentSrc || (t as HTMLVideoElement).src) : (t as HTMLImageElement).src;
        setViewer({ url, tipo: t.tagName === "VIDEO" ? "video" : "image" });
        clearMedia();
        return;
      }
      selectMedia(t as Media);
    } else clearMedia();
  };

  const submit = () => {
    const el = ref.current;
    if (!el || !hasContent() || uploading || !onSubmit) return;
    clearMedia();
    const html = sanitizeHtml(el.innerHTML);
    const message = (el.textContent ?? "").trim();
    onSubmit({ html, message });
    if (!editing) { el.innerHTML = ""; refreshEmpty(); setBar(null); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
  };

  const iconBtn = "width:32px; height:32px; flex:none; border:none; background:transparent; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;";
  const fmtBtn = "min-width:28px; height:28px; padding:0 5px; flex:none; border:none; background:transparent; border-radius:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#E8E9EE; font-weight:800;";
  const sep = <span style={css("width:1px; height:18px; background:#3A4150; margin:0 3px;")} />;
  const alignIcon = (d: "Left" | "Center" | "Right") => (
    <Svg size={15} stroke="currentColor"><path d={d === "Left" ? "M3 6h18M3 12h12M3 18h15" : d === "Center" ? "M3 6h18M6 12h12M4 18h16" : "M3 6h18M9 12h12M6 18h15"} /></Svg>
  );

  return (
    <div style={css(`border:1px solid ${dragging ? ACCENT : "#E2E3E9"}; border-radius:12px; background:#fff; overflow:hidden; transition:border-color .12s ease; ${fill ? "height:100%; display:flex; flex-direction:column;" : ""}`)}>
      {/* Toolbar de texto */}
      {bar && (
        <div ref={barRef} onMouseDown={(e) => e.preventDefault()} style={css(`position:fixed; z-index:420; top:0; left:0; display:flex; align-items:center; gap:1px; background:#1F2430; border-radius:9px; padding:4px 5px; box-shadow:0 6px 20px rgba(16,24,40,.28);`)}>
          <Hoverable as="button" title="Negrito" onClick={() => exec("bold")} s={css(fmtBtn)} hover="background:#343B49; color:#fff"><span style={{ fontWeight: 800 }}>B</span></Hoverable>
          <Hoverable as="button" title="Itálico" onClick={() => exec("italic")} s={css(fmtBtn)} hover="background:#343B49; color:#fff"><span style={{ fontStyle: "italic", fontWeight: 700 }}>I</span></Hoverable>
          <Hoverable as="button" title="Sublinhado" onClick={() => exec("underline")} s={css(fmtBtn)} hover="background:#343B49; color:#fff"><span style={{ textDecoration: "underline", fontWeight: 700 }}>U</span></Hoverable>
          <Hoverable as="button" title="Tachado" onClick={() => exec("strikeThrough")} s={css(fmtBtn)} hover="background:#343B49; color:#fff"><span style={{ textDecoration: "line-through", fontWeight: 700 }}>S</span></Hoverable>
          {sep}
          <Hoverable as="button" title="Fonte pequena" onClick={() => setFontSize(FONT_SIZES[0])} s={css(fmtBtn)} hover="background:#343B49; color:#fff"><span style={{ fontSize: 11, fontWeight: 800 }}>A</span></Hoverable>
          <Hoverable as="button" title="Fonte média" onClick={() => setFontSize(FONT_SIZES[1])} s={css(fmtBtn)} hover="background:#343B49; color:#fff"><span style={{ fontSize: 14, fontWeight: 800 }}>A</span></Hoverable>
          <Hoverable as="button" title="Fonte grande" onClick={() => setFontSize(FONT_SIZES[2])} s={css(fmtBtn)} hover="background:#343B49; color:#fff"><span style={{ fontSize: 17, fontWeight: 800 }}>A</span></Hoverable>
          {sep}
          <Hoverable as="button" title="Alinhar à esquerda" onClick={() => exec("justifyLeft", true)} s={css(fmtBtn)} hover="background:#343B49; color:#fff">{alignIcon("Left")}</Hoverable>
          <Hoverable as="button" title="Centralizar" onClick={() => exec("justifyCenter", true)} s={css(fmtBtn)} hover="background:#343B49; color:#fff">{alignIcon("Center")}</Hoverable>
          <Hoverable as="button" title="Alinhar à direita" onClick={() => exec("justifyRight", true)} s={css(fmtBtn)} hover="background:#343B49; color:#fff">{alignIcon("Right")}</Hoverable>
          {sep}
          <Hoverable as="button" title="Lista" onClick={() => exec("insertUnorderedList")} s={css(fmtBtn)} hover="background:#343B49; color:#fff"><Svg size={16} stroke="currentColor"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg></Hoverable>
          <Hoverable as="button" title="Lista numerada" onClick={() => exec("insertOrderedList")} s={css(fmtBtn)} hover="background:#343B49; color:#fff"><Svg size={16} stroke="currentColor"><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 16H4v-1l2-1v-1H4" /></Svg></Hoverable>
        </div>
      )}

      {/* Toolbar de mídia */}
      {mbar && (
        <div ref={mbarRef} data-mediabar onMouseDown={(e) => e.preventDefault()} style={css(`position:fixed; z-index:421; top:0; left:0; display:flex; align-items:center; gap:1px; background:#1F2430; border-radius:9px; padding:4px 5px; box-shadow:0 6px 20px rgba(16,24,40,.28);`)}>
          <Hoverable as="button" title="Alinhar à esquerda" onClick={() => alignMedia("left")} s={css(fmtBtn)} hover="background:#343B49; color:#fff">{alignIcon("Left")}</Hoverable>
          <Hoverable as="button" title="Centralizar" onClick={() => alignMedia("center")} s={css(fmtBtn)} hover="background:#343B49; color:#fff">{alignIcon("Center")}</Hoverable>
          <Hoverable as="button" title="Alinhar à direita" onClick={() => alignMedia("right")} s={css(fmtBtn)} hover="background:#343B49; color:#fff">{alignIcon("Right")}</Hoverable>
          {sep}
          {MEDIA_SIZES.map((s) => (
            <Hoverable key={s.label} as="button" title={`Tamanho ${s.label}`} onClick={() => sizeMedia(s.pct)} s={css(fmtBtn)} hover="background:#343B49; color:#fff"><span style={{ fontWeight: 800 }}>{s.label}</span></Hoverable>
          ))}
        </div>
      )}

      {/* Alça de redimensionamento manual (canto inferior direito da mídia). */}
      {mrect && (
        <div
          data-mediabar
          onMouseDown={onHandleDown}
          title="Arraste para redimensionar"
          style={css(`position:fixed; z-index:421; top:${mrect.top + mrect.height - 7}px; left:${mrect.left + mrect.width - 7}px; width:14px; height:14px; background:#fff; border:2px solid ${ACCENT}; border-radius:3px; cursor:nwse-resize;`)}
        />
      )}

      <div style={css(fill ? "position:relative; flex:1; min-height:0; display:flex; flex-direction:column;" : "position:relative;")}>
        <div
          ref={ref}
          className="cm-rich"
          contentEditable
          suppressContentEditableWarning
          onInput={refreshEmpty}
          onBlur={() => { saveSelection(); onBlur?.(); }}
          onKeyUp={() => { saveSelection(); updateBar(); }}
          onMouseUp={() => { saveSelection(); updateBar(); }}
          onClick={onEditorClick}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onDragStart={() => clearMedia()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={css(`${fill ? "flex:1; min-height:0;" : `min-height:${minHeight}px; max-height:340px;`} overflow-y:auto; padding:11px 13px; font-size:13.5px; line-height:1.6; color:#1B1B28; outline:none;`)}
        />
        {empty && !dragging && (
          <div style={css("position:absolute; top:11px; left:13px; font-size:13.5px; color:#9398A6; pointer-events:none;")}>
            {placeholder}
          </div>
        )}
        {dragging && (
          <div style={css(`position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:${ACCENT}0D; color:${ACCENT}; font-size:13px; font-weight:700; pointer-events:none;`)}>
            Solte a imagem ou vídeo aqui
          </div>
        )}
      </div>

      <div style={css("display:flex; align-items:center; gap:4px; padding:6px 8px; border-top:1px solid #F0F1F4; background:#FAFAFB;")}>
        <Hoverable as="button" title="Anexar imagem, vídeo ou áudio" onMouseDown={(e: React.MouseEvent) => e.preventDefault()} onClick={() => { saveSelection(); fileInput.current?.click(); }} s={css(iconBtn)} hover="background:#EEF0F3; color:#3A3F4C">
          <Svg size={17}><rect x="3" y="3" width="18" height="18" rx="2.4" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="m21 15-5-5L5 21" /></Svg>
        </Hoverable>
        {uploading && <span style={css("font-size:12px; color:#9398A6; font-weight:600; margin-left:4px;")}>enviando…</span>}
        <span style={{ flex: 1 }} />
        {!hideActions && editing && onCancel && (
          <Hoverable as="button" onClick={onCancel} s={css("border:1px solid #E2E3E9; background:#fff; border-radius:8px; padding:6px 12px; font-size:12.5px; font-weight:700; color:#5B6472; cursor:pointer;")} hover="background:#F4F4F7">Cancelar</Hoverable>
        )}
        {!hideActions && (
        <button onClick={submit} disabled={empty || uploading} title={editing ? "Salvar" : "Comentar"} style={css(`display:inline-flex; align-items:center; gap:7px; height:32px; padding:0 ${editing ? "14px" : "0"}; ${editing ? "" : "width:32px; justify-content:center;"} border:none; cursor:${empty || uploading ? "not-allowed" : "pointer"}; opacity:${empty || uploading ? 0.5 : 1}; background:${ACCENT}; color:#fff; border-radius:9px; font-size:12.5px; font-weight:700;`)}>
          {editing ? "Salvar" : <Svg size={15} sw={2.2}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></Svg>}
        </button>
        )}
      </div>
      <input ref={fileInput} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.zip,.mp3,.m4a,.aac,.ogg,.opus,.wav" onChange={onPick} style={{ display: "none" }} />
      {viewer && <MediaViewer url={viewer.url} tipo={viewer.tipo} onClose={() => setViewer(null)} />}
    </div>
  );
}
