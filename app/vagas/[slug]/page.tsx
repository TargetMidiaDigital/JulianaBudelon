import LinkBio from "@/components/linkbio/LinkBio";

/** Página pública de uma unidade: um botão por vaga aberta. */
export default async function VagasUnidade({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LinkBio view="unidade" slug={slug} />;
}
