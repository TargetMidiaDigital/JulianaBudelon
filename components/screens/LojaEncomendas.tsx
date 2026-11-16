"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { brl, foneBR, normalizePhone, parseBR } from "@/lib/format";
import { statusInfo } from "@/lib/theme";
import type { Task } from "@/lib/types";
import { LOCAIS_ESTOQUE, corDoLocal } from "@/lib/estoque";
import { tarefasDaPage } from "@/lib/tarefas";
import { isoDia, linkWhatsapp, numeroPedido, useEncomendas, type Lead, type PedidoEncomenda } from "@/lib/encomendas";
import { proximoStatusTarefa, statusEscolhiveis, useApp } from "../store";
import { Foto } from "../encomendas/FunilEncomenda";
import { LinkWhatsapp } from "../ui/BotaoWhatsapp";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
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
  Entregue: { texto: "Entregue ao cliente", cor: "#15803D" },
};

type Item = { t: Task; p?: PedidoEncomenda; lead?: Lead; iso: string; hora: string; qtd?: number; produto: string; foto: string | null; cliente: string; numero?: string };

export default function LojaEncomendas() {
  const { tasks, updateTask, setTaskDetailOpen, canEditPage, canSeeAll, workspace } = useApp();
  const { pedidos, leads, produtos, produtoDe, unidadeDe, carregado, erroCarga } = useEncomendas();
  const mobile = useIsMobile();
  const editavel = canEditPage("lojas-encomendas");
  const opcoes = statusEscolhiveis(canSeeAll, true);
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
    const prod = p ? produtoDe(p.produtoId) : undefined;
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
      qtd: p?.quantidade ?? (item ? Number(item[1]) : undefined),
      produto: nomeProd ?? t.titulo,
      foto: (prod ?? prodPorNome)?.foto ?? null,
      cliente, numero: lead?.numero ?? (foneDesc.length >= 10 ? foneDesc.replace(/^(?!55)/, "55") : undefined),
    };
  });

  const lojas = [...new Set(itens.map((i) => i.t.local).filter(Boolean))] as string[];
  const q = busca.trim().toLowerCase(), dig = normalizePhone(busca);
  const filtrados = itens.filter((i) =>
    (!loja || i.t.local === loja) &&
    (!q || i.cliente.toLowerCase().includes(q) || i.produto.toLowerCase().includes(q) || (i.p && numeroPedido(i.p.id).toLowerCase().includes(q)) || (dig.length >= 3 && !!i.numero?.includes(dig))));
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
    const prox = editavel ? proximoStatusTarefa(t.status, opcoes) : null;
    const prod = p ? NA_PRODUCAO[p.status] : undefined;
    const msg = `Oi${i.cliente ? `, ${i.cliente.trim().split(/\s+/)[0]}` : ""}, tudo bem? Aqui é da ${workspace.nome || "Ju Budelon"}${lojaNome ? `, loja ${lojaNome}` : ""}. Sobre a sua encomenda${p ? ` #${numeroPedido(p.id)}` : ""} (${p ? `${p.quantidade}× ` : ""}${i.produto}), com retirada ${i.iso === hoje ? "hoje" : `em ${i.iso.split("-").reverse().join("/")}`}${i.hora ? ` às ${i.hora}` : ""}:`;
    const href = i.numero ? linkWhatsapp(i.numero, msg) : null;
    return (
      <div key={t.id} style={css(`background:#fff; border:1px solid ${atrasada ? "#F3B4BC" : "#ECEDF1"}; border-radius:16px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 1px 3px rgba(16,24,40,.05); ${feita(t) ? "opacity:.82;" : ""}`)}>
        <div onClick={() => setTaskDetailOpen(t.id)} style={css("position:relative; cursor:pointer;")}>
          <Foto src={i.foto} alt={i.produto} proporcao="16/10" cortar miniatura />
          {i.qtd && <span style={css("position:absolute; top:10px; left:10px; background:rgba(27,27,40,.82); color:#fff; font-size:15px; font-weight:800; padding:5px 11px; border-radius:999px;")}>{i.qtd}×</span>}
          {i.hora && (
            <span style={css(`position:absolute; top:10px; right:10px; display:inline-flex; align-items:center; gap:5px; background:${atrasada ? "#CC3338" : "#fff"}; color:${atrasada ? "#fff" : "#1B1B28"}; font-size:14px; font-weight:800; padding:5px 11px; border-radius:999px; box-shadow:0 2px 8px rgba(0,0,0,.15);`)}>
              <Svg size={14} sw={2.4}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>{i.hora}
            </span>
          )}
        </div>

        <div style={css("padding:14px 16px 0; display:flex; flex-direction:column; gap:10px; flex:1;")}>
          <div onClick={() => setTaskDetailOpen(t.id)} style={{ cursor: "pointer" }}>
            <div style={css("font-size:17px; font-weight:800; line-height:1.25; letter-spacing:-.2px;")}>{i.produto}</div>
            <div style={css("display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:5px; font-size:12.5px; font-weight:700; color:#7A8090;")}>
              {lojaNome && <span style={css(`display:inline-flex; align-items:center; gap:5px; color:${corDoLocal(t.local)};`)}><span style={css(`width:7px; height:7px; border-radius:50%; background:${corDoLocal(t.local)};`)} />{lojaNome}</span>}
              {p && <span>#{numeroPedido(p.id)}</span>}
              {p && <span>{brl(p.total)}</span>}
            </div>
          </div>

          <div style={css("display:flex; align-items:center; gap:10px; background:#F7F7F9; border-radius:12px; padding:9px 11px;")}>
            <span style={css(`width:34px; height:34px; flex:none; border-radius:50%; background:${COR}1A; color:${COR}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px;`)}>{(i.cliente || "?").trim().charAt(0).toUpperCase()}</span>
            <div style={css("flex:1; min-width:0;")}>
              <div style={css("font-size:14px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{i.cliente || "Cliente"}</div>
              {i.numero && <div style={css("font-size:12.5px; color:#7A8090; font-weight:600;")}>{foneBR(i.numero)}</div>}
            </div>
            {href && i.numero && <LinkWhatsapp href={href} mensagem={msg} para={i.cliente || foneBR(i.numero)} size={32} />}
          </div>

          {p?.mensagem && (
            <div style={css("background:#FFF8E6; border:1px solid #F5DFA6; border-radius:12px; padding:9px 12px;")}>
              <div style={css("font-size:11px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; color:#A16207; margin-bottom:2px;")}>Observação do cliente</div>
              <div style={css("font-size:14px; font-weight:700; color:#5B4300; line-height:1.4; word-break:break-word;")}>{p.mensagem}</div>
            </div>
          )}

          {prod && !feita(t) && (
            <div style={css(`display:flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700; color:${prod.cor};`)}>
              <span style={css(`width:8px; height:8px; border-radius:50%; background:${prod.cor};`)} />{prod.texto}
            </div>
          )}
        </div>

        <div style={css("display:flex; align-items:center; flex-wrap:wrap; gap:8px; padding:12px 16px 14px; margin-top:12px; border-top:1px solid #F0F1F4;")}>
          <span style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:5px 10px; border-radius:999px; background:${si.bg}; color:${si.fg}; white-space:nowrap;`)}><span style={css(`width:7px; height:7px; border-radius:50%; background:${si.dot};`)} />{si.label}</span>
          <span style={{ flex: 1 }} />
          <Hoverable as="button" onClick={() => setTaskDetailOpen(t.id)} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:8px 12px; border-radius:10px;")} hover="background:#F4F4F7">Detalhes</Hoverable>
          {prox && (
            <Hoverable as="button" onClick={() => updateTask(t.id, { status: prox })} title={`Passar para "${statusInfo[prox].label}"`} s={css(`border:none; background:${prox === "concluida" ? "#1B7F4D" : "#2F80ED"}; color:#fff; cursor:pointer; font-size:13px; font-weight:800; padding:9px 14px; border-radius:10px; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;`)} hover="filter:brightness(1.08)">
              <Svg size={14} sw={2.8}>{prox === "concluida" ? <path d="M20 6 9 17l-5-5" /> : <path d="M5 12h14M13 6l6 6-6 6" />}</Svg>
              {prox === "concluida" ? "Concluir" : prox === "validada" ? "Validar" : statusInfo[prox].label}
            </Hoverable>
          )}
        </div>
      </div>
    );
  };

  const grade = (lista: Item[]) => (
    <div style={css(`display:grid; grid-template-columns:${mobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))"}; gap:16px;`)}>{lista.map(cartao)}</div>
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

      <div style={css("display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; margin-bottom:8px; scrollbar-width:none;")}>
        {chip(aba === "pendentes", () => setAba("pendentes"), <>Para entregar <span style={css("color:#9398A6;")}>{pendentes.length}</span></>)}
        {chip(aba === "concluidas", () => setAba("concluidas"), <>Concluídas <span style={css("color:#9398A6;")}>{concluidas.length}</span></>, "#1B7F4D")}
        {lojas.length > 1 && <span style={css("flex:none; width:1px; background:#E2E3E9; margin:4px 4px;")} />}
        {lojas.length > 1 && chip(!loja, () => setLoja(""), "Todas as lojas", "#3A3F4C")}
        {lojas.length > 1 && lojas.map((l) => chip(loja === l, () => setLoja(loja === l ? "" : l), <><span style={css(`width:8px; height:8px; border-radius:50%; background:${corDoLocal(l)};`)} />{LOCAIS_ESTOQUE.find((x) => x.id === l)?.label ?? l}</>, corDoLocal(l), l))}
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
      {aba === "concluidas" && (concluidas.length === 0 ? vazio("Nenhuma encomenda concluída") : <div style={css("margin-top:18px;")}>{grade(concluidas)}</div>)}
    </div>
  );
}
