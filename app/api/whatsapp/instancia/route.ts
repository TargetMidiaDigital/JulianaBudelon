import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth-admin";
import { getUazapiCreds, uazapiFetch } from "@/lib/whatsapp";

/**
 * Proxy server-side para a instância da Uazapi (status / conectar via QR / desconectar).
 * Evita CORS e mantém o token FORA do navegador: o cliente envia só a `action`.
 * Mesmo desenho do /api/uazapi do Cachorrão HD. Só Administrador. Ver https://docs.uazapi.com/
 */
export const dynamic = "force-dynamic";

const ACOES: Record<string, { method: "GET" | "POST"; path: string }> = {
  status: { method: "GET", path: "/instance/status" },
  connect: { method: "POST", path: "/instance/connect" },
  disconnect: { method: "POST", path: "/instance/disconnect" },
};

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Disponível só com o Supabase ligado." }, { status: 503 });
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return NextResponse.json({ error: adm.error }, { status: adm.status });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const acao = action ? ACOES[action] : undefined;
  if (!acao) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  const creds = await getUazapiCreds(sb);
  if (!creds) return NextResponse.json({ error: "Credenciais da Uazapi não configuradas." }, { status: 400 });
  try {
    const data = await uazapiFetch(creds, acao.path, acao.method, {});
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível contatar a Uazapi. Verifique a URL da API." }, { status: 502 });
  }
}
