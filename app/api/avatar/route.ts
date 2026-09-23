import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth-admin";

/**
 * Imagens PÚBLICAS pequenas (foto de perfil, logo da empresa, logo de grupo) →
 * bucket público `avatars`, devolvendo a URL. A coluna guarda só a URL; a imagem sai
 * do CDN do storage com cache no navegador (nada de base64 no banco).
 *
 *  - POST multipart { file, dir: "usuarios" | "workspace" | "grupos", chave } → { url }
 *  Permissão: a própria pessoa (dir=usuarios, chave = seu id) ou Administrador.
 */
export const dynamic = "force-dynamic";

const BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024;
const DIRS = new Set(["usuarios", "workspace", "grupos"]);

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Storage não configurado." }, { status: 503 });
  const sess = await requireSession(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const dir = String(form?.get("dir") ?? "").trim();
  const chave = String(form?.get("chave") ?? "").replace(/[^a-zA-Z0-9_-]+/g, "");
  if (!(file instanceof File) || !DIRS.has(dir) || !chave) return NextResponse.json({ error: "Arquivo, dir e chave são obrigatórios." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Envie uma imagem." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Imagem acima de 2 MB." }, { status: 413 });

  const proprio = dir === "usuarios" && chave === sess.userId;
  if (!proprio && sess.cargo !== "Administrador") return NextResponse.json({ error: "Só o Administrador altera esta imagem." }, { status: 403 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${dir}/${chave}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type, upsert: true, cacheControl: "31536000" });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  // `?v=` quebra o cache quando a imagem é trocada — o caminho é sempre o mesmo.
  const url = `${sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  return NextResponse.json({ url });
}
