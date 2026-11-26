"use client";

import { useEffect, useState } from "react";
import { aparelhoDe, gravarBioDemo, lerBioDemo, origemDe, type BioDemo as Dados, type BioLink } from "@/lib/bio";
import BioView from "./BioView";

/** Modo demo (sem banco): a página pública lê o que o painel gravou neste navegador e conta visitas/cliques aqui. */
export default function BioDemo() {
  const [d, setD] = useState<Dados | null>(null);
  useEffect(() => { setD(lerBioDemo()); }, []);
  if (!d) return null;
  const registrar = (tipo: "view" | "click", l?: BioLink) => {
    const atual = lerBioDemo();
    const ev = { linkId: l?.id ?? null, tipo, aparelho: aparelhoDe(navigator.userAgent), origem: origemDe(navigator.userAgent, document.referrer), em: new Date().toISOString() };
    gravarBioDemo({ ...atual, eventos: [...atual.eventos, ev], links: l ? atual.links.map((x) => (x.id === l.id ? { ...x, cliques: x.cliques + 1 } : x)) : atual.links });
  };
  if (!d.pagina.publicada) return <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBE4E9" }}><b>Página indisponível</b></div>;
  return <BioView pagina={d.pagina} links={d.links} aoVisitar={() => registrar("view")} aoClicar={(l) => registrar("click", l)} />;
}
