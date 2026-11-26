import { getSupabase } from "@/lib/supabase";
import { aparelhoDe, origemDe } from "@/lib/bio";

/**
 * Clique num botão do Link na Bio (rota pública): soma 1 no contador do botão, grava o clique
 * com data (relatório) e redireciona para o destino. Botão desligado ou inexistente volta para /bio.
 * Destino deste sistema ("/encomendar") vai como endereço relativo — atrás do proxy, req.url
 * pode ter o host interno do servidor.
 */
export const dynamic = "force-dynamic";

const ir = (location: string) => new Response(null, { status: 302, headers: { location, "cache-control": "no-store" } });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb || !/^[\w-]{1,60}$/.test(id)) return ir("/bio");
  const { data: url, error } = await sb.rpc("bio_clique", { link: id });
  if (error || typeof url !== "string" || !url) return ir("/bio");
  try {
    const ua = req.headers.get("user-agent") ?? "";
    await sb.from("bio_evento").insert({ link_id: id, tipo: "click", aparelho: aparelhoDe(ua), origem: origemDe(ua, req.headers.get("referer")) });
  } catch {
    // O relatório é extra: o visitante sempre segue para o destino.
  }
  return ir(url);
}
