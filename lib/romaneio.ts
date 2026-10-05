import type { Pedido, Produto, Task, TeamMember } from "./types";
import { CATEGORIAS_ESTOQUE, LOCAIS_ESTOQUE } from "./estoque";
import { linhasDaTarefa } from "./conferencia";

/**
 * Romaneio de expedição: documento para imprimir e levar junto com os produtos para a unidade.
 * Identifica a ordem, a unidade e os produtos com a quantidade pedida e a separada; a unidade
 * marca o que recebeu no papel e depois registra no sistema (tarefa de Recebimento).
 */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function htmlRomaneio(opts: { tarefa: Task; pedido?: Pedido; produtos: Produto[]; responsavel?: TeamMember; empresa: string; logo?: string | null; origem: string }): string {
  const { tarefa: t, pedido, produtos, responsavel, empresa, logo, origem } = opts;
  const unidade = LOCAIS_ESTOQUE.find((l) => l.id === t.local)?.label ?? (t.titulo.split(" - ")[1] || "—");
  const ordemCat = (c: string) => { const i = CATEGORIAS_ESTOQUE.findIndex((x) => x.v === c); return i < 0 ? 999 : i; };
  const linhas = linhasDaTarefa(t)
    .map((l) => ({ ...l, p: produtos.find((x) => x.id === l.produtoId) }))
    .sort((a, b) => ordemCat(a.p?.categoria ?? "") - ordemCat(b.p?.categoria ?? "") || (a.p?.nome ?? "").localeCompare(b.p?.nome ?? "", "pt"));
  const totPed = linhas.reduce((s, l) => s + l.pedido, 0);
  const separadoCompleto = linhas.every((l) => l.feito != null);
  const totSep = linhas.reduce((s, l) => s + (l.feito ?? 0), 0);
  const emitido = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
  const numero = t.id.replace(/^t-/, "").slice(-8).toUpperCase();
  const linkRecebimento = `${origem}/?page=unidades`;
  const linhasHtml = linhas.map((l, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td><b>${esc(l.p?.nome ?? "Produto removido")}</b><div class="cat">${esc(l.p?.categoria ?? "")}</div></td>
      <td class="n">${l.pedido}</td>
      <td class="n">${l.feito ?? ""}</td>
      <td class="box"></td>
    </tr>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Romaneio — ${esc(unidade)} — ${esc(pedido?.titulo ?? t.titulo)}</title><style>
    *{box-sizing:border-box} body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:0;padding:26px 30px;font-size:12.5px}
    .top{display:flex;align-items:center;gap:14px;border-bottom:2px solid #111;padding-bottom:12px}
    .top img{height:52px;width:auto} .top h1{font-size:20px;margin:0} .top .sub{color:#555;font-size:12px;margin-top:2px}
    .top .num{margin-left:auto;text-align:right;font-size:11px;color:#555} .top .num b{display:block;font-size:16px;color:#111;letter-spacing:.5px}
    .dest{margin:14px 0;padding:12px 14px;border:2px solid #111;border-radius:8px;display:flex;gap:22px;align-items:center}
    .dest .u{font-size:24px;font-weight:800} .dest .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#555}
    .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 16px;margin-bottom:14px}
    .meta div span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#555} .meta div b{font-size:13px}
    table{width:100%;border-collapse:collapse} th,td{border:1px solid #999;padding:7px 8px;vertical-align:middle}
    th{background:#eee;font-size:10px;text-transform:uppercase;letter-spacing:.5px;text-align:left}
    .n{text-align:right;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;width:86px} .c{text-align:center;width:30px;color:#555}
    .box{width:130px} .cat{font-size:10.5px;color:#666;margin-top:1px}
    table{table-layout:fixed} th:nth-child(2),td:nth-child(2){width:auto}
    th.n{font-size:10px;font-weight:700} tr.t td{font-weight:800;background:#f5f5f5}
    .inst{margin:12px 0 0;padding:10px 14px;background:#f5f5f5;border-radius:6px;font-size:11.5px;line-height:1.6}
    .inst ol{margin:6px 0 6px;padding-left:20px} .inst li{margin:2px 0} .inst p{margin:4px 0 0} .inst .link{color:#555;word-break:break-all}
    .ass{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:40px}
    .ass div{border-top:1px solid #111;padding-top:6px;font-size:11px;color:#333}
    .rod{margin-top:22px;font-size:10px;color:#777;display:flex;justify-content:space-between}
    @page{size:A4;margin:12mm} @media print{body{padding:0}}
  </style></head><body>
    <div class="top">${logo ? `<img src="${esc(logo)}" alt="">` : ""}<div><h1>Romaneio de expedição</h1><div class="sub">${esc(empresa)} · conferir no recebimento</div></div>
      <div class="num">Nº<b>${esc(numero)}</b>emitido em ${emitido}</div></div>
    <div class="dest"><div><div class="lbl">Destino</div><div class="u">${esc(unidade)}</div></div>
      <div><div class="lbl">Total de itens</div><div class="u">${totPed} un.</div></div>
      <div><div class="lbl">Produtos</div><div class="u">${linhas.length}</div></div></div>
    <div class="meta">
      <div><span>Ordem de serviço</span><b>${esc(pedido?.titulo ?? "—")}</b></div>
      <div><span>Entrega</span><b>${esc(pedido?.entrega ?? t.venc ?? "—")}</b></div>
      <div><span>Separado por</span><b>${esc(responsavel?.nome ?? "—")}</b></div>
      <div><span>Situação da separação</span><b>${separadoCompleto ? `separado ${totSep} un.` : "a separar"}</b></div>
    </div>
    <table><thead><tr><th class="c">#</th><th>Produto</th><th class="n">Pedido</th><th class="n">Separado</th><th class="box">Recebido (unidade)</th></tr></thead>
      <tbody>${linhasHtml}<tr class="t"><td></td><td>Total</td><td class="n">${totPed}</td><td class="n">${separadoCompleto ? totSep : ""}</td><td></td></tr></tbody></table>
    <div class="inst"><b>Na unidade:</b>
      <ol>
        <li>Confira cada produto e anote a quantidade recebida na coluna “Recebido”.</li>
        <li>No sistema, abra <b>Operacional → Unidades → Recebimento - ${esc(unidade)}</b>.</li>
        <li>Registre os mesmos números na Conferência e conclua a tarefa.</li>
      </ol>
      <p>Diferenças aparecem no relatório da ordem.</p>
      <p class="link">${esc(linkRecebimento)}</p></div>
    <div class="ass"><div>Separado / enviado por (nome, assinatura e data)</div><div>Recebido por na unidade (nome, assinatura, data e hora)</div></div>
    <div class="rod"><span>${esc(t.titulo)}</span><span>${esc(empresa)} · romaneio ${esc(numero)}</span></div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
  </body></html>`;
}

/** Abre o romaneio numa janela nova e chama a impressão (imprimir ou salvar PDF). */
export function imprimirRomaneio(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}
