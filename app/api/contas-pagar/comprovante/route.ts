import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { nivelNaTela, requireEditor, requireSession } from "@/lib/auth-admin";

/**
 * Comprovantes de Contas a Pagar (bucket PRIVADO `contas-pagar`).
 *  - POST multipart { file, contaId } → { path, nome, mime, tamanho, em, autor }  (nível "editar")
 *    Só guarda o arquivo; quem chama grava o comprovante na conta (PATCH /api/contas-pagar).
 *  - GET ?path=…[&dl=1] → o arquivo. Autentica por cookie `jb-at` (links e <img> não mandam
 *    Authorization) ou Bearer, e exige acesso à tela Contas a Pagar.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const BUCKET = "contas-pagar";
const MAX_BYTES = 20 * 1024 * 1024;
const TIPOS: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot >= 0 ? name.slice(0, dot) : name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "comprovante";
  const ext = (dot >= 0 ? name.slice(dot + 1) : "").replace(/[^a-zA-Z0-9]+/g, "").slice(0, 8).toLowerCase();
  return ext ? `${base}.${ext}` : base;
}

function lerCookie(req: Request, nome: string): string | null {
  for (const parte of (req.headers.get("cookie") ?? "").split(";")) {
    const eq = parte.indexOf("=");
    if (eq >= 0 && parte.slice(0, eq).trim() === nome) return decodeURIComponent(parte.slice(eq + 1).trim());
  }
  return null;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Storage não configurado." }, { status: 503 });
  const sess = await requireEditor(req, sb, "contas-pagar");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo acima de 20 MB." }, { status: 413 });
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mime = TIPOS[ext];
  if (!mime) return NextResponse.json({ error: "Envie PDF, JPG ou PNG." }, { status: 400 });
  const contaId = String(form?.get("contaId") ?? "").replace(/[^a-zA-Z0-9_-]+/g, "") || "sem-conta";
  const path = `${contaId}/${Date.now()}-${safeName(file.name)}`;
  const up = await sb.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: mime, upsert: false });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  return NextResponse.json({ path, nome: file.name.slice(0, 120), mime, tamanho: file.size, em: new Date().toISOString(), autor: sess.userId });
}

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return new NextResponse("Storage indisponível", { status: 503 });
  const token = lerCookie(req, "jb-at") || (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const sess = await requireSession(req, sb, token);
  if (!sess.ok) return new NextResponse(sess.error, { status: sess.status });
  if ((await nivelNaTela(sb, sess.cargo, "contas-pagar")) === "nenhum") return new NextResponse("Sem acesso.", { status: 403 });

  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "";
  if (!path || path.includes("..")) return new NextResponse("Caminho inválido", { status: 400 });
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) return new NextResponse("Não encontrado", { status: 404 });
  const buf = Buffer.from(await data.arrayBuffer());
  const nome = (path.split("/").pop() ?? "comprovante").replace(/^\d+-/, "").replace(/["\\\r\n]/g, "");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": data.type || "application/octet-stream",
      "content-disposition": `${url.searchParams.get("dl") === "1" ? "attachment" : "inline"}; filename="${nome}"`,
      "content-length": String(buf.length),
      "cache-control": "private, max-age=3600",
    },
  });
}

/** Remove um arquivo enviado e não usado (ex.: tirado do formulário antes de salvar). */
export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Storage não configurado." }, { status: 503 });
  const sess = await requireEditor(req, sb, "contas-pagar");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { path } = (await req.json().catch(() => ({}))) as { path?: string };
  if (!path || path.includes("..")) return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  // Só apaga se nenhuma conta usa o arquivo.
  const { data } = await sb.from("conta_pagar").select("id").contains("comprovantes", [{ path }]).limit(1);
  if (data?.length) return NextResponse.json({ ok: true, mantido: true });
  await sb.storage.from(BUCKET).remove([path]);
  return NextResponse.json({ ok: true });
}
