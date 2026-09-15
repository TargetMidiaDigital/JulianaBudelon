"use client";

import { useState } from "react";
import { ACCENT } from "@/lib/theme";
import { css } from "@/lib/css";
import { Svg } from "./Svg";
import { Avatar } from "./bits";
import Hoverable from "./Hoverable";

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export type FiltroOpt = { id: string; label: string; cor?: string; ini?: string; foto?: string };
/** Um "tipo" de filtro (ex.: Responsável) com suas opções e o valor atual/setter.
 *  `vazio` é o id que representa "sem filtro" (ex.: "todos" ou ""). */
export type FiltroTipo = { key: string; label: string; opts: FiltroOpt[]; value: string; vazio: string; set: (id: string) => void };

/**
 * Botão "Filtrar" + menu multi-tipo (busca → escolhe o TIPO, depois o valor),
 * genérico e dirigido por `tipos` (value/set). Mesma UX do filtro de Tarefas —
 * reusado em Tarefas/Design (estado global) e em Clientes/Contas (estado local).
 */
export default function FiltroMenu({ tipos }: { tipos: FiltroTipo[] }) {
  const [open, setOpen] = useState(false);
  const [nivel, setNivel] = useState<string>("root");
  const [q, setQ] = useState("");
  const close = () => { setOpen(false); setNivel("root"); setQ(""); };

  const labelDe = (t: FiltroTipo) => t.opts.find((o) => o.id === t.value)?.label ?? "";
  const ativos = tipos.filter((t) => t.value !== t.vazio);
  const botaoLabel = ativos.length === 0 ? "Filtrar" : ativos.length === 1 ? `${ativos[0].label}: ${labelDe(ativos[0])}` : `${ativos.length} filtros`;
  const limparTudo = () => tipos.forEach((t) => t.set(t.vazio));

  const query = norm(q.trim());
  const optRow = (o: FiltroOpt, selecionado: boolean, onClick: () => void, tag?: string) => (
    <Hoverable key={o.id + (tag ?? "")} onClick={onClick} s={css("display:flex; align-items:center; gap:9px; padding:8px 9px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; color:#1B1B28;")} hover="background:#F4F4F7">
      {o.ini !== undefined || o.foto ? <Avatar ini={o.ini ?? ""} cor={o.cor ?? "#9398A6"} src={o.foto} size={22} fontSize={10} /> : <span style={css(`width:11px; height:11px; border-radius:50%; flex:none; background:${o.cor ?? "#9398A6"};`)} />}
      <span style={css("flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{o.label}</span>
      {tag && <span style={css("font-size:10.5px; font-weight:700; color:#9398A6; background:#F0F1F4; padding:2px 7px; border-radius:999px;")}>{tag}</span>}
      <Svg size={15} sw={2.6} stroke={ACCENT} style={css(`flex:none; opacity:${selecionado ? 1 : 0};`)}><path d="m5 12 5 5 9-10" /></Svg>
    </Hoverable>
  );

  return (
    <div style={{ position: "relative" }}>
      <Hoverable
        as="button"
        onClick={() => { setNivel("root"); setQ(""); setOpen((v) => !v); }}
        s={css(`display:inline-flex; align-items:center; gap:8px; background:${ativos.length ? "#FDF1F4" : "#fff"}; border:1px solid ${open ? ACCENT : ativos.length ? "#EFC3CD" : "#E2E3E9"}; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:8px 14px; border-radius:10px;`)}
        hover="filter:brightness(0.98)"
      >
        <Svg size={15} style={css("flex:none;")} stroke={ativos.length ? ACCENT : "currentColor"}><path d="M3 5h18l-7 8v6l-4-2v-4z" /></Svg>
        {botaoLabel}
        <Svg size={12} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
      </Hoverable>
      {open && (
        <>
          <div onClick={close} style={css("position:fixed; inset:0; z-index:44;")} />
          <div style={css("position:absolute; top:calc(100% + 6px); right:0; z-index:45; background:#fff; border:1px solid #E2E3E9; border-radius:11px; box-shadow:0 12px 34px rgba(20,24,40,.16); padding:6px; min-width:264px; max-height:64vh; overflow-y:auto;")}>
            <div style={css("position:sticky; top:0; background:#fff; padding:0 0 6px; z-index:1;")}>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={nivel === "root" ? "Buscar filtro…" : "Buscar…"} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 13, border: "1px solid #E2E3E9", borderRadius: 8, outline: "none" }} />
            </div>

            {nivel === "root" ? (
              query ? (
                (() => {
                  const hits = tipos.flatMap((t) => t.opts.filter((o) => o.id !== t.vazio && norm(o.label).includes(query)).map((o) => ({ t, o })));
                  return hits.length ? hits.map(({ t, o }) => optRow(o, t.value === o.id, () => { t.set(o.id); setQ(""); }, t.label)) : <div style={css("padding:10px 9px; font-size:12.5px; color:#9398A6;")}>Nenhum filtro encontrado</div>;
                })()
              ) : (
                <>
                  {tipos.map((t) => {
                    const ativo = t.value !== t.vazio;
                    return (
                      <Hoverable key={t.key} onClick={() => { setNivel(t.key); setQ(""); }} s={css("display:flex; align-items:center; gap:9px; padding:9px 9px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; color:#1B1B28;")} hover="background:#F4F4F7">
                        <span style={{ flex: 1 }}>{t.label}</span>
                        {ativo && <span style={css("font-size:11.5px; font-weight:700; color:#955C6B; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{labelDe(t)}</span>}
                        <Svg size={13} sw={2.4} stroke="#9398A6" style={css("flex:none;")}><path d="m9 6 6 6-6 6" /></Svg>
                      </Hoverable>
                    );
                  })}
                  {ativos.length > 0 && (
                    <>
                      <div style={css("height:1px; background:#EEF0F3; margin:5px 4px;")} />
                      <Hoverable onClick={limparTudo} s={css("display:flex; align-items:center; gap:8px; padding:8px 9px; border-radius:8px; cursor:pointer; font-size:12.5px; font-weight:700; color:#5B6472;")} hover="background:#F4F4F7">
                        <Svg size={13} sw={2.4}><path d="M6 6l12 12M18 6 6 18" /></Svg>Limpar filtros
                      </Hoverable>
                    </>
                  )}
                </>
              )
            ) : (
              (() => {
                const t = tipos.find((x) => x.key === nivel)!;
                const opts = t.opts.filter((o) => !query || norm(o.label).includes(query));
                return (
                  <>
                    <Hoverable onClick={() => { setNivel("root"); setQ(""); }} s={css("display:flex; align-items:center; gap:7px; padding:6px 9px 8px; cursor:pointer; font-size:11.5px; font-weight:700; color:#9398A6; letter-spacing:0.3px; text-transform:uppercase;")} hover="color:#5B6472">
                      <Svg size={13} sw={2.6}><path d="m15 18-6-6 6-6" /></Svg>{t.label}
                    </Hoverable>
                    {opts.length ? opts.map((o) => optRow(o, t.value === o.id, () => { t.set(o.id); setNivel("root"); setQ(""); })) : <div style={css("padding:10px 9px; font-size:12.5px; color:#9398A6;")}>Nada encontrado</div>}
                  </>
                );
              })()
            )}
          </div>
        </>
      )}
    </div>
  );
}
