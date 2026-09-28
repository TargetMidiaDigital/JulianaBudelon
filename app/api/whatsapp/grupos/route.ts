import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth-admin";
import { normalizarJid, normalizarSetores } from "@/lib/grupo";
import { sendText, TEXTO_TESTE_GRUPO } from "@/lib/whatsapp";

/**
 * CRUD dos grupos de WhatsApp que recebem as notificações automáticas (Configurações →
 * WhatsApp → Grupos). Tudo passa por aqui (service role): `whatsapp_grupos` tem RLS sem
 * policy. Mesmo desenho do /api/grupos do Cachorrão HD. Só Administrador.
 *  - GET                                → { grupos }
 *  - POST { nome, grupo_id, setores? }  → { grupo }   |  POST { acao:"testar", grupo_id } → envia teste
 *  - PATCH { id, nome?, grupo_id?, ativo?, setores? } → { grupo }
 *  - DELETE ?id=                        → { ok }
 */
export const dynamic = "force-dynamic";

const CAMPOS = "id, nome, grupo_id, ativo, setores, created_at";

async function autenticar(req: Request) {
  const sb = getSupabase();
  if (!sb) return { erro: NextResponse.json({ error: "Disponível só com o Supabase ligado." }, { status: 503 }) };
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return { erro: NextResponse.json({ error: adm.error }, { status: adm.status }) };
  return { sb };
}

export async function GET(req: Request) {
  const { sb, erro } = await autenticar(req);
  if (erro) return erro;
  const { data, error } = await sb!.from("whatsapp_grupos").select(CAMPOS).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grupos: data ?? [] });
}

export async function POST(req: Request) {
  const { sb, erro } = await autenticar(req);
  if (erro) return erro;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // "Enviar teste": não grava nada, só prova que o JID recebe mensagem.
  if (body.acao === "testar") {
    const jid = normalizarJid(body.grupo_id);
    if (!jid) return NextResponse.json({ error: "ID do grupo inválido." }, { status: 400 });
    try {
      await sendText(sb!, jid, TEXTO_TESTE_GRUPO);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao enviar o teste." }, { status: 502 });
    }
  }

  const nome = String(body.nome ?? "").trim();
  if (nome.length < 2) return NextResponse.json({ error: "Informe o nome do grupo." }, { status: 400 });
  const jid = normalizarJid(body.grupo_id);
  if (!jid) return NextResponse.json({ error: "ID do grupo inválido. Use o JID (ex.: 120363...@g.us)." }, { status: 400 });
  const { data, error } = await sb!.from("whatsapp_grupos").insert({ nome, grupo_id: jid, setores: normalizarSetores(body.setores) }).select(CAMPOS).single();
  if (error?.code === "23505") return NextResponse.json({ error: "Esse grupo já está cadastrado." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grupo: data });
}

export async function PATCH(req: Request) {
  const { sb, erro } = await autenticar(req);
  if (erro) return erro;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id ausente." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof body.nome === "string") {
    const nome = body.nome.trim();
    if (nome.length < 2) return NextResponse.json({ error: "Informe o nome do grupo." }, { status: 400 });
    patch.nome = nome;
  }
  if (body.grupo_id !== undefined) {
    const jid = normalizarJid(body.grupo_id);
    if (!jid) return NextResponse.json({ error: "ID do grupo inválido." }, { status: 400 });
    patch.grupo_id = jid;
  }
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;
  if (body.setores !== undefined) patch.setores = normalizarSetores(body.setores);
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nada para salvar." }, { status: 400 });
  const { data, error } = await sb!.from("whatsapp_grupos").update(patch).eq("id", id).select(CAMPOS).single();
  if (error?.code === "23505") return NextResponse.json({ error: "Esse grupo já está cadastrado." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grupo: data });
}

export async function DELETE(req: Request) {
  const { sb, erro } = await autenticar(req);
  if (erro) return erro;
  const id = String(new URL(req.url).searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "id ausente." }, { status: 400 });
  const { error } = await sb!.from("whatsapp_grupos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
