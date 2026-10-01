"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { css } from "@/lib/css";
import { ACCENT, BRAND } from "@/lib/theme";
import { CATEGORIAS_ESTOQUE, LOCAIS_ESTOQUE } from "@/lib/estoque";
import { PEDIDO_STATUS, pedidoStatusInfo } from "@/lib/pedido";
import {
  FILTROS_VAZIOS, PERIODOS, filtrarPedidos, filtrarTarefas, matrizProdutoUnidade, pct, porCategoria, porResponsavel, porUnidade,
  rankingProdutos, resumoOrdens, serieTemporal, statusPorSetor, type Filtros,
} from "@/lib/indicadores";
import type { PedidoStatus, TaskStatus } from "@/lib/types";
import { gestorOf, useApp } from "../store";
import { Avatar } from "../ui/bits";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";

/**
 * Operacional → Indicadores. Tudo sai do store (ordens, tarefas, produtos) e os filtros da
 * barra valem para TODOS os cartões. Cores: marca (#955C6B) para séries únicas; o par
 * Produção/Expedição e os status foram validados no validador do skill de dataviz; o mapa de
 * calor usa uma rampa azul sequencial validada. Todo gráfico tem uma vista em tabela.
 */

// ── paleta (validada) ──
const COR_PRODUCAO = "#A4466A", COR_EXPEDICAO = "#0E8FB0", COR_UNIDADES = "#C98500"; // trio validado (todos os pares)
// Pizza de status das ordens — ordem circular validada (amarelo → verde → laranja → azul).
const COR_STATUS_ORDEM: Record<PedidoStatus, string> = { aberta: "#C98500", concluida: "#2FB56F", "em andamento": "#F76808", validada: "#2563EB" };
const ORDEM_PIZZA: PedidoStatus[] = ["aberta", "concluida", "em andamento", "validada"];
// Rampa sequencial (uma cor, claro → escuro) para o mapa de calor.
const RAMPA = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const GRADE = "#ECEDF1", EIXO = "#9398A6";
const TASK_STATUS: { key: TaskStatus; label: string }[] = [
  { key: "verificar", label: "A verificar" }, { key: "em andamento", label: "Em produção" }, { key: "atrasada", label: "Atrasada" }, { key: "concluida", label: "Concluída" }, { key: "validada", label: "Validada" },
];
const fmt = (n: number) => n.toLocaleString("pt-BR");

export default function Indicadores() {
  const { pedidos, tasks, produtos, team } = useApp();
  const [f, setF] = useState<Filtros>(FILTROS_VAZIOS);
  const set = (patch: Partial<Filtros>) => setF((x) => ({ ...x, ...patch }));
  const [metrica, setMetrica] = useState<"unidades" | "ordens">("unidades");

  // Recorte + agregados (memo: tudo recalcula só quando dados ou filtros mudam).
  const d = useMemo(() => {
    const ps = filtrarPedidos(pedidos, produtos, f);
    const ts = filtrarTarefas(tasks, ps, produtos, f);
    return {
      ps, ts,
      resumo: resumoOrdens(ps, produtos, f),
      top: rankingProdutos(ps, produtos, f, 5),
      todos: rankingProdutos(ps, produtos, f, 0),
      unidades: porUnidade(ps, produtos, f),
      categorias: porCategoria(ps, produtos, f),
      serie: serieTemporal(ps, produtos, f),
      setores: statusPorSetor(ts),
      matriz: matrizProdutoUnidade(ps, produtos, f, 8),
      pessoas: porResponsavel(ts),
    };
  }, [pedidos, tasks, produtos, f]);

  const r = d.resumo;
  const feitas = r.porStatus.concluida + r.porStatus.validada;
  const filtrosAtivos = f.local || f.categoria || f.status || f.periodo !== FILTROS_VAZIOS.periodo;
  const vazio = d.ps.length === 0;
  const localLabel = LOCAIS_ESTOQUE.find((l) => l.id === f.local)?.label;

  // Dados dos gráficos
  const pizza = ORDEM_PIZZA.map((s) => ({ key: s, name: pedidoStatusInfo(s).label, value: r.porStatus[s] })).filter((x) => x.value > 0);
  const maxMatriz = Math.max(1, ...d.matriz.flatMap((m) => Object.values(m.valores)));
  const corCelula = (v: number) => (v <= 0 ? "#fff" : RAMPA[Math.min(RAMPA.length - 1, Math.floor((v / maxMatriz) * (RAMPA.length - 1) + 0.0001))]);
  const inkCelula = (v: number) => (v / maxMatriz >= 0.5 ? "#fff" : "#1B1B28");
  const statusSetor = TASK_STATUS.map((s) => ({ status: s.label, Produção: d.setores[0][s.key], Expedição: d.setores[1][s.key], Unidades: d.setores[2][s.key] }));

  return (
    <div style={css("height:100%; display:flex; flex-direction:column; min-height:0;")}>
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:24px 30px 14px;")}>
        <div style={{ flex: 1 }}>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Indicadores</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>
            {PERIODOS.find((p) => p.key === f.periodo)?.label}{localLabel ? ` · ${localLabel}` : ""}{f.categoria ? ` · ${f.categoria}` : ""}{f.status ? ` · ${pedidoStatusInfo(f.status).label}` : ""} · {d.ps.length} {d.ps.length === 1 ? "ordem" : "ordens"}
          </p>
        </div>
      </div>

      {/* Filtros: uma linha, acima de tudo; valem para todos os cartões. */}
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:10px; padding:0 30px 16px;")}>
        <Filtro icone={<Svg size={14}><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>} rotulo="Período" valor={PERIODOS.find((p) => p.key === f.periodo)?.label ?? ""} ativo={f.periodo !== FILTROS_VAZIOS.periodo}>
          {(c) => PERIODOS.map((p) => <MenuItem key={p.key} checked={f.periodo === p.key} accent={ACCENT} onClick={() => { set({ periodo: p.key }); c(); }}><span style={{ flex: 1 }}>{p.label}</span></MenuItem>)}
        </Filtro>
        <Filtro icone={<Svg size={14}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" /></Svg>} rotulo="Unidade" valor={localLabel ?? "Todas"} ativo={!!f.local}>
          {(c) => (<>
            <MenuItem checked={!f.local} accent={ACCENT} onClick={() => { set({ local: "" }); c(); }}><span style={{ flex: 1 }}>Todas as unidades</span></MenuItem>
            {LOCAIS_ESTOQUE.map((l) => <MenuItem key={l.id} checked={f.local === l.id} accent={ACCENT} onClick={() => { set({ local: l.id }); c(); }}><span style={{ flex: 1 }}>{l.label}</span></MenuItem>)}
          </>)}
        </Filtro>
        <Filtro icone={<Svg size={14}><path d="M21 8 12 3 3 8v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></Svg>} rotulo="Categoria" valor={f.categoria || "Todas"} ativo={!!f.categoria}>
          {(c) => (<>
            <MenuItem checked={!f.categoria} accent={ACCENT} onClick={() => { set({ categoria: "" }); c(); }}><span style={{ flex: 1 }}>Todas as categorias</span></MenuItem>
            {CATEGORIAS_ESTOQUE.map((k) => <MenuItem key={k.v} checked={f.categoria === k.v} accent={ACCENT} onClick={() => { set({ categoria: k.v }); c(); }}><span style={css(`width:9px; height:9px; border-radius:50%; background:${k.cor};`)} /><span style={{ flex: 1 }}>{k.v}</span></MenuItem>)}
          </>)}
        </Filtro>
        <Filtro icone={<Svg size={14}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>} rotulo="Status" valor={f.status ? pedidoStatusInfo(f.status).label : "Todos"} ativo={!!f.status}>
          {(c) => (<>
            <MenuItem checked={!f.status} accent={ACCENT} onClick={() => { set({ status: "" }); c(); }}><span style={{ flex: 1 }}>Todos os status</span></MenuItem>
            {PEDIDO_STATUS.map((s) => <MenuItem key={s.key} checked={f.status === s.key} accent={ACCENT} onClick={() => { set({ status: s.key }); c(); }}><span style={css(`width:9px; height:9px; border-radius:50%; background:${s.dot};`)} /><span style={{ flex: 1 }}>{s.label}</span></MenuItem>)}
          </>)}
        </Filtro>
        {filtrosAtivos && (
          <Hoverable as="button" onClick={() => setF(FILTROS_VAZIOS)} s={css("display:inline-flex; align-items:center; gap:6px; border:none; background:transparent; color:#955C6B; cursor:pointer; font-size:12.5px; font-weight:700; padding:8px 10px; border-radius:9px;")} hover="background:#FDF1F4">
            <Svg size={13} sw={2.4}><path d="M6 6l12 12M18 6 6 18" /></Svg>Limpar filtros
          </Hoverable>
        )}
        <span style={{ flex: 1 }} />
        <span style={css("font-size:12px; color:#9398A6; font-weight:600;")}>Clique numa barra ou fatia para filtrar por ela.</span>
      </div>

      <div className="m-pad" style={css("flex:1; min-height:0; overflow-y:auto; padding:0 30px 30px;")}>
        {/* KPIs */}
        <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; margin-bottom:14px;")}>
          <Tile rotulo="Ordens de serviço" valor={fmt(r.total)} sub={`${fmt(r.porStatus.aberta)} abertas · ${fmt(r.porStatus["em andamento"])} em andamento`} />
          <Tile rotulo="Concluídas" valor={fmt(feitas)} sub={`${pct(feitas, r.total)} das ordens · ${fmt(r.porStatus.validada)} validadas`} cor="#1B7F4D" />
          <Tile rotulo="Unidades pedidas" valor={fmt(r.unidades)} sub={`${fmt(r.produtosDistintos)} ${r.produtosDistintos === 1 ? "produto distinto" : "produtos distintos"}`} destaque />
          <Tile rotulo="Produção" valor={`${fmt(d.setores[0].concluidas)}/${fmt(d.setores[0].total)}`} sub={`${pct(d.setores[0].concluidas, d.setores[0].total)} das tarefas concluídas · ${fmt(d.setores[0].atrasada)} atrasadas`} cor={COR_PRODUCAO} />
          <Tile rotulo="Expedição" valor={`${fmt(d.setores[1].concluidas)}/${fmt(d.setores[1].total)}`} sub={`${pct(d.setores[1].concluidas, d.setores[1].total)} das tarefas concluídas · ${fmt(d.setores[1].atrasada)} atrasadas`} cor={COR_EXPEDICAO} />
          <Tile rotulo="Unidades" valor={`${fmt(d.setores[2].concluidas)}/${fmt(d.setores[2].total)}`} sub={`${pct(d.setores[2].concluidas, d.setores[2].total)} das tarefas concluídas · ${fmt(d.setores[2].atrasada)} atrasadas`} cor={COR_UNIDADES} />
        </div>

        {vazio ? (
          <div style={css("display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:60px 30px; gap:12px; background:#fff; border:1px solid #ECEDF1; border-radius:14px;")}>
            <span style={css("width:56px; height:56px; border-radius:16px; background:#F2F3F6; display:flex; align-items:center; justify-content:center; color:#B4B8C4;")}><Svg size={26} sw={1.8}><path d="M3 3v18h18" /><path d="m7 15 4-4 4 3 5-6" /></Svg></span>
            <div style={css("font-size:15.5px; font-weight:800; color:#3A3F4C;")}>Nenhuma ordem de serviço neste recorte</div>
            <div style={css("font-size:13px; color:#9398A6; font-weight:600; max-width:380px; line-height:1.5;")}>Amplie o período ou limpe os filtros. Os indicadores aparecem assim que houver ordens.</div>
          </div>
        ) : (
          <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:14px;")}>
            {/* 1. Linha: evolução no tempo (uma série por vez — nunca dois eixos) */}
            <Card span={2} titulo="Evolução das ordens" sub={metrica === "unidades" ? "Unidades pedidas por data de criação da ordem" : "Ordens criadas por data"}
              acoes={<Seg opts={[{ k: "unidades", l: "Unidades" }, { k: "ordens", l: "Ordens" }]} v={metrica} set={(k) => setMetrica(k as "unidades" | "ordens")} />}
              tabela={{ cols: ["Data", "Ordens", "Unidades"], rows: d.serie.map((p) => [p.label, fmt(p.ordens), fmt(p.unidades)]) }}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={d.serie} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
                  <defs><linearGradient id="ind-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRAND} stopOpacity={0.14} /><stop offset="100%" stopColor={BRAND} stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid stroke={GRADE} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: EIXO }} tickLine={false} axisLine={{ stroke: GRADE }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: EIXO }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                  <Tooltip cursor={{ stroke: "#C7CAD2", strokeWidth: 1 }} content={<Tip />} />
                  <Area type="monotone" dataKey={metrica} name={metrica === "unidades" ? "Unidades" : "Ordens"} stroke={BRAND} strokeWidth={2} fill="url(#ind-area)" dot={{ r: 3, fill: BRAND, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* 2. Pizza: ordens por status (clique filtra) */}
            <Card titulo="Ordens por status" sub="Clique numa fatia para filtrar"
              tabela={{ cols: ["Status", "Ordens", "%"], rows: ORDEM_PIZZA.map((s) => [pedidoStatusInfo(s).label, fmt(r.porStatus[s]), pct(r.porStatus[s], r.total)]) }}>
              <div style={css("display:flex; align-items:center; gap:12px;")}>
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie data={pizza} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2} stroke="#fff" strokeWidth={2} onClick={(e) => { const k = (e as { key?: PedidoStatus })?.key; if (k) set({ status: f.status === k ? "" : k }); }} style={{ cursor: "pointer" }}>
                      {pizza.map((x) => <Cell key={x.key} fill={COR_STATUS_ORDEM[x.key]} opacity={f.status && f.status !== x.key ? 0.35 : 1} />)}
                    </Pie>
                    <Tooltip content={<Tip total={r.total} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={css("flex:1; display:flex; flex-direction:column; gap:8px;")}>
                  {ORDEM_PIZZA.map((s) => (
                    <Hoverable key={s} onClick={() => set({ status: f.status === s ? "" : s })} s={css(`display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:8px; cursor:pointer; ${f.status === s ? "background:#FDF1F4;" : ""}`)} hover="background:#F4F4F7">
                      <span style={css(`width:10px; height:10px; border-radius:3px; background:${COR_STATUS_ORDEM[s]}; flex:none;`)} />
                      <span style={css("flex:1; font-size:12.5px; font-weight:600; color:#3A3F4C;")}>{pedidoStatusInfo(s).label}</span>
                      <strong style={css("font-size:13px; color:#1B1B28;")}>{fmt(r.porStatus[s])}</strong>
                      <span style={css("font-size:11.5px; color:#9398A6; width:34px; text-align:right;")}>{pct(r.porStatus[s], r.total)}</span>
                    </Hoverable>
                  ))}
                </div>
              </div>
            </Card>

            {/* 3. Barras horizontais: top 5 produtos */}
            <Card titulo="Top 5 produtos mais pedidos" sub={d.todos.length > 5 ? `Entre ${d.todos.length} produtos do recorte` : "Unidades somadas em todas as ordens do recorte"}
              tabela={{ cols: ["Produto", "Categoria", "Unidades", "Ordens"], rows: d.todos.map((p) => [p.nome, p.categoria, fmt(p.qtd), fmt(p.ordens)]) }}>
              <ResponsiveContainer width="100%" height={Math.max(160, 36 * d.top.length + 30)}>
                <BarChart data={d.top} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 0 }} barCategoryGap={10}>
                  <CartesianGrid stroke={GRADE} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: EIXO }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 12, fill: "#3A3F4C" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 21) + "…" : v)} />
                  <Tooltip cursor={{ fill: "#F4F4F7" }} content={<Tip />} />
                  <Bar dataKey="qtd" name="Unidades" fill={BRAND} barSize={18} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 12, fill: "#3A3F4C", fontWeight: 700, formatter: (v: unknown) => fmt(Number(v)) }} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* 4. Colunas: unidades recebidas por local (clique filtra) */}
            <Card titulo="Quantidade recebida por unidade" sub="Unidades pedidas para cada loja · clique numa coluna para filtrar"
              tabela={{ cols: ["Unidade", "Unidades", "Ordens", "%"], rows: d.unidades.map((u) => [u.label, fmt(u.qtd), fmt(u.ordens), pct(u.qtd, r.unidades)]) }}>
              <ResponsiveContainer width="100%" height={262}>
                <BarChart data={d.unidades} margin={{ top: 18, right: 8, left: -14, bottom: 4 }} barCategoryGap={14} onClick={(st) => { const k = (st as { activePayload?: { payload?: { id?: string } }[] })?.activePayload?.[0]?.payload?.id; if (k) set({ local: f.local === k ? "" : k }); }} style={{ cursor: "pointer" }}>
                  <CartesianGrid stroke={GRADE} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: EIXO }} tickLine={false} axisLine={{ stroke: GRADE }} interval={0} angle={-22} textAnchor="end" height={46} tickFormatter={(v: string) => (v === "Santa Mônica" ? "Sta. Mônica" : v)} />
                  <YAxis tick={{ fontSize: 11, fill: EIXO }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                  <Tooltip cursor={{ fill: "#F4F4F7" }} content={<Tip total={r.unidades} />} />
                  <Bar dataKey="qtd" name="Unidades" barSize={24} radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 11.5, fill: "#3A3F4C", fontWeight: 700, formatter: (v: unknown) => (Number(v) ? fmt(Number(v)) : "") }}>
                    {d.unidades.map((u) => <Cell key={u.id} fill={BRAND} opacity={f.local && f.local !== u.id ? 0.35 : 1} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* 5. Barras agrupadas: tarefas por status, produção × expedição (par validado) */}
            <Card titulo="Tarefas por status" sub="Produção, expedição e conferência nas unidades"
              tabela={{ cols: ["Status", "Produção", "Expedição", "Unidades"], rows: statusSetor.map((s) => [s.status, fmt(s.Produção), fmt(s.Expedição), fmt(s.Unidades)]) }}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={statusSetor} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }} barCategoryGap={8} barGap={2}>
                  <CartesianGrid stroke={GRADE} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: EIXO }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="status" width={92} tick={{ fontSize: 12, fill: "#3A3F4C" }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "#F4F4F7" }} content={<Tip />} />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, fontWeight: 600, color: "#3A3F4C", paddingTop: 6 }} />
                  <Bar dataKey="Produção" fill={COR_PRODUCAO} barSize={9} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "#3A3F4C", fontWeight: 700, formatter: (v: unknown) => (Number(v) ? fmt(Number(v)) : "") }} />
                  <Bar dataKey="Expedição" fill={COR_EXPEDICAO} barSize={9} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "#3A3F4C", fontWeight: 700, formatter: (v: unknown) => (Number(v) ? fmt(Number(v)) : "") }} />
                  <Bar dataKey="Unidades" fill={COR_UNIDADES} barSize={9} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "#3A3F4C", fontWeight: 700, formatter: (v: unknown) => (Number(v) ? fmt(Number(v)) : "") }} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* 6. Barras: unidades por categoria (clique filtra) */}
            <Card titulo="Pedidos por categoria" sub="Unidades por categoria de produto · clique para filtrar"
              tabela={{ cols: ["Categoria", "Unidades", "Produtos", "%"], rows: d.categorias.map((c) => [c.categoria, fmt(c.qtd), fmt(c.produtos), pct(c.qtd, r.unidades)]) }}>
              <ResponsiveContainer width="100%" height={Math.max(160, 30 * d.categorias.length + 30)}>
                <BarChart data={d.categorias} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 0 }} barCategoryGap={8} onClick={(st) => { const k = (st as { activePayload?: { payload?: { categoria?: string } }[] })?.activePayload?.[0]?.payload?.categoria; if (k) set({ categoria: f.categoria === k ? "" : k }); }} style={{ cursor: "pointer" }}>
                  <CartesianGrid stroke={GRADE} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: EIXO }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="categoria" width={140} tick={{ fontSize: 12, fill: "#3A3F4C" }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "#F4F4F7" }} content={<Tip total={r.unidades} />} />
                  <Bar dataKey="qtd" name="Unidades" barSize={16} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 12, fill: "#3A3F4C", fontWeight: 700, formatter: (v: unknown) => fmt(Number(v)) }}>
                    {d.categorias.map((c) => <Cell key={c.categoria} fill={BRAND} opacity={f.categoria && f.categoria !== c.categoria ? 0.35 : 1} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* 7. Mapa de calor: produto × unidade (rampa sequencial, valor em cada célula) */}
            <Card span={2} titulo="Produto × unidade" sub="Quanto de cada produto (top 8) cada loja recebe · passe o mouse ou clique na coluna para filtrar a unidade"
              tabela={{ cols: ["Produto", ...LOCAIS_ESTOQUE.map((l) => l.label), "Total"], rows: d.matriz.map((m) => [m.nome, ...LOCAIS_ESTOQUE.map((l) => fmt(m.valores[l.id])), fmt(m.total)]) }}>
              <div style={css("overflow:auto;")}>
                <div style={css(`display:grid; grid-template-columns:minmax(140px, 1.6fr) repeat(${LOCAIS_ESTOQUE.length}, minmax(52px, 1fr)) 54px; gap:2px; min-width:600px; font-size:12.5px;`)}>
                  <span />
                  {LOCAIS_ESTOQUE.map((l) => (
                    <Hoverable key={l.id} onClick={() => set({ local: f.local === l.id ? "" : l.id })} s={css(`display:flex; align-items:flex-end; justify-content:center; text-align:center; font-size:10px; line-height:1.15; font-weight:700; letter-spacing:0.2px; text-transform:uppercase; padding:4px 2px; border-radius:7px; cursor:pointer; color:${f.local === l.id ? "#955C6B" : "#7A8090"}; background:${f.local === l.id ? "#FDF1F4" : "transparent"};`)} hover="background:#F4F4F7">{l.label}</Hoverable>
                  ))}
                  <span style={css("display:flex; align-items:flex-end; justify-content:center; font-size:10px; font-weight:700; letter-spacing:0.2px; text-transform:uppercase; padding:4px 2px; color:#7A8090;")}>Total</span>
                  {d.matriz.map((m) => (
                    <Linha key={m.nome}>
                      <span style={css("font-weight:700; color:#1B1B28; padding:0 8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center;")} title={m.nome}>{m.nome}</span>
                      {LOCAIS_ESTOQUE.map((l) => {
                        const v = m.valores[l.id];
                        return (
                          <div key={l.id} title={`${m.nome} · ${l.label}: ${fmt(v)} un.`} style={css(`height:34px; display:flex; align-items:center; justify-content:center; border-radius:6px; background:${corCelula(v)}; color:${v ? inkCelula(v) : "#D5D8DF"}; font-weight:700; font-variant-numeric:tabular-nums; opacity:${f.local && f.local !== l.id ? 0.45 : 1}; ${v ? "" : "border:1px solid #F0F1F4;"}`)}>{v || "·"}</div>
                        );
                      })}
                      <span style={css("display:flex; align-items:center; justify-content:center; font-weight:800; color:#1B1B28; font-variant-numeric:tabular-nums;")}>{fmt(m.total)}</span>
                    </Linha>
                  ))}
                </div>
                <div style={css("display:flex; align-items:center; gap:6px; margin-top:10px; font-size:11px; color:#9398A6; font-weight:600;")}>
                  <span>menos</span>{RAMPA.map((c) => <span key={c} style={css(`width:18px; height:10px; border-radius:3px; background:${c};`)} />)}<span>mais</span>
                </div>
              </div>
            </Card>

            {/* 8. Pessoas: tarefas por responsável */}
            <Card titulo="Tarefas por responsável" sub="Concluídas sobre o total atribuído (produção + expedição)"
              tabela={{ cols: ["Responsável", "Tarefas", "Concluídas", "Atrasadas", "%"], rows: d.pessoas.map((p) => [gestorOf(team, p.gestor).nome, fmt(p.total), fmt(p.concluidas), fmt(p.atrasadas), pct(p.concluidas, p.total)]) }}>
              {d.pessoas.length === 0 ? <Vazio>Sem tarefas no recorte.</Vazio> : (
                <div style={css("display:flex; flex-direction:column; gap:10px;")}>
                  {d.pessoas.map((p) => {
                    const g = gestorOf(team, p.gestor); const w = p.total ? Math.round((p.concluidas / p.total) * 100) : 0;
                    return (
                      <div key={p.gestor} style={css("display:flex; align-items:center; gap:10px;")}>
                        <Avatar ini={g.ini} cor={g.cor} src={g.foto} size={26} fontSize={10.5} />
                        <div style={css("flex:1; min-width:0;")}>
                          <div style={css("display:flex; align-items:baseline; gap:8px; margin-bottom:4px;")}>
                            <span style={css("font-size:13px; font-weight:700; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{g.nome}</span>
                            <span style={{ flex: 1 }} />
                            <span style={css("font-size:12px; color:#5B6472; font-weight:700;")}>{fmt(p.concluidas)}/{fmt(p.total)}</span>
                            {p.atrasadas > 0 && <span style={css("font-size:11px; font-weight:700; color:#CC3338; background:#FDECEC; padding:1px 7px; border-radius:999px;")}>{p.atrasadas} atrasada{p.atrasadas > 1 ? "s" : ""}</span>}
                          </div>
                          <div style={css("height:6px; border-radius:999px; background:#EDEEF2; overflow:hidden;")}><div style={css(`height:100%; width:${w}%; background:${BRAND}; border-radius:999px;`)} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── peças ─────────────────────────

function Filtro({ icone, rotulo, valor, ativo, children }: { icone: ReactNode; rotulo: string; valor: string; ativo: boolean; children: (close: () => void) => ReactNode }) {
  return (
    <Menu align="left" width={230} trigger={(toggle) => (
      <Hoverable as="button" onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:7px; background:${ativo ? "#FDF1F4" : "#fff"}; border:1px solid ${ativo ? ACCENT : "#E2E3E9"}; color:${ativo ? ACCENT : "#3A3F4C"}; cursor:pointer; font-size:13px; font-weight:700; padding:8px 12px; border-radius:10px; max-width:240px;`)} hover={ativo ? undefined : "background:#FAFAFB"}>
        <span style={css("display:inline-flex; color:inherit; opacity:.8;")}>{icone}</span>
        <span style={css("color:#9398A6; font-weight:600;")}>{rotulo}</span>
        <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{valor}</span>
        <Svg size={12} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
      </Hoverable>
    )}>{children}</Menu>
  );
}

function Tile({ rotulo, valor, sub, cor, destaque }: { rotulo: string; valor: string; sub?: string; cor?: string; destaque?: boolean }) {
  return (
    <div style={css(`background:${destaque ? "#1B1B28" : "#fff"}; border:1px solid ${destaque ? "#1B1B28" : "#ECEDF1"}; border-radius:14px; padding:14px 16px; min-width:0;`)}>
      <div style={css(`font-size:11.5px; font-weight:700; letter-spacing:0.3px; text-transform:uppercase; color:${destaque ? "rgba(255,255,255,.65)" : "#9398A6"}; display:flex; align-items:center; gap:6px;`)}>
        {cor && <span style={css(`width:8px; height:8px; border-radius:50%; background:${cor};`)} />}{rotulo}
      </div>
      <div style={css(`font-size:28px; font-weight:800; letter-spacing:-0.6px; line-height:1.15; margin-top:4px; color:${destaque ? "#fff" : "#1B1B28"};`)}>{valor}</div>
      {sub && <div style={css(`font-size:12px; font-weight:600; margin-top:4px; color:${destaque ? "rgba(255,255,255,.6)" : "#7A8090"}; line-height:1.4;`)}>{sub}</div>}
    </div>
  );
}

/** Cartão de gráfico com vista em tabela (toda leitura possível sem o gráfico). */
function Card({ titulo, sub, acoes, tabela, span, children }: { titulo: string; sub?: string; acoes?: ReactNode; tabela: { cols: string[]; rows: (string | number)[][] }; span?: number; children: ReactNode }) {
  const [modo, setModo] = useState<"grafico" | "tabela">("grafico");
  return (
    <section className={span === 2 ? "ind-span2" : undefined} style={css(`background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:16px 18px 14px; min-width:0; ${span === 2 ? "grid-column:span 2;" : ""}`)}>
      <div className="m-wrap" style={css("display:flex; align-items:flex-start; gap:10px; margin-bottom:10px;")}>
        <div style={css("flex:1 1 180px; min-width:180px;")}>
          <div style={css("font-size:14.5px; font-weight:800; color:#1B1B28; letter-spacing:-0.2px;")}>{titulo}</div>
          {sub && <div style={css("font-size:12px; color:#9398A6; font-weight:600; margin-top:2px;")}>{sub}</div>}
        </div>
        {acoes}
        <Seg opts={[{ k: "grafico", l: "Gráfico" }, { k: "tabela", l: "Tabela" }]} v={modo} set={(k) => setModo(k as "grafico" | "tabela")} />
      </div>
      {modo === "grafico" ? children : (
        tabela.rows.length === 0 ? <Vazio>Sem dados no recorte.</Vazio> : (
          <div style={css("overflow:auto; max-height:320px;")}>
            <table style={css("width:100%; border-collapse:collapse; font-size:12.5px;")}>
              <thead><tr>{tabela.cols.map((c, i) => <th key={c} style={css(`text-align:${i ? "right" : "left"}; font-size:11px; font-weight:700; letter-spacing:0.3px; text-transform:uppercase; color:#9398A6; padding:6px 8px; border-bottom:1px solid #ECEDF1; position:sticky; top:0; background:#fff;`)}>{c}</th>)}</tr></thead>
              <tbody>{tabela.rows.map((row, ri) => <tr key={ri}>{row.map((v, i) => <td key={i} style={css(`text-align:${i ? "right" : "left"}; padding:7px 8px; border-bottom:1px solid #F4F5F7; color:${i ? "#1B1B28" : "#3A3F4C"}; font-weight:${i ? 700 : 600}; ${i ? "font-variant-numeric:tabular-nums;" : ""}`)}>{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )
      )}
      <style>{`@media (max-width: 760px) { .ind-span2 { grid-column: span 1 !important; } }`}</style>
    </section>
  );
}

function Seg({ opts, v, set }: { opts: { k: string; l: string }[]; v: string; set: (k: string) => void }) {
  return (
    <div style={css("display:flex; gap:2px; background:#EDEEF2; border-radius:8px; padding:2px; flex:none;")}>
      {opts.map((o) => <button key={o.k} onClick={() => set(o.k)} style={css(`border:none; cursor:pointer; font-size:11.5px; font-weight:700; padding:5px 10px; border-radius:6px; background:${v === o.k ? "#fff" : "transparent"}; color:${v === o.k ? "#1B1B28" : "#5B6472"}; box-shadow:${v === o.k ? "0 1px 2px rgba(16,24,40,.10)" : "none"};`)}>{o.l}</button>)}
    </div>
  );
}

const Linha = ({ children }: { children: ReactNode }) => <>{children}</>;
const Vazio = ({ children }: { children: ReactNode }) => <div style={css("padding:28px 10px; text-align:center; color:#9398A6; font-size:13px; font-weight:600;")}>{children}</div>;

/** Tooltip: valor em destaque, série em segundo plano, chave de cor ao lado. */
function Tip({ active, payload, label, total }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[]; label?: string; total?: number }) {
  if (!active || !payload?.length) return null;
  const titulo = label ?? (payload[0]?.payload?.name as string | undefined) ?? (payload[0]?.payload?.label as string | undefined) ?? "";
  return (
    <div style={css("background:#1B1B28; color:#fff; border-radius:10px; padding:9px 12px; box-shadow:0 10px 30px rgba(20,24,40,.25); font-size:12.5px; min-width:140px;")}>
      {titulo && <div style={css("font-weight:700; margin-bottom:5px; color:rgba(255,255,255,.75);")}>{titulo}</div>}
      {payload.map((p, i) => (
        <div key={i} style={css("display:flex; align-items:center; gap:8px; padding:2px 0;")}>
          <span style={css(`width:12px; height:3px; border-radius:2px; background:${p.color ?? (p.payload?.fill as string) ?? "#fff"};`)} />
          <strong style={css("font-size:14px;")}>{fmt(Number(p.value ?? 0))}</strong>
          <span style={css("color:rgba(255,255,255,.7);")}>{p.name}{total ? ` · ${pct(Number(p.value ?? 0), total)}` : ""}</span>
        </div>
      ))}
    </div>
  );
}
