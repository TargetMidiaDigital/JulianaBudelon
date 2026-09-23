import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireEditor } from "@/lib/auth-admin";
import { linkbioDe } from "@/lib/data";
import type { LinkBioConfig, Vaga } from "@/lib/types";

/**
 * Vagas (Recrutamento → Vagas, tabela `vaga`) + textos da página pública
 * (workspace.vagas_pagina).
 *  - POST   { vaga }        → cria (id vem do cliente)
 *  - PATCH  { id, patch }   → atualiza a vaga  |  PATCH { pagina } → salva os textos/pixel
 *  - DELETE { id }          → remove (candidatos ficam, perdem só o vínculo)
 */
export const dynamic = "force-dynamic";

function mapCols(p: Partial<Vaga>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if ("unidadeId" in p) c.unidade_id = p.unidadeId;
  if ("titulo" in p) c.titulo = (p.titulo ?? "").trim();
  if ("turno" in p) c.turno = p.turno === "Diurno" || p.turno === "Noturno" ? p.turno : "";
  if ("descricao" in p) c.descricao = (p.descricao ?? "").trim() || null;
  if ("ativa" in p) c.ativa = p.ativa !== false;
  return c;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "recrutamento-vagas");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { vaga } = (await req.json().catch(() => ({}))) as { vaga?: Vaga };
  if (!vaga?.id || !vaga.unidadeId || !vaga.titulo?.trim()) return NextResponse.json({ error: "id, unidadeId e título são obrigatórios." }, { status: 400 });
  const { error } = await sb.from("vaga").insert({ id: vaga.id, ...mapCols(vaga), criada: vaga.criada ?? new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "recrutamento-vagas");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const body = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<Vaga>; pagina?: Partial<LinkBioConfig> };

  if (body.pagina) {
    // Mescla com o que já está salvo (o cliente manda só o que mudou).
    const { data: ws } = await sb.from("workspace").select("vagas_pagina").eq("id", 1).maybeSingle();
    const atual = linkbioDe((ws as { vagas_pagina?: unknown } | null)?.vagas_pagina);
    const pagina = linkbioDe({ ...atual, ...body.pagina });
    const { error } = await sb.from("workspace").update({ vagas_pagina: pagina }).eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ persisted: true, pagina });
  }

  if (!body.id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const cols = mapCols(body.patch ?? {});
  if (typeof cols.titulo === "string" && !cols.titulo) return NextResponse.json({ error: "Informe o título da vaga." }, { status: 400 });
  if (Object.keys(cols).length === 0) return NextResponse.json({ persisted: true });
  const { error } = await sb.from("vaga").update(cols).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Renomear a vaga renomeia o rótulo nos candidatos vinculados.
  if (typeof cols.titulo === "string") await sb.from("talento").update({ vaga: cols.titulo }).eq("vaga_id", body.id);
  return NextResponse.json({ persisted: true });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "recrutamento-vagas");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const { error } = await sb.from("vaga").delete().eq("id", id); // talento.vaga_id → set null (FK)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}
