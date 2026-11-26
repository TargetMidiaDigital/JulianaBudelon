import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { lerBio } from "@/lib/bio-server";
import BioView from "@/components/bio/BioView";
import BioDemo from "@/components/bio/BioDemo";

/**
 * PÁGINA PÚBLICA "Link na Bio" (sem login, por design) — o link que vai no Instagram.
 * Lida no servidor: só a página publicada e os botões ativos; cada botão passa por /bio/l/<id>
 * (contador de cliques). Sem banco (modo demo), lê o que o painel gravou neste navegador.
 */
export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
  const sb = getSupabase();
  const d = sb ? await lerBio(sb, true).catch(() => null) : null;
  const titulo = d?.pagina.titulo || "Ju Budelon";
  const img = d?.pagina.avatar?.startsWith("https://") ? [d.pagina.avatar] : undefined;
  return { title: titulo, description: d?.pagina.bio || undefined, openGraph: { title: titulo, description: d?.pagina.bio || undefined, images: img }, robots: { index: true, follow: true } };
}

export default async function BioPublica() {
  const sb = getSupabase();
  if (!sb) return <BioDemo />;
  const d = await lerBio(sb, true).catch(() => null);
  if (!d || !d.pagina.publicada) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", background: "#FBE4E9", color: "#2B1F24" }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Página indisponível</p>
          <p style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>Volte em breve.</p>
        </div>
      </div>
    );
  }
  return <BioView pagina={d.pagina} links={d.links} baseLink="/bio/l/" />;
}
