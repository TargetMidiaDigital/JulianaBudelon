import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { criarPedidoPublico, lerCatalogo, lerConfig } from "@/lib/encomendas-server";
import type { NovoPedido } from "@/lib/encomendas-base";

/**
 * ROTA PÚBLICA (sem sessão, por design) — alimenta a página /encomendar.
 *  - GET  → { categorias, produtos (só ativos), config }   (nenhum dado de cliente nem de pedido)
 *  - POST { pedido } → { pedido }   o servidor recalcula o preço, confere loja, horário e antecedência
 *    (lib/encomendas-base validarNovoPedido), acha/cria o contato pelo WhatsApp e grava em
 *    "Verificar pagamento". Erro de validação → 400 com a mensagem para o cliente.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  try {
    const [catalogo, config] = await Promise.all([lerCatalogo(sb, true), lerConfig(sb)]);
    return NextResponse.json({ ...catalogo, config }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao carregar." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { pedido?: NovoPedido };
  const n = body.pedido;
  if (!n || typeof n !== "object") return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const e = n.endereco && typeof n.endereco === "object" ? n.endereco : undefined;
  const r = await criarPedidoPublico(sb, {
    produtoId: String(n.produtoId ?? ""), quantidade: Number(n.quantidade), mensagem: typeof n.mensagem === "string" ? n.mensagem : undefined,
    tipo: n.tipo, unidadeId: typeof n.unidadeId === "string" ? n.unidadeId : undefined,
    endereco: e ? {
      cidade: String(e.cidade ?? "").slice(0, 80), bairro: String(e.bairro ?? "").slice(0, 80), rua: String(e.rua ?? "").slice(0, 120),
      numero: String(e.numero ?? "").slice(0, 20), complemento: e.complemento ? String(e.complemento).slice(0, 200) : undefined,
    } : undefined,
    data: String(n.data ?? ""), hora: String(n.hora ?? ""), nome: String(n.nome ?? ""), whatsapp: String(n.whatsapp ?? ""),
  });
  if ("erro" in r) return NextResponse.json({ error: r.erro }, { status: 400 });
  return NextResponse.json(r);
}
