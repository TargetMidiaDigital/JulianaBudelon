"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { brl, foneBR, normalizePhone, parseBR } from "@/lib/format";
import { ACCENT, statusInfo } from "@/lib/theme";
import type { Task } from "@/lib/types";
import { LOCAIS_ESTOQUE, corDoLocal, nomeDoLocal } from "@/lib/estoque";
import { rotuloEncomenda, tarefasDaPage } from "@/lib/tarefas";
import { isoDia, itensDoPedido, linkWhatsapp, numeroPedido, resumoItens, useEncomendas, type ItemPedido, type Lead, type PedidoEncomenda } from "@/lib/encomendas";
import { proximoStatusTarefa, statusEscolhiveis, useApp } from "../store";
import { Foto } from "../encomendas/FunilEncomenda";
import { LinkWhatsapp } from "../ui/BotaoWhatsapp";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import { useIsMobile } from "@/lib/useIsMobile";

/**
 * Lojas → Encomendas: o que cada loja tem para entregar aos clientes, em cartões com a foto
 * do que foi encomendado, separados por dia de retirada. As tarefas são as de categoria
 * "encomenda" (criadas quando o pagamento é confirmado no CRM); o pedido vem do id da tarefa
 * (`…-encl-<pedido>`) ou, nas antigas, do "Encomenda #XXXXXXXX" da descrição.
 */

const COR = "#955C6B";
const feita = (t: Task) => t.status === "concluida" || t.status === "validada";
const DIA_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Situação do pedido na produção, do ponto de vista da loja. */
const NA_PRODUCAO: Record<string, { texto: string; cor: string }> = {
  "Verificar pagamento": { texto: "Aguardando pagamento", cor: "#A16207" },
  "Confirmado com o cliente": { texto: "Aguardando a produção", cor: "#0369A1" },
  "Em produção": { texto: "Sendo feita na produção", cor: "#C2410C" },
  "Pronto para retirada": { texto: "Na loja, esperando o cliente", cor: "#7C3AED" },
  Entregue: { texto: "Entregue ao cliente", cor: "#15803D" },
};

type Item = { t: Task; p?: PedidoEncomenda; lead?: Lead; iso: string; hora: string; qtd?: number; produto: string; itens?: ItemPedido[]; foto: string | null; cliente: string; numero?: string };

export default function LojaEncomendas() {
  const { tasks, updateTask, setTaskDetailOpen, canEditPage, canSeeAll, workspace } = useApp();
  const { pedidos, leads, produtos, produtoDe, unidadeDe, carregado, erroCarga } = useEncomendas();
  const mobile = useIsMobile();
  const editavel = canEditPage("lojas-encomendas");
  const opcoes = statusEscolhiveis(canSeeAll, false); // A verificar → Recebido → Entregue (→ Validado)
  const [aba, setAba] = useState<"pendentes" | "concluidas">("pendentes");
  const [loja, setLoja] = useState<string>("");
  const [busca, setBusca] = useState("");

  const hoje = isoDia(new Date());
  const amanha = isoDia(new Date(Date.now() + 86400000));

  const pedidoDe = (t: Task): PedidoEncomenda | undefined => {
    const id = /-encl-(.+)$/.exec(t.id)?.[1];
    if (id) return pedidos.find((p) => p.id === id);
    const num = /Encomenda #([0-9A-Z]{8})\b/.exec(t.desc ?? "")?.[1];
    return num ? pedidos.find((p) => numeroPedido(p.id) === num) : undefined;
  };

  const itens: Item[] = tarefasDaPage(tasks, "lojas-encomendas").map((t) => {
    const p = pedidoDe(t);
    const lead = p ? leads.find((l) => l.id === p.leadId) : undefined;
    const lista = p ? itensDoPedido(p) : undefined;
    const prod = lista ? produtoDe(lista[0].produtoId) : undefined;
    const d = parseBR(t.venc);
    const iso = p?.data ?? (d ? isoDia(d) : "");
    // Sem pedido (tarefa manual ou pedido apagado): os dados saem da descrição gerada pelo CRM
    // ("<li>2× Torta de Morango</li>", "Cliente: Nome · (48) 9…") e do título "Encomenda - Cliente - Loja - data".
    const desc = (t.desc ?? "").replace(/&amp;/g, "&");
    const item = /<li>(\d+)× ([^<]+)<\/li>/.exec(desc);
    const doCliente = /Cliente:<\/strong> ([^<·]+?)(?: · ([^<]+))?<\/p>/.exec(desc);
    const nomeProd = prod?.nome ?? p?.produtoNome ?? item?.[2]?.trim();
    const prodPorNome = !prod && nomeProd ? produtos.find((x) => x.nome === nomeProd) : undefined;
    const foneDesc = doCliente?.[2] ? normalizePhone(doCliente[2]) : "";
    const cliente = lead?.nome || doCliente?.[1]?.trim() || (/^Encomenda [-–] (.+?) [-–] /.exec(t.titulo)?.[1] ?? "");
    return {
      t, p, lead, iso, hora: p?.hora ?? t.vencHora ?? "",
      qtd: lista ? (lista.length === 1 ? lista[0].quantidade : undefined) : item ? Number(item[1]) : undefined,
      produto: lista && lista.length > 1 ? resumoItens(lista) : nomeProd ?? t.titulo,
      itens: lista,
      foto: (prod ?? prodPorNome)?.foto ?? null,
      cliente, numero: lead?.numero ?? (foneDesc.length >= 10 ? foneDesc.replace(/^(?!55)/, "55") : undefined),
    };
  });

  // Todas as unidades (lojas) no filtro — a Fábrica não recebe encomenda de cliente; local fora da lista também aparece.
  const unidades = [
    ...LOCAIS_ESTOQUE.filter((l) => l.id !== "fabrica"),
    ...[...new Set(itens.map((i) => i.t.local).filter((l): l is string => !!l && !LOCAIS_ESTOQUE.some((x) => x.id === l)))].map((id) => ({ id, label: nomeDoLocal(id) })),
  ];
  const q = busca.trim().toLowerCase(), dig = normalizePhone(busca);
  const casaBusca = (i: Item) =>
    (!q || i.cliente.toLowerCase().includes(q) || i.produto.toLowerCase().includes(q) || (i.p && numeroPedido(i.p.id).toLowerCase().includes(q)) || (dig.length >= 3 && !!i.numero?.includes(dig)));
  const itensDaAba = itens.filter((i) => casaBusca(i) && (aba === "concluidas") === feita(i.t));
  const filtrados = itens.filter((i) => (!loja || i.t.local === loja) && casaBusca(i));
  const pendentes = filtrados.filter((i) => !feita(i.t)).sort((a, b) => `${a.iso} ${a.hora}`.localeCompare(`${b.iso} ${b.hora}`));
  const concluidas = filtrados.filter((i) => feita(i.t)).sort((a, b) => `${b.iso} ${b.hora}`.localeCompare(`${a.iso} ${a.hora}`));

  // Pendentes por dia: Atrasadas, Hoje, Amanhã e os próximos dias.
  const grupos: { chave: string; titulo: string; cor: string; itens: Item[] }[] = [];
  const grupo = (chave: string, titulo: string, cor: string) => {
    let g = grupos.find((x) => x.chave === chave);
    if (!g) { g = { chave, titulo, cor, itens: [] }; grupos.push(g); }
    return g;
  };
  for (const i of pendentes) {
    if (i.iso && i.iso < hoje) grupo("atrasadas", "Atrasadas", "#CC3338").itens.push(i);
    else if (i.iso === hoje) grupo("hoje", "Hoje", COR).itens.push(i);
    else if (i.iso === amanha) grupo("amanha", "Amanhã", "#3A3F4C").itens.push(i);
    else {
      const [y, m, d] = i.iso.split("-").map(Number);
      const titulo = i.iso ? `${DIA_SEMANA[new Date(y, m - 1, d).getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}` : "Sem data";
      grupo(i.iso || "sem", titulo, "#3A3F4C").itens.push(i);
    }
  }
  const atrasadas = pendentes.filter((i) => i.iso && i.iso < hoje).length;
  const deHoje = pendentes.filter((i) => i.iso === hoje).length;

  const cartao = (i: Item) => {
    const { t, p } = i;
    const lojaNome = p?.unidadeNome ?? unidadeDe(p?.unidadeId)?.nome ?? LOCAIS_ESTOQUE.find((l) => l.id === t.local)?.label ?? "";
    const atrasada = !feita(t) && !!i.iso && i.iso < hoje;
    const si = statusInfo[t.status];
    const prox = editavel ? proximoStatusTarefa(t.status, opcoes, true) : null;
    const nome = (s: Task["status"]) => rotuloEncomenda(s, t) ?? statusInfo[s].label;
    const prod = p ? NA_PRODUCAO[p.status] : undefined;
    const msg = `Oi${i.cliente ? `, ${i.cliente.trim().split(/\s+/)[0]}` : ""}, tudo bem? Aqui é da ${workspace.nome || "Ju Budelon"}${lojaNome ? `, loja ${lojaNome}` : ""}. Sobre a sua encomenda${p ? ` #${numeroPedido(p.id)}` : ""} (${i.itens ? resumoItens(i.itens) : i.produto}), com retirada ${i.iso === hoje ? "hoje" : `em ${i.iso.split("-").reverse().join("/")}`}${i.hora ? ` às ${i.hora}` : ""}:`;
    const href = i.numero ? linkWhatsapp(i.numero, msg) : null;
    return (
      <div key={t.id} style={css(`background:#fff; border:1px solid ${atrasada ? "#F3B4BC" : "#ECEDF1"}; border-radius:14px; overflow:hidden; display:flex; box-shadow:0 1px 3px rgba(16,24,40,.05); ${feita(t) ? "opacity:.82;" : ""}`)}>
        <div className="loja-enc-foto" onClick={() => setTaskDetailOpen(t.id)} style={css(`position:relative; flex:none; width:${mobile ? 92 : 108}px; cursor:pointer; background:#FDF1F4;`)}>
          <div style={css("position:absolute; inset:0;")}><Foto src={i.foto} alt={i.produto} proporcao="1/1" cortar miniatura /></div>
          {(i.qtd || (i.itens && i.itens.length > 1)) && <span style={css("position:absolute; top:7px; left:7px; background:rgba(27,27,40,.82); color:#fff; font-size:12.5px; font-weight:800; padding:2px 8px; border-radius:999px;")}>{i.itens && i.itens.length > 1 ? `${i.itens.length} itens` : `${i.qtd}×`}</span>}
        </div>

        <div style={css("flex:1; min-width:0; padding:10px 12px 10px; display:flex; flex-direction:column; gap:6px;")}>
          <div onClick={() => setTaskDetailOpen(t.id)} style={css("display:flex; align-items:flex-start; gap:8px; cursor:pointer;")}>
            <div style={css("flex:1; min-width:0;")}>
              <div style={css("font-size:14.5px; font-weight:800; line-height:1.25; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")} title={i.produto}>{i.itens && i.itens.length > 1 ? `${i.itens.length} produtos` : i.produto}</div>
              {i.itens && i.itens.length > 1 && (
                <div style={css("margin-top:3px; display:flex; flex-direction:column; gap:1px; font-size:12.5px; font-weight:700; color:#3A3F4C; line-height:1.3;")}>
                  {i.itens.map((x, k) => <span key={k} style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{x.quantidade}× {x.produtoNome}</span>)}
                </div>
              )}
              <div style={css("display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin-top:2px; font-size:11.5px; font-weight:700; color:#9398A6;")}>
                {lojaNome && <span style={css(`display:inline-flex; align-items:center; gap:4px; color:${corDoLocal(t.local)};`)}><span style={css(`width:6px; height:6px; border-radius:50%; background:${corDoLocal(t.local)};`)} />{lojaNome}</span>}
                {p && <span>#{numeroPedido(p.id)}</span>}
                {p && <span>{brl(p.total)}</span>}
              </div>
            </div>
            {i.hora && (
              <span style={css(`flex:none; display:inline-flex; align-items:center; gap:4px; background:${atrasada ? "#CC3338" : "#F2F3F6"}; color:${atrasada ? "#fff" : "#1B1B28"}; font-size:12.5px; font-weight:800; padding:3px 8px; border-radius:999px;`)}>
                <Svg size={12} sw={2.4}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>{i.hora}
              </span>
            )}
          </div>

          <div style={css("display:flex; align-items:center; gap:7px; font-size:12.5px; min-width:0;")}>
            <span style={css("font-weight:800; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;")}>{i.cliente || "Cliente"}</span>
            {i.numero && <span style={css("flex:none; color:#7A8090; font-weight:600;")}>{foneBR(i.numero)}</span>}
            {href && i.numero && <LinkWhatsapp href={href} mensagem={msg} para={i.cliente || foneBR(i.numero)} size={22} />}
          </div>

          {i.itens?.filter((x) => x.mensagem).map((x, k) => (
            <div key={k} title={x.mensagem} style={css("background:#FFF8E6; border:1px solid #F5DFA6; border-radius:8px; padding:4px 8px; font-size:12px; font-weight:700; color:#5B4300; line-height:1.35; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;")}>
              <span style={css("color:#A16207;")}>Obs.{i.itens!.length > 1 ? ` (${x.produtoNome})` : ""}: </span>{x.mensagem}
            </div>
          ))}

          <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:auto; padding-top:2px;")}>
            <span style={css(`display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px; background:${si.bg}; color:${si.fg}; white-space:nowrap;`)}><span style={css(`width:6px; height:6px; border-radius:50%; background:${si.dot};`)} />{nome(t.status)}</span>
            {prod && !feita(t) && <span title="Situação na produção" style={css(`font-size:11px; font-weight:700; color:${prod.cor}; white-space:nowrap;`)}>{prod.texto}</span>}
            <span style={{ flex: 1 }} />
            <Hoverable as="button" onClick={() => setTaskDetailOpen(t.id)} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:12px; font-weight:700; padding:5px 9px; border-radius:8px;")} hover="background:#F4F4F7">Detalhes</Hoverable>
            {prox && (
              <Hoverable as="button" onClick={() => updateTask(t.id, { status: prox })} title={`Passar para "${nome(prox)}"`} s={css(`border:none; background:${prox === "concluida" ? "#1B7F4D" : prox === "em andamento" ? "#7C3AED" : "#2F80ED"}; color:#fff; cursor:pointer; font-size:12px; font-weight:800; padding:6px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:5px; white-space:nowrap;`)} hover="filter:brightness(1.08)">
                <Svg size={12} sw={2.8}>{prox === "validada" ? <path d="M5 12h14M13 6l6 6-6 6" /> : <path d="M20 6 9 17l-5-5" />}</Svg>
                {prox === "validada" ? "Validar" : nome(prox)}
              </Hoverable>
            )}
          </div>
        </div>
      </div>
    );
  };

  const grade = (lista: Item[]) => (
    <div style={css(`display:grid; grid-template-columns:${mobile ? "1fr" : "repeat(auto-fill, minmax(380px, 1fr))"}; gap:12px;`)}>{lista.map(cartao)}</div>
  );
  const chip = (ativo: boolean, onClick: () => void, conteudo: React.ReactNode, cor = COR, key?: string) => (
    <button key={key} onClick={onClick} style={css(`flex:none; display:inline-flex; align-items:center; gap:7px; border:1px solid ${ativo ? cor : "#E2E3E9"}; background:${ativo ? `${cor}14` : "#fff"}; color:${ativo ? "#1B1B28" : "#5B6472"}; border-radius:999px; padding:8px 14px; font-size:13.5px; font-weight:700; cursor:pointer; white-space:nowrap;`)}>{conteudo}</button>
  );
  const vazio = (texto: string) => (
    <div style={css("padding:56px 16px; text-align:center; color:#9398A6;")}>
      <div style={css(`width:56px; height:56px; margin:0 auto 12px; border-radius:16px; background:${COR}12; color:${COR}; display:flex; align-items:center; justify-content:center;`)}><Svg size={26} sw={1.8}><path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M3 7h18v4H3zM12 7v14" /></Svg></div>
      <div style={css("font-size:15px; font-weight:800; color:#3A3F4C;")}>{texto}</div>
      <div style={css("font-size:13px; margin-top:4px;")}>As encomendas aparecem aqui quando o pagamento é confirmado no CRM.</div>
    </div>
  );

  return (
    <div className="m-pad" style={css("padding:24px 30px 40px;")}>
      <style>{".loja-enc-foto img{height:100% !important; aspect-ratio:auto !important; object-fit:cover !important;} .loja-enc-foto > div > div{height:100%; aspect-ratio:auto !important;}"}</style>
      <div className="m-wrap" style={css("display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:16px;")}>
        <div style={css("flex:1; min-width:220px;")}>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Encomendas</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>
            {deHoje ? <><b style={{ color: "#1B1B28" }}>{deHoje}</b> para entregar hoje</> : "Nada para entregar hoje"}
            {atrasadas ? <> · <b style={{ color: "#CC3338" }}>{atrasadas} atrasada{atrasadas === 1 ? "" : "s"}</b></> : null}
          </p>
        </div>
        <div style={css("position:relative; width:280px; max-width:100%;")}>
          <Svg size={15} stroke="#9398A6" style={css("position:absolute; left:11px; top:50%; transform:translateY(-50%);")}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, produto ou nº…" style={css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:10px; padding:10px 12px 10px 33px; font-size:13.5px; outline:none; background:#fff;")} />
        </div>
      </div>

      <div style={css("display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px;")}>
        <div style={css("display:flex; gap:8px; overflow-x:auto; scrollbar-width:none;")}>
          {chip(aba === "pendentes", () => setAba("pendentes"), <>Para entregar <span style={css("color:#9398A6;")}>{pendentes.length}</span></>)}
          {chip(aba === "concluidas", () => setAba("concluidas"), <>Entregues <span style={css("color:#9398A6;")}>{concluidas.length}</span></>, "#1B7F4D")}
        </div>
        <span style={{ flex: 1 }} />
        {/* Mesmo filtro da Ordem de Serviço: botão com menu, destacado quando há uma unidade escolhida. */}
        <Menu align="right" width={230} trigger={(toggle) => (
          <Hoverable as="button" onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:8px; background:${loja ? "#FDF1F4" : "#fff"}; border:1px solid ${loja ? ACCENT : "#E2E3E9"}; color:${loja ? ACCENT : "#3A3F4C"}; cursor:pointer; font-size:13px; font-weight:700; padding:8px 14px; border-radius:10px;`)} hover={loja ? undefined : "background:#FAFAFB"}>
            {loja
              ? <span style={css(`width:9px; height:9px; border-radius:50%; background:${corDoLocal(loja)};`)} />
              : <Svg size={15} sw={2.2}><path d="M3 9.5 4.5 4h15L21 9.5M3 9.5h18M3 9.5V20h18V9.5M9 20v-5h6v5" /></Svg>}
            {loja ? LOCAIS_ESTOQUE.find((x) => x.id === loja)?.label ?? loja : "Todas as lojas"}
            <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
          </Hoverable>
        )}>
          {(close) => (
            <>
              <MenuItem checked={!loja} accent={ACCENT} onClick={() => { setLoja(""); close(); }}><span style={{ flex: 1 }}>Todas as lojas</span><span style={css("font-size:12px; color:#9398A6;")}>{itensDaAba.length}</span></MenuItem>
              {unidades.map((u) => (
                <MenuItem key={u.id} checked={loja === u.id} accent={ACCENT} onClick={() => { setLoja(u.id); close(); }}>
                  <span style={css(`width:9px; height:9px; border-radius:50%; background:${corDoLocal(u.id)};`)} /><span style={{ flex: 1 }}>{u.label}</span>
                  <span style={css("font-size:12px; color:#9398A6;")}>{itensDaAba.filter((i) => i.t.local === u.id).length}</span>
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      </div>

      {erroCarga && <div style={css("margin:8px 0; padding:10px 14px; border-radius:10px; background:#FDECEC; color:#CC3338; font-size:13px; font-weight:600;")}>Não foi possível carregar as fotos e os dados dos pedidos: {erroCarga}</div>}
      {!carregado && !erroCarga && <div style={css("margin:8px 0; font-size:13px; color:#9398A6;")}>Carregando os pedidos…</div>}

      {aba === "pendentes" && (pendentes.length === 0 ? vazio(busca || loja ? "Nenhuma encomenda encontrada" : "Nenhuma encomenda para entregar") : grupos.map((g) => (
        <section key={g.chave} style={css("margin-top:18px;")}>
          <div style={css("display:flex; align-items:center; gap:9px; margin-bottom:12px;")}>
            <span style={css(`width:10px; height:10px; border-radius:50%; background:${g.cor};`)} />
            <h2 style={css(`margin:0; font-size:16px; font-weight:800; color:${g.cor === "#3A3F4C" ? "#1B1B28" : g.cor};`)}>{g.titulo}</h2>
            <span style={css("font-size:13px; font-weight:700; color:#9398A6;")}>{g.itens.length}</span>
          </div>
          {grade(g.itens)}
        </section>
      )))}
      {aba === "concluidas" && (concluidas.length === 0 ? vazio("Nenhuma encomenda entregue") : <div style={css("margin-top:18px;")}>{grade(concluidas)}</div>)}
    </div>
  );
}
