"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { brDe, brl, ehPaga, statusDaConta, tipoDespesaLabel, valorEfetivo, type Conta } from "@/lib/contas-pagar";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import { useApp } from "../store";
import { useIsMobile } from "@/lib/useIsMobile";

/**
 * Relatório de Contas a Pagar — mesmo desenho do relatório da ordem de serviço: prévia na
 * tela e "Imprimir / PDF" em A4. Usa exatamente as contas filtradas na tela (período, busca,
 * situação, plano, empresas, forma, despesa), agrupadas por plano, empresa ou vencimento.
 * Só LÊ os dados.
 */
type Agrupar = "plano" | "empresa" | "dia" | "nenhum";
const AGRUPAR: { k: Agrupar; l: string }[] = [
  { k: "plano", l: "Plano de contas" }, { k: "empresa", l: "Empresa" }, { k: "dia", l: "Vencimento" }, { k: "nenhum", l: "Sem grupos" },
];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export default function RelatorioContas({ contas, periodo, filtros, hoje, onClose }: { contas: Conta[]; periodo: string; filtros: string[]; hoje: string; onClose: () => void }) {
  const { workspace } = useApp();
  useFecharComEsc(true, onClose);
  const [agrupar, setAgrupar] = useState<Agrupar>("plano");
  const mobile = useIsMobile();

  const pago = (l: Conta[]) => l.filter((c) => ehPaga(c.situacao)).reduce((s, c) => s + valorEfetivo(c), 0);
  const aberto = (l: Conta[]) => l.filter((c) => !ehPaga(c.situacao)).reduce((s, c) => s + c.valor, 0);
  const total = (l: Conta[]) => l.reduce((s, c) => s + c.valor, 0);
  const vencidas = contas.filter((c) => !ehPaga(c.situacao) && c.vencimento < hoje);
  const juros = contas.filter((c) => ehPaga(c.situacao)).reduce((s, c) => s + Math.max(0, (c.valorPago ?? c.valor) - c.valor), 0);
  const ordenadas = [...contas].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.descricao.localeCompare(b.descricao));
  const chave = (c: Conta) => (agrupar === "plano" ? c.plano : agrupar === "empresa" ? c.empresa : agrupar === "dia" ? brDe(c.vencimento) : "Todas as contas");
  const grupos = [...new Set(ordenadas.map(chave))]
    .map((nome) => ({ nome, linhas: ordenadas.filter((c) => chave(c) === nome) }))
    .sort((a, b) => (agrupar === "dia" || agrupar === "nenhum" ? 0 : total(b.linhas) - total(a.linhas)));
  // Coluna "outra dimensão": agrupado por plano mostra a empresa, e vice-versa.
  const colExtra = agrupar === "empresa" ? "Plano" : "Empresa";
  const extra = (c: Conta) => (agrupar === "empresa" ? c.plano : c.empresa);
  const situacao = (c: Conta) => (ehPaga(c.situacao) ? `Pago${c.dataPagamento ? ` ${brDe(c.dataPagamento).slice(0, 5)}` : ""}` : statusDaConta(c, hoje).label);
  const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
  const resumo = [
    { r: "Contas", v: String(contas.length) },
    { r: "Valor total", v: brl(total(contas)) },
    { r: "Pago", v: brl(pago(contas)) },
    { r: "Em aberto", v: brl(aberto(contas)) },
    { r: "Vencido", v: `${brl(aberto(vencidas))} (${vencidas.length})` },
    ...(juros > 0 ? [{ r: "Juros e multas", v: brl(juros) }] : []),
  ];

  const imprimir = () => {
    const linha = (c: Conta) => {
      const vencida = !ehPaga(c.situacao) && c.vencimento < hoje;
      return `<tr${vencida ? ' class="v"' : ""}><td class="d">${brDe(c.vencimento)}</td><td>${esc(c.descricao)}${c.numeroDocumento ? `<div class="s">Doc. ${esc(c.numeroDocumento)}</div>` : ""}</td><td>${esc(extra(c))}</td><td>${esc(tipoDespesaLabel(c.tipoDespesa))}</td><td>${esc(c.forma)}</td><td>${esc(situacao(c))}</td><td class="n">${brl(c.valor)}</td><td class="n">${ehPaga(c.situacao) ? brl(valorEfetivo(c)) : "—"}</td></tr>`;
    };
    const corpo = grupos.map((g) => `${agrupar !== "nenhum" ? `<h3>${esc(g.nome)} <span>· ${g.linhas.length} conta${g.linhas.length > 1 ? "s" : ""}</span></h3>` : ""}<table><thead><tr><th style="width:10%">Venc.</th><th>Descrição</th><th style="width:13%">${colExtra}</th><th style="width:8%">Despesa</th><th style="width:9%">Forma</th><th style="width:12%">Situação</th><th class="n" style="width:11%">Valor</th><th class="n" style="width:11%">Pago</th></tr></thead><tbody>${g.linhas.map(linha).join("")}<tr class="t"><td colspan="6">Total${agrupar !== "nenhum" ? ` ${esc(g.nome)}` : ""} · em aberto ${brl(aberto(g.linhas))}</td><td class="n">${brl(total(g.linhas))}</td><td class="n">${brl(pago(g.linhas))}</td></tr></tbody></table>`).join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contas a pagar — ${esc(periodo)}</title><style>
      *{box-sizing:border-box} body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1B1B28;margin:0 auto;padding:14mm 12mm;max-width:210mm;font-size:10.5px;background:#fff}
      @media print{body{padding:0;max-width:none}} html{background:#E9EAEE}
      .top{display:flex;align-items:center;gap:12px;border-bottom:2px solid #1B1B28;padding-bottom:8px;margin-bottom:10px}
      .top img{height:42px;width:auto} h1{font-size:17px;margin:0} .meta{color:#5B6472;margin-top:2px}
      .top .em{margin-left:auto;text-align:right;font-size:9.5px;color:#5B6472}
      .res{display:flex;flex-wrap:wrap;gap:16px;margin:0 0 10px;padding:7px 10px;border:1.5px solid #1B1B28;border-radius:6px}
      .res span{display:block;font-size:8.5px;text-transform:uppercase;letter-spacing:.4px;color:#5B6472} .res b{font-size:13px}
      .fil{margin:-4px 0 10px;color:#5B6472} h3{font-size:12px;margin:14px 0 4px} h3 span{font-weight:500;color:#7A8090}
      table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border-bottom:1px solid #E2E3E9;padding:4px 4px;text-align:left;vertical-align:top;word-wrap:break-word}
      td.d{white-space:nowrap}
      th{font-size:8.5px;text-transform:uppercase;letter-spacing:.4px;color:#7A8090;border-bottom:1.5px solid #B6BAC4}
      td{overflow-wrap:anywhere} .s{color:#7A8090;font-size:9px} .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
      tr.v td{color:#CC3338} tr.t td{font-weight:700;background:#F4F5F7} thead{display:table-header-group} tr{page-break-inside:avoid}
      .rod{margin-top:12px;font-size:9px;color:#7A8090;display:flex;justify-content:space-between}
      @page{size:A4;margin:12mm}</style></head><body>
      <div class="top">${workspace.logo ? `<img src="${esc(workspace.logo)}" alt="">` : ""}<div><h1>Relatório de contas a pagar</h1><div class="meta">${esc(workspace.nome)} · ${esc(periodo)}${agrupar !== "nenhum" ? ` · por ${esc(AGRUPAR.find((a) => a.k === agrupar)!.l.toLowerCase())}` : ""}</div></div><div class="em">emitido em<br><b>${geradoEm}</b></div></div>
      <div class="res">${resumo.map((x) => `<div><span>${esc(x.r)}</span><b>${esc(x.v)}</b></div>`).join("")}</div>
      ${filtros.length ? `<div class="fil">Filtros: ${esc(filtros.join(" · "))}</div>` : ""}
      ${contas.length ? corpo : "<p>Nenhuma conta no filtro.</p>"}
      <div class="rod"><span>${esc(workspace.nome)} · contas a pagar</span><span>Em vermelho: vencidas e não pagas</span></div>
      <script>window.onload=()=>{window.print();}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { window.alert("Libere pop-ups para imprimir o relatório."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  const grid = "display:grid; grid-template-columns:78px minmax(0,1.6fr) minmax(0,1fr) 70px 98px 96px 96px; gap:8px; align-items:center;";
  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:70; background:rgba(20,24,40,.35);")} />
      <div style={css(mobile ? "position:fixed; inset:0; z-index:71; width:100vw; height:100dvh; padding-top:env(safe-area-inset-top); padding-bottom:env(safe-area-inset-bottom); box-sizing:border-box; background:#fff;" : "position:fixed; top:4vh; left:50%; transform:translateX(-50%); z-index:71; width:1020px; max-width:96vw; max-height:92vh;")} >
      <div style={css(`width:100%; height:100%; max-height:inherit; display:flex; flex-direction:column; background:#fff; border-radius:${mobile ? 0 : 16}px; box-shadow:0 24px 70px rgba(20,24,40,.32); overflow:hidden;`)}>
        <div style={css("display:flex; align-items:center; gap:10px; padding:16px 20px; border-bottom:1px solid #ECEDF1; flex-wrap:wrap;")}>
          <div style={css("flex:1 1 260px; min-width:0;")}>
            <div style={css("font-size:17px; font-weight:800; letter-spacing:-0.3px;")}>Relatório — Contas a Pagar</div>
            <div style={css("font-size:12.5px; color:#7A8090; font-weight:600; margin-top:2px;")}>{periodo}{filtros.length ? ` · ${filtros.join(" · ")}` : " · sem outros filtros"}</div>
          </div>
          <div className="m-rail" style={css("display:flex; gap:2px; background:#EDEEF2; border-radius:8px; padding:2px; max-width:100%;")}>
            {AGRUPAR.map((a) => <button key={a.k} onClick={() => setAgrupar(a.k)} style={css(`border:none; cursor:pointer; font-size:11.5px; font-weight:700; padding:5px 9px; border-radius:6px; background:${agrupar === a.k ? "#fff" : "transparent"}; color:${agrupar === a.k ? "#1B1B28" : "#5B6472"}; box-shadow:${agrupar === a.k ? "0 1px 2px rgba(16,24,40,.10)" : "none"};`)}>{a.l}</button>)}
          </div>
          <Hoverable as="button" onClick={imprimir} disabled={!contas.length} s={css(`display:inline-flex; align-items:center; gap:7px; border:none; background:#1B1B28; color:#fff; cursor:pointer; font-size:13px; font-weight:700; padding:9px 14px; border-radius:9px; opacity:${contas.length ? 1 : 0.5};`)} hover="filter:brightness(1.2)">
            <Svg size={14} sw={2.2}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" rx="1" /></Svg>Imprimir / PDF
          </Hoverable>
          <Hoverable as="button" onClick={onClose} title="Fechar" s={css("width:34px; height:34px; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7">
            <Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg>
          </Hoverable>
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:14px 20px 20px;")}>
          <div style={css("display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;")}>
            {resumo.map((x) => (
              <div key={x.r} style={css(`padding:7px 12px; border-radius:9px; background:${x.r === "Vencido" && vencidas.length ? "#FDECEC" : "#F4F4F7"};`)}>
                <div style={css("font-size:10.5px; font-weight:700; letter-spacing:.3px; text-transform:uppercase; color:#7A8090;")}>{x.r}</div>
                <div style={css(`font-size:14px; font-weight:800; font-variant-numeric:tabular-nums; color:${x.r === "Vencido" && vencidas.length ? "#CC3338" : "#1B1B28"};`)}>{x.v}</div>
              </div>
            ))}
          </div>
          {!contas.length && <div style={css("padding:40px 10px; text-align:center; color:#9398A6; font-size:13.5px; font-weight:600;")}>Nenhuma conta no filtro atual.</div>}
          {mobile && grupos.map((g) => (
            <div key={g.nome} style={css("margin-bottom:14px;")}>
              {agrupar !== "nenhum" && <div style={css("display:flex; align-items:baseline; gap:8px; margin:0 2px 6px;")}><span style={css("flex:1; font-size:13.5px; font-weight:800;")}>{g.nome} <span style={css("color:#9398A6; font-weight:600;")}>· {g.linhas.length}</span></span><span style={css("font-size:13px; font-weight:800; font-variant-numeric:tabular-nums;")}>{brl(total(g.linhas))}</span></div>}
              <div style={css("border:1px solid #ECEDF1; border-radius:11px; overflow:hidden;")}>
                {g.linhas.map((c, i) => {
                  const vencida = !ehPaga(c.situacao) && c.vencimento < hoje;
                  return (
                    <div key={c.id} style={css(`padding:9px 12px; ${i ? "border-top:1px solid #F4F5F7;" : ""} ${vencida ? "background:#FFF8F8;" : ""}`)}>
                      <div style={css("display:flex; gap:8px;")}><span style={css("flex:1; min-width:0; font-size:13px; font-weight:700; overflow-wrap:anywhere;")}>{c.descricao}</span><span style={css("font-size:13px; font-weight:800; font-variant-numeric:tabular-nums;")}>{brl(c.valor)}</span></div>
                      <div style={css("font-size:11.5px; color:#7A8090; font-weight:600; margin-top:2px;")}><span style={css(`color:${vencida ? "#CC3338" : "#5B6472"}; font-weight:800;`)}>{brDe(c.vencimento)}</span> · {extra(c)} · {tipoDespesaLabel(c.tipoDespesa)}{c.numeroDocumento ? ` · Doc. ${c.numeroDocumento}` : ""} · <span style={css(`font-weight:800; color:${ehPaga(c.situacao) ? "#0B6F89" : vencida ? "#CC3338" : "#5B6472"};`)}>{situacao(c)}</span></div>
                    </div>
                  );
                })}
                <div style={css("padding:8px 12px; background:#FAFAFB; border-top:1px solid #ECEDF1; font-size:12px; font-weight:800; color:#5B6472; display:flex; gap:8px;")}><span style={{ flex: 1 }}>Em aberto {brl(aberto(g.linhas))}</span><span>Pago {brl(pago(g.linhas))}</span></div>
              </div>
            </div>
          ))}
          {!mobile && grupos.map((g) => (
            <div key={g.nome} style={css("margin-bottom:14px; border:1px solid #ECEDF1; border-radius:11px; overflow:hidden;")}>
              <div style={css(`${grid} padding:8px 12px; background:#FAFAFB; border-bottom:1px solid #ECEDF1; font-size:10.5px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; color:#9398A6;`)}>
                <span>Venc.</span>
                <span style={css("font-size:12.5px; letter-spacing:0; text-transform:none; color:#1B1B28; font-weight:800;")}>{agrupar === "nenhum" ? "Descrição" : g.nome} {agrupar !== "nenhum" && <span style={css("color:#9398A6; font-weight:600;")}>· {g.linhas.length}</span>}</span>
                <span>{colExtra}</span><span>Despesa</span><span>Situação</span><span style={css("text-align:right;")}>Valor</span><span style={css("text-align:right;")}>Pago</span>
              </div>
              {g.linhas.map((c, i) => {
                const vencida = !ehPaga(c.situacao) && c.vencimento < hoje;
                return (
                  <div key={c.id} style={css(`${grid} padding:7px 12px; ${i ? "border-top:1px solid #F4F5F7;" : ""} ${vencida ? "background:#FFF8F8;" : ""}`)}>
                    <span style={css(`font-size:12.5px; font-weight:700; font-variant-numeric:tabular-nums; color:${vencida ? "#CC3338" : "#5B6472"};`)}>{brDe(c.vencimento)}</span>
                    <span style={css("min-width:0;")}>
                      <span style={css("display:block; font-size:12.5px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")} title={c.descricao}>{c.descricao}</span>
                      {c.numeroDocumento && <span style={css("display:block; font-size:11px; color:#9398A6; font-weight:600;")}>Doc. {c.numeroDocumento}</span>}
                    </span>
                    <span style={css("font-size:12px; font-weight:600; color:#5B6472; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{extra(c)}</span>
                    <span style={css("font-size:12px; font-weight:600; color:#5B6472;")}>{tipoDespesaLabel(c.tipoDespesa)}</span>
                    <span style={css(`font-size:12px; font-weight:700; color:${ehPaga(c.situacao) ? "#0B6F89" : vencida ? "#CC3338" : "#5B6472"};`)}>{situacao(c)}</span>
                    <span style={css("text-align:right; font-size:12.5px; font-weight:800; font-variant-numeric:tabular-nums;")}>{brl(c.valor)}</span>
                    <span style={css("text-align:right; font-size:12.5px; font-weight:700; color:#5B6472; font-variant-numeric:tabular-nums;")}>{ehPaga(c.situacao) ? brl(valorEfetivo(c)) : "—"}</span>
                  </div>
                );
              })}
              <div style={css(`${grid} padding:7px 12px; background:#FAFAFB; border-top:1px solid #ECEDF1; font-size:12px; font-weight:800; color:#5B6472;`)}>
                <span>Total</span><span style={css("grid-column:span 4;")}>em aberto {brl(aberto(g.linhas))}</span>
                <span style={css("text-align:right; font-variant-numeric:tabular-nums; color:#1B1B28;")}>{brl(total(g.linhas))}</span>
                <span style={css("text-align:right; font-variant-numeric:tabular-nums;")}>{brl(pago(g.linhas))}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </>
  );
}
