"use client";

import { css } from "@/lib/css";
import { CATEGORIAS_ESTOQUE, LOCAIS_ESTOQUE, corDaCategoria, qtdEm, totalProduto } from "@/lib/estoque";
import type { Produto } from "@/lib/types";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import EditableTitle from "../ui/EditableTitle";
import LogLine from "../ui/LogLine";
import QtdCell from "../ui/QtdCell";
import { useApp } from "../store";

/** ISO → "dd/mm/yyyy hh:mm" (Brasília). */
const dataHora = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "—";

/** Drawer do produto (Operacional → Estoque): quantidades por local à esquerda, histórico à direita. */
export default function ProdutoDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { produtos } = useApp();
  const p = produtos.find((x) => x.id === id);
  if (!p) return null;
  return <Body key={p.id} p={p} onClose={onClose} />;
}

function Body({ p, onClose }: { p: Produto; onClose: () => void }) {
  const { updateProduto, canEditPage } = useApp();
  const editavel = canEditPage("estoque");
  useFecharComEsc(true, onClose);
  const cor = corDaCategoria(p.categoria);
  // Mais recente primeiro: o que acabou de mudar fica no topo.
  const historico = [...(p.historico ?? [])].reverse();

  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:60; background:rgba(20,24,40,.32);")} />
      <div className="m-drawer m-stack" style={css("position:fixed; top:0; right:0; bottom:0; z-index:61; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:960px; max-width:96vw; display:flex; overflow:hidden;")}>
        <div style={css("flex:1.3; min-width:0; display:flex; flex-direction:column; border-right:1px solid #ECEDF1;")}>
          <div style={css("flex:1; min-height:0; overflow-y:auto; padding:22px 24px; display:flex; flex-direction:column;")}>
            <div style={css("display:flex; align-items:center; gap:11px; margin-bottom:20px;")}>
              <span style={css(`flex:none; width:34px; height:34px; border-radius:9px; background:${cor}1A; color:${cor}; display:flex; align-items:center; justify-content:center;`)}><Svg size={17} sw={2.2}><path d="M21 8 12 3 3 8v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></Svg></span>
              <div style={css("flex:1; min-width:0;")}>
                {editavel
                  ? <EditableTitle fill value={p.nome} onSave={(v) => updateProduto(p.id, { nome: v })} textStyle="margin:0; font-size:21px; font-weight:800; letter-spacing:-0.4px;" pencilSize={15} />
                  : <h2 style={css("margin:0; font-size:21px; font-weight:800; letter-spacing:-0.4px;")}>{p.nome}</h2>}
              </div>
            </div>
            <div style={css("display:flex; flex-direction:column; gap:2px;")}>
              <Row label="Categoria">
                {editavel ? (
                  <Menu trigger={(tg) => (
                    <span onClick={tg} style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; padding:5px 11px; border-radius:7px; cursor:pointer; background:${cor}1A; color:${cor};`)}><span style={css(`width:7px; height:7px; border-radius:50%; background:${cor};`)} />{p.categoria || "Sem categoria"}<Svg size={11} sw={2.4} style={css("flex:none; opacity:.6;")}><path d="m6 9 6 6 6-6" /></Svg></span>
                  )} width={230} z={64}>
                    {(c) => CATEGORIAS_ESTOQUE.map((k) => (<MenuItem key={k.v} checked={p.categoria === k.v} onClick={() => { if (k.v !== p.categoria) updateProduto(p.id, { categoria: k.v }); c(); }}><span style={css(`width:9px; height:9px; border-radius:50%; background:${k.cor};`)} /><span style={{ flex: 1 }}>{k.v}</span></MenuItem>))}
                  </Menu>
                ) : (
                  <span style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; padding:5px 11px; border-radius:7px; background:${cor}1A; color:${cor};`)}><span style={css(`width:7px; height:7px; border-radius:50%; background:${cor};`)} />{p.categoria || "Sem categoria"}</span>
                )}
              </Row>
              <Row label="Cadastrado em"><span style={css("font-size:13.5px; font-weight:600; color:#5B6472;")}>{dataHora(p.criada)}</span></Row>
              <Row label="Última atualização"><span style={css("font-size:13.5px; font-weight:600; color:#5B6472;")}>{dataHora(p.atualizada ?? p.criada)}</span></Row>
            </div>

            <div style={css("margin-top:18px; padding-top:18px; border-top:1px solid #F0F1F4;")}>
              <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:12px;")}>
                <Svg size={15} stroke="#5B6472"><rect x="3" y="4" width="18" height="16" rx="2.2" /><path d="M3 10h18M9 4v16" /></Svg>
                <span style={css("font-size:14px; font-weight:800;")}>Quantidade por unidade</span>
                <span style={{ flex: 1 }} />
                <span style={css("font-size:12.5px; font-weight:700; color:#7A8090;")}>Total <strong style={css("color:#1B1B28; font-size:14px;")}>{totalProduto(p.quantidades)}</strong></span>
              </div>
              <div style={css("border:1px solid #ECEDF1; border-radius:12px; overflow:hidden;")}>
                {LOCAIS_ESTOQUE.map((l, i) => {
                  const n = qtdEm(p.quantidades, l.id);
                  return (
                    <div key={l.id} style={css(`display:flex; align-items:center; gap:14px; padding:9px 14px; ${i ? "border-top:1px solid #F4F5F7;" : ""} background:${i % 2 ? "#FAFAFB" : "#fff"};`)}>
                      <span style={css("flex:1; font-size:13.5px; font-weight:700; color:#3A3F4C;")}>{l.label}</span>
                      {editavel
                        ? <QtdCell size="lg" value={n} onSave={(v) => updateProduto(p.id, { quantidades: { ...p.quantidades, [l.id]: v } })} />
                        : <span style={css(`width:92px; text-align:center; font-size:15px; font-weight:800; font-variant-numeric:tabular-nums; color:${n ? "#1B1B28" : "#C7CAD2"};`)}>{n}</span>}
                    </div>
                  );
                })}
              </div>
              {editavel && <p style={css("margin:10px 0 0; font-size:12px; color:#9398A6; line-height:1.5;")}>Digite a nova quantidade e pressione Enter (ou saia do campo) para salvar. Cada alteração fica registrada no histórico.</p>}
            </div>
          </div>
        </div>
        <div style={css("flex:1; min-width:0; display:flex; flex-direction:column; background:#FAFAFB;")}>
          <div style={css("display:flex; align-items:center; gap:9px; padding:14px 22px; border-bottom:1px solid #ECEDF1; height:60px;")}>
            <span style={css("font-weight:800; font-size:15px;")}>Histórico</span>
            <span style={css("font-size:12px; color:#9398A6; font-weight:700;")}>{historico.length}</span>
            <span style={{ flex: 1 }} />
            <Hoverable as="button" onClick={onClose} s={css("width:30px; height:30px; border:1px solid #ECEDF1; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
          </div>
          <div style={css("flex:1; overflow-y:auto; padding:18px 20px; display:flex; flex-direction:column; gap:10px;")}>
            {historico.length === 0 ? (
              <div style={css("flex:1; display:flex; align-items:center; justify-content:center; text-align:center; color:#9398A6; padding:30px 10px;")}>
                <div>
                  <Svg size={30} sw={1.6} stroke="#C7CAD2" style={css("margin-bottom:8px;")}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></Svg>
                  <div style={css("font-size:13px; font-weight:600;")}>Nenhuma alteração registrada ainda.</div>
                </div>
              </div>
            ) : (
              historico.map((c) => <LogLine key={c.id} c={c} />)
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={css("display:flex; align-items:center; gap:14px; padding:9px 0;")}>
      <span style={css("width:130px; flex:none; font-size:13px; color:#7A8090; font-weight:600;")}>{label}</span>
      {children}
    </div>
  );
}
