"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { PEDIDO_STATUS, pedidoStatusInfo, produtosNoPedido } from "@/lib/pedido";
import type { Pedido, Task } from "@/lib/types";
import { ehExpedicao, ehProducao, ehUnidade } from "@/lib/tarefas";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Avatar } from "../ui/bits";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import DatePicker from "../ui/DatePicker";
import EditableTitle from "../ui/EditableTitle";
import LogLine from "../ui/LogLine";
import MatrizPedido from "../ui/MatrizPedido";
import { gestorOf, useApp } from "../store";
import { statusInfo } from "@/lib/theme";
import TreeGuides from "../ui/TreeGuides";

const dataHora = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "—";

/** Drawer da ordem de serviço: dados + matriz produto × unidade à esquerda, histórico à direita. */
export default function PedidoDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { pedidos } = useApp();
  const p = pedidos.find((x) => x.id === id);
  if (!p) return null;
  return <Body key={p.id} p={p} onClose={onClose} />;
}

function Body({ p, onClose }: { p: Pedido; onClose: () => void }) {
  const { team, produtos, tasks, updatePedido, canEditPage, canSeeAll } = useApp();
  const statusOpts = canSeeAll ? PEDIDO_STATUS : PEDIDO_STATUS.filter((s) => s.key !== "validada");
  // Tarefas geradas por esta ordem: produção (uma por produto) e expedição (uma por unidade).
  // O status da ordem segue as duas listas.
  const tarefas = tasks.filter((t) => t.pedidoId === p.id);
  const producao = tarefas.filter(ehProducao);
  const expedicao = tarefas.filter(ehExpedicao);
  const recebimento = tarefas.filter(ehUnidade);
  const editavel = canEditPage("pedidos");
  useFecharComEsc(true, onClose);
  const si = pedidoStatusInfo(p.status);
  const autor = gestorOf(team, p.criadoPor);
  const historico = [...(p.historico ?? [])].reverse();
  const [soComQtd, setSoComQtd] = useState(produtosNoPedido(p.itens) > 0);
  const [busca, setBusca] = useState("");
  // Painel de histórico recolhível (botão no canto superior esquerdo); a escolha fica salva.
  const [mostrarLogs, setMostrarLogs] = useState(() => { try { return localStorage.getItem("jb.pedido.logs") === "1"; } catch { return false; } });
  const toggleLogs = () => setMostrarLogs((v) => { try { localStorage.setItem("jb.pedido.logs", v ? "0" : "1"); } catch { /* ignore */ } return !v; });
  // Link compartilhável da ordem (?pedido=<id>) — só quem está logado e com acesso consegue abrir.
  const [linkCopied, setLinkCopied] = useState(false);
  const copiarLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/?pedido=${p.id}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <>
      {/* z 60/61: abaixo do drawer da tarefa (62/63), que abre por cima ao clicar numa tarefa de produção —
          assim clicar fora dela (inclusive sobre esta ordem) fecha só a tarefa. */}
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:60; background:rgba(20,24,40,.32);")} />
      <div className="m-drawer m-stack" style={css("position:fixed; top:0; right:0; bottom:0; z-index:61; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:1500px; max-width:97vw; display:flex; overflow:hidden;")}>
        <div style={css(`flex:2; min-width:0; display:flex; flex-direction:column; ${mostrarLogs ? "border-right:1px solid #ECEDF1;" : ""}`)}>
          <div style={css("flex:1; min-height:0; overflow-y:auto; padding:22px 24px; display:flex; flex-direction:column;")}>
            <div style={css("display:flex; align-items:flex-start; gap:11px; margin-bottom:18px;")}>
              <span style={css(`flex:none; width:34px; height:34px; border-radius:9px; background:${si.bg}; color:${si.fg}; display:flex; align-items:center; justify-content:center;`)}><Svg size={17} sw={2.2}><path d="M9 5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 13h6M9 17h4" /></Svg></span>
              <div style={css("flex:1; min-width:0; padding-top:3px;")}>
                {editavel
                  ? <EditableTitle fill value={p.titulo} onSave={(v) => updatePedido(p.id, { titulo: v })} textStyle="margin:0; font-size:21px; font-weight:800; letter-spacing:-0.4px;" pencilSize={15} />
                  : <h2 style={css("margin:0; font-size:21px; font-weight:800; letter-spacing:-0.4px;")}>{p.titulo}</h2>}
              </div>
              <Hoverable as="button" onClick={copiarLink} title="Copiar link da ordem" s={css("flex:none; display:inline-flex; align-items:center; gap:7px; height:34px; border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:12.5px; font-weight:700; padding:0 12px; border-radius:9px;")} hover="background:#FAFAFB">
                <Svg size={14} sw={2.2}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Svg>
                {linkCopied ? "Link copiado!" : "Copiar link"}
              </Hoverable>
              {/* Canto superior direito: X em cima, Histórico logo abaixo. */}
              <div style={css("flex:none; display:flex; flex-direction:column; align-items:flex-end; gap:6px;")}>
                <Hoverable as="button" onClick={onClose} title="Fechar" s={css("width:34px; height:34px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={16} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
                <Hoverable as="button" onClick={toggleLogs} title={mostrarLogs ? "Esconder histórico" : "Mostrar histórico"} s={css(`display:inline-flex; align-items:center; gap:7px; height:30px; border:1px solid ${mostrarLogs ? "#955C6B" : "#E2E3E9"}; background:${mostrarLogs ? "#FDF1F4" : "#fff"}; color:${mostrarLogs ? "#955C6B" : "#5B6472"}; cursor:pointer; font-size:12px; font-weight:700; padding:0 10px; border-radius:8px;`)} hover={mostrarLogs ? undefined : "background:#F4F4F7"}>
                  <Svg size={14} sw={2.2}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></Svg>
                  Histórico
                  {historico.length > 0 && <span style={css(`font-size:11px; font-weight:800; padding:1px 6px; border-radius:999px; background:${mostrarLogs ? "#955C6B" : "#EFF0F4"}; color:${mostrarLogs ? "#fff" : "#5B6472"};`)}>{historico.length}</span>}
                </Hoverable>
              </div>
            </div>
            <div className="m-wrap" style={css("display:grid; grid-template-columns:1fr 1fr; gap:0 24px;")}>
              <Row label="Status">
                {editavel ? (
                  <Menu trigger={(tg) => (
                    <span onClick={tg} style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; padding:5px 11px; border-radius:7px; cursor:pointer; background:${si.bg}; color:${si.fg};`)}><span style={css(`width:7px; height:7px; border-radius:50%; background:${si.dot};`)} />{si.label}<Svg size={11} sw={2.4} style={css("flex:none; opacity:.6;")}><path d="m6 9 6 6 6-6" /></Svg></span>
                  )} width={190} z={64}>
                    {(c) => statusOpts.map((s) => (<MenuItem key={s.key} checked={p.status === s.key} onClick={() => { updatePedido(p.id, { status: s.key }); c(); }}><span style={css(`width:9px; height:9px; border-radius:50%; background:${s.dot};`)} /><span style={{ flex: 1 }}>{s.label}</span></MenuItem>))}
                  </Menu>
                ) : (
                  <span style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; padding:5px 11px; border-radius:7px; background:${si.bg}; color:${si.fg};`)}><span style={css(`width:7px; height:7px; border-radius:50%; background:${si.dot};`)} />{si.label}</span>
                )}
              </Row>
              <Row label="Entrega">
                {editavel ? (
                  <DatePicker date={p.entrega ?? ""} align="left" z={66} onSave={(d) => updatePedido(p.id, { entrega: d })} trigger={(toggle) => (
                    <Hoverable onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:7px; font-size:13.5px; font-weight:700; color:${p.entrega ? "#5B6472" : "#9398A6"}; cursor:pointer; padding:5px 9px; border-radius:7px;`)} hover="background:#F2F3F6"><Svg size={14}><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>{p.entrega || "Definir"}</Hoverable>
                  )} />
                ) : <span style={css("font-size:13.5px; font-weight:600; color:#5B6472;")}>{p.entrega || "—"}</span>}
              </Row>
              <Row label="Criado por"><span style={css("display:inline-flex; align-items:center; gap:8px;")}><Avatar ini={autor.ini} cor={autor.cor} src={autor.foto} size={24} fontSize={10.5} /><span style={css("font-size:13.5px; font-weight:600;")}>{autor.nome}</span></span></Row>
              <Row label="Criada em"><span style={css("font-size:13.5px; font-weight:600; color:#5B6472;")}>{dataHora(p.criada)}</span></Row>
              <Row label="Última atualização"><span style={css("font-size:13.5px; font-weight:600; color:#5B6472;")}>{dataHora(p.atualizada ?? p.criada)}</span></Row>
            </div>

            {tarefas.length > 0 && (
              <div style={css("margin-top:18px; padding-top:18px; border-top:1px solid #F0F1F4; display:flex; flex-direction:column; gap:10px;")}>
                <ArvoreOrdem pedido={p} setores={[
                  { key: "producao", titulo: "Produção", tarefas: producao },
                  { key: "expedicao", titulo: "Expedição", tarefas: expedicao },
                  { key: "unidades", titulo: "Recebimento nas unidades", tarefas: recebimento },
                ]} />
                <p style={css("margin:0; font-size:12px; color:#9398A6; line-height:1.5;")}>Ciclo da ordem: produção fabrica → expedição separa por unidade → cada unidade confere o que recebeu. Alguma tarefa iniciada → Em andamento; as três etapas concluídas → Concluída.</p>
              </div>
            )}

            <div style={css("margin-top:18px; padding-top:18px; border-top:1px solid #F0F1F4;")}>
              <div className="m-wrap" style={css("display:flex; align-items:center; gap:10px; margin-bottom:12px;")}>
                <Svg size={15} stroke="#5B6472"><rect x="3" y="4" width="18" height="16" rx="2.2" /><path d="M3 10h18M9 4v16" /></Svg>
                <span style={css("font-size:14px; font-weight:800;")}>Produtos por unidade</span>
                <span style={{ flex: 1 }} />
                <div style={css("display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #E2E3E9; border-radius:9px; padding:0 10px; height:32px; width:200px;")}>
                  <Svg size={14} sw={2.2} stroke="#9398A6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" style={css("flex:1; min-width:0; border:none; outline:none; background:transparent; font-size:12.5px; font-weight:600; color:#1B1B28;")} />
                </div>
                <Hoverable as="button" onClick={() => setSoComQtd((v) => !v)} s={css(`display:inline-flex; align-items:center; gap:6px; height:32px; border:1px solid ${soComQtd ? "#955C6B" : "#E2E3E9"}; background:${soComQtd ? "#FDF1F4" : "#fff"}; color:${soComQtd ? "#955C6B" : "#5B6472"}; cursor:pointer; font-size:12.5px; font-weight:700; padding:0 12px; border-radius:9px;`)} hover={soComQtd ? undefined : "background:#FAFAFB"}>
                  <Svg size={13} sw={2.4}><path d="M20 6 9 17l-5-5" /></Svg>{soComQtd ? "Só com quantidade" : "Todos os produtos"}
                </Hoverable>
              </div>
              <MatrizPedido produtos={produtos} itens={p.itens} onChange={(itens) => updatePedido(p.id, { itens })} editavel={editavel} soComQuantidade={soComQtd} busca={busca} />
              {editavel && <p style={css("margin:10px 0 0; font-size:12px; color:#9398A6; line-height:1.5;")}>Digite a quantidade e pressione Enter (ou saia do campo) para salvar. Para acrescentar um produto que ainda não está na ordem, mostre “Todos os produtos”.</p>}
            </div>
          </div>
        </div>
        {mostrarLogs && (
        <div style={css("flex:1; min-width:0; max-width:360px; display:flex; flex-direction:column; background:#FAFAFB;")}>
          <div style={css("display:flex; align-items:center; gap:9px; padding:14px 22px; border-bottom:1px solid #ECEDF1; height:60px;")}>
            <span style={css("font-weight:800; font-size:15px;")}>Histórico</span>
            <span style={css("font-size:12px; color:#9398A6; font-weight:700;")}>{historico.length}</span>
          </div>
          <div style={css("flex:1; overflow-y:auto; padding:18px 20px; display:flex; flex-direction:column; gap:10px;")}>
            {historico.length === 0
              ? <div style={css("flex:1; display:flex; align-items:center; justify-content:center; text-align:center; color:#9398A6; font-size:13px; font-weight:600;")}>Nenhuma alteração registrada ainda.</div>
              : historico.map((c) => <LogLine key={c.id} c={c} />)}
          </div>
        </div>
        )}
      </div>
    </>
  );
}

const feitaT = (t: Task) => t.status === "concluida" || t.status === "validada";

/** Status agregado de um grupo de tarefas (setor): mesmo critério da ordem. */
function statusDoGrupo(ts: Task[]): { label: string; bg: string; fg: string; dot: string } {
  if (ts.length && ts.every(feitaT)) return statusInfo.concluida;
  if (ts.some((t) => t.status === "atrasada")) return statusInfo.atrasada;
  if (ts.some((t) => t.status !== "verificar")) return { ...statusInfo["em andamento"], label: "Em andamento" };
  return statusInfo.verificar;
}

const Pill = ({ st }: { st: { label: string; bg: string; fg: string } }) => (
  <span style={css(`flex:none; font-size:12px; font-weight:700; padding:3px 10px; border-radius:7px; background:${st.bg}; color:${st.fg};`)}>{st.label}</span>
);

/**
 * Ordem → setores → tarefas, em árvore (mesmo desenho das subtarefas do onboarding da Target):
 * a ordem é a raiz, cada setor (Produção / Expedição / Recebimento) é um nó com x/y e status
 * agregado, e cada produto/unidade é uma folha. Setores começam recolhidos; folha abre a tarefa.
 */
function ArvoreOrdem({ pedido, setores }: { pedido: Pedido; setores: { key: string; titulo: string; tarefas: Task[] }[] }) {
  const { team, setTaskDetailOpen } = useApp();
  // Setores começam recolhidos: ao abrir a ordem vê-se só o resumo de cada etapa.
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const todas = setores.flatMap((x) => x.tarefas);
  const visiveis = setores.filter((x) => x.tarefas.length);
  const si = pedidoStatusInfo(pedido.status);
  const linha = "display:flex; align-items:center; gap:10px; padding:7px 12px; min-height:40px; box-sizing:border-box;";
  return (
    <div style={css("border:1px solid #ECEDF1; border-radius:12px; padding:6px 0; background:#fff;")}>
      {/* raiz: a ordem */}
      <div style={css(`${linha} margin:0 6px; border-radius:10px; background:#EEF0FB;`)}>
        <span style={css(`width:9px; height:9px; flex:none; border-radius:50%; background:${si.dot};`)} />
        <span style={css("flex:1; min-width:0; font-size:15px; font-weight:800; color:#3B3FB6; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{pedido.titulo}</span>
        <span style={css("font-size:13px; font-weight:700; color:#7A8090;")}>{todas.filter(feitaT).length}/{todas.length}</span>
        <Pill st={si} />
      </div>
      {visiveis.map((g, gi) => {
        const ultimoG = gi === visiveis.length - 1;
        const aberto = !!abertos[g.key];
        const ok = g.tarefas.filter(feitaT).length;
        return (
          <div key={g.key}>
            {/* nó do setor */}
            <Hoverable onClick={() => setAbertos((f) => ({ ...f, [g.key]: !f[g.key] }))} s={css(`${linha} padding-left:14px; cursor:pointer;`)} hover="background:#FAFAFB">
              <TreeGuides guides={[!ultimoG]} sangra={7} />
              <Svg size={13} sw={2.4} stroke="#7A8090" style={css(`flex:none; transform:rotate(${aberto ? 0 : -90}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
              <span style={css("flex:1; min-width:0; font-size:14px; font-weight:800; color:#1B1B28;")}>{g.titulo}</span>
              <span style={css("font-size:12.5px; font-weight:700; color:#7A8090;")}>{ok}/{g.tarefas.length}</span>
              <Pill st={statusDoGrupo(g.tarefas)} />
            </Hoverable>
            {/* folhas: produtos / unidades */}
            {aberto && g.tarefas.map((t, ti) => {
              const st = statusInfo[t.status];
              const gg = gestorOf(team, t.gestor);
              const feito = feitaT(t);
              return (
                <Hoverable key={t.id} onClick={() => setTaskDetailOpen(t.id)} s={css(`${linha} padding-left:14px; cursor:pointer;`)} hover="background:#FAFAFB">
                  <TreeGuides guides={[!ultimoG, ti < g.tarefas.length - 1]} sangra={7} />
                  <span style={css(`width:8px; height:8px; flex:none; border-radius:50%; background:${st.dot};`)} />
                  <span style={css(`flex:1; min-width:0; font-size:13.5px; font-weight:600; color:${feito ? "#9398A6" : "#1B1B28"}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`)}>{t.titulo}</span>
                  <Avatar ini={gg.ini} cor={gg.cor} src={gg.foto} size={22} fontSize={9.5} />
                  <Pill st={st} />
                </Hoverable>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={css("display:flex; align-items:center; gap:14px; padding:8px 0; min-width:0;")}>
      <span style={css("width:118px; flex:none; font-size:13px; color:#7A8090; font-weight:600;")}>{label}</span>
      {children}
    </div>
  );
}
