"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { css } from "@/lib/css";
import { ACCENT } from "@/lib/theme";
import { GUIAS, SETORES_TREINAMENTO, type Bloco, type Guia } from "@/lib/treinamentos";
import { useApp } from "../store";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Fluxograma from "../ui/Fluxograma";
import { useIsMobile } from "@/lib/useIsMobile";

/**
 * Treinamentos → Guias de processo. Índice por setor à esquerda e o guia aberto à direita.
 * Cada pessoa vê os guias das telas que pode acessar (a Visão geral é para todos). O guia
 * aberto fica na URL (?guia=) para mandar o link direto.
 */
export default function Treinamentos() {
  const { canAccessPage, goto } = useApp();
  const guias = useMemo(() => GUIAS.filter((g) => !g.page || g.setor === "Visão geral" || canAccessPage(g.page)), [canAccessPage]);
  const [atual, setAtual] = useState<string>(() => {
    const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("guia") : null;
    return q && GUIAS.some((g) => g.id === q) ? q : GUIAS[0].id;
  });
  const guia = guias.find((g) => g.id === atual) ?? guias[0];
  const mobile = useIsMobile();
  const [indiceAberto, setIndiceAberto] = useState(false); // celular: índice recolhido
  const escolher = (id: string) => { setAtual(id); setIndiceAberto(false); };
  const i = guias.indexOf(guia);

  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("guia", guia.id);
      window.history.replaceState(null, "", u.toString());
    } catch { /* noop */ }
    document.querySelector(".m-screens")?.scrollTo({ top: 0 });
  }, [guia.id]);

  return (
    <div style={css("height:100%; display:flex; flex-direction:column; min-height:0;")}>
      <div className="m-pad" style={css("padding:24px 30px 14px;")}>
        <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Treinamentos</h1>
        <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>Guias de como cada processo funciona no sistema · {guias.length} guias</p>
      </div>

      <div className="m-pad tr-grid" style={css("display:grid; grid-template-columns:270px minmax(0,1fr); gap:16px; padding:0 30px 30px; align-items:start;")}>
        {/* Índice */}
        <nav style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:10px; position:sticky; top:12px;")}>
          {mobile && (
            <button onClick={() => setIndiceAberto((v) => !v)} style={css("width:100%; display:flex; align-items:center; gap:10px; border:none; background:transparent; cursor:pointer; padding:6px 6px; text-align:left;")}>
              <span style={css("flex:1; min-width:0;")}>
                <span style={css("display:block; font-size:11px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; color:#9398A6;")}>Guia {guias.indexOf(guia) + 1} de {guias.length}</span>
                <span style={css(`display:block; font-size:14px; font-weight:800; color:${ACCENT};`)}>{guia.titulo}</span>
              </span>
              <span style={css("font-size:12px; font-weight:700; color:#5B6472; flex:none;")}>{indiceAberto ? "Fechar" : "Ver todos"}</span>
              <Svg size={14} sw={2.4} stroke="#9398A6" style={{ transform: indiceAberto ? "rotate(180deg)" : "none", flex: "none" }}><path d="m6 9 6 6 6-6" /></Svg>
            </button>
          )}
          {(!mobile || indiceAberto) && SETORES_TREINAMENTO.map((setor) => {
            const doSetor = guias.filter((g) => g.setor === setor);
            if (!doSetor.length) return null;
            return (
              <div key={setor} style={{ marginBottom: 6 }}>
                <div style={css("font-size:11px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; color:#9398A6; padding:8px 8px 4px;")}>{setor}</div>
                {doSetor.map((g) => {
                  const on = g.id === guia.id;
                  return (
                    <Hoverable key={g.id} as="button" onClick={() => escolher(g.id)} s={css(`display:block; width:100%; text-align:left; border:none; cursor:pointer; font-size:13px; font-weight:${on ? 800 : 600}; color:${on ? ACCENT : "#3A3F4C"}; background:${on ? "#FDF1F4" : "transparent"}; padding:8px 10px; border-radius:8px; line-height:1.35;`)} hover={on ? undefined : "background:#F6F7F9"}>
                      {g.titulo}
                    </Hoverable>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Guia */}
        <article style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:24px 28px; min-width:0;")}>
          <div style={css("display:flex; align-items:flex-start; gap:14px; flex-wrap:wrap; margin-bottom:18px; padding-bottom:18px; border-bottom:1px solid #F0F1F4;")}>
            <div style={css("flex:1 1 300px; min-width:0;")}>
              <div style={css(`font-size:11.5px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; color:${ACCENT};`)}>{guia.setor}</div>
              <h2 style={css("margin:4px 0 6px; font-size:21px; font-weight:800; letter-spacing:-0.4px; color:#1B1B28;")}>{guia.titulo}</h2>
              <p style={css("margin:0; font-size:14px; color:#5B6472; line-height:1.55;")}>{guia.resumo}</p>
              {guia.quem && <div style={css("margin-top:10px; font-size:12.5px; color:#7A8090; font-weight:600;")}>Quem usa: <span style={css("color:#3A3F4C; font-weight:700;")}>{guia.quem}</span></div>}
            </div>
            {guia.page && canAccessPage(guia.page) && (
              <Hoverable as="button" onClick={() => goto(guia.page!)} s={css(`display:inline-flex; align-items:center; gap:7px; border:1px solid ${ACCENT}; background:#fff; color:${ACCENT}; cursor:pointer; font-size:13px; font-weight:700; padding:9px 14px; border-radius:10px; flex:none;`)} hover="background:#FDF1F4">
                Abrir a tela<Svg size={14} sw={2.4}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
              </Hoverable>
            )}
          </div>

          <div style={css("display:flex; flex-direction:column; gap:22px;")}>
            {guia.blocos.map((b, k) => <BlocoView key={k} b={b} />)}
          </div>

          <div style={css("display:flex; gap:10px; margin-top:28px; padding-top:16px; border-top:1px solid #F0F1F4;")}>
            {i > 0 && <Navega lado="ant" g={guias[i - 1]} onClick={() => setAtual(guias[i - 1].id)} />}
            <span style={{ flex: 1 }} />
            {i < guias.length - 1 && <Navega lado="prox" g={guias[i + 1]} onClick={() => setAtual(guias[i + 1].id)} />}
          </div>
        </article>
      </div>
      <style>{`@media (max-width: 900px) { .tr-grid { grid-template-columns: minmax(0,1fr) !important; } .tr-grid nav { position: static !important; } .tr-grid article { padding: 18px 16px !important; } }`}</style>
    </div>
  );
}

function Navega({ lado, g, onClick }: { lado: "ant" | "prox"; g: Guia; onClick: () => void }) {
  return (
    <Hoverable as="button" onClick={onClick} s={css(`display:flex; flex-direction:column; align-items:${lado === "ant" ? "flex-start" : "flex-end"}; gap:2px; border:1px solid #ECEDF1; background:#fff; cursor:pointer; padding:10px 14px; border-radius:10px; max-width:48%; text-align:${lado === "ant" ? "left" : "right"};`)} hover="background:#FAFAFB">
      <span style={css("font-size:11px; font-weight:700; color:#9398A6;")}>{lado === "ant" ? "← Anterior" : "Próximo →"}</span>
      <span style={css("font-size:13px; font-weight:700; color:#3A3F4C;")}>{g.titulo}</span>
    </Hoverable>
  );
}

const Titulo = ({ children }: { children: ReactNode }) => <h3 style={css("margin:0 0 10px; font-size:15px; font-weight:800; color:#1B1B28; letter-spacing:-0.2px;")}>{children}</h3>;

function BlocoView({ b }: { b: Bloco }) {
  if (b.tipo === "diagrama") {
    return (
      <section>
        <Titulo>{b.titulo ?? "Fluxo do processo"}</Titulo>
        <Fluxograma d={b} />
      </section>
    );
  }
  if (b.tipo === "dica" || b.tipo === "atencao") {
    const dica = b.tipo === "dica";
    return (
      <div style={css(`display:flex; gap:10px; align-items:flex-start; background:${dica ? "#EEF8F2" : "#FFF6E5"}; border:1px solid ${dica ? "#CBEBD7" : "#F5DFAE"}; border-radius:12px; padding:12px 14px;`)}>
        <span style={css(`flex:none; display:flex; color:${dica ? "#1B7F4D" : "#B45309"}; margin-top:1px;`)}>
          {dica
            ? <Svg size={16}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></Svg>
            : <Svg size={16}><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></Svg>}
        </span>
        <div style={css(`font-size:13.5px; line-height:1.55; color:${dica ? "#1E5136" : "#7A4A0C"};`)}><strong>{dica ? "Dica: " : "Atenção: "}</strong>{b.texto}</div>
      </div>
    );
  }
  if (b.tipo === "fluxo") {
    return (
      <section>
        {b.titulo && <Titulo>{b.titulo}</Titulo>}
        <ol style={css("list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit, minmax(128px, 1fr)); gap:10px;")}>
          {b.itens.map((it, n) => (
            <li key={it.rotulo} style={css("position:relative; background:#FAFAFB; border:1px solid #ECEDF1; border-radius:12px; padding:12px;")}>
              <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:6px;")}>
                <span style={css(`width:22px; height:22px; border-radius:50%; background:${ACCENT}; color:#fff; font-size:11.5px; font-weight:800; display:flex; align-items:center; justify-content:center; flex:none;`)}>{n + 1}</span>
                <span style={css("font-size:13px; font-weight:800; color:#1B1B28;")}>{it.rotulo}</span>
              </div>
              <div style={css("font-size:12.5px; color:#5B6472; line-height:1.5;")}>{it.texto}</div>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  if (b.tipo === "passos") {
    return (
      <section>
        <Titulo>{b.titulo}</Titulo>
        <ol style={css("list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px;")}>
          {b.itens.map((t, n) => (
            <li key={n} style={css("display:flex; gap:12px; align-items:flex-start;")}>
              <span style={css(`width:24px; height:24px; border-radius:50%; background:#FDF1F4; color:${ACCENT}; border:1px solid #F1D5DD; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; flex:none;`)}>{n + 1}</span>
              <span style={css("font-size:13.5px; color:#3A3F4C; line-height:1.55; padding-top:2px;")}>{t}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  if (b.tipo === "status") {
    return (
      <section>
        <Titulo>{b.titulo}</Titulo>
        <div style={css("border:1px solid #ECEDF1; border-radius:12px; overflow:hidden;")}>
          {b.itens.map((it, n) => (
            <div key={it.rotulo} className="tr-linha" style={css(`display:grid; grid-template-columns:190px minmax(0,1fr); gap:12px; align-items:center; padding:10px 14px; ${n ? "border-top:1px solid #F0F1F4;" : ""}`)}>
              <span style={css(`justify-self:start; display:inline-flex; align-items:center; gap:6px; background:${it.cor}1A; color:${it.cor}; font-size:12px; font-weight:800; padding:4px 10px; border-radius:999px; filter:brightness(.85);`)}>
                <span style={css(`width:7px; height:7px; border-radius:50%; background:${it.cor};`)} />{it.rotulo}
              </span>
              <span style={css("font-size:13px; color:#3A3F4C; line-height:1.5;")}>{it.texto}</span>
            </div>
          ))}
        </div>
        <style>{`@media (max-width: 600px) { .tr-linha { grid-template-columns: minmax(0,1fr) !important; gap:6px !important; } }`}</style>
      </section>
    );
  }
  return (
    <section>
      <Titulo>{b.titulo}</Titulo>
      <dl style={css("margin:0; display:flex; flex-direction:column; gap:10px;")}>
        {b.itens.map((it) => (
          <div key={it.rotulo} style={css("padding-left:12px; border-left:3px solid #F1D5DD;")}>
            <dt style={css("font-size:13px; font-weight:800; color:#1B1B28;")}>{it.rotulo}</dt>
            <dd style={css("margin:2px 0 0; font-size:13px; color:#5B6472; line-height:1.55;")}>{it.texto}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
