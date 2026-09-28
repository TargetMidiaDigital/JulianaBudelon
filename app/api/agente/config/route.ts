import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth-admin";
import { AGENTE_RECRUTAMENTO, MODELO_RECRUTAMENTO_PADRAO, PDF_ENGINE_PADRAO, PDF_ENGINES, type AgenteConfigPublica } from "@/lib/agente";

/**
 * Configuração do agente de RECRUTAMENTO (Configurações → Agente IA), linha `recrutamento`
 * de `agente_ia`. Mesmo desenho do /api/llm/config do Cachorrão HD: o TOKEN do OpenRouter é
 * write-only — nunca volta ao navegador, só o status "configurado". Só Administrador.
 *  - GET  → { configurado, modelo, engine, prompt, ferramentas }
 *  - POST { token?, modelo?, engine?, prompt?, ferramentas? } → { ok }  (só grava o que vier)
 */
export const dynamic = "force-dynamic";

type Row = { prompt: string | null; openrouter_token: string | null; openrouter_modelo: string | null; pdf_engine: string | null; ferramentas: unknown };

async function ler(sb: NonNullable<ReturnType<typeof getSupabase>>): Promise<AgenteConfigPublica> {
  const { data } = await sb.from("agente_ia").select("prompt, openrouter_token, openrouter_modelo, pdf_engine, ferramentas").eq("slug", AGENTE_RECRUTAMENTO).maybeSingle();
  const r = data as Row | null;
  const ferr = (r?.ferramentas && typeof r.ferramentas === "object" ? r.ferramentas : {}) as Record<string, unknown>;
  return {
    configurado: Boolean((r?.openrouter_token ?? "").trim()),
    modelo: (r?.openrouter_modelo ?? "").trim() || MODELO_RECRUTAMENTO_PADRAO,
    engine: (r?.pdf_engine ?? "").trim() || PDF_ENGINE_PADRAO,
    prompt: (r?.prompt ?? "").trim(),
    ferramentas: Object.fromEntries(Object.entries(ferr).map(([k, v]) => [k, v !== false])),
  };
}

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ demo: true });
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return NextResponse.json({ error: adm.error }, { status: adm.status });
  return NextResponse.json(await ler(sb));
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Disponível só com o Supabase ligado." }, { status: 503 });
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return NextResponse.json({ error: adm.error }, { status: adm.status });
  const body = (await req.json().catch(() => ({}))) as { token?: string; modelo?: string; engine?: string; prompt?: string; ferramentas?: Record<string, unknown> };

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
  if (Object.keys(payload).length <= 2) return NextResponse.json({ error: "Nada para salvar." }, { status: 400 });

  const { error } = await sb.from("agente_ia").upsert(payload, { onConflict: "slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...(await ler(sb)) });
}
