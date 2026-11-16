import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { lerAcompanhamento } from "@/lib/encomendas-server";

/**
 * ROTA PÚBLICA (sem sessão, por design) — alimenta a página /pedido/[id], que o cliente recebe
 * pelo WhatsApp para acompanhar a encomenda. Só responde com o id completo do pedido (UUID) e
 * devolve só o necessário (primeiro nome, produto, data, loja e status).
 *  - GET ?id=<uuid> → { pedido: Acompanhamento } | 404
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try {
    const pedido = await lerAcompanhamento(sb, id);
    if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    return NextResponse.json({ pedido }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Falha ao carregar o pedido." }, { status: 500 });
  }
}
