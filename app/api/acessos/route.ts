import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth-admin";
import { CARGOS } from "@/lib/acesso";
import type { Cargo, NivelAcesso } from "@/lib/types";

/**
 * Acessos por cargo (Configurações → Acessos).
 *  - PATCH { acessos: { [cargo]: { [page]: nivel } }, escopoProprio: { [cargo]: bool } }
 *    → upsert em `cargo_acesso` (permitido + pode_editar) e `cargo_permissao`. Só Administrador.
 */
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return NextResponse.json({ error: adm.error }, { status: adm.status });

  const body = (await req.json().catch(() => ({}))) as { acessos?: Record<string, Record<string, NivelAcesso>>; escopoProprio?: Record<string, boolean> };

  const rows: { cargo: string; page: string; permitido: boolean; pode_editar: boolean }[] = [];
  for (const [cargo, pages] of Object.entries(body.acessos ?? {})) {
    if (!CARGOS.includes(cargo as Cargo) || cargo === "Administrador") continue;
    for (const [page, nivel] of Object.entries(pages ?? {})) {
      if (!page) continue;
      rows.push({ cargo, page, permitido: nivel !== "nenhum", pode_editar: nivel === "editar" });
    }
  }
  if (rows.length) {
    const { error } = await sb.from("cargo_acesso").upsert(rows, { onConflict: "cargo,page" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const escopos = Object.entries(body.escopoProprio ?? {})
    .filter(([cargo]) => CARGOS.includes(cargo as Cargo) && cargo !== "Administrador")
    .map(([cargo, v]) => ({ cargo, escopo_proprio: v === true }));
  if (escopos.length) {
    const { error } = await sb.from("cargo_permissao").upsert(escopos, { onConflict: "cargo" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ persisted: true });
}
