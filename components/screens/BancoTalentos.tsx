"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { foneBR } from "@/lib/format";
import { BRAND } from "@/lib/theme";
import type { Talento } from "@/lib/types";
import { TALENTO_STATUS, corDeTexto, statusPill } from "@/lib/talento-dims";
import { unidadeLabel } from "@/lib/localdb";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import TalentoDetail from "../modals/TalentoDetail";
import { useApp } from "../store";

// ── Vista LISTA: tabela ordenável ──
type SortKey = "criada" | "nome" | "status" | "vaga" | "fone" | "qualidade";
const COLS: { label: string; key: SortKey }[] = [
  { label: "Data criada", key: "criada" },
  { label: "Contato", key: "nome" },
  { label: "Status", key: "status" },
  { label: "Vaga", key: "vaga" },
  { label: "WhatsApp", key: "fone" },
  { label: "Qualidade", key: "qualidade" },
];
const GRID = "140px minmax(180px,1.4fr) 190px 170px 160px 160px";
const GRID_MIN = 1000;

const dataBR = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};
const txt = (v?: string) => v || "—";

// ── Filtro leve (Status / Vaga), derivado dos dados ──
type Filtro = { dim: "status" | "vaga"; val: string } | null;
const matchFiltro = (t: Talento, f: Filtro) =>
  !f || (f.dim === "status" ? t.status === f.val : (t.vaga ?? "") === f.val);

function TalentoFiltro({ talentos, filtro, onChange, statusPermitidos }: { talentos: Talento[]; filtro: Filtro; onChange: (f: Filtro) => void; statusPermitidos: string[] }) {
  const [step, setStep] = useState<"root" | "status" | "vaga">("root");
  const label = !filtro ? "Todos" : filtro.dim === "status" ? (TALENTO_STATUS.find((s) => s.key === filtro.val)?.label ?? filtro.val) : filtro.val;
  const statusOpts = TALENTO_STATUS.filter((s) => statusPermitidos.includes(s.key) && talentos.some((t) => t.status === s.key));
  const vagaOpts = [...new Set(talentos.map((t) => (t.vaga ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));
  const chevR = <Svg size={12} sw={2.4} stroke="#9398A6" style={css("flex:none;")}><path d="m9 6 6 6-6 6" /></Svg>;
  const back = (t: string) => (
    <MenuItem onClick={() => setStep("root")}>
      <Svg size={13} sw={2.4} stroke="#9398A6" style={css("flex:none;")}><path d="m15 18-6-6 6-6" /></Svg>
      <span style={{ flex: 1, fontWeight: 700 }}>{t}</span>
    </MenuItem>
  );
  return (
    <Menu align="right" width={240} trigger={(tg) => (
      <Hoverable as="button" onClick={() => { setStep("root"); tg(); }} s={css("display:inline-flex; align-items:center; gap:8px; background:#fff; border:1px solid #E2E3E9; color:#3A3F4C; cursor:pointer; font-size:13px; padding:9px 14px; border-radius:10px;")} hover="background:#FAFAFB">
        <Svg size={15} stroke="#5B6472"><rect x="3" y="4" width="7" height="7" rx="1.6" /><rect x="14" y="4" width="7" height="7" rx="1.6" /><rect x="3" y="15" width="7" height="5" rx="1.6" /><rect x="14" y="15" width="7" height="5" rx="1.6" /></Svg>
        <span style={css("color:#9398A6; font-weight:600;")}>Filtrar por</span> <span style={css("font-weight:700;")}>{label}</span>
        <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
      </Hoverable>
    )}>
      {(close) => step === "root" ? (
        <>
          <div style={css("font-size:11px; font-weight:700; color:#9398A6; letter-spacing:0.5px; text-transform:uppercase; padding:7px 10px 5px;")}>Filtrar por</div>
          <MenuItem onClick={() => setStep("status")}><span style={{ flex: 1 }}>Status</span>{chevR}</MenuItem>
          <MenuItem onClick={() => setStep("vaga")}><span style={{ flex: 1 }}>Vaga</span>{chevR}</MenuItem>
          {filtro && <MenuItem onClick={() => { onChange(null); close(); }}><span style={{ flex: 1, color: "#CC3338" }}>Limpar filtro</span></MenuItem>}
        </>
      ) : step === "status" ? (
        <>
          {back("Status")}
          {statusOpts.length === 0 && <div style={css("padding:8px 10px; color:#9398A6; font-size:12.5px;")}>Nenhum status disponível.</div>}
          {statusOpts.map((s) => (
            <MenuItem key={s.key} checked={filtro?.dim === "status" && filtro.val === s.key} onClick={() => { onChange({ dim: "status", val: s.key }); close(); }}>
              <span style={css(`width:9px; height:9px; border-radius:50%; flex:none; background:${s.dot};`)} /><span style={{ flex: 1 }}>{s.label}</span>
            </MenuItem>
          ))}
        </>
      ) : (
        <>
          {back("Vaga")}
          {vagaOpts.length === 0 && <div style={css("padding:8px 10px; color:#9398A6; font-size:12.5px;")}>Nenhuma vaga disponível.</div>}
          {vagaOpts.map((v) => (
            <MenuItem key={v} checked={filtro?.dim === "vaga" && filtro.val === v} onClick={() => { onChange({ dim: "vaga", val: v }); close(); }}>
              <span style={{ flex: 1 }}>{v}</span>
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  );
}

const vagaCor = (v?: string) => corDeTexto(v);

// Status "de arquivo": saem da visão por padrão (igual às tarefas validadas). Um único botão
// na toolbar mostra/esconde os três de uma vez.
const ARQUIVO_KEYS = ["desqualificado", "contratado", "antigos"];

export default function BancoTalentos() {
  const { canEditPage, talentos, unidades, updateTalento, removeTalento, setTalentoFormOpen } = useApp();
  const unidadeDe = (id?: string) => unidades.find((u) => u.id === id);
  const [vista, setVista] = useState<"list" | "board">("board");
  const [filtro, setFiltro] = useState<Filtro>(null);
  const [showArq, setShowArq] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const editavel = canEditPage("recrutamento-talentos");
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));
  const toggleSort = (k: SortKey) => setSort((s) => (s && s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: 1 }));
  const abrir = (id: string) => setAbertoId(id);

  // Os status "de arquivo" só aparecem com o botão ligado.
  const oculto = (k?: string) => !!k && ARQUIVO_KEYS.includes(k) && !showArq;
  const base = talentos.filter((t) => !oculto(t.status));
  const visiveis = base.filter((t) => matchFiltro(t, filtro));
  const colunas = TALENTO_STATUS.filter((s) => !oculto(s.key));
  const talentosDo = (status: string) => visiveis.filter((t) => t.status === status);
  const linhas = sort
    ? [...visiveis].sort((a, b) => {
        if (sort.key === "status") {
          const ia = TALENTO_STATUS.findIndex((e) => e.key === a.status);
          const ib = TALENTO_STATUS.findIndex((e) => e.key === b.status);
          return (ia - ib) * sort.dir;
        }
        const av = a[sort.key], bv = b[sort.key];
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return String(av).localeCompare(String(bv), "pt", { numeric: true, sensitivity: "base" }) * sort.dir;
      })
    : visiveis;

  const aberto = abertoId ? talentos.find((t) => t.id === abertoId) ?? null : null;

  return (
    <div style={css("padding:0; height:100%; display:flex; flex-direction:column;")}>
      {/* Header */}
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:24px 30px 14px; flex:none;")}>
        <div style={{ flex: 1 }}>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Banco de Talentos</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>Candidatos e vagas do recrutamento · {talentos.length}</p>
        </div>
      </div>

      {/* Novo + Lista × Quadro + filtro */}
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:12px; padding:0 30px 12px; flex:none;")}>
        {editavel && (
          <Hoverable
            as="button"
            onClick={() => setTalentoFormOpen(true)}
            s={css(`display:flex; align-items:center; gap:7px; border:none; cursor:pointer; background:${BRAND}; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:10px;`)}
            hover="filter:brightness(1.12)"
          >
            <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>
            Novo candidato
          </Hoverable>
        )}
        <div style={css("display:flex; gap:3px; background:#EDEEF2; border-radius:10px; padding:3px;")}>
          {(["list", "board"] as const).map((v) => {
            const active = vista === v;
            return (
              <button key={v} onClick={() => setVista(v)} style={css(`display:flex; align-items:center; gap:6px; border:none; cursor:pointer; font-size:13px; font-weight:600; padding:7px 13px; border-radius:8px; background:${active ? "#fff" : "transparent"}; color:${active ? "#1B1B28" : "#5B6472"}; box-shadow:${active ? "0 1px 2px rgba(16,24,40,.10)" : "none"};`)}>
                {v === "list"
                  ? <Svg size={14}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>
                  : <Svg size={14}><rect x="3" y="4" width="5" height="16" rx="1.4" /><rect x="10" y="4" width="5" height="11" rx="1.4" /><rect x="17" y="4" width="4" height="14" rx="1.4" /></Svg>}
                {v === "list" ? "Lista" : "Quadro"}
              </button>
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        <Hoverable
          as="button"
          onClick={() => setShowArq((v) => !v)}
          title={showArq ? "Ocultar arquivados (Desqualificado, Contratado, Antigos)" : "Mostrar arquivados (Desqualificado, Contratado, Antigos)"}
          s={css(`display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; flex:none; border:1px solid ${showArq ? "#2563EB" : "#E2E3E9"}; background:${showArq ? "#EAF0FE" : "#fff"}; color:${showArq ? "#2563EB" : "#5B6472"}; cursor:pointer; border-radius:10px;`)}
          hover={showArq ? undefined : "background:#FAFAFB"}
        >
          <Svg size={17} sw={2.2}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>
        </Hoverable>
        <TalentoFiltro talentos={talentos} filtro={filtro} onChange={setFiltro} statusPermitidos={colunas.map((c) => c.key)} />
      </div>

      {/* ── Lista: tabela ordenável ── */}
      {vista === "list" && (
        <div className="m-pad" style={css("flex:1; min-height:0; padding:0 30px 24px; display:flex; flex-direction:column;")}>
          <div style={css("flex:1; min-height:0; overflow:auto; border:1px solid #ECEDF1; border-radius:12px; background:#fff;")}>
            <div style={css(`min-width:${GRID_MIN}px;`)}>
              <div style={css(`position:sticky; top:0; z-index:20; min-width:${GRID_MIN}px; display:grid; grid-template-columns:${GRID}; gap:14px; padding:11px 18px; border-bottom:1px solid #ECEDF1; background:#F4F5F7; font-size:11px; font-weight:700; color:#9398A6; letter-spacing:0.4px; text-transform:uppercase;`)}>
                {COLS.map((col) => (
                  <Hoverable key={col.key} onClick={() => toggleSort(col.key)} s={css("display:flex; align-items:center; gap:4px; overflow:hidden; cursor:pointer; user-select:none;")} hover="color:#5B6472">
                    <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{col.label}</span>
                    <span style={css(`color:${BRAND}; font-weight:800;`)}>{sort?.key === col.key ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
                  </Hoverable>
                ))}
              </div>
              {linhas.map((t) => {
                const p = statusPill(t.status);
                return (
                  <Hoverable key={t.id} onClick={() => abrir(t.id)} s={css(`display:grid; grid-template-columns:${GRID}; gap:14px; padding:13px 18px; border-bottom:1px solid #F4F5F7; align-items:center; cursor:pointer; font-size:13px; color:#3A3F4C;`)} hover="background:#FAFAFB">
                    <span style={css("color:#7A8090; white-space:nowrap;")}>{dataBR(t.criada)}</span>
                    <span style={css("font-weight:700; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{t.nome}</span>
                    <span style={css("overflow:hidden;")}>
                      <span style={css(`display:inline-flex; align-items:center; gap:6px; background:${p.bg}; color:${p.fg}; font-size:12px; font-weight:700; padding:4px 10px; border-radius:999px; white-space:nowrap;`)}>
                        <span style={css(`width:7px; height:7px; border-radius:50%; background:${p.fg};`)} />{p.label}
                      </span>
                    </span>
                    <span style={css("overflow:hidden;")}>
                      {t.vaga ? (
                        <span style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:3px 9px; border-radius:7px; white-space:nowrap; background:${vagaCor(t.vaga)}1A; color:${vagaCor(t.vaga)};`)}>
                          <span style={css(`width:7px; height:7px; border-radius:50%; background:${vagaCor(t.vaga)};`)} />{t.vaga}
                        </span>
                      ) : "—"}
                    </span>
                    <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-variant-numeric:tabular-nums;")}>{t.fone ? foneBR(t.fone) : "—"}</span>
                    <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{txt(t.qualidade)}</span>
                  </Hoverable>
                );
              })}
              {linhas.length === 0 && (
                <div style={css("padding:26px 18px; text-align:center; color:#B6BAC4; font-size:13px;")}>Nenhum candidato.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Quadro: colunas por status ── */}
      {vista === "board" && (
        <div className="m-pad" style={css("flex:1; min-height:0; padding:0 30px 24px; display:flex; flex-direction:column;")}>
          <div style={css("flex:1; min-height:0; overflow-x:auto; overflow-y:hidden; padding:20px 0 8px;")}>
            <div style={css("display:flex; gap:16px; height:100%; align-items:stretch;")}>
              {colunas.map((et) => {
                const col = talentosDo(et.key);
                if (collapsed[et.key]) {
                  return (
                    <Hoverable key={et.key} onClick={() => toggle(et.key)} title="Expandir coluna" s={css("align-self:stretch; display:flex; flex-direction:column; align-items:center; gap:11px; background:#F4F5F7; border-radius:14px; width:46px; flex:none; padding:14px 0 16px; cursor:pointer;")} hover="background:#EDEEF2">
                      <span style={css(`width:9px; height:9px; border-radius:50%; flex:none; background:${et.dot};`)} />
                      <span style={css("font-size:12.5px; font-weight:700; color:#9398A6;")}>{col.length}</span>
                      <span style={css("writing-mode:vertical-rl; transform:rotate(180deg); font-weight:700; font-size:13.5px; color:#3A3F4C; white-space:nowrap; letter-spacing:0.2px;")}>{et.label}</span>
                    </Hoverable>
                  );
                }
                return (
                  <div key={et.key} style={css("width:300px; flex:none; display:flex; flex-direction:column; min-height:0; background:#F4F5F7; border-radius:14px;")}>
                    <Hoverable onClick={() => toggle(et.key)} title="Recolher coluna" s={css("flex:none; display:flex; align-items:center; gap:9px; margin:6px 6px 0; padding:12px 12px 11px; cursor:pointer; border-radius:10px;")} hover="background:#EDEEF2">
                      <span style={css(`width:9px; height:9px; border-radius:50%; flex:none; background:${et.dot};`)} />
                      <span style={css("font-weight:700; font-size:13.5px; color:#3A3F4C;")}>{et.label}</span>
                      <span style={css("font-size:12.5px; font-weight:700; color:#9398A6;")}>{col.length}</span>
                    </Hoverable>
                    <div style={css("flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding:4px 12px 10px;")}>
                      {col.map((t) => (
                        <Hoverable key={t.id} onClick={() => abrir(t.id)} s={css("background:#fff; border:1px solid #ECEDF1; border-radius:12px; padding:14px 15px; box-shadow:0 1px 2px rgba(16,24,40,.04); cursor:pointer; user-select:none;")} hover="box-shadow:0 2px 8px rgba(16,24,40,.08)">
                          <div style={css("font-weight:700; font-size:14px; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:10px;")}>{t.nome}</div>
                          <div style={css("display:flex; flex-wrap:wrap; gap:6px; align-items:center;")}>
                            {t.vaga && (
                              <span style={css(`display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; padding:3px 9px; border-radius:7px; background:${vagaCor(t.vaga)}1A; color:${vagaCor(t.vaga)};`)}>
                                <span style={css(`width:6px; height:6px; border-radius:50%; background:${vagaCor(t.vaga)};`)} />{t.vaga}
                              </span>
                            )}
                            {t.qualidade && <span style={css("font-size:11.5px; font-weight:600; color:#5B6472; background:#EDEEF2; padding:3px 9px; border-radius:7px;")}>{t.qualidade}</span>}
                          </div>
                          {unidadeDe(t.unidadeId) && (
                            <div style={css("margin-top:8px; display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; color:#7A8090;")}>
                              <Svg size={12} sw={2.2} stroke="#9398A6"><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></Svg>{unidadeLabel(unidadeDe(t.unidadeId))}
                            </div>
                          )}
                          {t.fone && <div style={css("margin-top:10px; font-size:12.5px; color:#7A8090; font-variant-numeric:tabular-nums;")}>{foneBR(t.fone)}</div>}
                        </Hoverable>
                      ))}
                      {col.length === 0 && (
                        <div style={css("padding:16px 8px; text-align:center; color:#B6BAC4; font-size:12.5px;")}>Sem candidatos.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {aberto && (
        <TalentoDetail
          talento={aberto}
          canEdit={editavel}
          onClose={() => setAbertoId(null)}
          onPatch={(p) => { if (editavel) updateTalento(aberto.id, p); }}
          onDelete={() => { if (editavel) { removeTalento(aberto.id); setAbertoId(null); } }}
        />
      )}
    </div>
  );
}
