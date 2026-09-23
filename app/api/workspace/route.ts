import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth-admin";

/**
 * Espaço de trabalho (Configurações → Empresa): nome e logo.
 *  - PATCH { nome?, logo? } → atualiza a linha única (id=1) de `workspace`. Só Administrador.
 */
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return NextResponse.json({ error: adm.error }, { status: adm.status });
  const body = (await req.json().catch(() => ({}))) as { nome?: string; logo?: string | null };
  const cols: Record<string, unknown> = {};
  if ("nome" in body) cols.nome = (body.nome ?? "").trim() || "Ju Budelon";
  if ("logo" in body) cols.logo = body.logo || null;
  if (!Object.keys(cols).length) return NextResponse.json({ persisted: true });
  const { error } = await sb.from("workspace").update(cols).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}
