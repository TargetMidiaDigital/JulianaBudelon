"use client";

import { css } from "@/lib/css";
import { LOCAIS_ESTOQUE } from "@/lib/estoque";
import { pedidoStatusInfo } from "@/lib/pedido";
import { divergencias, relatorioDaOrdem, textoDivergencias, type LinhaRelatorio } from "@/lib/relatorio";
import type { Pedido } from "@/lib/types";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import { gestorOf, useApp } from "../store";

const COLS = ["Pedido", "Produzido", "Separado", "Recebido"] as const;
const val = (v: number | null | undefined) => (v === null ? "n/a" : v === undefined ? "—" : String(v));
const cor = (v: number | null | undefined, ref: number) => (v == null ? "#B6BAC4" : v === ref ? "#1B1B28" : v < ref ? "#CC3338" : "#C25712");
const soma = (ls: LinhaRelatorio[], k: "pedido" | "produzido" | "separado" | "recebido") => {
  const vs = ls.map((l) => l[k]).filter((v) => v !== null);
  if (!vs.length) return null;
  if (vs.some((v) => v === undefined)) return undefined;
  return (vs as number[]).reduce((s, n) => s + n, 0);
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Relatório da ordem: pedido × produzido × separado × recebido por unidade, com divergências. */
export default function RelatorioOrdem({ pedido, onClose }: { pedido: Pedido; onClose: () => void }) {
  const { tasks, produtos, team } = useApp();
  useFecharComEsc(true, onClose);
  const linhas = relatorioDaOrdem(pedido, tasks, produtos);
  const grupos = LOCAIS_ESTOQUE.map((l) => ({ ...l, linhas: linhas.filter((x) => x.local === l.id) })).filter((g) => g.linhas.length);
  const comDivergencia = linhas.filter((l) => divergencias(l).length);
  const pendentes = linhas.filter((l) => l.produzido === undefined || l.separado === undefined || l.recebido === undefined).length;
  const autor = gestorOf(team, pedido.criadoPor);
  const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");

  const imprimir = () => {
    const linha = (l: LinhaRelatorio) => `<tr><td>${esc(l.produto)}</td>${COLS.map((c) => { const k = c.toLowerCase() as "pedido"; const v = l[k]; const ref = c === "Recebido" ? (l.separado ?? l.pedido) : l.pedido; const diff = c !== "Pedido" && v != null && v !== ref; return `<td class="n${diff ? " d" : ""}">${val(v)}</td>`; }).join("")}<td class="d">${esc(textoDivergencias(l))}</td></tr>`;
    const corpo = grupos.map((g) => `<h3>${esc(g.label)}</h3><table><thead><tr><th>Produto</th>${COLS.map((c) => `<th class="n">${c}</th>`).join("")}<th>Divergências</th></tr></thead><tbody>${g.linhas.map(linha).join("")}<tr class="t"><td>Total</td>${COLS.map((c) => `<td class="n">${val(soma(g.linhas, c.toLowerCase() as "pedido"))}</td>`).join("")}<td></td></tr></tbody></table>`).join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório — ${esc(pedido.titulo)}</title><style>
      body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1B1B28;margin:28px;font-size:12px}
      h1{font-size:18px;margin:0 0 4px} .meta{color:#5B6472;margin-bottom:14px} h3{font-size:13px;margin:18px 0 6px}
      table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #E2E3E9;padding:5px 6px;text-align:left}
      th{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#7A8090} .n{text-align:right;font-variant-numeric:tabular-nums}
      .d{color:#CC3338;font-weight:700} tr.t td{font-weight:700;background:#F7F7F9} .res{margin:10px 0;padding:8px 10px;background:#F7F7F9;border-radius:6px}
      @page{size:A4;margin:14mm}</style></head><body>
      <h1>Relatório da ordem de serviço — ${esc(pedido.titulo)}</h1>
      <div class="meta">Status: ${esc(pedidoStatusInfo(pedido.status).label)} · Entrega: ${esc(pedido.entrega ?? "—")} · Criada por ${esc(autor.nome)} · Gerado em ${geradoEm}</div>
      <div class="res">${comDivergencia.length ? `<b>${comDivergencia.length} produto(s) com divergência</b> entre o pedido e o realizado.` : "Nenhuma divergência registrada."}${pendentes ? ` · ${pendentes} linha(s) com etapa ainda sem registro.` : ""} — “n/a”: a parte da Fábrica não passa por expedição/recebimento.</div>
      ${corpo}<script>window.onload=()=>{window.print();}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { window.alert("Libere pop-ups para imprimir o relatório."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  const grid = "display:grid; grid-template-columns:minmax(0,1.6fr) repeat(4, 86px) minmax(0,1fr); gap:8px; align-items:center;";
  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:70; background:rgba(20,24,40,.35);")} />
      <div style={css("position:fixed; top:4vh; left:50%; transform:translateX(-50%); z-index:71; width:980px; max-width:96vw; max-height:92vh; display:flex; flex-direction:column; background:#fff; border-radius:16px; box-shadow:0 24px 70px rgba(20,24,40,.32); overflow:hidden;")}>
        <div style={css("display:flex; align-items:center; gap:10px; padding:16px 20px; border-bottom:1px solid #ECEDF1;")}>
          <div style={css("flex:1; min-width:0;")}>
            <div style={css("font-size:17px; font-weight:800; letter-spacing:-0.3px;")}>Relatório — {pedido.titulo}</div>
            <div style={css("font-size:12.5px; color:#7A8090; font-weight:600; margin-top:2px;")}>Produção e expedição comparadas ao pedido; recebimento ao separado · entrega {pedido.entrega ?? "—"}</div>
          </div>
          <Hoverable as="button" onClick={imprimir} s={css("display:inline-flex; align-items:center; gap:7px; border:none; background:#1B1B28; color:#fff; cursor:pointer; font-size:13px; font-weight:700; padding:9px 14px; border-radius:9px;")} hover="filter:brightness(1.15)">
            <Svg size={14} sw={2.2}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" rx="1" /></Svg>Imprimir / PDF
          </Hoverable>
          <Hoverable as="button" onClick={onClose} title="Fechar" s={css("width:34px; height:34px; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={16} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:14px 20px 20px;")}>
          <div style={css(`display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; font-size:12.5px; font-weight:700;`)}>
            <span style={css(`padding:5px 10px; border-radius:8px; background:${comDivergencia.length ? "#FDECEC" : "#E7F6EE"}; color:${comDivergencia.length ? "#CC3338" : "#1B7F4D"};`)}>{comDivergencia.length ? `${comDivergencia.length} produto${comDivergencia.length > 1 ? "s" : ""} com divergência` : "Sem divergências"}</span>
            {pendentes > 0 && <span style={css("padding:5px 10px; border-radius:8px; background:#FFF7E0; color:#9C7414;")}>{pendentes} linha{pendentes > 1 ? "s" : ""} com etapa sem registro</span>}
            <span style={css("padding:5px 10px; border-radius:8px; background:#F4F4F7; color:#5B6472;")}>“n/a”: a parte da Fábrica não passa por expedição/recebimento</span>
          </div>
          {grupos.map((g) => (
            <div key={g.id} style={css("margin-bottom:14px; border:1px solid #ECEDF1; border-radius:11px; overflow:hidden;")}>
              <div style={css(`${grid} padding:8px 12px; background:#FAFAFB; border-bottom:1px solid #ECEDF1; font-size:10.5px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; color:#9398A6;`)}>
                <span style={css("font-size:12.5px; letter-spacing:0; text-transform:none; color:#1B1B28; font-weight:800;")}>{g.label}</span>
                {COLS.map((c) => <span key={c} style={css("text-align:right;")}>{c}</span>)}<span>Divergências</span>
              </div>
              {g.linhas.map((l, i) => {
                const onde = textoDivergencias(l) || null;
                return (
                  <div key={l.produtoId} style={css(`${grid} padding:7px 12px; ${i ? "border-top:1px solid #F4F5F7;" : ""} ${onde ? "background:#FFF8F8;" : ""}`)}>
                    <span style={css("font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{l.produto}</span>
                    <span style={css("text-align:right; font-size:13px; font-weight:700; color:#5B6472; font-variant-numeric:tabular-nums;")}>{l.pedido}</span>
                    {(["produzido", "separado", "recebido"] as const).map((k) => (
                      <span key={k} style={css(`text-align:right; font-size:13px; font-weight:800; font-variant-numeric:tabular-nums; color:${cor(l[k], k === "recebido" ? (l.separado ?? l.pedido) : l.pedido)};`)}>{val(l[k])}</span>
                    ))}
                    <span style={css(`font-size:12px; font-weight:700; color:${onde ? "#CC3338" : "#B6BAC4"};`)}>{onde ?? "—"}</span>
                  </div>
                );
              })}
              <div style={css(`${grid} padding:7px 12px; background:#FAFAFB; border-top:1px solid #ECEDF1; font-size:12px; font-weight:800; color:#5B6472;`)}>
                <span>Total</span>
                {(["pedido", "produzido", "separado", "recebido"] as const).map((k) => <span key={k} style={css("text-align:right; font-variant-numeric:tabular-nums;")}>{val(soma(g.linhas, k))}</span>)}<span />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
