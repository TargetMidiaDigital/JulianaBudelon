import type { Metadata } from "next";
import AcompanharPedido from "@/components/encomendas/AcompanharPedido";

/**
 * Página pública de acompanhamento da encomenda (sem login), enviada ao cliente pelo WhatsApp:
 * status no estilo app de delivery, foto e dados do pedido. O id (UUID) é a "chave" do link.
 */
export const metadata: Metadata = {
  title: "Acompanhe seu pedido | Ju Budelon",
  description: "Status da sua encomenda Ju Budelon",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AcompanharPedido id={decodeURIComponent(id)} />;
}
