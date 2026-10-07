"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { ACCENT, BRAND } from "@/lib/theme";
import { CATEGORIAS_ESTOQUE, LOCAIS_ESTOQUE, corDaCategoria, qtdEm, totalProduto } from "@/lib/estoque";
import type { Produto } from "@/lib/types";
import { useApp } from "../store";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import EditableTitle from "../ui/EditableTitle";
import ConfirmModal from "../ui/ConfirmModal";
import ProdutoForm from "../modals/ProdutoForm";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { htmlRelatorioEstoque } from "@/lib/relatorio-estoque";
import { imprimirRomaneio } from "@/lib/romaneio";
import ProdutoDetail from "../modals/ProdutoDetail";
import QtdCell from "../ui/QtdCell";

// Impede o clique numa célula editável de abrir o detalhe do produto (clique na linha).
const stop = (e: React.MouseEvent) => e.stopPropagation();

type SortKey = "nome" | "categoria" | "total" | "atualizada" | `local:${string}`;
type GroupBy = "categoria" | "none";
const GROUP_OPTS: { key: GroupBy; label: string }[] = [
  { key: "categoria", label: "Categoria" },
  { key: "none", label: "Sem agrupamento" },
];

// Colunas: Produto (travada à esquerda) · Categoria · um local por coluna · Total · Atualização · ações.
const COL_W = { nome: 250, categoria: 180, local: 88, total: 80, atualizada: 150, acoes: 40 };
const GRID = `${COL_W.nome}px ${COL_W.categoria}px ${LOCAIS_ESTOQUE.map(() => `${COL_W.local}px`).join(" ")} ${COL_W.total}px ${COL_W.atualizada}px ${COL_W.acoes}px`;
const NCOLS = 5 + LOCAIS_ESTOQUE.length;
const GRID_MIN = COL_W.nome + COL_W.categoria + COL_W.local * LOCAIS_ESTOQUE.length + COL_W.total + COL_W.atualizada + COL_W.acoes + 14 * (NCOLS - 1) + 36;
/** Célula travada (Produto): fundo opaco porque as outras colunas deslizam por baixo. */
const fixa = (fundo: string, z: number) => `position:sticky; left:0; z-index:${z}; background:${fundo}; padding-left:18px; margin-left:-18px;`;

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** ISO → "dd/mm/yyyy hh:mm" (Brasília). */
const dataHora = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "—";

/** Operacional → Estoque: lista de produtos por categoria, com cadastro e ajuste de quantidade. */
export default function Estoque() {
  const { produtos, updateProduto, removeProduto, canEditPage, workspace } = useApp();
  const editavel = canEditPage("estoque");

  const [formOpen, setFormOpen] = useState(false);
  const [catForm, setCatForm] = useState(""); // "+" de um grupo abre o cadastro já na categoria
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("categoria");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [confirmDel, setConfirmDel] = useState<Produto | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null); // produto aberto no drawer
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "nome", dir: 1 });
  const toggleSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: 1 }));

  const q = semAcento(busca.trim());
  const lista = produtos.filter((p) => (!filtroCat || p.categoria === filtroCat) && (!q || semAcento(p.nome).includes(q)));
  const ordemCat = (c: string) => { const i = CATEGORIAS_ESTOQUE.findIndex((x) => x.v === c); return i < 0 ? 999 : i; };
  const sortRows = (rows: Produto[]): Produto[] =>
    [...rows].sort((a, b) => {
      const r =
        sort.key === "total" ? totalProduto(a.quantidades) - totalProduto(b.quantidades)
        : sort.key.startsWith("local:") ? qtdEm(a.quantidades, sort.key.slice(6)) - qtdEm(b.quantidades, sort.key.slice(6))
        : sort.key === "categoria" ? ordemCat(a.categoria) - ordemCat(b.categoria)
        : sort.key === "atualizada" ? (a.atualizada ?? "").localeCompare(b.atualizada ?? "")
        : 0;
      return (r || a.nome.localeCompare(b.nome, "pt")) * sort.dir;
    });

  // Grupos na ordem da planilha; categoria fora da lista (dado antigo) entra no fim.
  const cats = [...CATEGORIAS_ESTOQUE.map((c) => c.v), ...new Set(lista.map((p) => p.categoria).filter((c) => ordemCat(c) === 999))];
  const groups =
    groupBy === "none"
      ? [{ key: "all", label: "Todos", cor: "#9398A6", itens: lista }]
      : cats.map((c) => ({ key: c, label: c || "Sem categoria", cor: corDaCategoria(c), itens: lista.filter((p) => p.categoria === c) })).filter((g) => g.itens.length);

  const filtroAtivo = !!q || !!filtroCat;
  // Relatório de estoque (somente leitura): produtos da lista atual, para imprimir/PDF.
  const [escolhaRel, setEscolhaRel] = useState<{ ocultarZerados: boolean } | null>(null);
  const gerarRelatorio = (ocultarZerados: boolean, locais: string[]) => {
    const logo = workspace.logo ? (workspace.logo.startsWith("http") || workspace.logo.startsWith("data:") ? workspace.logo : `${window.location.origin}${workspace.logo}`) : `${window.location.origin}/logo.png`;
    const filtro = [filtroCat, q ? `busca “${busca.trim()}”` : ""].filter(Boolean).join(" · ") + (ocultarZerados ? `${filtroCat || q ? " · " : ""}só com estoque` : "");
    if (!imprimirRomaneio(htmlRelatorioEstoque({ produtos: lista, empresa: workspace.nome, logo, filtro, ocultarZerados, locais }))) window.alert("Libere pop-ups para gerar o relatório.");
  };
  const cols: { id: string; label: string; key?: SortKey }[] = [
    { id: "nome", label: "Produto", key: "nome" },
    { id: "categoria", label: "Categoria", key: "categoria" },
    ...LOCAIS_ESTOQUE.map((l) => ({ id: l.id, label: l.label, key: `local:${l.id}` as SortKey })),
    { id: "total", label: "Total", key: "total" as SortKey },
    { id: "atualizada", label: "Última atualização", key: "atualizada" },
    { id: "acoes", label: "" },
  ];

  const renderRow = (p: Produto) => {
    const cor = corDaCategoria(p.categoria);
    const pill = (
      <span style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:4px 10px; border-radius:7px; background:${cor}1A; color:${cor}; ${editavel ? "cursor:pointer;" : ""} max-width:100%;`)}>
        <span style={css(`width:7px; height:7px; flex:none; border-radius:50%; background:${cor};`)} />
        <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{p.categoria || "Sem categoria"}</span>
        {editavel && <Svg size={11} sw={2.4} stroke="currentColor" style={css("flex:none; opacity:.55;")}><path d="m6 9 6 6 6-6" /></Svg>}
      </span>
    );
    return (
      <Hoverable key={p.id} onClick={() => setDetalhe(p.id)} s={css(`display:grid; grid-template-columns:${GRID}; gap:14px; padding:10px 18px; border-bottom:1px solid #F4F5F7; align-items:center; cursor:pointer;`)} hover="background:#FAFAFB">
        <div style={css(`${fixa("#fff", 1)} align-self:stretch; display:flex; align-items:center; min-width:0;`)}>
          {editavel
            ? <EditableTitle fill value={p.nome} onSave={(v) => updateProduto(p.id, { nome: v })} textStyle="font-weight:600; font-size:13.5px;" />
            : <span style={css("display:block; font-weight:600; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{p.nome}</span>}
        </div>
        <div onClick={stop} style={{ minWidth: 0 }}>
          {editavel ? (
            <Menu trigger={(tg) => <span onClick={tg} style={css("display:inline-flex; max-width:100%;")}>{pill}</span>} width={230}>
              {(close) => CATEGORIAS_ESTOQUE.map((c) => (
                <MenuItem key={c.v} checked={p.categoria === c.v} onClick={() => { if (c.v !== p.categoria) updateProduto(p.id, { categoria: c.v }); close(); }}>
                  <span style={css(`width:9px; height:9px; border-radius:50%; background:${c.cor};`)} /><span style={{ flex: 1 }}>{c.v}</span>
                </MenuItem>
              ))}
            </Menu>
          ) : pill}
        </div>
        {LOCAIS_ESTOQUE.map((l) => {
          const n = qtdEm(p.quantidades, l.id);
          return (
            <div key={l.id} style={css("display:flex; justify-content:center;")}>
              {editavel
                ? <QtdCell value={n} onSave={(v) => updateProduto(p.id, { quantidades: { ...p.quantidades, [l.id]: v } })} />
                : <span style={css(`font-size:13.5px; font-weight:700; font-variant-numeric:tabular-nums; color:${n ? "#1B1B28" : "#C7CAD2"};`)}>{n}</span>}
            </div>
          );
        })}
        <span style={css("text-align:center; font-size:13.5px; font-weight:800; font-variant-numeric:tabular-nums; color:#1B1B28;")}>{totalProduto(p.quantidades)}</span>
        <span style={css("font-size:12.5px; color:#7A8090; font-weight:600;")}>{dataHora(p.atualizada ?? p.criada)}</span>
        <div onClick={stop} style={css("display:flex; justify-content:center;")}>
          {editavel && (
            <Hoverable as="button" title="Excluir produto" onClick={() => setConfirmDel(p)} s={css("flex:none; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:none; background:transparent; border-radius:7px; cursor:pointer; color:#C7CAD2;")} hover="background:#FDECEC; color:#CC3338">
              <Svg size={15} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></Svg>
            </Hoverable>
          )}
        </div>
      </Hoverable>
    );
  };

  return (
    <div style={css("height:100%; display:flex; flex-direction:column;")}>
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:24px 30px 18px;")}>
        <div style={{ flex: 1 }}>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Estoque</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>
            {lista.length} {lista.length === 1 ? "produto" : "produtos"}{groupBy === "none" ? "" : " · agrupados por categoria"}
          </p>
        </div>
      </div>

      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:12px; padding:0 30px 16px;")}>
        {editavel && (
          <Hoverable as="button" onClick={() => setFormOpen(true)} s={css(`display:flex; align-items:center; gap:7px; border:none; cursor:pointer; background:${BRAND}; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:10px;`)} hover="filter:brightness(1.12)">
            <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>
            Novo produto
          </Hoverable>
        )}
        <div style={css("display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #E2E3E9; border-radius:10px; padding:0 12px; height:36px; width:260px; max-width:100%;")}>
          <Svg size={15} sw={2.2} stroke="#9398A6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto" style={css("flex:1; min-width:0; border:none; outline:none; background:transparent; font-size:13px; font-weight:600; color:#1B1B28;")} />
        </div>
        <span style={{ flex: 1 }} />
        <Menu align="right" width={250} trigger={(toggle) => (
          <Hoverable as="button" onClick={toggle} title="Relatório de estoque para imprimir ou salvar em PDF" s={css("display:inline-flex; align-items:center; gap:8px; background:#fff; border:1px solid #E2E3E9; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:8px 14px; border-radius:10px;")} hover="background:#FAFAFB">
            <Svg size={15} sw={2.2}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" rx="1" /></Svg>
            Relatório
            <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
          </Hoverable>
        )}>
          {(close) => (
            <>
              <div style={css("font-size:11px; font-weight:700; color:#9398A6; letter-spacing:0.5px; text-transform:uppercase; padding:7px 10px 5px;")}>{filtroAtivo ? "Produtos do filtro atual" : "Todos os produtos"}</div>
              <MenuItem onClick={() => { setEscolhaRel({ ocultarZerados: false }); close(); }}><span style={{ flex: 1 }}>Todos ({lista.length})</span></MenuItem>
              <MenuItem onClick={() => { setEscolhaRel({ ocultarZerados: true }); close(); }}><span style={{ flex: 1 }}>Só com estoque ({lista.filter((p) => totalProduto(p.quantidades) > 0).length})</span></MenuItem>
            </>
          )}
        </Menu>
        <Menu align="right" width={220} trigger={(toggle) => (
          <Hoverable as="button" onClick={toggle} s={css("display:inline-flex; align-items:center; gap:8px; background:#fff; border:1px solid #E2E3E9; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:8px 14px; border-radius:10px;")} hover="background:#FAFAFB">
            <Svg size={15} stroke={ACCENT}><rect x="3" y="4" width="7" height="7" rx="1.6" /><rect x="14" y="4" width="7" height="7" rx="1.6" /><rect x="3" y="15" width="7" height="5" rx="1.6" /><rect x="14" y="15" width="7" height="5" rx="1.6" /></Svg>
            <span style={css("color:#9398A6; font-weight:600;")}>Agrupar por</span> {GROUP_OPTS.find((o) => o.key === groupBy)?.label}
            <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
          </Hoverable>
        )}>
          {(close) => GROUP_OPTS.map((o) => (
            <MenuItem key={o.key} checked={groupBy === o.key} accent={ACCENT} onClick={() => { setGroupBy(o.key); close(); }}>
              <span style={{ flex: 1 }}>{o.label}</span>
            </MenuItem>
          ))}
        </Menu>
        <Menu align="right" width={230} trigger={(toggle) => (
          <Hoverable as="button" onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:8px; background:${filtroCat ? "#FDF1F4" : "#fff"}; border:1px solid ${filtroCat ? ACCENT : "#E2E3E9"}; color:${filtroCat ? ACCENT : "#3A3F4C"}; cursor:pointer; font-size:13px; font-weight:700; padding:8px 14px; border-radius:10px;`)} hover={filtroCat ? undefined : "background:#FAFAFB"}>
            <Svg size={15} sw={2.2}><path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5z" /></Svg>
            {filtroCat || "Categoria"}
            <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
          </Hoverable>
        )}>
          {(close) => (
            <>
              <MenuItem checked={!filtroCat} accent={ACCENT} onClick={() => { setFiltroCat(""); close(); }}><span style={{ flex: 1 }}>Todas as categorias</span></MenuItem>
              {CATEGORIAS_ESTOQUE.map((c) => (
                <MenuItem key={c.v} checked={filtroCat === c.v} accent={ACCENT} onClick={() => { setFiltroCat(c.v); close(); }}>
                  <span style={css(`width:9px; height:9px; border-radius:50%; background:${c.cor};`)} /><span style={{ flex: 1 }}>{c.v}</span>
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      </div>

      {lista.length === 0 ? (
        <div style={css("flex:1; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px 30px; gap:14px;")}>
          <span style={css("width:56px; height:56px; border-radius:16px; background:#F2F3F6; display:flex; align-items:center; justify-content:center; color:#B4B8C4;")}>
            <Svg size={26} sw={1.8}><path d="M21 8 12 3 3 8v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></Svg>
          </span>
          <div style={css("font-size:15.5px; font-weight:800; color:#3A3F4C; letter-spacing:-0.2px;")}>
            {filtroAtivo ? "Nenhum produto com esses filtros" : "Nenhum produto cadastrado"}
          </div>
          <div style={css("font-size:13px; color:#9398A6; font-weight:600; max-width:340px; line-height:1.5;")}>
            {filtroAtivo ? "Ajuste a busca ou a categoria para ver mais produtos." : editavel ? "Use o botão “Novo produto” para cadastrar o primeiro." : "Quando houver produtos, eles aparecem aqui."}
          </div>
        </div>
      ) : (
        <div style={css("flex:1; min-height:0; padding:18px 30px 0; display:flex; flex-direction:column; transform:translateZ(0);")} className="m-pad">
          <div style={css("flex:1; min-height:0; overflow:auto; padding:0 0 16px;")}>
            {groups.map((grp) => {
              const semGrupo = groupBy === "none";
              const open = semGrupo || !collapsed[grp.key];
              const total = grp.itens.reduce((s, p) => s + totalProduto(p.quantidades), 0);
              return (
                <div key={grp.key} style={css(semGrupo ? "" : "padding-bottom:22px;")}>
                  <div style={css(`position:sticky; top:0; z-index:20; background:#F7F7F9; min-width:${GRID_MIN}px;`)}>
                    {!semGrupo && (
                      <div style={css("position:sticky; left:0; width:max-content; max-width:100%; background:#F7F7F9; display:flex; align-items:center; gap:10px; padding:2px 0 9px;")}>
                        <Hoverable as="button" onClick={() => setCollapsed((c) => ({ ...c, [grp.key]: !c[grp.key] }))} s={css("width:26px; height:26px; flex:none; border:1px solid #E2E3E9; background:#fff; border-radius:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#5B6472;")} hover="background:#F2F3F6">
                          <Svg size={14} sw={2.4} style={css(`transform:rotate(${open ? 0 : -90}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
                        </Hoverable>
                        <span style={css(`display:inline-flex; align-items:center; gap:7px; background:${grp.cor}1A; color:${grp.cor}; font-size:12.5px; font-weight:800; padding:4px 12px; border-radius:8px; letter-spacing:0.3px; text-transform:uppercase;`)}>
                          <span style={css(`width:9px; height:9px; border-radius:50%; background:${grp.cor};`)} />
                          {grp.label}
                        </span>
                        <span style={css("font-size:13px; color:#9398A6; font-weight:700;")}>{grp.itens.length} · {total} un.</span>
                        {editavel && (
                          <Hoverable as="button" title={`Novo produto em ${grp.label}`} onClick={() => { setCatForm(grp.key); setFormOpen(true); }} s={css("width:24px; height:24px; flex:none; border:none; background:transparent; border-radius:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9398A6;")} hover="background:#ECEDF1; color:#3A3F4C">
                            <Svg size={14} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>
                          </Hoverable>
                        )}
                      </div>
                    )}
                    {open && (
                      <div style={css(`display:grid; grid-template-columns:${GRID}; gap:14px; padding:10px 18px; border:1px solid #ECEDF1; background:#FAFAFB; border-radius:12px 12px 0 0; font-size:11px; font-weight:700; color:#9398A6; letter-spacing:0.4px; text-transform:uppercase;`)}>
                        {cols.map((col) => {
                          const centro = col.id !== "nome" && col.id !== "categoria" && col.id !== "atualizada";
                          return col.key ? (
                            <Hoverable key={col.id} onClick={() => toggleSort(col.key!)} s={css(`${col.id === "nome" ? fixa("#FAFAFB", 5) : ""} display:flex; align-items:center; gap:4px; overflow:hidden; cursor:pointer; user-select:none; min-width:0; ${centro ? "justify-content:center;" : ""}`)} hover="color:#5B6472">
                              <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{col.label}</span>
                              <span style={css(`color:${ACCENT}; font-weight:800;`)}>{sort.key === col.key ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
                            </Hoverable>
                          ) : <span key={col.id} />;
                        })}
                      </div>
                    )}
                  </div>
                  {open && (
                    <div style={css(`background:#fff; border:1px solid #ECEDF1; border-top:none; border-radius:0 0 12px 12px; min-width:${GRID_MIN}px;`)}>
                      {sortRows(grp.itens).map(renderRow)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {escolhaRel && (
        <EscolherUnidades
          ocultarZerados={escolhaRel.ocultarZerados}
          onClose={() => setEscolhaRel(null)}
          onGerar={(locais) => { gerarRelatorio(escolhaRel.ocultarZerados, locais); setEscolhaRel(null); }}
        />
      )}
      <ProdutoDetail id={detalhe} onClose={() => setDetalhe(null)} />
      <ProdutoForm open={formOpen} categoriaInicial={catForm} onClose={() => { setFormOpen(false); setCatForm(""); }} />

      {confirmDel && (
        <ConfirmModal
          danger
          titulo="Excluir produto"
          confirmLabel="Excluir"
          mensagem={<>Tem certeza que deseja excluir <strong style={css("color:#1B1B28;")}>{confirmDel.nome}</strong> do estoque? Essa ação não pode ser desfeita.</>}
          onConfirm={() => { removeProduto(confirmDel.id); setConfirmDel(null); }}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

/** Popup do relatório: escolher as unidades (uma, várias ou todas). */
function EscolherUnidades({ ocultarZerados, onClose, onGerar }: { ocultarZerados: boolean; onClose: () => void; onGerar: (locais: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(LOCAIS_ESTOQUE.map((l) => l.id));
  useFecharComEsc(true, onClose);
  const todas = sel.length === LOCAIS_ESTOQUE.length;
  const alternar = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : LOCAIS_ESTOQUE.map((l) => l.id).filter((x) => x === id || s.includes(x))));
  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:90; background:rgba(20,24,40,.4);")} />
      <div style={css("position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:91; width:420px; max-width:94vw; background:#fff; border-radius:16px; box-shadow:0 24px 70px rgba(20,24,40,.32); overflow:hidden;")}>
        <div style={css("padding:18px 20px 12px; border-bottom:1px solid #ECEDF1;")}>
          <div style={css("font-size:16.5px; font-weight:800; letter-spacing:-0.3px;")}>Relatório de estoque</div>
          <div style={css("font-size:12.5px; color:#7A8090; font-weight:600; margin-top:2px;")}>{ocultarZerados ? "Só produtos com estoque" : "Todos os produtos"} · escolha as unidades</div>
        </div>
        <div style={css("padding:12px 14px;")}>
          <Hoverable onClick={() => setSel(todas ? [] : LOCAIS_ESTOQUE.map((l) => l.id))} s={css("display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:9px; cursor:pointer; font-size:13.5px; font-weight:800; color:#1B1B28; border-bottom:1px solid #F0F1F4; margin-bottom:4px;")} hover="background:#F7F7F9">
            <Caixa on={todas} parcial={!todas && sel.length > 0} />Todas as unidades
          </Hoverable>
          {LOCAIS_ESTOQUE.map((l) => (
            <Hoverable key={l.id} onClick={() => alternar(l.id)} s={css("display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:9px; cursor:pointer; font-size:13.5px; font-weight:600; color:#3A3F4C;")} hover="background:#F7F7F9">
              <Caixa on={sel.includes(l.id)} />{l.label}
            </Hoverable>
          ))}
        </div>
        <div style={css("display:flex; align-items:center; gap:10px; padding:14px 20px; border-top:1px solid #ECEDF1;")}>
          <span style={css("flex:1; font-size:12px; color:#9398A6; font-weight:600;")}>{sel.length ? `${sel.length} ${sel.length === 1 ? "unidade" : "unidades"}` : "Escolha ao menos uma"}</span>
          <Hoverable as="button" onClick={onClose} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:13.5px; font-weight:700; padding:10px 16px; border-radius:10px;")} hover="background:#F4F4F7">Cancelar</Hoverable>
          <Hoverable as="button" onClick={() => sel.length && onGerar(sel)} {...{ disabled: !sel.length }} s={css(`border:none; background:${BRAND}; color:#fff; cursor:${sel.length ? "pointer" : "not-allowed"}; opacity:${sel.length ? 1 : 0.45}; font-size:13.5px; font-weight:700; padding:10px 16px; border-radius:10px;`)} hover={sel.length ? "filter:brightness(1.1)" : undefined}>Gerar relatório</Hoverable>
        </div>
      </div>
    </>
  );
}

function Caixa({ on, parcial }: { on: boolean; parcial?: boolean }) {
  return (
    <span style={css(`width:18px; height:18px; flex:none; border-radius:5px; border:1.5px solid ${on || parcial ? BRAND : "#C7CAD2"}; background:${on ? BRAND : "#fff"}; display:flex; align-items:center; justify-content:center; color:#fff;`)}>
      {on ? <Svg size={12} sw={3}><path d="M20 6 9 17l-5-5" /></Svg> : parcial ? <span style={css(`width:8px; height:2px; background:${BRAND}; border-radius:1px;`)} /> : null}
    </span>
  );
}
