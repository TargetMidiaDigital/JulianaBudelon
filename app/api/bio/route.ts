import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { nivelNaTela, requireSession } from "@/lib/auth-admin";
import { lerBio } from "@/lib/bio-server";
import { linkEntradaDe, paginaDe } from "@/lib/bio";

/**
 * Marketing → Link na Bio (painel). Ver: nível "ver" na tela; gravar: "editar".
 *  - GET                     → { pagina, links, podeEditar }
 *  - GET ?dias=30            → { eventos } do período (relatório)
 *  - PATCH { pagina }        → salva perfil/cores/pixel (mescla com o salvo)
 *  - POST  { link }          → cria botão (vai para o fim da lista)
 *  - PATCH { id, link }      → edita botão
 *  - PATCH { ordem: [ids] }  → reordena
 *  - DELETE { id }           → exclui botão (os eventos ficam, sem o vínculo)
 */
export const dynamic = "force-dynamic";
const PAGE = "marketing-linkbio" as const;
/** No banco, imagem é sempre URL do Storage (data-URL é só do modo demo). */
const semDataUrl = (v: string | null) => (v && v.startsWith("data:") ? null : v);

async function acesso(req: Request, sb: NonNullable<ReturnType<typeof getSupabase>>, editar: boolean) {
  const s = await requireSession(req, sb);
  if (!s.ok) return s;
  const nivel = await nivelNaTela(sb, s.cargo, PAGE);
  if (nivel === "nenhum" || (editar && nivel !== "editar")) return { ok: false as const, status: 403, error: "Sem permissão no Link na Bio." };
  return { ...s, podeEditar: nivel === "editar" };
}

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ demo: true });
  const s = await acesso(req, sb, false);
  if (!s.ok) return NextResponse.json({ error: s.error }, { status: s.status });
  const dias = Number(new URL(req.url).searchParams.get("dias") || 0);
  if (dias > 0) {
    const desde = new Date(Date.now() - Math.min(dias, 366) * 86_400_000).toISOString();
    const eventos: unknown[] = [];
    for (let de = 0; de < 50_000; de += 1000) {
      const { data, error } = await sb.from("bio_evento").select("link_id, tipo, aparelho, origem, em").gte("em", desde).order("em").range(de, de + 999);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      eventos.push(...(data ?? []).map((r) => ({ linkId: r.link_id, tipo: r.tipo, aparelho: r.aparelho, origem: r.origem, em: r.em })));
      if (!data || data.length < 1000) break;
    }
    return NextResponse.json({ eventos });
  }
  const bio = await lerBio(sb);
  if (!bio) return NextResponse.json({ error: "Link na Bio ainda não instalado no banco (migração 0036)." }, { status: 503 });
  return NextResponse.json({ ...bio, podeEditar: s.podeEditar });
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const s = await acesso(req, sb, true);
  if (!s.ok) return NextResponse.json({ error: s.error }, { status: s.status });
  const body = (await req.json().catch(() => ({}))) as { link?: unknown; id?: string };
  const l = linkEntradaDe(body.link);
  if (!l) return NextResponse.json({ error: "Informe o título e um link válido." }, { status: 400 });
  const { data: ult } = await sb.from("bio_link").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
  const id = typeof body.id === "string" && /^[\w-]{4,60}$/.test(body.id) ? body.id : `bio-${Date.now()}`;
  const { error } = await sb.from("bio_link").insert({
    id, titulo: l.titulo, subtitulo: l.subtitulo, url: l.url, imagem: semDataUrl(l.imagem), ativo: l.ativo, evento_meta: l.eventoMeta,
    ordem: ((ult as { ordem?: number } | null)?.ordem ?? -1) + 1,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true, id });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const s = await acesso(req, sb, true);
  if (!s.ok) return NextResponse.json({ error: s.error }, { status: s.status });
  const body = (await req.json().catch(() => ({}))) as { pagina?: unknown; id?: string; link?: Record<string, unknown>; ordem?: unknown };

  if (body.pagina && typeof body.pagina === "object") {
    const { data: atual } = await sb.from("bio_pagina").select("dados").eq("id", 1).maybeSingle();
    const mesclada = paginaDe({ ...paginaDe((atual as { dados?: unknown } | null)?.dados), ...(body.pagina as object) });
    const dados = { ...mesclada, avatar: semDataUrl(mesclada.avatar), capa: semDataUrl(mesclada.capa) };
    const { error } = await sb.from("bio_pagina").upsert({ id: 1, dados, atualizada: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ persisted: true, pagina: dados });
  }

  if (Array.isArray(body.ordem)) {
    const ids = body.ordem.filter((x): x is string => typeof x === "string").slice(0, 200);
    const r = await Promise.all(ids.map((id, i) => sb.from("bio_link").update({ ordem: i }).eq("id", id)));
    const erro = r.find((x) => x.error)?.error;
    if (erro) return NextResponse.json({ error: erro.message }, { status: 500 });
    return NextResponse.json({ persisted: true });
  }

  if (body.id && body.link) {
    // Só ligar/desligar (atalho da lista) ou a edição completa do botão.
    const so = Object.keys(body.link);
    let cols: Record<string, unknown>;
    if (so.length === 1 && so[0] === "ativo") cols = { ativo: body.link.ativo !== false };
    else {
      const l = linkEntradaDe(body.link);
      if (!l) return NextResponse.json({ error: "Informe o título e um link válido." }, { status: 400 });
      cols = { titulo: l.titulo, subtitulo: l.subtitulo, url: l.url, imagem: semDataUrl(l.imagem), ativo: l.ativo, evento_meta: l.eventoMeta };
    }
    const { error } = await sb.from("bio_link").update(cols).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ persisted: true });
  }
  return NextResponse.json({ error: "Nada para salvar." }, { status: 400 });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const s = await acesso(req, sb, true);
  if (!s.ok) return NextResponse.json({ error: s.error }, { status: s.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const { error } = await sb.from("bio_link").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}
