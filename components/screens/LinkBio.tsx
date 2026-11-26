"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { css } from "@/lib/css";
import { BRAND } from "@/lib/theme";
import {
  BIO_EVENTOS_CLIQUE, BIO_EVENTOS_PAGINA, BIO_PATH, BIO_TEMAS, gravarBioDemo, lerBioDemo, normalizarUrl, rotuloEventoClique, tipoDoLink, urlValida,
  type BioEvento, type BioLink, type BioLinkEntrada, type BioPagina, type BioTamanho,
} from "@/lib/bio";
import { apiJson } from "@/lib/supabase-browser";
import { uploadAvatar } from "@/lib/upload";
import { useApp } from "../store";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import ConfirmModal from "../ui/ConfirmModal";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Chave } from "../encomendas/CatalogoEditor";
import BioView from "../bio/BioView";

/**
 * Marketing → Link na Bio (mesmo desenho do Instituto, adaptado à Ju): a página pública /bio que vai
 * no Instagram. Abre no Relatório (visitas, cliques, taxa de clique, cliques por botão, origem e
 * aparelho); "Configurações" tem perfil, estilo, cores, botões, Pixel da Meta e a prévia no celular.
 * Dados em /api/bio (tabelas bio_pagina, bio_link, bio_evento); sem banco, no navegador (modo demo).
 */

const DIA = 86_400_000;
const chaveDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const NOME_ORIGEM: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", direto: "Direto / outros apps" };
const num = (n: number) => n.toLocaleString("pt-BR");
const SERIE_CLIQUES = "#955C6B", SERIE_VISITAS = "#0E8FB0", GRADE = "#ECEDF1", EIXO = "#9398A6";

type Rascunho = Omit<BioPagina, "publicada">;
const rascunhoDe = ({ publicada: _p, ...r }: BioPagina): Rascunho => r;
const igual = (a: Rascunho, b: Rascunho) => (Object.keys(a) as (keyof Rascunho)[]).every((k) => a[k] === b[k]);

/** Camada de dados: API (banco) ou navegador (demo). */
function useBio(demo: boolean) {
  const [pagina, setPagina] = useState<BioPagina | null>(null);
  const [links, setLinks] = useState<BioLink[]>([]);
  const [podeEditarApi, setPodeEditarApi] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (demo) { const d = lerBioDemo(); setPagina(d.pagina); setLinks(d.links); return; }
    try {
      const j = await apiJson<{ pagina: BioPagina; links: BioLink[]; podeEditar: boolean }>("/api/bio", "GET");
      setPagina(j.pagina); setLinks(j.links); setPodeEditarApi(j.podeEditar); setErro("");
    } catch (e) { setErro((e as Error).message); }
  }, [demo]);
  useEffect(() => { void carregar(); }, [carregar]);

  const demoGravar = (p: BioPagina | null, ls: BioLink[]) => { const d = lerBioDemo(); gravarBioDemo({ ...d, pagina: p ?? d.pagina, links: ls }); };
  /** Otimista; se a API recusar, recarrega e devolve o erro. */
  const rodar = async (local: () => void, remoto: () => Promise<unknown>) => {
    local();
    if (demo) return null;
    try { await remoto(); return null; } catch (e) { void carregar(); return (e as Error).message; }
  };

  return {
    pagina, links, podeEditarApi, erro, carregar,
    salvarPagina: (patch: Partial<BioPagina>) => rodar(
      () => { setPagina((p) => { const n = p ? { ...p, ...patch } : p; if (demo && n) demoGravar(n, links); return n; }); },
      () => apiJson("/api/bio", "PATCH", { pagina: patch }),
    ),
    criarLink: (l: BioLinkEntrada) => {
      const novo: BioLink = { ...l, id: `bio-${Date.now()}`, ordem: Math.max(-1, ...links.map((x) => x.ordem)) + 1, cliques: 0 };
      return rodar(() => { const ls = [...links, novo]; setLinks(ls); if (demo) demoGravar(pagina, ls); }, () => apiJson("/api/bio", "POST", { id: novo.id, link: l }));
    },
    editarLink: (id: string, l: Partial<BioLinkEntrada>) => rodar(
      () => { const ls = links.map((x) => (x.id === id ? { ...x, ...l } : x)); setLinks(ls); if (demo) demoGravar(pagina, ls); },
      () => apiJson("/api/bio", "PATCH", { id, link: l }),
    ),
    moverLink: (id: string, d: -1 | 1) => {
      const ls = [...links].sort((a, b) => a.ordem - b.ordem);
      const i = ls.findIndex((x) => x.id === id), j = i + d;
      if (i < 0 || j < 0 || j >= ls.length) return Promise.resolve(null);
      [ls[i], ls[j]] = [ls[j], ls[i]];
      const nova = ls.map((x, k) => ({ ...x, ordem: k }));
      return rodar(() => { setLinks(nova); if (demo) demoGravar(pagina, nova); }, () => apiJson("/api/bio", "PATCH", { ordem: nova.map((x) => x.id) }));
    },
    excluirLink: (id: string) => rodar(
      () => { const ls = links.filter((x) => x.id !== id); setLinks(ls); if (demo) demoGravar(pagina, ls); },
      () => apiJson("/api/bio", "DELETE", { id }),
    ),
  };
}

export default function LinkBioPainel() {
  const { demo, canEditPage } = useApp();
  const bio = useBio(demo);
  const podeEditar = canEditPage("marketing-linkbio") && bio.podeEditarApi;
  const [vista, setVista] = useState<"relatorio" | "config">("relatorio");
  const [editando, setEditando] = useState<BioLink | "novo" | null>(null);
  const [aviso, setAviso] = useState("");
  const avisoT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = (m: string) => { setAviso(m); if (avisoT.current) clearTimeout(avisoT.current); avisoT.current = setTimeout(() => setAviso(""), 2600); };
  const feito = (ok: string) => (e: string | null) => avisar(e ? `Não salvou: ${e}` : ok);

  return (
    <div style={css("height:100%; overflow-y:auto;")}>
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:24px 30px 14px;")}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>{vista === "relatorio" ? "Link na Bio" : "Configurações do Link na Bio"}</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>{vista === "relatorio" ? "Visitas e cliques da página que vai na bio do Instagram" : "Perfil, estilo, cores, botões, rastreamento e prévia"}</p>
        </div>
        <div style={css("display:flex; gap:8px; flex-wrap:wrap;")}>
          <Segmentado valor={vista} onChange={setVista} opcoes={[{ v: "relatorio", label: "Relatório" }, { v: "config", label: "Configurações" }]} />
          {vista === "config" && podeEditar && (
            <Hoverable as="button" onClick={() => setEditando("novo")} s={css(`display:flex; align-items:center; gap:7px; border:none; cursor:pointer; background:${BRAND}; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:10px;`)} hover="filter:brightness(1.12)">
              <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>Novo botão
            </Hoverable>
          )}
        </div>
      </div>

      <div className="m-pad" style={css("padding:0 30px 30px; display:flex; flex-direction:column; gap:14px;")}>
        {bio.erro && <div role="alert" style={css("font-size:13px; font-weight:600; color:#B42318; background:#FEF3F2; border:1px solid #FECDCA; border-radius:11px; padding:10px 12px;")}>{bio.erro}</div>}
        {bio.pagina && (
          <>
            <CartaoLinkPublico publicada={bio.pagina.publicada} podeEditar={podeEditar} onPublicar={(v) => void bio.salvarPagina({ publicada: v }).then(feito(v ? "Página no ar" : "Página fora do ar"))} />
            {vista === "relatorio"
              ? <Relatorio demo={demo} links={bio.links} />
              : <Configuracoes pagina={bio.pagina} links={bio.links} podeEditar={podeEditar} bio={bio} onEditar={setEditando} avisar={avisar} feito={feito} />}
          </>
        )}
      </div>

      {editando && (
        <LinkForm alvo={editando} podeEditar={podeEditar} temPixel={!!bio.pagina?.pixelId} onClose={() => setEditando(null)}
          onSalvar={(l) => { const id = editando === "novo" ? null : editando.id; setEditando(null); void (id ? bio.editarLink(id, l) : bio.criarLink(l)).then(feito(id ? "Botão atualizado" : "Botão criado")); }}
          onExcluir={() => { const id = editando === "novo" ? null : editando.id; setEditando(null); if (id) void bio.excluirLink(id).then(feito("Botão excluído")); }} />
      )}
      {aviso && <div role="status" style={css("position:fixed; left:50%; bottom:22px; transform:translateX(-50%); z-index:90; background:#1B1B28; color:#fff; font-size:13px; font-weight:600; padding:10px 16px; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.2);")}>{aviso}</div>}
    </div>
  );
}

// ── Peças pequenas ───────────────────────────────────────────────────────────

function Cartao({ titulo, extra, children, s }: { titulo?: ReactNode; extra?: ReactNode; children: ReactNode; s?: string }) {
  return (
    <div style={css(`background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:16px; min-width:0; ${s ?? ""}`)}>
      {(titulo || extra) && <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:12px;")}><span style={css("flex:1; font-size:14px; font-weight:800;")}>{titulo}</span>{extra}</div>}
      {children}
    </div>
  );
}

function Segmentado<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" style={css("display:inline-flex; background:#F1F2F5; border-radius:10px; padding:3px;")}>
      {opcoes.map((o) => (
        <button key={o.v} role="tab" aria-selected={valor === o.v} onClick={() => onChange(o.v)}
          style={css(`border:none; cursor:pointer; font-size:13px; font-weight:700; padding:7px 14px; border-radius:8px; background:${valor === o.v ? "#fff" : "transparent"}; color:${valor === o.v ? "#1B1B28" : "#7A8090"}; box-shadow:${valor === o.v ? "0 1px 3px rgba(0,0,0,.08)" : "none"};`)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Escolha entre poucas opções (botões lado a lado). */
function Escolha<T extends string>({ valor, opcoes, onChange, rotulo }: { valor: T; opcoes: { v: T; label: string; dica?: string }[]; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} style={{ display: "grid", gap: 8, gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}>
      {opcoes.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={valor === o.v} onClick={() => onChange(o.v)}
          style={css(`text-align:left; cursor:pointer; border-radius:9px; padding:8px 10px; border:1px solid ${valor === o.v ? BRAND : "#E2E3E9"}; background:${valor === o.v ? "rgba(149,92,107,0.08)" : "#fff"}; color:${valor === o.v ? BRAND : "#1B1B28"};`)}>
          <span style={css("display:block; font-size:13px; font-weight:800;")}>{o.label}</span>
          {o.dica && <span style={css("display:block; font-size:11.5px; color:#7A8090; line-height:1.35;")}>{o.dica}</span>}
        </button>
      ))}
    </div>
  );
}

const ROT = "display:block; font-size:12.5px; font-weight:700; color:#5B6472;";
const CAMPO = "width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; padding:9px 11px; font-size:13.5px; outline:none; font-family:inherit; margin-top:5px; background:#fff;";
const BTN_SEC = "border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; border-radius:9px; padding:7px 13px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;";
const TAMANHOS: { v: BioTamanho; label: string }[] = [{ v: "sm", label: "P" }, { v: "md", label: "M" }, { v: "lg", label: "G" }];

function CartaoLinkPublico({ publicada, podeEditar, onPublicar }: { publicada: boolean; podeEditar: boolean; onPublicar: (v: boolean) => void }) {
  const [copiado, setCopiado] = useState(false);
  const [origem, setOrigem] = useState("");
  useEffect(() => { setOrigem(window.location.origin); }, []);
  const url = `${origem}${BIO_PATH}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1400); } catch {} };
  return (
    <Cartao s="display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:14px;">
      <span style={css(`width:40px; height:40px; border-radius:11px; background:rgba(149,92,107,0.12); color:${BRAND}; display:flex; align-items:center; justify-content:center; flex:none;`)}>
        <Svg size={19} sw={2.2}><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></Svg>
      </span>
      <div style={css("flex:1 1 200px; min-width:0;")}>
        <div style={css("font-size:13.5px; font-weight:800;")}>Página pública (link na bio)</div>
        <div style={css("font-size:12.5px; color:#7A8090; font-family:ui-monospace,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{url}</div>
      </div>
      <div style={css("display:flex; gap:8px; flex-wrap:wrap; align-items:center;")}>
        <button type="button" onClick={copiar} style={css(BTN_SEC)}>{copiado ? "Copiado!" : "Copiar link"}</button>
        <a href={BIO_PATH} target="_blank" rel="noreferrer" style={css(`${BTN_SEC} text-decoration:none;`)}>Abrir ↗</a>
        <label style={css(`display:inline-flex; align-items:center; gap:8px; border:1px solid #E2E3E9; border-radius:9px; padding:4px 10px; font-size:12.5px; font-weight:700; cursor:${podeEditar ? "pointer" : "default"};`)}>
          <Chave ligado={publicada} onChange={(v) => podeEditar && onPublicar(v)} />{publicada ? "No ar" : "Fora do ar"}
        </label>
      </div>
    </Cartao>
  );
}

// ── Relatório ────────────────────────────────────────────────────────────────

function Relatorio({ demo, links }: { demo: boolean; links: BioLink[] }) {
  const [dias, setDias] = useState(30);
  const [eventos, setEventos] = useState<BioEvento[] | null>(null);
  const [erro, setErro] = useState("");
  const [agora, setAgora] = useState(() => Date.now());
  const [tique, setTique] = useState(0);
  useEffect(() => {
    let vivo = true;
    const t = Date.now();
    const ini = new Date(t - (dias - 1) * DIA); ini.setHours(0, 0, 0, 0);
    const p = demo
      ? Promise.resolve(lerBioDemo().eventos.filter((e) => e.em >= ini.toISOString()))
      : apiJson<{ eventos: BioEvento[] }>(`/api/bio?dias=${dias}`, "GET").then((j) => j.eventos);
    p.then((ev) => { if (vivo) { setEventos(ev); setAgora(t); setErro(""); } }, (e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [demo, dias, tique]);

  const r = useMemo(() => {
    const lista = eventos ?? [];
    const ini = new Date(agora - (dias - 1) * DIA); ini.setHours(0, 0, 0, 0);
    const visitas = lista.filter((e) => e.tipo === "view");
    const cliques = lista.filter((e) => e.tipo === "click");
    const porDia = new Map<string, { dia: string; visitas: number; cliques: number }>();
    for (let i = 0; i < dias; i++) { const d = new Date(ini.getTime() + i * DIA); porDia.set(chaveDia(d), { dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), visitas: 0, cliques: 0 }); }
    for (const e of lista) { const p = porDia.get(chaveDia(new Date(e.em))); if (p) p[e.tipo === "view" ? "visitas" : "cliques"]++; }
    const porLink = links.map((l) => ({ l, n: cliques.filter((e) => e.linkId === l.id).length })).sort((a, b) => b.n - a.n || a.l.ordem - b.l.ordem);
    const contar = (arr: BioEvento[], k: "origem" | "aparelho") => { const m = new Map<string, number>(); for (const e of arr) m.set(e[k] || "direto", (m.get(e[k] || "direto") ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
    const base = visitas.length ? visitas : cliques;
    return { visitas: visitas.length, cliques: cliques.length, serie: [...porDia.values()], porLink, origens: contar(base, "origem"), aparelhos: contar(base, "aparelho") };
  }, [eventos, dias, agora, links]);

  const taxa = r.visitas ? Math.round((r.cliques / r.visitas) * 100) : 0;
  const maxL = Math.max(0, ...r.porLink.map((x) => x.n));
  const totOrig = r.origens.reduce((t, [, n]) => t + n, 0);
  const top = r.porLink[0]?.n ? r.porLink[0].l.titulo : "—";
  const vazio = eventos !== null && !eventos.length;

  return (
    <div style={css("display:flex; flex-direction:column; gap:14px;")}>
      <div style={css("display:flex; align-items:center; gap:8px; flex-wrap:wrap;")}>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Período" style={css("border:1px solid #E2E3E9; border-radius:9px; padding:8px 10px; font-size:13px; font-weight:700; background:#fff; font-family:inherit;")}>
          <option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option>
        </select>
        <button type="button" onClick={() => setTique((x) => x + 1)} style={css(BTN_SEC)}>Atualizar</button>
        {erro && <span style={css("font-size:12.5px; color:#B42318;")}>{erro}</span>}
      </div>

      <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px;")}>
        <Kpi rotulo="Visitas" valor={eventos ? num(r.visitas) : "—"} dica="Aberturas da página" />
        <Kpi rotulo="Cliques" valor={eventos ? num(r.cliques) : "—"} dica="Toques nos botões" />
        <Kpi rotulo="Taxa de clique" valor={eventos && r.visitas ? `${taxa}%` : "—"} dica="Cliques ÷ visitas" />
        <Kpi rotulo="Botão mais clicado" valor={eventos ? top : "—"} dica="No período" pequeno />
      </div>

      <Cartao titulo="Visitas e cliques por dia" extra={<span style={css("font-size:12px; color:#7A8090;")}>Últimos {dias} dias</span>}>
        {eventos === null ? <div style={css("height:240px; display:flex; align-items:center; justify-content:center; color:#9398A6; font-size:13px;")}>Carregando…</div>
          : vazio ? <div style={css("padding:36px 12px; text-align:center; color:#7A8090; font-size:13px; line-height:1.5;")}><b style={css("display:block; color:#1B1B28; font-size:14px; margin-bottom:4px;")}>Nenhuma visita no período</b>Coloque o link da página na bio do Instagram: cada visita e cada toque nos botões aparecem aqui.</div>
          : <Grafico dados={r.serie} />}
      </Cartao>

      <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; align-items:start;")}>
        <Cartao titulo="Cliques por botão" extra={<span style={css("font-size:12px; color:#7A8090;")}>no período (total desde o início)</span>} s="padding:16px 0 4px;">
          <div style={css("padding:0 16px;")}>
            {r.porLink.map(({ l, n }) => (
              <div key={l.id} style={css("padding:10px 0; border-top:1px solid #F0F1F4;")}>
                <div style={css("display:flex; align-items:baseline; gap:8px;")}>
                  <span style={css(`flex:1; min-width:0; font-size:13.5px; font-weight:700; color:${l.ativo ? "#1B1B28" : "#9398A6"};`)}>{l.titulo}{!l.ativo && <span style={css("font-size:11px; font-weight:800; margin-left:6px;")}>· OCULTO</span>}</span>
                  <span style={css("font-size:13.5px; font-weight:800;")}>{num(n)} <span style={css("font-size:12px; font-weight:500; color:#9398A6;")}>({num(l.cliques)})</span></span>
                </div>
                <div style={css("display:flex; align-items:center; gap:8px; margin-top:6px;")}>
                  <Barra valor={n} max={maxL} />
                  <span style={css("font-size:11.5px; color:#9398A6; width:36px; text-align:right;")}>{r.cliques ? Math.round((n / r.cliques) * 100) : 0}%</span>
                </div>
              </div>
            ))}
            {!links.length && <p style={css("font-size:13px; color:#9398A6;")}>Crie os botões em Configurações.</p>}
          </div>
        </Cartao>
        <div style={css("display:flex; flex-direction:column; gap:14px;")}>
          <Cartao titulo="De onde vieram">
            {!totOrig ? <p style={css("margin:0; font-size:12.5px; color:#9398A6;")}>Sem visitas no período.</p> : r.origens.slice(0, 6).map(([o, n]) => (
              <div key={o} style={css("margin-bottom:10px;")}>
                <div style={css("display:flex; justify-content:space-between; font-size:13px;")}><span>{NOME_ORIGEM[o] ?? o}</span><b>{Math.round((n / totOrig) * 100)}%</b></div>
                <div style={css("margin-top:4px;")}><Barra valor={n} max={r.origens[0][1]} /></div>
              </div>
            ))}
          </Cartao>
          <Cartao titulo="Aparelho">
            {!totOrig ? <p style={css("margin:0; font-size:12.5px; color:#9398A6;")}>Sem visitas no período.</p> : (
              <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:10px;")}>
                {(["mobile", "desktop"] as const).map((a) => {
                  const n = r.aparelhos.find(([k]) => k === a)?.[1] ?? 0;
                  return <div key={a} style={css("border:1px solid #ECEDF1; border-radius:10px; padding:10px;")}><div style={css("font-size:12px; color:#7A8090;")}>{a === "mobile" ? "Celular" : "Computador"}</div><div style={css("font-size:20px; font-weight:800;")}>{Math.round((n / totOrig) * 100)}%</div></div>;
                })}
              </div>
            )}
          </Cartao>
        </div>
      </div>
    </div>
  );
}

function Kpi({ rotulo, valor, dica, pequeno }: { rotulo: string; valor: string; dica: string; pequeno?: boolean }) {
  return (
    <Cartao s="padding:14px;">
      <div style={css("font-size:12px; font-weight:700; color:#7A8090;")}>{rotulo}</div>
      <div style={css(`font-size:${pequeno ? 16 : 24}px; font-weight:800; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`)} title={valor}>{valor}</div>
      <div style={css("font-size:12px; color:#9398A6; margin-top:2px;")}>{dica}</div>
    </Cartao>
  );
}

function Barra({ valor, max }: { valor: number; max: number }) {
  return <div style={css("flex:1; height:8px; border-radius:999px; background:#F1F2F5; overflow:hidden;")} aria-hidden="true"><div style={{ height: "100%", borderRadius: 999, width: `${max ? Math.max(2, (valor / max) * 100) : 0}%`, background: BRAND }} /></div>;
}

function Grafico({ dados }: { dados: { dia: string; visitas: number; cliques: number }[] }) {
  const passo = Math.max(1, Math.ceil(dados.length / 8));
  const series = [{ k: "cliques", label: "Cliques", cor: SERIE_CLIQUES }, { k: "visitas", label: "Visitas", cor: SERIE_VISITAS }] as const;
  return (
    <div>
      <div style={css("display:flex; gap:16px; margin-bottom:8px; font-size:12px; color:#7A8090;")} aria-hidden="true">
        {series.map((s) => <span key={s.k} style={css("display:inline-flex; align-items:center; gap:6px;")}><span style={{ width: 16, height: 2, borderRadius: 2, background: s.cor }} />{s.label}</span>)}
      </div>
      <div style={{ height: 240, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRADE} />
            <XAxis dataKey="dia" tickLine={false} axisLine={{ stroke: GRADE }} interval={passo - 1} tick={{ fontSize: 11, fill: EIXO }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: EIXO }} width={34} />
            <Tooltip content={<Dica />} cursor={{ stroke: EIXO, strokeWidth: 1 }} />
            {series.map((s) => <Line key={s.k} type="monotone" dataKey={s.k} name={s.label} stroke={s.cor} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Dica({ active, payload }: { active?: boolean; payload?: { payload: { dia: string; visitas: number; cliques: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:9px; padding:8px 11px; box-shadow:0 6px 18px rgba(0,0,0,.1); font-size:12px; min-width:130px;")}>
      <b>{p.dia}</b>
      <div style={css("display:flex; justify-content:space-between; gap:10px; margin-top:4px;")}><span style={{ color: SERIE_CLIQUES }}>Cliques</span><b>{p.cliques}</b></div>
      <div style={css("display:flex; justify-content:space-between; gap:10px;")}><span style={{ color: SERIE_VISITAS }}>Visitas</span><b>{p.visitas}</b></div>
      {p.visitas > 0 && <div style={css("color:#7A8090; margin-top:3px;")}>Taxa de clique {Math.round((p.cliques / p.visitas) * 100)}%</div>}
    </div>
  );
}

// ── Configurações ────────────────────────────────────────────────────────────

function Configuracoes({ pagina, links, podeEditar, bio, onEditar, avisar, feito }: {
  pagina: BioPagina; links: BioLink[]; podeEditar: boolean; bio: ReturnType<typeof useBio>;
  onEditar: (l: BioLink | "novo") => void; avisar: (m: string) => void; feito: (ok: string) => (e: string | null) => void;
}) {
  const salvo = rascunhoDe(pagina);
  const [d, setD] = useState<Rascunho>(salvo);
  // Chegou versão nova e não há nada por salvar: acompanha.
  const [visto, setVisto] = useState(salvo);
  if (!igual(visto, salvo)) { setVisto(salvo); if (igual(d, visto)) setD(salvo); }
  const sujo = !igual(d, salvo);
  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => setD((x) => ({ ...x, [k]: v }));
  const [aba, setAba] = useState<"editar" | "previa">("editar");
  const ordenados = [...links].sort((a, b) => a.ordem - b.ordem);
  const totalCliques = links.reduce((t, l) => t + l.cliques, 0);
  const salvar = () => void bio.salvarPagina({ ...d, titulo: d.titulo.trim(), bio: d.bio.trim(), instagram: d.instagram.trim().replace(/^@/, ""), pixelId: d.pixelId.replace(/\D/g, "") }).then(feito("Link na Bio salvo — a página pública atualiza em até 30 segundos"));

  return (
    <>
      <div className="m-only" style={css("display:none;")}>
        <Segmentado valor={aba} onChange={setAba} opcoes={[{ v: "editar", label: "Editar" }, { v: "previa", label: "Prévia" }]} />
      </div>
      <div className="jb-bio-grade" style={css("display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:16px; align-items:start;")}>
        <fieldset disabled={!podeEditar} className={aba === "previa" ? "jb-bio-oculta-cel" : undefined} style={css("border:none; padding:0; margin:0; min-width:0; display:flex; flex-direction:column; gap:14px;")}>
          <Cartao titulo="Perfil">
            <div style={css("display:flex; flex-direction:column; gap:14px;")}>
              {d.layout === "destaque" ? (
                <EscolherImagem rotulo="Foto de destaque" dica="Foto em pé, aparece grande no topo e some no fundo. Melhor em 1080 × 1350." valor={d.avatar} formato="retrato" chave="destaque" onChange={(v) => set("avatar", v)} avisar={avisar} />
              ) : (
                <>
                  <EscolherImagem rotulo="Capa" dica="Foto larga no topo (opcional). Melhor em 1500 × 845." valor={d.capa} formato="largo" chave="capa" onChange={(v) => set("capa", v)} avisar={avisar} />
                  <EscolherImagem rotulo="Foto do perfil" dica="Aparece redonda. Melhor quadrada (o logo da Ju já vem)." valor={d.avatar} formato="redondo" chave="perfil" onChange={(v) => set("avatar", v)} avisar={avisar} />
                </>
              )}
              <label style={css(ROT)}>Nome<input value={d.titulo} onChange={(e) => set("titulo", e.target.value)} maxLength={60} placeholder="Ex.: Ju Budelon" style={css(CAMPO)} /></label>
              <label style={css(ROT)}>Bio ({d.bio.length}/300)<textarea rows={3} value={d.bio} onChange={(e) => set("bio", e.target.value.slice(0, 300))} placeholder="Uma frase sobre a Ju Budelon" style={css(`${CAMPO} resize:vertical;`)} /></label>
              <label style={css(ROT)}>Instagram (opcional)
                <div style={css("position:relative;")}><span style={css("position:absolute; left:11px; top:15px; font-size:13px; color:#9398A6;")}>@</span>
                  <input value={d.instagram} onChange={(e) => set("instagram", e.target.value.replace(/[^\w.]/g, ""))} placeholder="jubudelon" style={css(`${CAMPO} padding-left:26px;`)} /></div>
              </label>
            </div>
          </Cartao>

          <Cartao titulo="Estilo">
            <div style={css("display:flex; flex-direction:column; gap:14px;")}>
              <div><span style={css(ROT)}>Layout</span><div style={css("margin-top:6px;")}><Escolha rotulo="Layout" valor={d.layout} onChange={(v) => set("layout", v)} opcoes={[{ v: "classico", label: "Foto redonda", dica: "Capa opcional e foto/logo redondo" }, { v: "destaque", label: "Foto em destaque", dica: "Foto grande no topo, como no Linktree" }]} /></div></div>
              <div><span style={css(ROT)}>Fonte do nome</span><div style={css("margin-top:6px;")}><Escolha rotulo="Fonte do nome" valor={d.fonteTitulo} onChange={(v) => set("fonteTitulo", v)} opcoes={[{ v: "serif", label: "Elegante", dica: "Serifada" }, { v: "sans", label: "Moderna", dica: "Igual ao sistema" }]} /></div></div>
              <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px;")}>
                <div><span style={css(ROT)}>Tamanho do nome</span><div style={css("margin-top:6px;")}><Escolha rotulo="Tamanho do nome" valor={d.tamTitulo} onChange={(v) => set("tamTitulo", v)} opcoes={TAMANHOS} /></div></div>
                <div><span style={css(ROT)}>Tamanho da bio</span><div style={css("margin-top:6px;")}><Escolha rotulo="Tamanho da bio" valor={d.tamBio} onChange={(v) => set("tamBio", v)} opcoes={TAMANHOS} /></div></div>
                <div><span style={css(ROT)}>Tamanho dos botões</span><div style={css("margin-top:6px;")}><Escolha rotulo="Tamanho dos botões" valor={d.tamBotao} onChange={(v) => set("tamBotao", v)} opcoes={TAMANHOS} /></div></div>
              </div>
            </div>
          </Cartao>

          <Cartao titulo="Cores">
            <div style={css("display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;")}>
              {BIO_TEMAS.map((t) => {
                const on = d.corFundo.toLowerCase() === t.fundo.toLowerCase() && d.corBotao.toLowerCase() === t.botao.toLowerCase() && d.corTextoBotao.toLowerCase() === t.texto.toLowerCase();
                return (
                  <button key={t.nome} type="button" onClick={() => setD((x) => ({ ...x, corFundo: t.fundo, corBotao: t.botao, corTextoBotao: t.texto }))}
                    style={css(`display:inline-flex; align-items:center; gap:8px; cursor:pointer; border-radius:10px; padding:6px 10px; font-size:12.5px; font-weight:700; border:1px solid ${on ? BRAND : "#E2E3E9"}; background:${on ? "rgba(149,92,107,0.08)" : "#fff"};`)}>
                    <span style={{ position: "relative", width: 24, height: 24, borderRadius: 6, border: "1px solid #E2E3E9", background: t.fundo }}><span style={{ position: "absolute", left: 4, right: 4, bottom: 4, height: 8, borderRadius: 3, background: t.botao }} /></span>{t.nome}
                  </button>
                );
              })}
            </div>
            <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px;")}>
              <CampoCor rotulo="Fundo" valor={d.corFundo} onChange={(v) => set("corFundo", v)} />
              <CampoCor rotulo="Botões" valor={d.corBotao} onChange={(v) => set("corBotao", v)} />
              <CampoCor rotulo="Texto dos botões" valor={d.corTextoBotao} onChange={(v) => set("corTextoBotao", v)} />
            </div>
          </Cartao>

          <Cartao titulo={<>Botões <span style={css("color:#9398A6; font-weight:700;")}>{links.length}</span></>} extra={<span style={css("font-size:12px; color:#7A8090;")}>{num(totalCliques)} cliques</span>} s="padding:16px 0 6px;">
            {!ordenados.length && <p style={css("padding:0 16px; font-size:13px; color:#9398A6;")}>Nenhum botão ainda. Use “Novo botão”.</p>}
            {ordenados.map((l, i) => (
              <div key={l.id} style={css(`display:flex; align-items:center; gap:10px; padding:10px 14px; border-top:1px solid #F0F1F4; opacity:${l.ativo ? 1 : 0.6};`)}>
                <div style={css("display:flex; flex-direction:column;")}>
                  <BotaoSeta titulo={`Subir ${l.titulo}`} off={i === 0 || !podeEditar} onClick={() => void bio.moverLink(l.id, -1).then((e) => e && avisar(`Não salvou: ${e}`))} d="m18 15-6-6-6 6" />
                  <BotaoSeta titulo={`Descer ${l.titulo}`} off={i === ordenados.length - 1 || !podeEditar} onClick={() => void bio.moverLink(l.id, 1).then((e) => e && avisar(`Não salvou: ${e}`))} d="m6 9 6 6 6-6" />
                </div>
                {l.imagem ? <img src={l.imagem} alt="" style={css("width:42px; height:42px; border-radius:9px; object-fit:cover; border:1px solid #ECEDF1; flex:none;")} />
                  : <span style={css("width:42px; height:42px; border-radius:9px; background:#F4F4F7; flex:none; display:flex; align-items:center; justify-content:center; color:#9398A6;")}><Svg size={16} sw={2}><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></Svg></span>}
                <button type="button" onClick={() => onEditar(l)} style={css("flex:1; min-width:0; text-align:left; border:none; background:transparent; cursor:pointer; padding:0;")}>
                  <div style={css("font-size:13.5px; font-weight:700; color:#1B1B28;")}>{l.titulo}</div>
                  <div style={css("font-size:12px; color:#7A8090; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{tipoDoLink(l.url)} · {num(l.cliques)} {l.cliques === 1 ? "clique" : "cliques"}{l.eventoMeta !== "none" ? ` · Meta: ${rotuloEventoClique(l.eventoMeta)}` : ""}</div>
                </button>
                <Chave ligado={l.ativo} onChange={(v) => podeEditar && void bio.editarLink(l.id, { ativo: v }).then(feito(v ? "Botão visível" : "Botão oculto"))} />
                <button type="button" onClick={() => onEditar(l)} style={css(BTN_SEC)}>Editar</button>
              </div>
            ))}
          </Cartao>

          <Cartao titulo="Rastreamento">
            <div style={css("display:flex; flex-direction:column; gap:12px;")}>
              <label style={css(ROT)}>Pixel da Meta (opcional)<input inputMode="numeric" value={d.pixelId} onChange={(e) => set("pixelId", e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 123456789012345" style={css(CAMPO)} /></label>
              <label style={css(ROT)}>Evento ao abrir a página
                <select value={d.eventoPagina} onChange={(e) => set("eventoPagina", e.target.value as BioPagina["eventoPagina"])} style={css(CAMPO)}>
                  {BIO_EVENTOS_PAGINA.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
                </select>
                <span style={css("display:block; font-size:12px; font-weight:500; color:#7A8090; margin-top:4px;")}>{BIO_EVENTOS_PAGINA.find((e) => e.v === d.eventoPagina)?.dica}</span>
              </label>
              <p style={css("margin:0; font-size:12px; color:#7A8090; line-height:1.5;")}>O evento de cada botão escolhe-se em Editar botão. Sem Pixel, nenhum evento vai para a Meta, mas as visitas e os cliques de cada botão são contados aqui mesmo.</p>
            </div>
          </Cartao>
        </fieldset>

        <div className={aba === "editar" ? "jb-bio-oculta-cel" : undefined} style={css("position:sticky; top:12px;")}>
          <div style={css("font-size:11.5px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; color:#9398A6; text-align:center; margin-bottom:8px;")}>Prévia</div>
          <div style={css("margin:0 auto; width:100%; max-width:380px; border-radius:34px; border:10px solid #1f2329; background:#1f2329; box-shadow:0 18px 40px rgba(20,24,40,.25); overflow:hidden;")}>
            <div className="jb-bio-previa" style={{ height: 640, overflowY: "auto", borderRadius: 24, background: d.corFundo }}>
              <BioView pagina={{ ...pagina, ...d }} links={ordenados} preview />
            </div>
          </div>
        </div>
      </div>

      {podeEditar && sujo && (
        <div style={css("position:sticky; bottom:12px; z-index:30; display:flex; align-items:center; justify-content:flex-end; gap:8px; background:rgba(255,255,255,.96); border:1px solid #ECEDF1; border-radius:12px; box-shadow:0 8px 24px rgba(20,24,40,.12); padding:10px 14px;")}>
          <span style={css("margin-right:auto; font-size:12.5px; color:#7A8090;")}>Alterações não salvas</span>
          <button type="button" onClick={() => setD(salvo)} style={css(BTN_SEC)}>Descartar</button>
          <Hoverable as="button" onClick={salvar} s={css(`border:none; background:${BRAND}; color:#fff; border-radius:9px; padding:8px 18px; font-size:13px; font-weight:700; cursor:pointer;`)} hover="filter:brightness(1.08)">Salvar</Hoverable>
        </div>
      )}
      <style>{`
        .jb-bio-previa{scrollbar-width:none}.jb-bio-previa::-webkit-scrollbar{display:none}
        @media (max-width: 1100px){.jb-bio-grade{grid-template-columns:minmax(0,1fr) !important}.m-only{display:block !important}.jb-bio-oculta-cel{display:none !important}}
      `}</style>
    </>
  );
}

function BotaoSeta({ titulo, off, onClick, d }: { titulo: string; off: boolean; onClick: () => void; d: string }) {
  return (
    <button type="button" title={titulo} aria-label={titulo} disabled={off} onClick={onClick}
      style={css(`width:24px; height:22px; border:none; background:transparent; color:#7A8090; cursor:${off ? "default" : "pointer"}; opacity:${off ? 0.3 : 1}; display:flex; align-items:center; justify-content:center; padding:0;`)}>
      <Svg size={14} sw={2.4}><path d={d} /></Svg>
    </button>
  );
}

function CampoCor({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label style={css(ROT)}>{rotulo}
      <div style={css("display:flex; align-items:center; gap:8px; border:1px solid #E2E3E9; border-radius:9px; padding:0 8px; height:38px; margin-top:5px; background:#fff;")}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(valor) ? valor : "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={rotulo} style={css("width:24px; height:24px; border:none; padding:0; background:transparent; cursor:pointer;")} />
        <input value={valor} onChange={(e) => onChange(e.target.value.startsWith("#") ? e.target.value.slice(0, 7) : `#${e.target.value.slice(0, 6)}`)} aria-label={`${rotulo} (hexadecimal)`} style={css("flex:1; min-width:0; border:none; outline:none; font-size:13px; font-family:ui-monospace,monospace; text-transform:uppercase; background:transparent;")} />
      </div>
    </label>
  );
}

/** Reduz a imagem no navegador (até 1080 px, JPEG) antes de subir — o limite do Storage é 2 MB. */
async function reduzir(file: File, max = 1080): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error("Imagem inválida.")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, file.type === "image/png" ? "image/png" : "image/jpeg", 0.86));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + (blob.type === "image/png" ? ".png" : ".jpg"), { type: blob.type }) : file;
  } finally { URL.revokeObjectURL(url); }
}

function EscolherImagem({ rotulo, dica, valor, formato, chave, onChange, avisar }: {
  rotulo: string; dica?: string; valor: string | null; formato: "retrato" | "largo" | "redondo"; chave: string; onChange: (v: string | null) => void; avisar: (m: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const escolher = async (f: File | undefined) => {
    if (!f) return;
    setOcupado(true);
    try { onChange(await uploadAvatar(await reduzir(f), "bio", `${chave}-${Date.now()}`)); }
    catch (e) { avisar(`Não foi possível usar a imagem: ${(e as Error).message}`); }
    finally { setOcupado(false); if (ref.current) ref.current.value = ""; }
  };
  const caixa = formato === "retrato" ? "width:96px; aspect-ratio:4/5; border-radius:9px;" : formato === "largo" ? "width:150px; aspect-ratio:16/9; border-radius:9px;" : "width:64px; height:64px; border-radius:50%;";
  return (
    <div>
      <span style={css(ROT)}>{rotulo}</span>
      <div style={css("display:flex; align-items:center; gap:12px; margin-top:6px;")}>
        <button type="button" onClick={() => ref.current?.click()} aria-label={valor ? `Trocar ${rotulo}` : `Escolher ${rotulo}`}
          style={css(`${caixa} flex:none; overflow:hidden; border:1px solid #E2E3E9; background:#F4F4F7; display:flex; align-items:center; justify-content:center; color:#9398A6; cursor:pointer; padding:0; position:relative;`)}>
          {valor ? <img src={valor} alt="" style={css("width:100%; height:100%; object-fit:cover;")} /> : <Svg size={18} sw={2}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></Svg>}
          {ocupado && <span style={css("position:absolute; inset:0; background:rgba(0,0,0,.4); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center;")}>Enviando…</span>}
        </button>
        <div style={css("min-width:0;")}>
          <div style={css("display:flex; gap:8px;")}>
            <button type="button" onClick={() => ref.current?.click()} disabled={ocupado} style={css(BTN_SEC)}>{valor ? "Trocar" : "Escolher"}</button>
            {valor && <button type="button" onClick={() => onChange(null)} disabled={ocupado} style={css(`${BTN_SEC} border-color:transparent; color:#B42318;`)}>Remover</button>}
          </div>
          {dica && <div style={css("font-size:11.5px; color:#9398A6; margin-top:5px;")}>{dica}</div>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => void escolher(e.target.files?.[0])} />
    </div>
  );
}

// ── Botão: criar / editar ───────────────────────────────────────────────────

function LinkForm({ alvo, podeEditar, temPixel, onClose, onSalvar, onExcluir }: {
  alvo: BioLink | "novo"; podeEditar: boolean; temPixel: boolean; onClose: () => void; onSalvar: (l: BioLinkEntrada) => void; onExcluir: () => void;
}) {
  useFecharComEsc(true, onClose);
  const ed = alvo === "novo" ? null : alvo;
  const [f, setF] = useState<BioLinkEntrada>({ titulo: ed?.titulo ?? "", subtitulo: ed?.subtitulo ?? "", url: ed?.url ?? "", imagem: ed?.imagem ?? null, ativo: ed?.ativo ?? true, eventoMeta: ed?.eventoMeta ?? "Contact" });
  const [confirmar, setConfirmar] = useState(false);
  const [aviso, setAviso] = useState("");
  const url = normalizarUrl(f.url);
  const urlOk = !f.url.trim() || urlValida(url);
  const pronto = f.titulo.trim().length > 0 && !!f.url.trim() && urlOk;

  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:64; background:rgba(20,24,40,.32);")} />
      <div className="m-drawer" role="dialog" aria-label={ed ? "Editar botão" : "Novo botão"} style={css("position:fixed; top:0; right:0; bottom:0; z-index:65; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:480px; max-width:96vw; display:flex; flex-direction:column;")}>
        <div style={css("flex:none; display:flex; align-items:center; gap:10px; padding:18px 22px; border-bottom:1px solid #ECEDF1;")}>
          <span style={css("flex:1; font-size:18px; font-weight:800;")}>{ed ? "Editar botão" : "Novo botão"}</span>
          <Hoverable as="button" onClick={onClose} title="Fechar" s={css("width:32px; height:32px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <fieldset disabled={!podeEditar} style={css("flex:1; min-height:0; overflow-y:auto; border:none; margin:0; padding:18px 22px; display:flex; flex-direction:column; gap:14px;")}>
          <p style={css("margin:0; font-size:12.5px; color:#7A8090;")}>Aparece na página do link na bio, na ordem da lista.</p>
          <label style={css(ROT)}>Título do botão *<input autoFocus={!ed} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={90} placeholder="Ex.: Peça pelo iFood" style={css(CAMPO)} /></label>
          <label style={css(ROT)}>Texto menor (opcional)<input value={f.subtitulo} onChange={(e) => setF({ ...f, subtitulo: e.target.value })} maxLength={90} placeholder="Ex.: Entrega na sua casa" style={css(CAMPO)} /></label>
          <label style={css(ROT)}>Link *
            <input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} onBlur={() => f.url.trim() && setF((x) => ({ ...x, url: normalizarUrl(x.url) }))} inputMode="url"
              placeholder="https://…, /encomendar ou um WhatsApp: (48) 99999-0000" style={css(CAMPO)} />
            {f.url.trim() && (urlOk
              ? <span style={css("display:block; font-size:12px; font-weight:500; color:#7A8090; margin-top:4px; word-break:break-all;")}>Abre: {tipoDoLink(url)} · {url}</span>
              : <span style={css("display:block; font-size:12px; color:#B42318; margin-top:4px;")}>Link inválido.</span>)}
          </label>
          <EscolherImagem rotulo="Miniatura (opcional)" dica="Imagem pequena à esquerda do botão." valor={f.imagem} formato="redondo" chave="botao" onChange={(v) => setF({ ...f, imagem: v })} avisar={setAviso} />
          {aviso && <div style={css("font-size:12.5px; color:#B42318;")}>{aviso}</div>}
          <label style={css(ROT)}>Evento enviado para a Meta ao clicar
            <select value={f.eventoMeta} onChange={(e) => setF({ ...f, eventoMeta: e.target.value as BioLink["eventoMeta"] })} style={css(CAMPO)}>
              {BIO_EVENTOS_CLIQUE.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
            </select>
            <span style={css("display:block; font-size:12px; font-weight:500; color:#7A8090; margin-top:4px;")}>{BIO_EVENTOS_CLIQUE.find((e) => e.v === f.eventoMeta)?.dica}</span>
            {!temPixel && f.eventoMeta !== "none" && <span style={css("display:block; font-size:12px; font-weight:600; color:#B07800; margin-top:4px;")}>Informe o Pixel da Meta em Rastreamento para o evento ser enviado.</span>}
          </label>
          <label style={css("display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid #ECEDF1; border-radius:10px; padding:10px 12px; font-size:13px; font-weight:700; cursor:pointer;")}>
            Mostrar na página<Chave ligado={f.ativo} onChange={(v) => setF({ ...f, ativo: v })} />
          </label>
        </fieldset>
        <div style={css("flex:none; display:flex; align-items:center; gap:8px; padding:14px 22px; border-top:1px solid #ECEDF1;")}>
          {ed && podeEditar && <button type="button" onClick={() => setConfirmar(true)} style={css(`${BTN_SEC} border-color:transparent; color:#B42318;`)}>Excluir</button>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={css(BTN_SEC)}>{podeEditar ? "Cancelar" : "Fechar"}</button>
          {podeEditar && (
            <Hoverable as="button" onClick={() => pronto && onSalvar({ ...f, titulo: f.titulo.trim(), subtitulo: f.subtitulo.trim(), url })} {...{ disabled: !pronto }}
              s={css(`border:none; background:${BRAND}; color:#fff; border-radius:9px; padding:8px 18px; font-size:13px; font-weight:700; cursor:${pronto ? "pointer" : "not-allowed"}; opacity:${pronto ? 1 : 0.5};`)} hover={pronto ? "filter:brightness(1.08)" : undefined}>
              {ed ? "Salvar" : "Criar botão"}
            </Hoverable>
          )}
        </div>
      </div>
      {confirmar && ed && (
        <ConfirmModal danger titulo="Excluir botão" confirmLabel="Excluir botão"
          mensagem={<>Excluir <strong style={css("color:#1B1B28;")}>“{ed.titulo}”</strong>? Se for só por um tempo, prefira desligar “Mostrar na página”.</>}
          onConfirm={() => { setConfirmar(false); onExcluir(); }} onClose={() => setConfirmar(false)} />
      )}
    </>
  );
}
