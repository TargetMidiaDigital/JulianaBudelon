import { authToken, temSupabase } from "./supabase-browser";

/**
 * Upload de arquivos a partir do navegador.
 *  - Com Supabase: vai para o Storage pelas rotas /api/upload (bucket privado, servido
 *    pelo proxy /api/anexo) e /api/avatar (bucket público: fotos e logos).
 *  - Sem Supabase (modo demo): o arquivo vira uma data-URL guardada no localStorage.
 */
export type UploadResult = { url: string; tipo: "image" | "video" | "audio" | "file"; nome: string; mime: string };

const ANEXO_AUDIO = /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i;

export function tipoDoArquivo(f: File): UploadResult["tipo"] {
  if (f.type.startsWith("image/")) return "image";
  if (f.type.startsWith("video/")) return "video";
  if (f.type.startsWith("audio/") || ANEXO_AUDIO.test(f.name)) return "audio";
  return "file";
}

export function uploadLocal(file: File): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: String(reader.result), tipo: tipoDoArquivo(file), nome: file.name, mime: file.type });
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

/** Limite de tamanho de um anexo/mídia (50 MB com Storage; ~4 MB no modo demo, que vive no localStorage). */
export const LIMITE_ANEXO = () => (temSupabase() ? 50 * 1024 * 1024 : 4 * 1024 * 1024);

/** Anexo/mídia de tarefa ou candidato → bucket privado (ou data-URL no modo demo). */
export async function uploadArquivo(file: File, opts: { dir: "tarefas" | "talentos"; id?: string }): Promise<UploadResult> {
  if (!temSupabase()) return uploadLocal(file);
  const fd = new FormData();
  fd.append("file", file);
  fd.append("dir", opts.dir);
  if (opts.id) fd.append("taskId", opts.id);
  const token = await authToken();
  const res = await fetch("/api/upload", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: fd });
  const j = (await res.json().catch(() => ({}))) as Partial<UploadResult> & { error?: string };
  if (!res.ok || !j.url) throw new Error(j.error || "Falha no upload.");
  return { url: j.url, tipo: (j.tipo as UploadResult["tipo"]) || tipoDoArquivo(file), nome: j.nome || file.name, mime: j.mime || file.type };
}

/** Foto de perfil / logo → bucket público, devolvendo a URL (ou data-URL no modo demo). */
export async function uploadAvatar(file: File, dir: "usuarios" | "workspace" | "grupos", chave: string): Promise<string> {
  if (!temSupabase()) return (await uploadLocal(file)).url;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("dir", dir);
  fd.append("chave", chave);
  const token = await authToken();
  const res = await fetch("/api/avatar", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: fd });
  const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !j.url) throw new Error(j.error || "Falha no upload da imagem.");
  return j.url;
}

/** data-URL → File (para subir ao Storage uma imagem que a tela já redimensionou no navegador). */
export function dataUrlParaFile(dataUrl: string, nome = "imagem.jpg"): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] || "image/jpeg";
  const bin = atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], nome, { type: mime });
}
