import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { nivelNaTela, requireEditor, requireSession } from "@/lib/auth-admin";
import { AGENTE_RECRUTAMENTO, MODELO_RECRUTAMENTO_PADRAO, PDF_ENGINE_PADRAO, PDF_ENGINES, type AgenteConfigPublica, type GrupoResumo } from "@/lib/agente";

/**
 * Configuração do agente de RECRUTAMENTO (Recrutamento → Agente IA), linha `recrutamento`
 * de `agente_ia`. Mesmo desenho do /api/llm/config do Cachorrão HD: o TOKEN do OpenRouter é
 * write-only — nunca volta ao navegador, só o status "configurado".
 * Autorização pela matriz de Acessos, tela "recrutamento-agente": ver → GET; editar → POST.
 *  - GET  → { configurado, modelo, engine, prompt, ferramentas }
 *  - POST { token?, modelo?, engine?, prompt?, ferramentas?, notificarGrupos? } → { ok, ...config }
 *    (só grava o que vier). `notificarGrupos` = ids de whatsapp_grupos que recebem o aviso de
 *    currículo novo; a resposta traz `grupos` (cadastrados) para a tela montar a escolha.
 */
export const dynamic = "force-dynamic";

type Row = { prompt: string | null; openrouter_token: string | null; openrouter_modelo: string | null; pdf_engine: string | null; ferramentas: unknown; notificar_grupos: string[] | null };

async function ler(sb: NonNullable<ReturnType<typeof getSupabase>>): Promise<AgenteConfigPublica> {
  const [{ data }, { data: gs }] = await Promise.all([
    sb.from("agente_ia").select("prompt, openrouter_token, openrouter_modelo, pdf_engine, ferramentas, notificar_grupos").eq("slug", AGENTE_RECRUTAMENTO).maybeSingle(),
    sb.from("whatsapp_grupos").select("id, nome, grupo_id, ativo").order("created_at", { ascending: true }),
  ]);
  const r = data as Row | null;
  const ferr = (r?.ferramentas && typeof r.ferramentas === "object" ? r.ferramentas : {}) as Record<string, unknown>;
  const grupos = ((gs ?? []) as GrupoResumo[]).map((g) => ({ id: g.id, nome: g.nome, grupo_id: g.grupo_id, ativo: g.ativo !== false }));
  const ids = new Set(grupos.map((g) => g.id));
  return {
    configurado: Boolean((r?.openrouter_token ?? "").trim()),
    modelo: (r?.openrouter_modelo ?? "").trim() || MODELO_RECRUTAMENTO_PADRAO,
    engine: (r?.pdf_engine ?? "").trim() || PDF_ENGINE_PADRAO,
    prompt: (r?.prompt ?? "").trim(),
    ferramentas: Object.fromEntries(Object.entries(ferr).map(([k, v]) => [k, v !== false])),
    // Grupo excluído em Configurações → WhatsApp some daqui sozinho.
    notificarGrupos: (r?.notificar_grupos ?? []).filter((id) => ids.has(id)),
    grupos,
  };
}

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ demo: true });
  const sess = await requireSession(req, sb);
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  if ((await nivelNaTela(sb, sess.cargo, "recrutamento-agente")) === "nenhum") return NextResponse.json({ error: "Sem acesso a esta tela." }, { status: 403 });
  return NextResponse.json(await ler(sb));
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Disponível só com o Supabase ligado." }, { status: 503 });
  const sess = await requireEditor(req, sb, "recrutamento-agente");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const body = (await req.json().catch(() => ({}))) as { token?: string; modelo?: string; engine?: string; prompt?: string; ferramentas?: Record<string, unknown>; notificarGrupos?: unknown };

  const payload: Record<string, unknown> = { slug: AGENTE_RECRUTAMENTO, nome: "RECRUTAMENTO" };
  if (typeof body.token === "string" && body.token.trim()) payload.openrouter_token = body.token.trim();
  if (typeof body.modelo === "string" && body.modelo.trim()) payload.openrouter_modelo = body.modelo.trim().slice(0, 120);
  if (typeof body.engine === "string") {
    if (!PDF_ENGINES.some((e) => e.value === body.engine)) return NextResponse.json({ error: "Motor de PDF inválido." }, { status: 400 });
    payload.pdf_engine = body.engine;
  }
  // Prompt vazio é legítimo: volta ao padrão do código.
  if (typeof body.prompt === "string") payload.prompt = body.prompt.trim().slice(0, 20_000) || null;
  if (body.ferramentas && typeof body.ferramentas === "object") {
    const atual = (await ler(sb)).ferramentas;
    const novo: Record<string, boolean> = { ...atual };
    for (const [k, v] of Object.entries(body.ferramentas)) if (/^[a-z_]{1,40}$/.test(k)) novo[k] = v !== false;
    payload.ferramentas = novo;
  }
  if (Array.isArray(body.notificarGrupos)) {
    // Só ids que existem em whatsapp_grupos (a tela manda os escolhidos; o resto é descartado).
    const { data: gs } = await sb.from("whatsapp_grupos").select("id");
    const validos = new Set(((gs ?? []) as { id: string }[]).map((g) => g.id));
    payload.notificar_grupos = [...new Set(body.notificarGrupos.map(String).filter((id) => validos.has(id)))];
  }
  if (Object.keys(payload).length <= 2) return NextResponse.json({ error: "Nada para salvar." }, { status: 400 });

  const { error } = await sb.from("agente_ia").upsert(payload, { onConflict: "slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...(await ler(sb)) });
}
