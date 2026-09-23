import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { linkbioDe, unidadeDe, vagaDe, type UnidadeRow, type VagaRow } from "@/lib/data";

/**
 * ROTA PÚBLICA (sem sessão, por design) — alimenta a página /vagas.
 * Só devolve unidades ATIVAS e vagas ABERTAS (id, unidade, título, turno), os textos
 * da página (com o Pixel) e nome/logo da empresa. Nenhum dado de candidato.
 * Sem Supabase → { demo:true } e a página usa o localStorage (fase 1).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ demo: true });
  const [{ data: us }, { data: vs }, { data: ws }] = await Promise.all([
    sb.from("unidade").select("*").eq("ativa", true).order("criada", { ascending: true }),
    sb.from("vaga").select("id, unidade_id, titulo, turno, ativa, criada").eq("ativa", true).order("criada", { ascending: true }),
    sb.from("workspace").select("nome, logo, vagas_pagina").eq("id", 1).maybeSingle(),
  ]);
  const w = ws as { nome?: string | null; logo?: string | null; vagas_pagina?: unknown } | null;
  const unidades = ((us ?? []) as UnidadeRow[]).map(unidadeDe);
  const vagas = ((vs ?? []) as VagaRow[]).map((r) => { const v = vagaDe({ ...r, descricao: null }); return { id: v.id, unidadeId: v.unidadeId, titulo: v.titulo, turno: v.turno ?? "", ativa: true }; });
  return NextResponse.json(
    { demo: false, unidades, vagas, pagina: linkbioDe(w?.vagas_pagina), empresa: { nome: w?.nome ?? "", logo: w?.logo ?? null } },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
