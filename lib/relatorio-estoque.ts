import type { Produto } from "./types";
import { CATEGORIAS_ESTOQUE, LOCAIS_ESTOQUE, qtdEm } from "./estoque";

/**
 * Relatório de estoque para imprimir/PDF: um produto por linha, com a quantidade em cada
 * unidade e o total; agrupado por categoria (subtotais) e com o total geral por unidade.
 * Só LÊ os dados — não altera nada. Respeita a busca e o filtro de categoria da tela.
 */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function htmlRelatorioEstoque(opts: { produtos: Produto[]; empresa: string; logo?: string | null; filtro?: string; ocultarZerados?: boolean; locais?: string[] }): string {
  const { empresa, logo, filtro, ocultarZerados } = opts;
  // Unidades escolhidas no popup (padrão: todas). Colunas, totais e "só com estoque" consideram só elas.
  const LOCS = LOCAIS_ESTOQUE.filter((l) => !opts.locais?.length || opts.locais.includes(l.id));
  const totalSel = (p: Produto) => LOCS.reduce((s, l) => s + qtdEm(p.quantidades, l.id), 0);
  const produtos = opts.produtos.filter((p) => !ocultarZerados || totalSel(p) > 0);
  const ordemCat = (c: string) => { const i = CATEGORIAS_ESTOQUE.findIndex((x) => x.v === c); return i < 0 ? 999 : i; };
  const cats = [...new Set(produtos.map((p) => p.categoria))].sort((a, b) => ordemCat(a) - ordemCat(b));
  const somaLocais = (ps: Produto[]) => LOCS.map((l) => ps.reduce((s, p) => s + qtdEm(p.quantidades, l.id), 0));
  const cel = (n: number) => `<td class="n${n ? "" : " z"}">${n || "–"}</td>`;
  const emitido = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
  const geral = somaLocais(produtos);
  const totalGeral = geral.reduce((s, n) => s + n, 0);
  const corpo = cats.map((c) => {
    const ps = produtos.filter((p) => p.categoria === c).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
    const sub = somaLocais(ps);
    return `<tr class="cat"><td colspan="${LOCS.length + 2}">${esc(c || "Sem categoria")} <span>· ${ps.length} produto${ps.length > 1 ? "s" : ""}</span></td></tr>
      ${ps.map((p) => `<tr><td>${esc(p.nome)}</td>${LOCS.map((l) => cel(qtdEm(p.quantidades, l.id))).join("")}<td class="n t">${totalSel(p)}</td></tr>`).join("")}
      <tr class="sub"><td>Subtotal ${esc(c || "")}</td>${sub.map((n) => `<td class="n">${n}</td>`).join("")}<td class="n t">${sub.reduce((s, n) => s + n, 0)}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de estoque — ${emitido}</title><style>
    *{box-sizing:border-box} body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:0;padding:24px 28px;font-size:11.5px}
    .top{display:flex;align-items:center;gap:14px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px}
    .top img{height:48px;width:auto} .top h1{font-size:19px;margin:0} .top .sub{color:#555;font-size:11.5px;margin-top:2px}
    .top .em{margin-left:auto;text-align:right;font-size:10.5px;color:#555}
    .res{display:flex;gap:18px;margin-bottom:12px;padding:8px 12px;border:1.5px solid #111;border-radius:7px}
    .res div span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;color:#555} .res div b{font-size:16px}
    table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border-bottom:1px solid #ddd;padding:5px 6px}
    th{background:#eee;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;text-align:right;border-bottom:1.5px solid #999}
    th:first-child,td:first-child{text-align:left;width:30%} td:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .n{text-align:right;font-variant-numeric:tabular-nums} .z{color:#bbb} .t{font-weight:800}
    tr.cat td{background:#f6f6f6;font-weight:800;padding-top:9px;border-bottom:1.5px solid #bbb} tr.cat span{font-weight:500;color:#666}
    tr.sub td{font-weight:700;color:#444;border-bottom:1.5px solid #bbb}
    tr.geral td{font-weight:800;font-size:12.5px;background:#111;color:#fff;border:none}
    thead{display:table-header-group} tr{page-break-inside:avoid}
    .rod{margin-top:14px;font-size:9.5px;color:#777;display:flex;justify-content:space-between}
    th:first-child,td:first-child{width:${LOCS.length <= 2 ? 50 : LOCS.length <= 4 ? 40 : 30}%}
    @page{size:${LOCS.length <= 3 ? "A4" : "A4 landscape"};margin:10mm} @media print{body{padding:0}}
  </style></head><body>
    <div class="top">${logo ? `<img src="${esc(logo)}" alt="">` : ""}<div><h1>Relatório de estoque</h1><div class="sub">${esc(empresa)} · ${LOCS.length === LOCAIS_ESTOQUE.length ? "todas as unidades" : esc(LOCS.map((l) => l.label).join(", "))}</div></div>
      <div class="em">emitido em<br><b>${emitido}</b></div></div>
    <div class="res">
      <div><span>Produtos</span><b>${produtos.length}</b></div>
      <div><span>${LOCS.length === LOCAIS_ESTOQUE.length ? "Total em estoque" : "Total nas unidades"}</span><b>${totalGeral} un.</b></div>
      ${LOCS.map((l, i) => `<div><span>${esc(l.label)}</span><b>${geral[i]}</b></div>`).join("")}
      ${filtro ? `<div><span>Filtro</span><b style="font-size:12px">${esc(filtro)}</b></div>` : ""}
    </div>
    <table><thead><tr><th>Produto</th>${LOCS.map((l) => `<th>${esc(l.label)}</th>`).join("")}<th>Total</th></tr></thead>
      <tbody>${corpo}<tr class="geral"><td>TOTAL GERAL</td>${geral.map((n) => `<td class="n">${n}</td>`).join("")}<td class="n">${totalGeral}</td></tr></tbody></table>
    <div class="rod"><span>${esc(empresa)} · relatório de estoque</span><span>“–” = sem estoque na unidade</span></div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
  </body></html>`;
}
