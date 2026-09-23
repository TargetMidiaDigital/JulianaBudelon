import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth-admin";

/**
 * Proxy de mídia do bucket PRIVADO `task-anexos`. As tags <img>/<audio>/<video> e os
 * links de anexo não enviam Authorization (a sessão vive no localStorage), então
 * autentica por COOKIE `jb-at` (mantido em sincronia com o token no store) — ou
 * Bearer, se vier. Logado e da equipe → devolve o arquivo; senão → 401/403.
 */
export const dynamic = "force-dynamic";
const BUCKET = "task-anexos";

const EXT_DE_MIME: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/gif": "gif", "audio/ogg": "ogg", "audio/mpeg": "mp3", "video/mp4": "mp4",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function lerCookie(req: Request, nome: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const parte of raw.split(";")) {
    const eq = parte.indexOf("=");
    if (eq < 0) continue;
    if (parte.slice(0, eq).trim() === nome) return decodeURIComponent(parte.slice(eq + 1).trim());
  }
  return null;
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const sb = getSupabase();
  if (!sb) return new NextResponse("Storage indisponível", { status: 503 });

  const token = lerCookie(req, "jb-at") || (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const sess = await requireSession(req, sb, token);
  if (!sess.ok) return new NextResponse(sess.error, { status: sess.status });

  const { path: segs } = await params;
  const path = (segs ?? []).map((s) => decodeURIComponent(s)).join("/");
  if (!path || path.includes("..")) return new NextResponse("Caminho inválido", { status: 400 });

  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) return new NextResponse("Não encontrado", { status: 404 });

  const buf = Buffer.from(await data.arrayBuffer());
  const ct = data.type || "application/octet-stream";
  let nome = path.split("/").pop() || "arquivo";
  const ext = EXT_DE_MIME[ct];
  if (ext && !new RegExp(`\\.${ext}$`, "i").test(nome)) nome += `.${ext}`;
  const dl = new URL(req.url).searchParams.get("dl") === "1";
  const nomeSeguro = nome.replace(/["\\\r\n]/g, "");

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": ct,
      "content-disposition": `${dl ? "attachment" : "inline"}; filename="${nomeSeguro}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "content-length": String(buf.length),
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
