"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { CATEGORIAS_ESTOQUE, LOCAIS_ESTOQUE, corDaCategoria } from "@/lib/estoque";
import { comItem, itemQtd, totalPorLocal, totalProdutoNoPedido, type Itens } from "@/lib/pedido";
import type { Produto } from "@/lib/types";
import { Svg } from "./Svg";
import QtdCell from "./QtdCell";

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const COL_PROD = 250, COL_LOCAL = 84, COL_TOTAL = 70;
const GRID = `${COL_PROD}px ${LOCAIS_ESTOQUE.map(() => `${COL_LOCAL}px`).join(" ")} ${COL_TOTAL}px`;
const GRID_MIN = COL_PROD + COL_LOCAL * LOCAIS_ESTOQUE.length + COL_TOTAL + 10 * (LOCAIS_ESTOQUE.length + 1) + 28;
const fixa = (fundo: string, z: number) => `position:sticky; left:0; z-index:${z}; background:${fundo}; padding-left:14px; margin-left:-14px;`;

/**
 * Matriz produto × unidade de uma ordem de serviço (cadastro e detalhe). Os produtos vêm do
 * Estoque, agrupados por categoria; `itens` só guarda as células com quantidade > 0.
 *  - `soComQuantidade`: esconde produtos zerados (visão de "o que produzir").
 */
export default function MatrizPedido({ produtos, itens, onChange, editavel, soComQuantidade = false, busca = "" }: {
  produtos: Produto[];
  itens: Itens;
  onChange?: (itens: Itens) => void;
  editavel: boolean;
  soComQuantidade?: boolean;
  busca?: string;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const q = semAcento(busca.trim());
  const ordemCat = (c: string) => { const i = CATEGORIAS_ESTOQUE.findIndex((x) => x.v === c); return i < 0 ? 999 : i; };
  const cats = [...CATEGORIAS_ESTOQUE.map((c) => c.v), ...new Set(produtos.map((p) => p.categoria).filter((c) => ordemCat(c) === 999))];
  const visiveis = produtos
    .filter((p) => !q || semAcento(p.nome).includes(q))
    .filter((p) => !soComQuantidade || totalProdutoNoPedido(itens, p.id) > 0);
  // Produtos apagados do Estoque que ainda estão no pedido aparecem no fim, para não sumir quantidade.
  const removidos = Object.keys(itens).filter((id) => !produtos.some((p) => p.id === id));
  const grupos = cats
    .map((c) => ({ key: c, label: c || "Sem categoria", cor: corDaCategoria(c), itens: visiveis.filter((p) => p.categoria === c).sort((a, b) => a.nome.localeCompare(b.nome, "pt")) }))
    .filter((g) => g.itens.length);
  const totais = totalPorLocal(itens);
  const set = (pid: string, local: string, n: number) => onChange?.(comItem(itens, pid, local, n));
  const cell = (pid: string, local: string) => {
    const n = itemQtd(itens, pid, local);
    return editavel
      ? <QtdCell value={n} onSave={(v) => set(pid, local, v)} />
      : <span style={css(`font-size:13.5px; font-weight:700; font-variant-numeric:tabular-nums; color:${n ? "#1B1B28" : "#D5D8DF"};`)}>{n}</span>;
  };

  if (!grupos.length && !removidos.length) {
    return (
      <div style={css("padding:34px 16px; text-align:center; color:#9398A6; font-size:13px; font-weight:600; border:1px dashed #E2E3E9; border-radius:12px;")}>
        {produtos.length === 0 ? "Nenhum produto cadastrado no Estoque." : soComQuantidade ? "Nenhum item com quantidade nesta ordem." : "Nenhum produto encontrado."}
      </div>
    );
  }

  return (
    <div style={css("overflow:auto; border:1px solid #ECEDF1; border-radius:12px; background:#fff; transform:translateZ(0);")}>
      <div style={css(`min-width:${GRID_MIN}px;`)}>
        <div style={css(`position:sticky; top:0; z-index:6; display:grid; grid-template-columns:${GRID}; gap:10px; padding:9px 14px; background:#FAFAFB; border-bottom:1px solid #ECEDF1; font-size:11px; font-weight:700; color:#9398A6; letter-spacing:0.4px; text-transform:uppercase;`)}>
          <span style={css(fixa("#FAFAFB", 7))}>Produto</span>
          {LOCAIS_ESTOQUE.map((l) => <span key={l.id} style={css("text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{l.label}</span>)}
          <span style={css("text-align:center;")}>Total</span>
        </div>
        {grupos.map((g) => {
          const open = !collapsed[g.key];
          const totalCat = g.itens.reduce((s, p) => s + totalProdutoNoPedido(itens, p.id), 0);
          return (
            <div key={g.key}>
              <div onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))} style={css(`position:sticky; left:0; display:flex; align-items:center; gap:8px; padding:8px 14px; background:${g.cor}0D; border-bottom:1px solid #F0F1F4; cursor:pointer; user-select:none; width:max-content; min-width:100%; box-sizing:border-box;`)}>
                <Svg size={13} sw={2.4} stroke={g.cor} style={css(`transform:rotate(${open ? 0 : -90}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
                <span style={css(`font-size:11.5px; font-weight:800; color:${g.cor}; letter-spacing:0.3px; text-transform:uppercase;`)}>{g.label}</span>
                <span style={css("font-size:12px; color:#9398A6; font-weight:700;")}>{g.itens.length}{totalCat ? ` · ${totalCat} un.` : ""}</span>
              </div>
              {open && g.itens.map((p) => {
                const tot = totalProdutoNoPedido(itens, p.id);
                return (
                  <div key={p.id} style={css(`display:grid; grid-template-columns:${GRID}; gap:10px; padding:6px 14px; border-bottom:1px solid #F4F5F7; align-items:center; background:${tot ? "#fff" : "#FFFFFF"};`)}>
                    <span style={css(`${fixa("#fff", 1)} align-self:stretch; display:flex; align-items:center; font-size:13.5px; font-weight:${tot ? 700 : 600}; color:${tot ? "#1B1B28" : "#5B6472"}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`)}>{p.nome}</span>
                    {LOCAIS_ESTOQUE.map((l) => <div key={l.id} style={css("display:flex; justify-content:center;")}>{cell(p.id, l.id)}</div>)}
                    <span style={css(`text-align:center; font-size:13.5px; font-weight:800; font-variant-numeric:tabular-nums; color:${tot ? "#1B1B28" : "#D5D8DF"};`)}>{tot}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
        {removidos.length > 0 && (
          <div>
            <div style={css("position:sticky; left:0; display:flex; align-items:center; gap:8px; padding:8px 14px; background:#F7F7F9; border-bottom:1px solid #F0F1F4; width:max-content; min-width:100%; box-sizing:border-box;")}>
              <span style={css("font-size:11.5px; font-weight:800; color:#7A8090; letter-spacing:0.3px; text-transform:uppercase;")}>Produtos removidos do estoque</span>
            </div>
            {removidos.map((pid) => (
              <div key={pid} style={css(`display:grid; grid-template-columns:${GRID}; gap:10px; padding:6px 14px; border-bottom:1px solid #F4F5F7; align-items:center;`)}>
                <span style={css(`${fixa("#fff", 1)} align-self:stretch; display:flex; align-items:center; font-size:13.5px; font-weight:600; color:#9398A6; font-style:italic;`)}>Produto removido</span>
                {LOCAIS_ESTOQUE.map((l) => <div key={l.id} style={css("display:flex; justify-content:center;")}>{cell(pid, l.id)}</div>)}
                <span style={css("text-align:center; font-size:13.5px; font-weight:800; color:#1B1B28;")}>{totalProdutoNoPedido(itens, pid)}</span>
              </div>
            ))}
          </div>
        )}
        <div style={css(`position:sticky; bottom:0; z-index:6; display:grid; grid-template-columns:${GRID}; gap:10px; padding:10px 14px; background:#FAFAFB; border-top:1px solid #ECEDF1; align-items:center;`)}>
          <span style={css(`${fixa("#FAFAFB", 7)} align-self:stretch; display:flex; align-items:center; font-size:12px; font-weight:800; color:#5B6472; text-transform:uppercase; letter-spacing:0.4px;`)}>Total por unidade</span>
          {LOCAIS_ESTOQUE.map((l) => <span key={l.id} style={css(`text-align:center; font-size:13.5px; font-weight:800; font-variant-numeric:tabular-nums; color:${totais[l.id] ? "#1B1B28" : "#C7CAD2"};`)}>{totais[l.id]}</span>)}
          <span style={css("text-align:center; font-size:14px; font-weight:800; color:#955C6B;")}>{Object.values(totais).reduce((s, n) => s + n, 0)}</span>
        </div>
      </div>
    </div>
  );
}
