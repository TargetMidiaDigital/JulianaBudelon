import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth-admin";

/**
 * Upload de mídia/arquivo para o Supabase Storage (bucket privado `task-anexos`).
 * Usado pelos comentários ricos (imagem/vídeo/áudio inline) e pelos anexos de candidato.
 *  - POST multipart/form-data { file, taskId?, dir? } → { url, tipo, nome, mime }
 *    tipo: "image" | "video" | "audio" | "file". dir namespaceia o caminho (default "tarefas").
 * A URL devolvida é o proxy autenticado /api/anexo/<caminho> (bucket privado).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "task-anexos";
const MAX_BYTES = 50 * 1024 * 1024;
const DOC_EXT = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods", "odp", "zip"]);
const AUDIO_EXT = new Set(["mp3", "m4a", "aac", "ogg", "opus", "wav", "flac"]);

function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot >= 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "arquivo";
  const ext = (dot >= 0 ? name.slice(dot + 1) : "").replace(/[^a-zA-Z0-9]+/g, "").slice(0, 8).toLowerCase();
  return ext ? `${base}.${ext}` : base;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Storage não configurado." }, { status: 503 });
  const sess = await requireSession(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo acima de 50 MB." }, { status: 413 });
  const ct = file.type || "application/octet-stream";
  const buf = Buffer.from(await file.arrayBuffer());
  const fname = file.name;

  const isImage = ct.startsWith("image/");
  const isVideo = ct.startsWith("video/");
  const ext = (fname.split(".").pop() ?? "").toLowerCase();
  const isDoc = ct === "application/pdf" || ct === "text/plain" || ct === "text/csv" || DOC_EXT.has(ext);
  const isAudio = ct.startsWith("audio/") || AUDIO_EXT.has(ext);
  if (!isImage && !isVideo && !isDoc && !isAudio) return NextResponse.json({ error: "Tipo de arquivo não suportado." }, { status: 400 });
  const tipo = isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "file";

  const taskId = String(form?.get("taskId") ?? "").replace(/[^a-zA-Z0-9_-]+/g, "") || "misc";
  const dir = String(form?.get("dir") ?? "tarefas").replace(/[^a-zA-Z0-9_-]+/g, "") || "tarefas";
  const path = `${dir}/${taskId}/${Date.now()}-${safeName(fname || tipo)}`;

  const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: false });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  return NextResponse.json({ url: "/api/anexo/" + path, tipo, nome: safeName(fname || tipo), mime: ct });
}
