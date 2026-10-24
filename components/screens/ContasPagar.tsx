"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { css } from "@/lib/css";
import { ACCENT } from "@/lib/theme";
import {
  FORMAS, MESES, MESES_CURTOS, SITUACOES, addDias, brDe, brl, diasEntre, ehPaga, hojeISO, mesDe, nomeMes, situacaoLabel, somaMes,
  statusDaConta, urlComprovante, valorEfetivo, type Comprovante, type Conta, type FormaPagamento, type ItemLista, type Situacao,
} from "@/lib/contas-pagar";
import { apiJson, authToken, getSupabaseBrowser } from "@/lib/supabase-browser";
import { useApp } from "../store";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import ConfirmModal from "../ui/ConfirmModal";
import { useFecharComEsc } from "../ui/useFecharComEsc";

/**
 * Administrativo → Contas a Pagar. Dados em /api/contas-pagar (tabelas conta_pagar, cp_empresa,
 * cp_plano; comprovantes no bucket privado contas-pagar). Fora do bootstrap: carrega ao abrir a
 * tela e recarrega quando o realtime_ping avisa mudança em conta_pagar/listas. Escrita otimista
 * com volta atrás se a API recusar. Abas Contas (lista com filtros) e Dashboard (visão do ano).
 * Cores Pago/Em aberto: par validado do Indicadores (azul-petróleo / âmbar); vermelho só para vencidas.
 */

const COR_PAGO = "#0E8FB0", COR_ABERTO = "#C98500", COR_VENCIDA = "#E5484D", COR_BREVE = "#F76808";
const GRADE = "#ECEDF1", EIXO = "#9398A6";
type FiltroSit = "todas" | "apagar" | "vencidas" | "pagas";

export default function ContasPagar() {
  const hoje = hojeISO();
  const anoAtual = Number(hoje.slice(0, 4));
  const { canEditPage } = useApp();
  const [contas, setContas] = useState<Conta[]>([]);
  const [listaEmpresas, setListaEmpresas] = useState<ItemLista[]>([]);
  const [listaPlanos, setListaPlanos] = useState<ItemLista[]>([]);
  const [podeEditarApi, setPodeEditarApi] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");
  const podeEditar = podeEditarApi && canEditPage("contas-pagar");
  const [aba, setAba] = useState<"contas" | "dashboard">("contas");
  const [mes, setMes] = useState(mesDe(hoje));
  const [busca, setBusca] = useState("");
  const [sit, setSit] = useState<FiltroSit>("todas");
  const [plano, setPlano] = useState("");
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [forma, setForma] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [ordem, setOrdem] = useState<"asc" | "desc">("asc");
  const [editando, setEditando] = useState<Conta | "nova" | null>(null);
  const [aviso, setAviso] = useState("");
  const avisoT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = (m: string) => { setAviso(m); if (avisoT.current) clearTimeout(avisoT.current); avisoT.current = setTimeout(() => setAviso(""), 2200); };

  const carregar = useCallback(async () => {
    try {
      const j = await apiJson<{ contas: Conta[]; empresas: ItemLista[]; planos: ItemLista[]; podeEditar: boolean }>("/api/contas-pagar", "GET");
      setContas(j.contas); setListaEmpresas(j.empresas); setListaPlanos(j.planos); setPodeEditarApi(j.podeEditar); setErroCarga("");
    } catch (e) { setErroCarga((e as Error).message); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  // Outra pessoa mexeu em contas/listas → recarrega (o sinal não carrega dado nenhum).
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ch = sb.channel("cp-ping").on("postgres_changes", { event: "*", schema: "public", table: "realtime_ping" }, (msg) => {
      const dom = (msg.new as { dominio?: string } | null)?.dominio ?? "";
      if (!["conta_pagar", "cp_empresa", "cp_plano"].includes(dom)) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => { void carregar(); }, 800);
    }).subscribe();
    return () => { if (t) clearTimeout(t); sb.removeChannel(ch); };
  }, [carregar]);
  const EMPRESAS = useMemo(() => listaEmpresas.map((e) => e.nome), [listaEmpresas]);
  const PLANOS = useMemo(() => listaPlanos.map((p) => p.nome), [listaPlanos]);

  /** Grava um patch: otimista, volta atrás se a API recusar. */
  const atualizar = async (id: string, patch: Partial<Conta>, msg?: string) => {
    const antes = contas.find((c) => c.id === id);
    setContas((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    try { await apiJson("/api/contas-pagar", "PATCH", { id, patch }); if (msg) avisar(msg); return true; }
    catch (e) { if (antes) setContas((cs) => cs.map((c) => (c.id === id ? antes : c))); avisar(`Não salvou: ${(e as Error).message}`); return false; }
  };

  // KPIs do topo: carteira inteira (não dependem dos filtros).
  const amanha = addDias(hoje, 1);
  const kpi = useMemo(() => {
    const abertas = contas.filter((c) => !ehPaga(c.situacao));
    const vencidas = abertas.filter((c) => c.vencimento < hoje);
    const amanhaL = abertas.filter((c) => c.vencimento === amanha);
    const pagasMes = contas.filter((c) => ehPaga(c.situacao) && c.dataPagamento && mesDe(c.dataPagamento) === mesDe(hoje));
    const soma = (l: Conta[]) => l.reduce((s, c) => s + valorEfetivo(c), 0);
    return { vencidas, amanha: amanhaL, abertas, pagasMes, soma };
  }, [contas, hoje, amanha]);

  // Lista filtrada. Com intervalo de vencimento, ele substitui o mês.
  const porData = !!(de || ate);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const l = contas.filter((c) => {
      if (porData) { if (de && c.vencimento < de) return false; if (ate && c.vencimento > ate) return false; }
      else if (mesDe(c.vencimento) !== mes) return false;
      if (plano && c.plano !== plano) return false;
      if (empresas.length && !empresas.includes(c.empresa)) return false;
      if (forma && c.forma !== forma) return false;
      const pago = ehPaga(c.situacao);
      if (sit === "apagar" && pago) return false;
      if (sit === "pagas" && !pago) return false;
      if (sit === "vencidas" && (pago || c.vencimento >= hoje)) return false;
      if (q && ![c.descricao, c.empresa, c.plano, c.codigoBarras ?? "", c.obs ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
    return l.sort((a, b) => (ordem === "asc" ? 1 : -1) * (a.vencimento.localeCompare(b.vencimento) || a.descricao.localeCompare(b.descricao)));
  }, [contas, busca, sit, plano, empresas, forma, de, ate, mes, porData, ordem, hoje]);

  const tot = useMemo(() => {
    const total = filtradas.reduce((s, c) => s + c.valor, 0);
    const pago = filtradas.filter((c) => ehPaga(c.situacao)).reduce((s, c) => s + valorEfetivo(c), 0);
    const aberto = filtradas.filter((c) => !ehPaga(c.situacao)).reduce((s, c) => s + c.valor, 0);
    const planos = new Map<string, { total: number; pago: number; aberto: number; n: number }>();
    for (const c of filtradas) {
      const p = planos.get(c.plano) ?? { total: 0, pago: 0, aberto: 0, n: 0 };
      p.n++; p.total += c.valor;
      if (ehPaga(c.situacao)) p.pago += c.valor; else p.aberto += c.valor;
      planos.set(c.plano, p);
    }
    return { total, pago, aberto, planos: [...planos.entries()].sort((a, b) => b[1].total - a[1].total) };
  }, [filtradas]);

  const chips: { label: string; limpar: () => void }[] = [
    ...(busca.trim() ? [{ label: `“${busca.trim()}”`, limpar: () => setBusca("") }] : []),
    ...(sit !== "todas" ? [{ label: { apagar: "A pagar", vencidas: "Vencidas", pagas: "Pagas" }[sit], limpar: () => setSit("todas") }] : []),
    ...(plano ? [{ label: plano, limpar: () => setPlano("") }] : []),
    ...empresas.map((e) => ({ label: e, limpar: () => setEmpresas((l) => l.filter((x) => x !== e)) })),
    ...(forma ? [{ label: forma, limpar: () => setForma("") }] : []),
    ...(porData ? [{ label: rotuloPeriodo(de, ate), limpar: () => { setDe(""); setAte(""); } }] : []),
  ];
  const limparTudo = () => { setBusca(""); setSit("todas"); setPlano(""); setEmpresas([]); setForma(""); setDe(""); setAte(""); };
  const contagemEmpresa = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of contas) if (porData ? (!de || c.vencimento >= de) && (!ate || c.vencimento <= ate) : mesDe(c.vencimento) === mes) m[c.empresa] = (m[c.empresa] ?? 0) + 1;
    return m;
  }, [contas, mes, de, ate, porData]);

  const salvar = async (novas: Conta[], id?: string): Promise<string | null> => {
    try {
      if (id) {
        const { id: _id, ...patch } = novas[0];
        await apiJson("/api/contas-pagar", "PATCH", { id, patch: { ...patch, valorPago: patch.valorPago ?? null, dataPagamento: patch.dataPagamento ?? null, obs: patch.obs ?? null, codigoBarras: patch.codigoBarras ?? null } });
        setContas((cs) => cs.map((c) => (c.id === id ? novas[0] : c)));
        avisar("Conta atualizada.");
      } else {
        await apiJson("/api/contas-pagar", "POST", { contas: novas });
        setContas((cs) => [...cs, ...novas]);
        avisar(novas.length > 1 ? `${novas.length} parcelas lançadas.` : "Conta lançada.");
      }
      setEditando(null);
      return null;
    } catch (e) { return (e as Error).message; }
  };
  const [excluindo, setExcluindo] = useState<Conta | null>(null);
  const excluir = async (c: Conta) => {
    setExcluindo(null);
    try { await apiJson("/api/contas-pagar", "DELETE", { id: c.id }); setContas((cs) => cs.filter((x) => x.id !== c.id)); setEditando(null); avisar("Conta excluída."); }
    catch (e) { avisar(`Não excluiu: ${(e as Error).message}`); }
  };
  const novoItem = async (tipo: "empresa" | "plano", nome: string): Promise<string | null> => {
    try {
      const { item } = await apiJson<{ item: ItemLista }>("/api/contas-pagar/listas", "POST", { tipo, nome });
      (tipo === "empresa" ? setListaEmpresas : setListaPlanos)((l) => (l.some((x) => x.id === item.id) ? l : [...l, item]));
      return item.nome;
    } catch (e) { avisar((e as Error).message); return null; }
  };

  return (
    <div style={css("height:100%; display:flex; flex-direction:column; min-height:0;")}>
      {/* Cabeçalho */}
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:14px; padding:24px 30px 14px; flex-wrap:wrap;")}>
        <div style={css("flex:1 1 220px;")}>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Contas a Pagar</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>{carregando ? "Carregando…" : `${contas.length} ${contas.length === 1 ? "lançamento" : "lançamentos"}`} · hoje {brDe(hoje)}</p>
        </div>
        <Seg grande opts={[{ k: "contas", l: "Contas" }, { k: "dashboard", l: "Dashboard" }]} v={aba} set={(k) => setAba(k as "contas" | "dashboard")} />
        {aba === "contas" && (
          <div style={css("display:flex; align-items:center; gap:4px; background:#fff; border:1px solid #E2E3E9; border-radius:10px; padding:3px;")}>
            <IconBtn titulo="Mês anterior" onClick={() => { setMes(somaMes(mes, -1)); setDe(""); setAte(""); }}><path d="m15 18-6-6 6-6" /></IconBtn>
            <Menu width={200} trigger={(t) => (
              <button onClick={t} style={css("border:none; background:transparent; cursor:pointer; font-size:13px; font-weight:700; color:#1B1B28; padding:6px 8px; min-width:150px; display:flex; align-items:center; justify-content:center; gap:6px;")}>
                {nomeMes(mes).replace(" de ", " ")}{mes === mesDe(hoje) && <span style={css("font-size:11px; color:#9398A6; font-weight:600;")}>(atual)</span>}
                <Svg size={12} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
              </button>
            )}>
              {(c) => Array.from({ length: 24 }, (_, i) => somaMes(`${anoAtual}-01`, i)).map((ym) => (
                <MenuItem key={ym} checked={ym === mes} accent={ACCENT} onClick={() => { setMes(ym); setDe(""); setAte(""); c(); }}><span style={{ flex: 1 }}>{nomeMes(ym)}</span></MenuItem>
              ))}
            </Menu>
            <IconBtn titulo="Próximo mês" onClick={() => { setMes(somaMes(mes, 1)); setDe(""); setAte(""); }}><path d="m9 18 6-6-6-6" /></IconBtn>
          </div>
        )}
        {podeEditar && <Hoverable as="button" onClick={() => setEditando("nova")} s={css(`display:inline-flex; align-items:center; gap:7px; border:none; background:${ACCENT}; color:#fff; cursor:pointer; font-size:13px; font-weight:700; padding:10px 15px; border-radius:10px;`)} hover="filter:brightness(1.08)">
          <Svg size={14} sw={2.6}><path d="M12 5v14M5 12h14" /></Svg>Nova conta
        </Hoverable>}
      </div>

      <div className="m-pad" style={css("flex:1; min-height:0; overflow-y:auto; padding:0 30px 30px;")}>
        {erroCarga && (
          <div style={css("display:flex; align-items:center; gap:10px; background:#FDECEC; border:1px solid #F5C2C4; color:#A12A2F; border-radius:12px; padding:10px 14px; margin-bottom:14px; font-size:13px; font-weight:700;")}>
            <span style={{ flex: 1 }}>Não foi possível carregar as contas: {erroCarga}</span>
            <button onClick={() => { setCarregando(true); void carregar(); }} style={css("border:1px solid #F5C2C4; background:#fff; color:#A12A2F; border-radius:8px; padding:6px 10px; font-weight:700; cursor:pointer;")}>Tentar de novo</button>
          </div>
        )}
        {/* KPIs (carteira toda) */}
        <div className="cp-kpis" style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:12px; margin-bottom:16px;")}>
          <Kpi cor={COR_VENCIDA} rotulo="Vencidas" valor={brl(kpi.soma(kpi.vencidas))} sub={`${kpi.vencidas.length} ${kpi.vencidas.length === 1 ? "conta" : "contas"} em atraso`} onClick={() => { limparTudo(); setSit("vencidas"); setAte(addDias(hoje, -1)); setAba("contas"); }} />
          <Kpi cor={COR_BREVE} rotulo="Vencem amanhã" valor={brl(kpi.soma(kpi.amanha))} sub={`${kpi.amanha.length} ${kpi.amanha.length === 1 ? "conta" : "contas"} em ${brDe(amanha).slice(0, 5)}`} onClick={() => { limparTudo(); setSit("apagar"); setDe(amanha); setAte(amanha); setAba("contas"); }} />
          <Kpi cor={COR_ABERTO} rotulo="Total em aberto" valor={brl(kpi.soma(kpi.abertas))} sub={`${kpi.abertas.length} contas a pagar`} />
          <Kpi cor={COR_PAGO} rotulo="Pago no mês atual" valor={brl(kpi.soma(kpi.pagasMes))} sub={`${kpi.pagasMes.length} pagamentos em ${MESES[Number(hoje.slice(5, 7)) - 1].toLowerCase()}`} />
        </div>

        {aba === "dashboard" ? <Dashboard contas={contas} hoje={hoje} anoAtual={anoAtual} onAbrir={(c) => podeEditar && setEditando(c)} /> : (<>
          {/* Filtros */}
          <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:14px 16px; margin-bottom:14px; display:flex; flex-direction:column; gap:12px;")}>
            <div className="m-wrap" style={css("display:flex; align-items:center; gap:10px; flex-wrap:wrap;")}>
              <label style={css("flex:1 1 260px; display:flex; align-items:center; gap:8px; border:1px solid #E2E3E9; border-radius:10px; padding:0 12px; background:#FAFAFB;")}>
                <Svg size={15} stroke="#9398A6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fornecedor, NF, código de barras…" style={css("flex:1; border:none; outline:none; background:transparent; font-size:13px; padding:10px 0; min-width:0;")} />
              </label>
              <Seg opts={[{ k: "todas", l: "Todas" }, { k: "apagar", l: "A pagar" }, { k: "vencidas", l: "Vencidas" }, { k: "pagas", l: "Pagas" }]} v={sit} set={(k) => setSit(k as FiltroSit)} />
            </div>
            <div className="m-wrap" style={css("display:flex; align-items:center; gap:10px; flex-wrap:wrap;")}>
              <Filtro rotulo="Plano" valor={plano || "Todos os planos"} ativo={!!plano}>
                {(c) => (<>
                  <MenuItem checked={!plano} accent={ACCENT} onClick={() => { setPlano(""); c(); }}><span style={{ flex: 1 }}>Todos os planos</span></MenuItem>
                  {PLANOS.map((p) => <MenuItem key={p} checked={plano === p} accent={ACCENT} onClick={() => { setPlano(p); c(); }}><span style={{ flex: 1 }}>{p}</span></MenuItem>)}
                </>)}
              </Filtro>
              <Filtro rotulo="Empresa" valor={empresas.length === 0 ? "Todas" : empresas.length === 1 ? empresas[0] : `${empresas.length} empresas`} ativo={empresas.length > 0} largura={260}>
                {() => (<>
                  <div style={css("display:flex; gap:6px; padding:4px 4px 6px; border-bottom:1px solid #F0F1F4; margin-bottom:4px;")}>
                    <button onClick={() => setEmpresas([...EMPRESAS])} style={css(`flex:1; border:1px solid #E2E3E9; background:#fff; border-radius:7px; padding:6px; font-size:12px; font-weight:700; color:${ACCENT}; cursor:pointer;`)}>Marcar todas</button>
                    <button onClick={() => setEmpresas([])} style={css("flex:1; border:1px solid #E2E3E9; background:#fff; border-radius:7px; padding:6px; font-size:12px; font-weight:700; color:#5B6472; cursor:pointer;")}>Limpar</button>
                  </div>
                  {EMPRESAS.map((e) => {
                    const on = empresas.includes(e);
                    return (
                      <Hoverable key={e} onClick={() => setEmpresas((l) => (on ? l.filter((x) => x !== e) : [...l, e]))} s={css("display:flex; align-items:center; gap:9px; padding:7px 9px; border-radius:7px; cursor:pointer; font-size:12.5px; font-weight:600; color:#3A3F4C;")} hover="background:#F4F4F7">
                        <span style={css(`width:16px; height:16px; border-radius:4px; border:1.5px solid ${on ? ACCENT : "#C9CCD5"}; background:${on ? ACCENT : "#fff"}; display:flex; align-items:center; justify-content:center; flex:none;`)}>
                          {on && <Svg size={11} sw={3} stroke="#fff"><path d="m5 12 5 5 9-10" /></Svg>}
                        </span>
                        <span style={{ flex: 1 }}>{e}</span>
                        <span style={css("font-size:11.5px; color:#9398A6; font-variant-numeric:tabular-nums;")}>{contagemEmpresa[e] ?? 0}</span>
                      </Hoverable>
                    );
                  })}
                </>)}
              </Filtro>
              <Filtro rotulo="Forma" valor={forma || "Todas as formas"} ativo={!!forma}>
                {(c) => (<>
                  <MenuItem checked={!forma} accent={ACCENT} onClick={() => { setForma(""); c(); }}><span style={{ flex: 1 }}>Todas as formas</span></MenuItem>
                  {FORMAS.map((f) => <MenuItem key={f} checked={forma === f} accent={ACCENT} onClick={() => { setForma(f); c(); }}><span style={{ flex: 1 }}>{f}</span></MenuItem>)}
                </>)}
              </Filtro>
              <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap;")}>
                <span style={css("font-size:12.5px; color:#9398A6; font-weight:700;")}>Vencimento</span>
                <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={css(campoData(!!de))} aria-label="Vencimento de" />
                <span style={css("font-size:12.5px; color:#9398A6;")}>até</span>
                <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={css(campoData(!!ate))} aria-label="Vencimento até" />
                <Hoverable as="button" onClick={() => { setDe(hoje); setAte(hoje); }} s={css("border:1px solid #E2E3E9; background:#fff; border-radius:9px; padding:7px 10px; font-size:12px; font-weight:700; color:#3A3F4C; cursor:pointer;")} hover="background:#FAFAFB">Hoje</Hoverable>
              </div>
            </div>
          </div>

          {/* Resumo do filtro */}
          <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:12px;")}>
            <Mini rotulo="Contas filtradas" valor={String(filtradas.length)} />
            <Mini rotulo="Valor total" valor={brl(tot.total)} destaque />
            <Mini rotulo="Pago" valor={brl(tot.pago)} cor={COR_PAGO} />
            <Mini rotulo="Em aberto" valor={brl(tot.aberto)} cor={COR_ABERTO} />
          </div>
          {chips.length > 0 && (
            <div style={css("display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin-bottom:12px;")}>
              {chips.map((ch) => (
                <span key={ch.label} style={css(`display:inline-flex; align-items:center; gap:6px; background:#FDF1F4; color:${ACCENT}; border:1px solid #F1D5DD; font-size:12px; font-weight:700; padding:4px 6px 4px 10px; border-radius:999px;`)}>
                  {ch.label}
                  <button onClick={ch.limpar} aria-label={`Remover ${ch.label}`} style={css(`border:none; background:transparent; color:${ACCENT}; cursor:pointer; display:flex; padding:2px;`)}><Svg size={11} sw={2.8}><path d="M6 6l12 12M18 6 6 18" /></Svg></button>
                </span>
              ))}
              <button onClick={limparTudo} style={css("border:none; background:transparent; color:#5B6472; cursor:pointer; font-size:12px; font-weight:700; text-decoration:underline;")}>Limpar filtros</button>
            </div>
          )}

          <div className="cp-grid" style={css("display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:14px; align-items:start;")}>
            {/* Tabela */}
            <section style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; min-width:0; overflow:hidden;")}>
              <div className="m-wrap" style={css("display:flex; align-items:baseline; gap:10px; padding:14px 16px 10px; flex-wrap:wrap;")}>
                <div style={css("flex:1; font-size:15px; font-weight:800; color:#1B1B28;")}>{porData ? rotuloPeriodo(de, ate) : nomeMes(mes)}</div>
                <div style={css("font-size:12.5px; color:#7A8090; font-weight:600;")}>{filtradas.length} contas · {brl(tot.total)} · <span style={{ color: COR_ABERTO }}>{brl(tot.aberto)} em aberto</span></div>
              </div>
              <div style={css("overflow-x:auto;")}>
                <div style={css("min-width:760px;")}>
                  <div style={css(`display:grid; grid-template-columns:${COLS}; gap:10px; padding:8px 16px; border-top:1px solid #F0F1F4; border-bottom:1px solid #F0F1F4; background:#FAFAFB; font-size:11px; font-weight:700; letter-spacing:.3px; text-transform:uppercase; color:#9398A6;`)}>
                    <button onClick={() => setOrdem((o) => (o === "asc" ? "desc" : "asc"))} style={css("border:none; background:transparent; padding:0; cursor:pointer; font:inherit; color:#5B6472; text-transform:inherit; letter-spacing:inherit; text-align:left; display:flex; align-items:center; gap:4px;")}>Vencimento {ordem === "asc" ? "↑" : "↓"}</button>
                    <span>Descrição</span><span style={{ textAlign: "right" }}>Valor</span><span>Empresa</span><span>Situação</span><span style={{ textAlign: "right" }}>Ações</span>
                  </div>
                  {filtradas.length === 0 ? (
                    <div style={css("padding:48px 16px; text-align:center; color:#9398A6; font-size:13.5px; font-weight:600;")}>{carregando ? "Carregando contas…" : contas.length === 0 ? (podeEditar ? "Nenhuma conta lançada ainda. Use “+ Nova conta” para começar." : "Nenhuma conta lançada ainda.") : "Nenhuma conta corresponde aos filtros."}</div>
                  ) : filtradas.map((c) => <Linha key={c.id} c={c} hoje={hoje} podeEditar={podeEditar} onEditar={() => setEditando(c)} onSituacao={(s) => { void atualizar(c.id, pagamentoPara(c, s, hoje)); }} onAnexar={async (f) => { try { const comp = await enviarComprovante(f, c.id); await atualizar(c.id, { comprovantes: [...c.comprovantes, comp] }, "Comprovante anexado."); } catch (e) { avisar((e as Error).message); } }} onCopiar={async () => { try { await navigator.clipboard.writeText(c.codigoBarras ?? ""); } catch { /* sem permissão: só avisa */ } avisar("Código de barras copiado."); }} />)}
                </div>
              </div>
            </section>

            {/* Por plano de contas */}
            <aside style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:14px 16px; min-width:0;")}>
              <div style={css("display:flex; align-items:baseline; gap:8px; margin-bottom:12px;")}>
                <div style={css("flex:1; font-size:14.5px; font-weight:800; color:#1B1B28;")}>Por plano de contas</div>
                <span style={css("font-size:12px; color:#9398A6; font-weight:600;")}>{tot.planos.length} planos</span>
              </div>
              {tot.planos.length === 0 && <div style={css("font-size:12.5px; color:#9398A6; padding:12px 0;")}>Sem contas no filtro.</div>}
              <div style={css("display:flex; flex-direction:column; gap:12px;")}>
                {tot.planos.map(([nome, p]) => (
                  <Hoverable key={nome} onClick={() => setPlano(plano === nome ? "" : nome)} s={css(`cursor:pointer; border-radius:9px; padding:6px; margin:-6px; background:${plano === nome ? "#FDF1F4" : "transparent"};`)} hover="background:#FAFAFB">
                    <div style={css("display:flex; align-items:baseline; gap:8px; font-size:12.5px;")}>
                      <span style={css("flex:1; font-weight:700; color:#3A3F4C; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{nome}</span>
                      <span style={css("font-weight:800; color:#1B1B28; font-variant-numeric:tabular-nums;")}>{brl(p.total)}</span>
                    </div>
                    <div style={css("display:flex; height:6px; border-radius:4px; overflow:hidden; background:#F0F1F4; margin:6px 0 4px; gap:2px;")}>
                      {p.pago > 0 && <span style={{ width: `${(p.pago / p.total) * 100}%`, background: COR_PAGO }} />}
                      {p.aberto > 0 && <span style={{ width: `${(p.aberto / p.total) * 100}%`, background: COR_ABERTO }} />}
                    </div>
                    <div style={css("font-size:11.5px; color:#9398A6; font-weight:600;")}>{p.n} {p.n === 1 ? "conta" : "contas"}{p.aberto > 0 ? ` · ${brl(p.aberto)} em aberto` : " · tudo pago"}</div>
                  </Hoverable>
                ))}
              </div>
              <Legenda />
            </aside>
          </div>
        </>)}
      </div>

      <style>{`@media (max-width: 1180px) { .cp-grid { grid-template-columns: minmax(0,1fr) !important; } }
            @media (max-width: 560px) { .cp-kpis { grid-template-columns: repeat(2, minmax(0,1fr)) !important; gap:8px !important; } .cp-kpis .cp-kpi-v { font-size:17px !important; } }`}</style>
      {editando && <ContaForm conta={editando === "nova" ? null : editando} hoje={hoje} empresas={EMPRESAS} planos={PLANOS} onNovoItem={novoItem} onFechar={() => setEditando(null)} onSalvar={salvar} onExcluir={setExcluindo} />}
      {excluindo && (
        <ConfirmModal danger titulo="Excluir conta" confirmLabel="Excluir" onClose={() => setExcluindo(null)} onConfirm={() => void excluir(excluindo)}
          mensagem={<>A conta <strong>{excluindo.descricao}</strong> ({brl(excluindo.valor)}, vencimento {brDe(excluindo.vencimento)}) será excluída.{excluindo.comprovantes.length ? " Os comprovantes anexados também serão apagados." : ""} Esta ação não pode ser desfeita.</>} />
      )}
      {aviso && <div style={css("position:fixed; left:50%; bottom:26px; transform:translateX(-50%); z-index:90; background:#1B1B28; color:#fff; font-size:13px; font-weight:700; padding:10px 16px; border-radius:10px; box-shadow:0 10px 30px rgba(20,24,40,.25);")}>{aviso}</div>}
    </div>
  );
}

/** "Vencimento em 24/10", "de 01/10 a 15/10", "até 23/10" ou "a partir de 01/11". */
const rotuloPeriodo = (de: string, ate: string) =>
  de && ate ? (de === ate ? `Vencimento em ${brDe(de)}` : `Vencimento de ${brDe(de)} a ${brDe(ate)}`) : ate ? `Vencimento até ${brDe(ate)}` : `Vencimento a partir de ${brDe(de)}`;

const COLS = "88px minmax(190px,1fr) 108px 112px 128px 104px";

/** Mudar a situação pela pílula: marcar como paga preenche valor e data de pagamento. */
function pagamentoPara(c: Conta, s: Situacao, hoje: string): Partial<Conta> {
  if (!ehPaga(s)) return { situacao: s, valorPago: undefined, dataPagamento: undefined };
  return { situacao: s, valorPago: c.valorPago ?? c.valor, dataPagamento: c.dataPagamento ?? hoje };
}

/** Envia um comprovante para o bucket (a conta é atualizada por quem chama). */
async function enviarComprovante(file: File, contaId: string): Promise<Comprovante> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Arquivo acima de 20 MB.");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("contaId", contaId);
  const tk = await authToken();
  const res = await fetch("/api/contas-pagar/comprovante", { method: "POST", body: fd, headers: tk ? { authorization: `Bearer ${tk}` } : {} });
  const j = (await res.json().catch(() => ({}))) as Comprovante & { error?: string };
  if (!res.ok) throw new Error(j.error || `Falha no envio (${res.status})`);
  return j;
}

const ICONE_CLIPE = <Svg size={14}><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></Svg>;

function Linha({ c, hoje, podeEditar, onEditar, onSituacao, onAnexar, onCopiar }: { c: Conta; hoje: string; podeEditar: boolean; onEditar: () => void; onSituacao: (s: Situacao) => void; onAnexar: (f: File) => Promise<void>; onCopiar: () => void }) {
  const st = statusDaConta(c, hoje);
  const arq = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const juros = ehPaga(c.situacao) && (c.valorPago ?? c.valor) > c.valor;
  const pill = { pago: ["#E6F4F8", "#0B6F89"], vencida: ["#FDECEC", "#CC3338"], hoje: ["#FFF1E8", "#C25712"], breve: ["#FFF1E8", "#C25712"], aberto: ["#F2F3F6", "#3A3F4C"] }[st.tipo];
  const pilula = (onClick?: () => void) => (
    <button onClick={onClick} disabled={!onClick} title={situacaoLabel(c.situacao)} style={css(`display:inline-flex; align-items:center; gap:5px; border:none; cursor:${onClick ? "pointer" : "default"}; background:${pill[0]}; color:${pill[1]}; font-size:12px; font-weight:800; padding:5px 9px; border-radius:999px; white-space:nowrap;`)}>
      {st.label}{onClick && <Svg size={10} sw={2.8}><path d="m6 9 6 6 6-6" /></Svg>}
    </button>
  );
  const clipe = (
    <span style={{ position: "relative", display: "flex" }}>
      {ICONE_CLIPE}
      {c.comprovantes.length === 0 && <span style={css(`position:absolute; top:-3px; right:-4px; width:7px; height:7px; border-radius:50%; background:${COR_VENCIDA}; border:1.5px solid #fff;`)} />}
    </span>
  );
  return (
    <div style={css(`display:grid; grid-template-columns:${COLS}; gap:10px; align-items:center; padding:10px 16px; border-bottom:1px solid #F4F5F7; border-left:3px solid ${st.tipo === "vencida" ? COR_VENCIDA : "transparent"}; font-size:13px;`)}>
      <span style={css(`font-weight:700; font-variant-numeric:tabular-nums; color:${st.tipo === "vencida" ? "#CC3338" : "#3A3F4C"};`)}>{brDe(c.vencimento)}</span>
      <div style={css("min-width:0;")}>
        <div style={css("font-weight:700; color:#1B1B28; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")} title={c.descricao}>{c.descricao}</div>
        <div style={css("font-size:11.5px; color:#9398A6; font-weight:600; margin-top:1px;")}>{c.plano} · {c.forma}</div>
      </div>
      <div style={css("text-align:right; font-variant-numeric:tabular-nums;")}>
        <div style={css("font-weight:800; color:#1B1B28;")}>{brl(c.valor)}</div>
        {juros && <div style={css("font-size:11px; color:#CC3338; font-weight:700;")} title="Valor pago com juros/multa">pago {brl(c.valorPago!)}</div>}
      </div>
      <span style={css("font-size:12.5px; font-weight:700; color:#5B6472; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{c.empresa}</span>
      {podeEditar ? (
        <Menu width={190} trigger={(t) => pilula(t)}>
          {(close) => SITUACOES.map((s) => <MenuItem key={s.key} checked={c.situacao === s.key} accent={ACCENT} onClick={() => { onSituacao(s.key); close(); }}><span style={{ flex: 1 }}>{s.label}</span></MenuItem>)}
        </Menu>
      ) : <div>{pilula()}</div>}
      <div style={css("display:flex; align-items:center; justify-content:flex-end; gap:4px;")}>
        <input ref={arq} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setEnviando(true); try { await onAnexar(f); } finally { setEnviando(false); } }} />
        {enviando ? (
          <span style={css("font-size:11.5px; color:#9398A6; font-weight:700; padding:0 6px;")}>Enviando…</span>
        ) : c.comprovantes.length === 0 ? (
          podeEditar ? <Acao titulo="Sem comprovante — anexar" onClick={() => arq.current?.click()}>{clipe}</Acao> : <span title="Sem comprovante" style={css("display:flex; color:#C9CCD5; padding:6px 7px;")}>{clipe}</span>
        ) : (
          <Menu width={240} align="right" trigger={(t) => <Acao titulo={`${c.comprovantes.length} comprovante(s)`} onClick={t}>{clipe}<span style={css("font-size:11px;")}>{c.comprovantes.length}</span></Acao>}>
            {(close) => (<>
              {c.comprovantes.map((cp) => (
                <a key={cp.path} href={urlComprovante(cp)} target="_blank" rel="noreferrer" onClick={close} style={css("display:flex; align-items:center; gap:8px; padding:8px 9px; border-radius:7px; font-size:12.5px; font-weight:600; color:#3A3F4C; text-decoration:none;")}>
                  <Svg size={13} stroke="#9398A6"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></Svg>
                  <span style={css("flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{cp.nome}</span>
                </a>
              ))}
              {podeEditar && <MenuItem onClick={() => { close(); arq.current?.click(); }}><span style={css(`flex:1; color:${ACCENT}; font-weight:700;`)}>+ Anexar outro</span></MenuItem>}
            </>)}
          </Menu>
        )}
        {c.codigoBarras && <Acao titulo={`Copiar código de barras: ${c.codigoBarras}`} onClick={onCopiar}><Svg size={14}><path d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12" /></Svg></Acao>}
        {podeEditar && <Acao titulo="Editar conta" onClick={onEditar}><Svg size={14}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg></Acao>}
      </div>
    </div>
  );
}

// ── Dashboard ──
function Dashboard({ contas, hoje, anoAtual, onAbrir }: { contas: Conta[]; hoje: string; anoAtual: number; onAbrir: (c: Conta) => void }) {
  const [ano, setAno] = useState(anoAtual);
  const anos = useMemo(() => [...new Set([anoAtual, ...contas.map((c) => Number(c.vencimento.slice(0, 4)))])].sort((a, b) => a - b).slice(-4), [contas, anoAtual]);
  const d = useMemo(() => {
    const doAno = contas.filter((c) => c.vencimento.startsWith(String(ano)));
    const pagas = doAno.filter((c) => ehPaga(c.situacao));
    const abertas = doAno.filter((c) => !ehPaga(c.situacao));
    const total = doAno.reduce((s, c) => s + c.valor, 0);
    const pago = pagas.reduce((s, c) => s + valorEfetivo(c), 0);
    const aberto = abertas.reduce((s, c) => s + c.valor, 0);
    const vencido = abertas.filter((c) => c.vencimento < hoje).reduce((s, c) => s + c.valor, 0);
    const juros = pagas.reduce((s, c) => s + Math.max(0, (c.valorPago ?? c.valor) - c.valor), 0);
    const meses = MESES_CURTOS.map((m, i) => {
      const l = doAno.filter((c) => Number(c.vencimento.slice(5, 7)) === i + 1);
      return { mes: m, Pago: arred(l.filter((c) => ehPaga(c.situacao)).reduce((s, c) => s + c.valor, 0)), "Em aberto": arred(l.filter((c) => !ehPaga(c.situacao)).reduce((s, c) => s + c.valor, 0)) };
    });
    const agrupar = (chave: (c: Conta) => string, top: number) => {
      const m = new Map<string, { Pago: number; "Em aberto": number }>();
      for (const c of doAno) { const g = m.get(chave(c)) ?? { Pago: 0, "Em aberto": 0 }; if (ehPaga(c.situacao)) g.Pago += c.valor; else g["Em aberto"] += c.valor; m.set(chave(c), g); }
      const l = [...m.entries()].map(([nome, v]) => ({ nome, ...v, total: v.Pago + v["Em aberto"] })).sort((a, b) => b.total - a.total);
      if (l.length <= top) return l;
      const resto = l.slice(top);
      return [...l.slice(0, top), { nome: `Outros (${resto.length})`, Pago: resto.reduce((s, x) => s + x.Pago, 0), "Em aberto": resto.reduce((s, x) => s + x["Em aberto"], 0), total: resto.reduce((s, x) => s + x.total, 0) }];
    };
    const vencidas = contas.filter((c) => !ehPaga(c.situacao) && c.vencimento < hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 8);
    const proximas = contas.filter((c) => !ehPaga(c.situacao) && c.vencimento >= hoje && c.vencimento <= addDias(hoje, 30)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    return { total, pago, aberto, vencido, juros, meses, planos: agrupar((c) => c.plano, 7), empresas: agrupar((c) => c.empresa, 7), vencidas, proximas, n: doAno.length };
  }, [contas, ano, hoje]);

  return (<>
    <div style={css("display:flex; align-items:center; gap:10px; margin-bottom:12px;")}>
      <div style={css("flex:1; font-size:16px; font-weight:800; color:#1B1B28;")}>Visão de {ano}</div>
      <Seg opts={anos.map((a) => ({ k: String(a), l: String(a) }))} v={String(ano)} set={(k) => setAno(Number(k))} />
    </div>
    <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; margin-bottom:14px;")}>
      <Mini rotulo="Total lançado" valor={brl(d.total)} sub={`${d.n} contas no ano`} destaque />
      <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:12px 14px;")}>
        <Rot cor={COR_PAGO}>Pago</Rot>
        <div style={css("font-size:20px; font-weight:800; color:#1B1B28; margin-top:3px; font-variant-numeric:tabular-nums;")}>{brl(d.pago)}</div>
        <div style={css("height:5px; border-radius:3px; background:#F0F1F4; overflow:hidden; margin:7px 0 4px;")}><div style={{ width: `${d.total ? Math.min(100, (d.pago / d.total) * 100) : 0}%`, height: "100%", background: COR_PAGO }} /></div>
        <div style={css("font-size:11.5px; color:#7A8090; font-weight:600;")}>{d.total ? Math.round((d.pago / d.total) * 100) : 0}% do total</div>
      </div>
      <Mini rotulo="Em aberto" valor={brl(d.aberto)} cor={COR_ABERTO} />
      <Mini rotulo="Vencido" valor={brl(d.vencido)} cor={COR_VENCIDA} vermelho />
      <Mini rotulo="Juros e multas pagos" valor={brl(d.juros)} sub="valor pago acima do original" />
    </div>

    <Bloco titulo="Despesas por mês" sub={`Valor original por mês de vencimento · ${ano}`}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={d.meses} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: EIXO }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: EIXO }} tickFormatter={milhar} width={56} />
          <Tooltip content={<Tip />} cursor={{ fill: "rgba(20,24,40,.04)" }} />
          <Bar dataKey="Pago" stackId="a" fill={COR_PAGO} maxBarSize={38} />
          <Bar dataKey="Em aberto" stackId="a" fill={COR_ABERTO} radius={[4, 4, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
      <Legenda />
    </Bloco>

    <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:14px; margin-top:14px;")}>
      <Bloco titulo="Maiores planos de contas"><BarrasH dados={d.planos} /></Bloco>
      <Bloco titulo="Por empresa"><BarrasH dados={d.empresas} /></Bloco>
      <Bloco titulo="Vencidas há mais tempo" sub={d.vencidas.length ? undefined : "Nada em atraso 🎉"}>
        <ListaCurta contas={d.vencidas} onAbrir={onAbrir} direita={(c) => <span style={css("color:#CC3338; font-weight:800;")}>{diasEntre(c.vencimento, hoje)}d</span>} />
      </Bloco>
      <Bloco titulo="Próximos 30 dias" sub={`${d.proximas.length} contas · ${brl(d.proximas.reduce((s, c) => s + c.valor, 0))}`}>
        <ListaCurta contas={d.proximas.slice(0, 8)} onAbrir={onAbrir} direita={(c) => <span style={css("color:#5B6472; font-weight:700;")}>{brDe(c.vencimento).slice(0, 5)}</span>} />
      </Bloco>
    </div>
  </>);
}

function BarrasH({ dados }: { dados: { nome: string; Pago: number; "Em aberto": number; total: number }[] }) {
  const max = Math.max(1, ...dados.map((x) => x.total));
  return (
    <div style={css("display:flex; flex-direction:column; gap:10px;")}>
      {dados.map((x) => (
        <div key={x.nome} title={`${x.nome}: ${brl(x.Pago)} pago · ${brl(x["Em aberto"])} em aberto`}>
          <div style={css("display:flex; gap:8px; font-size:12.5px; margin-bottom:4px;")}>
            <span style={css("flex:1; font-weight:700; color:#3A3F4C;")}>{x.nome}</span>
            <span style={css("font-weight:800; color:#1B1B28; font-variant-numeric:tabular-nums;")}>{brl(x.total)}</span>
          </div>
          <div style={css("display:flex; height:8px; gap:2px;")}>
            <span style={{ width: `${(x.Pago / max) * 100}%`, background: COR_PAGO, borderRadius: 3 }} />
            {x["Em aberto"] > 0 && <span style={{ width: `${(x["Em aberto"] / max) * 100}%`, background: COR_ABERTO, borderRadius: 3 }} />}
          </div>
        </div>
      ))}
      <Legenda />
    </div>
  );
}

function ListaCurta({ contas, onAbrir, direita }: { contas: Conta[]; onAbrir: (c: Conta) => void; direita: (c: Conta) => ReactNode }) {
  return (
    <div style={css("display:flex; flex-direction:column;")}>
      {contas.map((c) => (
        <Hoverable key={c.id} onClick={() => onAbrir(c)} s={css("display:flex; align-items:center; gap:10px; padding:8px 6px; border-bottom:1px solid #F4F5F7; cursor:pointer; font-size:12.5px; border-radius:6px;")} hover="background:#FAFAFB">
          <div style={css("flex:1; min-width:0;")}>
            <div style={css("font-weight:700; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{c.descricao}</div>
            <div style={css("font-size:11.5px; color:#9398A6; font-weight:600;")}>{c.empresa} · {brDe(c.vencimento)}</div>
          </div>
          <span style={css("font-weight:800; font-variant-numeric:tabular-nums; color:#1B1B28;")}>{brl(c.valor)}</span>
          <span style={css("width:44px; text-align:right; font-size:12px;")}>{direita(c)}</span>
        </Hoverable>
      ))}
    </div>
  );
}

// ── Formulário (nova / editar) ──
const pareceCodigo = (t: string) => t.replace(/[\s.]/g, "").length >= 40 && /^[\d\s.]+$/.test(t);

function ContaForm({ conta, hoje, empresas, planos, onNovoItem, onFechar, onSalvar, onExcluir }: {
  conta: Conta | null; hoje: string; empresas: string[]; planos: string[];
  onNovoItem: (tipo: "empresa" | "plano", nome: string) => Promise<string | null>;
  onFechar: () => void; onSalvar: (l: Conta[], id?: string) => Promise<string | null>; onExcluir: (c: Conta) => void;
}) {
  const [f, setF] = useState({
    descricao: conta?.descricao ?? "", vencimento: conta?.vencimento ?? hoje, valor: conta ? conta.valor.toFixed(2).replace(".", ",") : "",
    plano: conta?.plano ?? planos[0] ?? "", empresa: conta?.empresa ?? empresas[0] ?? "", forma: (conta?.forma ?? "Boleto") as FormaPagamento, parcelas: "1",
    situacao: (conta?.situacao ?? "a pagar") as Situacao, valorPago: conta?.valorPago != null ? conta.valorPago.toFixed(2).replace(".", ",") : "",
    dataPagamento: conta?.dataPagamento ?? "", obs: conta?.codigoBarras ?? conta?.obs ?? "", comprovantes: conta?.comprovantes ?? ([] as Comprovante[]),
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(0);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const arq = useRef<HTMLInputElement>(null);
  // Id base da conta nova (a pasta dos comprovantes é criada antes de salvar).
  const baseId = useRef(conta?.id ?? `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  // Arquivos enviados nesta abertura e ainda não salvos: apagados se cancelar.
  const novos = useRef<string[]>([]);
  const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

  const descartarNovos = (paths: string[]) => { for (const path of paths) void apiJson("/api/contas-pagar/comprovante", "DELETE", { path }).catch(() => {}); };
  const fechar = () => { if (novos.current.length) descartarNovos(novos.current); onFechar(); };

  const anexar = async (files: File[]) => {
    setErro("");
    for (const file of files) {
      setEnviando((n) => n + 1);
      try {
        const cp = await enviarComprovante(file, baseId.current);
        novos.current.push(cp.path);
        setF((x) => ({ ...x, comprovantes: [...x.comprovantes, cp] }));
      } catch (e) { setErro((e as Error).message); }
      finally { setEnviando((n) => n - 1); }
    }
  };
  const remover = (cp: Comprovante) => {
    set({ comprovantes: f.comprovantes.filter((x) => x.path !== cp.path) });
    if (novos.current.includes(cp.path)) { novos.current = novos.current.filter((p) => p !== cp.path); descartarNovos([cp.path]); }
  };
  const criar = async (tipo: "empresa" | "plano", nome: string) => {
    const ok = await onNovoItem(tipo, nome);
    if (ok) set(tipo === "empresa" ? { empresa: ok } : { plano: ok });
    return !!ok;
  };
  useFecharComEsc(true, fechar);

  const salvar = async () => {
    const valor = num(f.valor);
    if (!f.descricao.trim()) return setErro("Informe a descrição.");
    if (!f.vencimento) return setErro("Informe o vencimento.");
    if (!(valor > 0)) return setErro("Informe o valor original.");
    if (!f.plano) return setErro("Escolha o plano de contas.");
    if (!f.empresa) return setErro("Escolha a empresa.");
    if (enviando) return setErro("Aguarde o envio dos comprovantes.");
    const pago = ehPaga(f.situacao);
    const texto = f.obs.trim();
    const base = {
      plano: f.plano, empresa: f.empresa, forma: f.forma, valor, situacao: f.situacao, comprovantes: f.comprovantes,
      valorPago: pago ? (num(f.valorPago) > 0 ? num(f.valorPago) : valor) : undefined,
      dataPagamento: pago ? f.dataPagamento || hoje : undefined,
      codigoBarras: texto && pareceCodigo(texto) ? texto : undefined,
      obs: texto && !pareceCodigo(texto) ? texto : undefined,
    };
    let lista: Conta[];
    if (conta) lista = [{ ...conta, ...base, descricao: f.descricao.trim(), vencimento: f.vencimento }];
    else {
      const n = Math.max(1, Math.min(60, Math.floor(Number(f.parcelas) || 1)));
      lista = Array.from({ length: n }, (_, i) => {
        const d = new Date(f.vencimento + "T12:00:00"); d.setMonth(d.getMonth() + i);
        const venc = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return {
          ...base, id: n > 1 ? `${baseId.current}-${i + 1}` : baseId.current, vencimento: venc,
          descricao: n > 1 ? `${f.descricao.trim()} (PARCELA ${i + 1}/${n})` : f.descricao.trim(),
          ...(n > 1 ? { grupo: baseId.current, parcela: i + 1, parcelas: n } : {}),
          // Só a 1ª parcela herda pagamento e comprovantes.
          ...(i > 0 ? { situacao: (f.forma === "PIX" ? "qr code / pix" : "a pagar") as Situacao, valorPago: undefined, dataPagamento: undefined, comprovantes: [] } : {}),
        };
      });
    }
    setSalvando(true); setErro("");
    const e = await onSalvar(lista, conta?.id);
    setSalvando(false);
    if (e) setErro(e); else novos.current = [];
  };

  return (
    <>
      <div onClick={fechar} style={css("position:fixed; inset:0; z-index:64; background:rgba(20,24,40,.32);")} />
      <div role="dialog" aria-label={conta ? "Editar conta" : "Nova conta"} style={css("position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:65; background:#fff; border-radius:16px; box-shadow:0 24px 60px rgba(20,24,40,.25); width:640px; max-width:calc(100vw - 24px); max-height:calc(100vh - 24px); display:flex; flex-direction:column; overflow:hidden;")}>
        <div style={css("display:flex; align-items:flex-start; gap:10px; padding:18px 20px 12px; border-bottom:1px solid #F0F1F4;")}>
          <div style={{ flex: 1 }}>
            <div style={css("font-size:17px; font-weight:800; color:#1B1B28;")}>{conta ? "Editar conta" : "Nova conta"}</div>
            <div style={css("font-size:12.5px; color:#9398A6; font-weight:600; margin-top:2px;")}>{conta ? (conta.parcelas ? `Parcela ${conta.parcela}/${conta.parcelas} · altere os dados e salve.` : "Altere os dados e salve.") : "Lance uma conta única ou parcelada."}</div>
          </div>
          <IconBtn titulo="Fechar" onClick={fechar}><path d="M6 6l12 12M18 6 6 18" /></IconBtn>
        </div>
        <div style={css("padding:16px 20px; overflow-y:auto; display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px 14px;")}>
          <Campo rotulo="Descrição" span><input autoFocus value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Ex.: CELESC - FÁBRICA 09/2026" style={css(INPUT)} /></Campo>
          <Campo rotulo="Vencimento"><input type="date" value={f.vencimento} onChange={(e) => set({ vencimento: e.target.value })} style={css(INPUT)} /></Campo>
          <Campo rotulo="Valor original (R$)"><input inputMode="decimal" value={f.valor} onChange={(e) => set({ valor: e.target.value })} placeholder="0,00" style={css(INPUT)} /></Campo>
          <Campo rotulo="Plano de contas"><Escolha v={f.plano} opts={[...new Set([...planos, ...(f.plano ? [f.plano] : [])])]} placeholder="Escolha o plano" set={(v) => set({ plano: v })} novo={{ rotulo: "Novo plano de contas", exemplo: "Ex.: DESP MARKETING", criar: (n) => criar("plano", n) }} /></Campo>
          <Campo rotulo="Empresa"><Escolha v={f.empresa} opts={[...new Set([...empresas, ...(f.empresa ? [f.empresa] : [])])]} placeholder="Escolha a empresa" set={(v) => set({ empresa: v })} novo={{ rotulo: "Nova empresa", exemplo: "Ex.: JB INGLESES", criar: (n) => criar("empresa", n) }} /></Campo>
          <Campo rotulo="Forma"><Escolha v={f.forma} opts={FORMAS} set={(v) => set({ forma: v as FormaPagamento })} /></Campo>
          {!conta ? <Campo rotulo="Parcelas (mensais)"><input type="number" min={1} max={60} value={f.parcelas} onChange={(e) => set({ parcelas: e.target.value })} style={css(INPUT)} /></Campo> : <span />}
          <Campo rotulo="Situação" span>
            <div style={css("display:flex; flex-wrap:wrap; gap:6px;")}>
              {SITUACOES.map((s) => {
                const on = f.situacao === s.key;
                return <button key={s.key} onClick={() => set({ situacao: s.key, ...(ehPaga(s.key) && !f.dataPagamento ? { dataPagamento: hoje } : {}) })} style={css(`border:1px solid ${on ? ACCENT : "#E2E3E9"}; background:${on ? "#FDF1F4" : "#fff"}; color:${on ? ACCENT : "#3A3F4C"}; cursor:pointer; font-size:12.5px; font-weight:700; padding:7px 11px; border-radius:999px;`)}>{s.label}</button>;
              })}
            </div>
          </Campo>
          {ehPaga(f.situacao) && (<>
            <Campo rotulo="Valor pago (com juros)"><input inputMode="decimal" value={f.valorPago} onChange={(e) => set({ valorPago: e.target.value })} placeholder={f.valor || "0,00"} style={css(INPUT)} /></Campo>
            <Campo rotulo="Data de pagamento"><input type="date" value={f.dataPagamento} onChange={(e) => set({ dataPagamento: e.target.value })} style={css(INPUT)} /></Campo>
          </>)}
          <Campo rotulo="Observação / código de barras" span><textarea value={f.obs} onChange={(e) => set({ obs: e.target.value })} rows={2} placeholder="Linha digitável do boleto, chave PIX ou observação" style={css(INPUT + "resize:vertical; font-family:inherit;")} /></Campo>
          <Campo rotulo="Comprovantes" span>
            <input ref={arq} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void anexar(fs); }} />
            <button onClick={() => arq.current?.click()} disabled={enviando > 0} style={css(`width:100%; border:1.5px dashed #D5D8E0; background:#FAFAFB; border-radius:10px; padding:14px; cursor:${enviando ? "wait" : "pointer"}; font-size:12.5px; font-weight:700; color:#5B6472;`)}>
              {enviando ? "Enviando…" : <>Anexar comprovante <span style={css("color:#9398A6; font-weight:600;")}>· PDF, JPG ou PNG até 20 MB</span></>}
            </button>
            {f.comprovantes.length > 0 && (
              <div style={css("display:flex; flex-direction:column; gap:4px; margin-top:8px;")}>
                {f.comprovantes.map((cp) => (
                  <div key={cp.path} style={css("display:flex; align-items:center; gap:8px; font-size:12.5px; color:#3A3F4C; background:#F6F7F9; border-radius:8px; padding:6px 10px;")}>
                    <Svg size={13} stroke="#9398A6"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></Svg>
                    <a href={urlComprovante(cp)} target="_blank" rel="noreferrer" style={css("flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#3A3F4C; text-decoration:none;")}>{cp.nome}</a>
                    <button onClick={() => remover(cp)} aria-label="Remover" title="Remover" style={css("border:none; background:transparent; cursor:pointer; color:#9398A6; display:flex;")}><Svg size={12} sw={2.6}><path d="M6 6l12 12M18 6 6 18" /></Svg></button>
                  </div>
                ))}
              </div>
            )}
          </Campo>
        </div>
        <div style={css("display:flex; align-items:center; gap:8px; padding:12px 20px; border-top:1px solid #F0F1F4;")}>
          {conta && <Hoverable as="button" onClick={() => onExcluir(conta)} s={css("border:none; background:transparent; color:#CC3338; cursor:pointer; font-size:13px; font-weight:700; padding:9px 10px; border-radius:9px;")} hover="background:#FDECEC">Excluir</Hoverable>}
          <span style={css("flex:1; font-size:12.5px; color:#CC3338; font-weight:700;")}>{erro}</span>
          <Hoverable as="button" onClick={fechar} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:9px 14px; border-radius:10px;")} hover="background:#FAFAFB">Cancelar</Hoverable>
          <Hoverable as="button" onClick={salvar} disabled={salvando} s={css(`border:none; background:${ACCENT}; color:#fff; cursor:${salvando ? "wait" : "pointer"}; opacity:${salvando ? 0.7 : 1}; font-size:13px; font-weight:700; padding:9px 16px; border-radius:10px;`)} hover="filter:brightness(1.08)">{salvando ? "Salvando…" : "Salvar"}</Hoverable>
        </div>
      </div>
    </>
  );
}

// ── peças ──
const INPUT = "width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; padding:9px 11px; font-size:13px; color:#1B1B28; background:#fff; outline:none;";
const campoData = (on: boolean) => `border:1px solid ${on ? ACCENT : "#E2E3E9"}; border-radius:9px; padding:6px 8px; font-size:12.5px; color:#1B1B28; background:${on ? "#FDF1F4" : "#fff"}; font-family:inherit;`;
const arred = (n: number) => Math.round(n * 100) / 100;
const milhar = (n: number) => (n >= 1000 ? `${Math.round(n / 1000).toLocaleString("pt-BR")} mil` : String(n));

function Campo({ rotulo, span, children }: { rotulo: string; span?: boolean; children: ReactNode }) {
  return (
    <div style={css(`display:flex; flex-direction:column; gap:5px; min-width:0; ${span ? "grid-column:1 / -1;" : ""}`)}>
      <span style={css("font-size:11.5px; font-weight:700; color:#5B6472; letter-spacing:.2px;")}>{rotulo}</span>
      {children}
    </div>
  );
}

/** Seletor no visual do app (no lugar do <select> nativo): busca quando a lista é longa,
 *  opção marcada e, opcionalmente, cadastro de um item novo dentro do próprio menu. */
function Escolha({ v, opts, set, placeholder = "Selecione", novo }: {
  v: string; opts: readonly string[]; set: (v: string) => void; placeholder?: string;
  novo?: { rotulo: string; exemplo: string; criar: (nome: string) => Promise<boolean> };
}) {
  const [q, setQ] = useState("");
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const comBusca = opts.length > 7;
  const lista = q.trim() ? opts.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase())) : opts;
  const reset = () => { setQ(""); setCriando(false); setNome(""); };
  return (
    <Menu width={260} popStyle="padding:0;" trigger={(toggle, open) => (
      <button type="button" onClick={() => { reset(); toggle(); }} style={css(`${INPUT} display:flex; align-items:center; gap:8px; cursor:pointer; text-align:left; ${open ? `border-color:${ACCENT}; box-shadow:0 0 0 3px rgba(149,92,107,.12);` : ""}`)}>
        <span style={css(`flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${v ? "" : "color:#9398A6;"}`)}>{v || placeholder}</span>
        <Svg size={13} sw={2.4} stroke="#9398A6" style={{ flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}><path d="m6 9 6 6 6-6" /></Svg>
      </button>
    )}>
      {(close) => (
        <div>
          {comBusca && (
            <div style={css("position:sticky; top:0; background:#fff; padding:8px 8px 6px; border-bottom:1px solid #F0F1F4; z-index:1;")}>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
                onKeyDown={(e) => { if (e.key === "Enter" && lista.length === 1) { set(lista[0]); close(); } }}
                style={css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:8px; padding:7px 10px; font-size:12.5px; outline:none; background:#FAFAFB;")} />
            </div>
          )}
          <div style={css("padding:5px;")}>
            {lista.length === 0 && <div style={css("padding:10px; font-size:12.5px; color:#9398A6; font-weight:600;")}>Nada encontrado.</div>}
            {lista.map((o) => <MenuItem key={o} checked={o === v} accent={ACCENT} onClick={() => { set(o); close(); }}><span style={{ flex: 1 }}>{o}</span></MenuItem>)}
          </div>
          {novo && (
            <div style={css("position:sticky; bottom:0; background:#fff; border-top:1px solid #F0F1F4; padding:6px;")}>
              {criando ? (
                <form onSubmit={async (e) => { e.preventDefault(); if (!nome.trim() || salvando) return; setSalvando(true); const ok = await novo.criar(nome.trim()); setSalvando(false); if (ok) close(); }} style={css("display:flex; gap:6px; padding:2px;")}>
                  <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder={novo.exemplo} style={css("flex:1; min-width:0; border:1px solid #E2E3E9; border-radius:8px; padding:7px 9px; font-size:12.5px; outline:none; text-transform:uppercase;")} />
                  <button type="submit" disabled={!nome.trim() || salvando} style={css(`border:none; background:${ACCENT}; color:#fff; border-radius:8px; padding:0 11px; font-size:12px; font-weight:700; cursor:pointer; opacity:${!nome.trim() || salvando ? 0.5 : 1};`)}>{salvando ? "…" : "Adicionar"}</button>
                </form>
              ) : (
                <Hoverable as="button" type="button" onClick={() => { setCriando(true); setNome(q.trim().toUpperCase()); }} s={css(`width:100%; display:flex; align-items:center; gap:8px; border:none; background:transparent; color:${ACCENT}; cursor:pointer; font-size:12.5px; font-weight:700; padding:8px 9px; border-radius:7px;`)} hover="background:#FDF1F4">
                  <Svg size={13} sw={2.6}><path d="M12 5v14M5 12h14" /></Svg>{novo.rotulo}
                </Hoverable>
              )}
            </div>
          )}
        </div>
      )}
    </Menu>
  );
}

function Kpi({ cor, rotulo, valor, sub, onClick }: { cor: string; rotulo: string; valor: string; sub: string; onClick?: () => void }) {
  return (
    <Hoverable as={onClick ? "button" : "div"} onClick={onClick} title={onClick ? "Ver na lista" : undefined} s={css(`text-align:left; font:inherit; background:#fff; border:1px solid #ECEDF1; border-top:3px solid ${cor}; border-radius:14px; padding:13px 16px; min-width:0; ${onClick ? "cursor:pointer;" : ""}`)} hover={onClick ? "box-shadow:0 6px 18px rgba(20,24,40,.08)" : undefined}>
      <Rot cor={cor}>{rotulo}</Rot>
      <div className="cp-kpi-v" style={css("font-size:22px; font-weight:800; letter-spacing:-0.4px; color:#1B1B28; margin-top:4px; font-variant-numeric:tabular-nums; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{valor}</div>
      <div style={css("font-size:12px; font-weight:600; color:#7A8090; margin-top:2px;")}>{sub}</div>
    </Hoverable>
  );
}

function Mini({ rotulo, valor, sub, cor, destaque, vermelho }: { rotulo: string; valor: string; sub?: string; cor?: string; destaque?: boolean; vermelho?: boolean }) {
  return (
    <div style={css(`background:${destaque ? "#1B1B28" : "#fff"}; border:1px solid ${destaque ? "#1B1B28" : "#ECEDF1"}; border-radius:14px; padding:12px 14px; min-width:0;`)}>
      <Rot cor={cor} claro={destaque}>{rotulo}</Rot>
      <div style={css(`font-size:20px; font-weight:800; letter-spacing:-0.3px; margin-top:3px; font-variant-numeric:tabular-nums; color:${destaque ? "#fff" : vermelho ? "#CC3338" : "#1B1B28"};`)}>{valor}</div>
      {sub && <div style={css(`font-size:11.5px; font-weight:600; margin-top:2px; color:${destaque ? "rgba(255,255,255,.6)" : "#7A8090"};`)}>{sub}</div>}
    </div>
  );
}

const Rot = ({ cor, claro, children }: { cor?: string; claro?: boolean; children: ReactNode }) => (
  <div style={css(`font-size:11px; font-weight:700; letter-spacing:.3px; text-transform:uppercase; color:${claro ? "rgba(255,255,255,.65)" : "#9398A6"}; display:flex; align-items:center; gap:6px;`)}>
    {cor && <span style={css(`width:8px; height:8px; border-radius:50%; background:${cor};`)} />}{children}
  </div>
);

function Bloco({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:16px 18px 14px; min-width:0;")}>
      <div style={css("font-size:14.5px; font-weight:800; color:#1B1B28;")}>{titulo}</div>
      {sub && <div style={css("font-size:12px; color:#9398A6; font-weight:600; margin-top:2px;")}>{sub}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

const Legenda = () => (
  <div style={css("display:flex; gap:14px; margin-top:12px; font-size:11.5px; color:#7A8090; font-weight:700;")}>
    <span style={css("display:flex; align-items:center; gap:6px;")}><span style={css(`width:10px; height:10px; border-radius:3px; background:${COR_PAGO};`)} />Pago</span>
    <span style={css("display:flex; align-items:center; gap:6px;")}><span style={css(`width:10px; height:10px; border-radius:3px; background:${COR_ABERTO};`)} />Em aberto</span>
  </div>
);

function Seg({ opts, v, set, grande }: { opts: { k: string; l: string }[]; v: string; set: (k: string) => void; grande?: boolean }) {
  return (
    <div style={css("display:flex; gap:2px; background:#EDEEF2; border-radius:9px; padding:3px; flex:none;")}>
      {opts.map((o) => <button key={o.k} onClick={() => set(o.k)} style={css(`border:none; cursor:pointer; font-size:${grande ? 13 : 12}px; font-weight:700; padding:${grande ? "7px 14px" : "6px 11px"}; border-radius:7px; background:${v === o.k ? "#fff" : "transparent"}; color:${v === o.k ? "#1B1B28" : "#5B6472"}; box-shadow:${v === o.k ? "0 1px 2px rgba(16,24,40,.10)" : "none"};`)}>{o.l}</button>)}
    </div>
  );
}

function Filtro({ rotulo, valor, ativo, largura = 220, children }: { rotulo: string; valor: string; ativo: boolean; largura?: number; children: (close: () => void) => ReactNode }) {
  return (
    <Menu width={largura} trigger={(toggle) => (
      <Hoverable as="button" onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:7px; background:${ativo ? "#FDF1F4" : "#fff"}; border:1px solid ${ativo ? ACCENT : "#E2E3E9"}; color:${ativo ? ACCENT : "#3A3F4C"}; cursor:pointer; font-size:13px; font-weight:700; padding:8px 12px; border-radius:10px; max-width:260px;`)} hover={ativo ? undefined : "background:#FAFAFB"}>
        <span style={css("color:#9398A6; font-weight:600;")}>{rotulo}</span>
        <span style={css("overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{valor}</span>
        <Svg size={12} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
      </Hoverable>
    )}>{children}</Menu>
  );
}

function IconBtn({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <Hoverable as="button" onClick={onClick} title={titulo} aria-label={titulo} s={css("border:none; background:transparent; cursor:pointer; color:#5B6472; display:flex; padding:6px; border-radius:7px;")} hover="background:#F2F3F6">
      <Svg size={15} sw={2.4}>{children}</Svg>
    </Hoverable>
  );
}

function Acao({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <Hoverable as="button" onClick={onClick} title={titulo} s={css("display:inline-flex; align-items:center; gap:5px; border:1px solid #ECEDF1; background:#fff; cursor:pointer; color:#5B6472; font-size:11.5px; font-weight:700; padding:6px 7px; border-radius:7px; white-space:nowrap;")} aria-label={titulo} hover="background:#FAFAFB; border-color:#D5D8E0">
      {children}
    </Hoverable>
  );
}

function Tip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + Number(p.value ?? 0), 0);
  return (
    <div style={css("background:#1B1B28; color:#fff; border-radius:10px; padding:9px 12px; box-shadow:0 10px 30px rgba(20,24,40,.25); font-size:12.5px; min-width:160px;")}>
      <div style={css("font-weight:700; margin-bottom:5px; color:rgba(255,255,255,.75);")}>{label} · {brl(total)}</div>
      {payload.map((p, i) => (
        <div key={i} style={css("display:flex; align-items:center; gap:8px; padding:2px 0;")}>
          <span style={css(`width:10px; height:10px; border-radius:3px; background:${p.color ?? "#fff"};`)} />
          <strong>{brl(Number(p.value ?? 0))}</strong><span style={css("color:rgba(255,255,255,.7);")}>{p.name}</span>
        </div>
      ))}
    </div>
  );
}
