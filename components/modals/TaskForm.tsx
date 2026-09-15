"use client";

import { useFecharComEsc } from "../ui/useFecharComEsc";
import { useEffect, useState } from "react";
import { css } from "@/lib/css";
import { TODAY } from "@/lib/format";
import { prioInfo, statusInfo } from "@/lib/theme";
import type { Prioridade, Task, TaskStatus } from "@/lib/types";
import { hojeSP, primeiraOcorrencia, proximaApos, addDias, isoParaBR } from "@/lib/recorrencia";
import { Avatar } from "../ui/bits";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import DatePicker from "../ui/DatePicker";
import CommentEditor from "../ui/CommentEditor";
import { PRIO_ORDER, gestorOf, responsaveisDoScope, useApp } from "../store";

const STATUS_OPTS: TaskStatus[] = ["verificar", "em andamento", "atrasada", "concluida", "validada"];
/** Tipos de tarefa oferecidos no formulário (a lista pode ser agrupada por tipo). */
export const TIPOS_TAREFA = ["Otimização", "Criativo", "Configuração", "Relatório", "Financeiro", "Reunião", "Interno"];

const pad = (n: number) => String(n).padStart(2, "0");
const hojeBR = () => { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const horaBR = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const SEMANA_LABEL = ["todo domingo", "toda segunda-feira", "toda terça-feira", "toda quarta-feira", "toda quinta-feira", "toda sexta-feira", "todo sábado"];
const DIAS_ABREV = ["D", "S", "T", "Q", "Q", "S", "S"];
const FREQ_LABEL: Record<"diaria" | "semanal" | "mensal", string> = { diaria: "Diária", semanal: "Semanal", mensal: "Mensal" };
function freqLabel(freq: "diaria" | "semanal" | "mensal", ds: number, dm: number): string {
  if (freq === "diaria") return "todo dia";
  if (freq === "semanal") return SEMANA_LABEL[ds] ?? "semanal";
  return `todo dia ${dm} do mês`;
}

export default function TaskForm() {
  const { taskFormOpen, setTaskFormOpen, team, addTask, criarRecorrencia, taskFormPrefill, setTaskFormPrefill, currentUser, ownScopeOnly, canSeeAll } = useApp();
  const statusOpts = canSeeAll ? STATUS_OPTS : STATUS_OPTS.filter((s) => s !== "validada");
  const [titulo, setTitulo] = useState("");
  const [resp, setResp] = useState<string | null>(currentUser.id || null);
  const [prio, setPrio] = useState<Prioridade | null>(null);
  const [tipo, setTipo] = useState<string>("");
  const [status, setStatus] = useState<TaskStatus>("verificar");
  const [venc, setVenc] = useState("");
  const [vencHora, setVencHora] = useState("");
  const [obs, setObs] = useState("");
  // Recorrência (repetir): a tarefa vira um modelo que gera instâncias na cadência.
  const [repetir, setRepetir] = useState(false);
  const [freq, setFreq] = useState<"diaria" | "semanal" | "mensal">("semanal");
  const [diaSemana, setDiaSemana] = useState(1); // 0=dom … 1=seg
  const [diaMes, setDiaMes] = useState(1);
  const [prazoDias, setPrazoDias] = useState(0);
  const [modo, setModo] = useState<"novo" | "reagendar">("novo"); // novo = com histórico
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Popup de confirmação (resumo da tarefa criada) — exibido após criar.
  const [criada, setCriada] = useState<{ titulo: string; respNome: string; respIni?: string; respCor?: string; respFoto?: string; rec?: { freqLabel: string; primeira: string; venc: string; modo: "novo" | "reagendar" } } | null>(null);

  // Pré-preenchimento (cliente/responsável vindos de outra tela).
  useEffect(() => {
    if (taskFormOpen && taskFormPrefill) {
      if (taskFormPrefill.gestor !== undefined) setResp(taskFormPrefill.gestor ?? null);
      setTaskFormPrefill(null);
    }
  }, [taskFormOpen, taskFormPrefill, setTaskFormPrefill]);

  // Hook ANTES do return antecipado (regra dos hooks).
  useFecharComEsc(taskFormOpen, () => close());
  if (!taskFormOpen) return null;

  const reset = () => {
    setTitulo(""); setResp(currentUser.id || null); setPrio(null); setTipo("");
    setStatus("verificar"); setVenc(""); setVencHora(""); setObs("");
    setRepetir(false); setFreq("semanal"); setDiaSemana(1); setDiaMes(1); setPrazoDias(0); setModo("novo"); setErro(null);
  };
  const close = () => { setTaskFormOpen(false); reset(); };
  const fecharCriada = () => { setCriada(null); close(); };

  const respM = resp ? gestorOf(team, resp) : undefined;
  const usarRecorrencia = repetir;
  const valido = !!titulo.trim() && !!resp && !!prio && (usarRecorrencia || !!venc);

  const submit = async () => {
    if (!valido || !prio || !resp || salvando) return;
    const categoria = "operacional";
    const tipoFinal = tipo || undefined;

    if (usarRecorrencia) {
      setErro(null); setSalvando(true);
      // Esta tarefa É a 1ª ocorrência: vence na 1ª ocorrência + prazo. A próxima fica agendada.
      const regra = { frequencia: freq, dia_semana: freq === "semanal" ? diaSemana : null, dia_mes: freq === "mensal" ? diaMes : null };
      const firstOcc = primeiraOcorrencia(hojeSP(), regra);
      const vencISO = addDias(firstOcc, prazoDias);
      const t: Task = {
        id: `t-${Date.now()}`, titulo: titulo.trim(), gestor: resp, status: "verificar", prio, tipo: tipoFinal, categoria,
        criada: hojeBR(), criadaHora: horaBR(), venc: isoParaBR(vencISO), vencHora: "23:59", desc: obs || undefined,
        rec: {
          ativa: true, freq, prazoDias, modo,
          diaSemana: freq === "semanal" ? diaSemana : undefined,
          diaMes: freq === "mensal" ? diaMes : undefined,
          proxima: proximaApos(firstOcc, regra),
        },
      };
      const r = await criarRecorrencia(t);
      setSalvando(false);
      if (!r.ok) { setErro(r.error ?? "Falha ao criar a recorrência."); return; }
      setCriada({
        titulo: titulo.trim(),
        respNome: respM?.nome ?? "—", respIni: respM?.ini, respCor: respM?.cor, respFoto: respM?.foto,
        rec: { freqLabel: freqLabel(freq, diaSemana, diaMes), primeira: firstOcc, venc: vencISO, modo },
      });
      return;
    }

    const t: Task = {
      id: `t-${Date.now()}`,
      titulo: titulo.trim(),
      gestor: resp,
      status,
      prio,
      tipo: tipoFinal,
      categoria,
      criada: hojeBR(),
      criadaHora: horaBR(),
      venc,
      vencHora: vencHora || undefined,
      desc: obs || undefined,
    };
    addTask(t);
    setCriada({
      titulo: t.titulo,
      respNome: respM?.nome ?? "—", respIni: respM?.ini, respCor: respM?.cor, respFoto: respM?.foto,
    });
  };

  return (
    <>
      <div onClick={close} style={css("position:fixed; inset:0; z-index:64; background:rgba(20,24,40,.32);")} />
      <div style={css("position:fixed; top:0; right:0; bottom:0; z-index:65; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:720px; max-width:96vw; display:flex; flex-direction:column; overflow:hidden;")}>
        <div style={css("display:flex; align-items:center; gap:10px; padding:18px 24px; border-bottom:1px solid #ECEDF1;")}>
          <h2 style={css("margin:0; font-size:18px; font-weight:800; letter-spacing:-0.3px;")}>Nova tarefa</h2>
          <span style={{ flex: 1 }} />
          <Hoverable as="button" onClick={close} s={css("width:32px; height:32px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={16} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:22px 24px; display:flex; flex-direction:column; gap:18px;")}>
          <div style={css("background:#F7F8FA; border:1px solid #ECEDF1; border-radius:12px; padding:14px 16px; display:flex; gap:12px;")}>
            <span style={css("flex:none; width:30px; height:30px; border-radius:8px; background:#EAF0FE; color:#2563EB; display:flex; align-items:center; justify-content:center;")}>
              <Svg size={16} sw={2.2}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Svg>
            </span>
            <div style={css("min-width:0;")}>
              <div style={css("font-size:14px; font-weight:800; color:#1B1B28; letter-spacing:-0.2px; margin-bottom:4px;")}>Registre uma nova demanda para o time</div>
              <div style={css("font-size:13px; line-height:1.55; color:#7A8090;")}>Preencha os campos abaixo e detalhe o pedido na descrição.<br />Quanto mais contexto — o que precisa, prazo, links e imagens —, mais rápido e certeiro o time executa.</div>
            </div>
          </div>
          <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:18px 22px;")}>
          <Field label="Nome" req full>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Otimizar campanha de mensagens" style={css(inp)} />
          </Field>
          <Field label="Responsável" req>
            {ownScopeOnly ? (
              <div style={css(`display:flex; align-items:center; gap:8px; border:1px solid #E2E3E9; border-radius:10px; padding:9px 13px; background:#F7F7F9; font-size:13.5px; font-weight:600; color:#1B1B28;`)}>
                {respM && <Avatar ini={respM.ini} cor={respM.cor} src={respM.foto} size={24} fontSize={10} />}<span style={{ flex: 1 }}>{respM?.nome ?? "—"}</span>
              </div>
            ) : (
              <Menu trigger={(tg) => (
                <SelectBox onClick={tg} placeholder={!respM}>
                  {respM ? <><Avatar ini={respM.ini} cor={respM.cor} src={respM.foto} size={24} fontSize={10} /><span style={{ flex: 1 }}>{respM.nome}</span></> : <span style={{ flex: 1 }}>Selecionar responsável</span>}
                </SelectBox>
              )} z={70} width={260}>
                {(c) => responsaveisDoScope(team, "operacional").map((m) => (<MenuItem key={m.id} checked={resp === m.id} onClick={() => { setResp(m.id); c(); }}><Avatar ini={m.ini} cor={m.cor} src={m.foto} size={24} fontSize={10} /><span style={{ flex: 1 }}>{m.nome}</span></MenuItem>))}
              </Menu>
            )}
          </Field>
          <Field label="Urgência" req>
            <Menu trigger={(tg) => (
              <SelectBox onClick={tg} placeholder={!prio}>
                {prio ? <><Svg size={15} stroke={prioInfo[prio].dot}><path d="M5 21V4h11l-2.2 4 2.2 4H5" /></Svg><span style={{ flex: 1, color: prioInfo[prio].fg, fontWeight: 700 }}>{prioInfo[prio].label}</span></> : <span style={{ flex: 1 }}>Selecionar urgência</span>}
              </SelectBox>
            )} z={70} width={220}>
              {(c) => PRIO_ORDER.map((p) => (<MenuItem key={p} checked={prio === p} onClick={() => { setPrio(p); c(); }}><Svg size={14} stroke={prioInfo[p].dot}><path d="M5 21V4h11l-2.2 4 2.2 4H5" /></Svg><span style={{ flex: 1 }}>{prioInfo[p].label}</span></MenuItem>))}
            </Menu>
          </Field>
          <Field label="Tipo">
            <Menu trigger={(tg) => (
              <SelectBox onClick={tg} placeholder={!tipo}>
                <span style={{ flex: 1 }}>{tipo || "Selecionar tipo (opcional)"}</span>
              </SelectBox>
            )} z={70} width={220}>
              {(c) => (
                <>
                  <MenuItem checked={!tipo} onClick={() => { setTipo(""); c(); }}><span style={{ flex: 1, color: "#9398A6" }}>Sem tipo</span></MenuItem>
                  {TIPOS_TAREFA.map((tp) => (<MenuItem key={tp} checked={tipo === tp} onClick={() => { setTipo(tp); c(); }}><span style={{ flex: 1 }}>{tp}</span></MenuItem>))}
                </>
              )}
            </Menu>
          </Field>
          {!usarRecorrencia && (
          <Field label="Status" req>
            <Menu trigger={(tg) => (
              <SelectBox onClick={tg}>
                <span style={css(`width:8px; height:8px; border-radius:50%; background:${statusInfo[status].dot};`)} /><span style={{ flex: 1 }}>{statusInfo[status].label}</span>
              </SelectBox>
            )} z={70} width={220}>
              {(c) => statusOpts.map((s) => (<MenuItem key={s} checked={status === s} onClick={() => { setStatus(s); c(); }}><span style={css(`width:8px; height:8px; border-radius:50%; background:${statusInfo[s].dot};`)} /><span style={{ flex: 1 }}>{statusInfo[s].label}</span></MenuItem>))}
            </Menu>
          </Field>
          )}
          {!usarRecorrencia && (
          <Field label="Vencimento" req full>
            <DatePicker
              date={venc}
              time={vencHora || undefined}
              align="left"
              z={300}
              minDate={TODAY}
              onSave={(d, t) => { setVenc(d); setVencHora(t); }}
              trigger={(toggle) => (
                <SelectBox onClick={toggle} placeholder={!venc}>
                  <Svg size={15} stroke="#9398A6"><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>
                  <span style={{ flex: 1 }}>{venc ? `${venc}${vencHora ? ` às ${vencHora}` : ""}` : "Selecionar data de vencimento"}</span>
                </SelectBox>
              )}
            />
          </Field>
          )}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={css("display:flex; align-items:center; gap:10px;")}>
              <Hoverable as="button" onClick={() => setRepetir((v) => !v)} s={css(`width:44px; height:26px; flex:none; border-radius:999px; border:none; cursor:pointer; background:${repetir ? "#1B1B28" : "#D7DAE2"}; position:relative; transition:background .15s;`)}>
                <span style={css(`position:absolute; top:3px; left:${repetir ? 21 : 3}px; width:20px; height:20px; border-radius:50%; background:#fff; transition:left .15s; box-shadow:0 1px 2px rgba(0,0,0,.2);`)} />
              </Hoverable>
              <div>
                <div style={css("font-size:13.5px; font-weight:700; color:#1B1B28;")}>Repetir</div>
                <div style={css("font-size:12px; color:#9398A6;")}>{repetir ? `Cria a tarefa ${freqLabel(freq, diaSemana, diaMes)}.` : "Gerar esta tarefa automaticamente numa cadência."}</div>
              </div>
            </div>
            {repetir && (
              <div style={css("margin-top:12px; border:1px solid #ECEDF1; background:#FAFBFC; border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:14px;")}>
                <div>
                  <label style={css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;")}>Frequência</label>
                  <div style={css("display:flex; gap:8px;")}>
                    {(["diaria", "semanal", "mensal"] as const).map((f) => (
                      <Hoverable key={f} as="button" onClick={() => setFreq(f)} s={css(`flex:1; padding:9px; border:1px solid ${freq === f ? "#1B1B28" : "#E2E3E9"}; background:${freq === f ? "#1B1B28" : "#fff"}; color:${freq === f ? "#fff" : "#5B6472"}; font-weight:700; font-size:13px; border-radius:9px; cursor:pointer;`)} hover={freq === f ? undefined : "background:#F2F3F6"}>{FREQ_LABEL[f]}</Hoverable>
                    ))}
                  </div>
                </div>
                {freq === "semanal" && (
                  <div>
                    <label style={css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;")}>Dia da semana</label>
                    <div style={css("display:flex; gap:6px;")}>
                      {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                        <Hoverable key={d} as="button" onClick={() => setDiaSemana(d)} title={SEMANA_LABEL[d]} s={css(`width:36px; height:36px; border-radius:9px; border:1px solid ${diaSemana === d ? "#1B1B28" : "#E2E3E9"}; background:${diaSemana === d ? "#1B1B28" : "#fff"}; color:${diaSemana === d ? "#fff" : "#5B6472"}; font-weight:700; font-size:12.5px; cursor:pointer;`)} hover={diaSemana === d ? undefined : "background:#F2F3F6"}>{DIAS_ABREV[d]}</Hoverable>
                      ))}
                    </div>
                  </div>
                )}
                {freq === "mensal" && (
                  <div>
                    <label style={css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;")}>Dia do mês</label>
                    <input type="number" min={1} max={31} value={diaMes} onChange={(e) => setDiaMes(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} style={css(inp + "max-width:120px;")} />
                    <div style={css("font-size:11.5px; color:#9398A6; margin-top:5px;")}>Se o mês não tiver esse dia (ex.: 31 em fevereiro), cai no último dia.</div>
                  </div>
                )}
                <div>
                  <label style={css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;")}>Prazo</label>
                  <div style={css("display:flex; align-items:center; gap:8px; font-size:13.5px; color:#1B1B28;")}>
                    <span>Vence</span>
                    <input type="number" min={0} max={365} value={prazoDias} onChange={(e) => setPrazoDias(Math.max(0, Math.min(365, Number(e.target.value) || 0)))} style={css(inp + "max-width:80px; text-align:center;")} />
                    <span>dia(s) após ser criada {prazoDias === 0 ? "(vence no mesmo dia)" : ""}</span>
                  </div>
                </div>
                <div>
                  <label style={css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;")}>Histórico</label>
                  <div style={css("display:flex; gap:8px;")}>
                    {([["novo", "Com histórico", "cada ocorrência vira uma tarefa nova"], ["reagendar", "Sem histórico", "reusa a mesma tarefa toda vez"]] as const).map(([m, tit, sub]) => (
                      <Hoverable key={m} as="button" onClick={() => setModo(m)} s={css(`flex:1; text-align:left; padding:10px 12px; border:1px solid ${modo === m ? "#1B1B28" : "#E2E3E9"}; background:${modo === m ? "#FDF1F4" : "#fff"}; border-radius:10px; cursor:pointer;`)} hover={modo === m ? undefined : "background:#F7F8FA"}>
                        <div style={css(`font-size:13px; font-weight:700; color:${modo === m ? "#1B1B28" : "#3A3F4C"};`)}>{tit}</div>
                        <div style={css("font-size:11.5px; color:#9398A6; margin-top:2px;")}>{sub}</div>
                      </Hoverable>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
          <div style={css("flex:1; min-height:160px; display:flex; flex-direction:column;")}>
            <label style={css("display:block; font-size:13px; font-weight:700; margin-bottom:6px;")}>Descrição</label>
            <div style={css("flex:1; min-height:0;")}>
              <CommentEditor taskId="nova-tarefa" fill hideActions placeholder="Detalhes, contexto, imagens ou vídeos… (arraste aqui)" onChange={(html) => setObs(html)} />
            </div>
          </div>
        </div>
        <div style={css("flex:none; padding:16px 24px; border-top:1px solid #ECEDF1; display:flex; flex-direction:column; gap:10px;")}>
          {erro && <div style={css("font-size:12.5px; font-weight:600; color:#E5484D; background:#FDECEC; border:1px solid #F7C9C9; border-radius:9px; padding:8px 11px;")}>{erro}</div>}
          <div style={css("display:flex; gap:10px;")}>
            <Hoverable as="button" onClick={close} s={css("border:1px solid #E2E3E9; cursor:pointer; background:#fff; color:#5B6472; font-weight:700; font-size:14px; padding:13px 20px; border-radius:11px;")} hover="background:#F4F4F7">Cancelar</Hoverable>
            <Hoverable as="button" onClick={submit} {...{ disabled: !valido || salvando }} s={css(`flex:1; border:none; cursor:${valido && !salvando ? "pointer" : "not-allowed"}; opacity:${valido && !salvando ? 1 : 0.5}; background:#1B1B28; color:#fff; font-weight:700; font-size:14px; padding:13px; border-radius:11px;`)} hover={valido && !salvando ? "filter:brightness(1.15)" : undefined}>{usarRecorrencia ? (salvando ? "Criando…" : "Criar recorrência") : "Criar tarefa"}</Hoverable>
          </div>
        </div>
      </div>

      {criada && (
        <>
          <div onClick={fecharCriada} style={css("position:fixed; inset:0; z-index:80; background:rgba(20,24,40,.42);")} />
          <div style={css("position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:81; background:#fff; border:1px solid #E2E3E9; border-radius:18px; box-shadow:0 24px 70px rgba(20,24,40,.32); width:420px; max-width:94vw; overflow:hidden;")}>
            <div style={css("display:flex; flex-direction:column; align-items:center; text-align:center; padding:26px 24px 8px;")}>
              <span style={css("width:52px; height:52px; border-radius:50%; background:#E7F6EC; color:#1B7F4D; display:flex; align-items:center; justify-content:center; margin-bottom:14px;")}>
                <Svg size={26} sw={2.4}><path d="M20 6 9 17l-5-5" /></Svg>
              </span>
              <div style={css("font-size:17px; font-weight:800; letter-spacing:-0.3px; color:#1B1B28;")}>{criada.rec ? "Recorrência criada!" : "Tarefa criada com sucesso!"}</div>
              <div style={css("font-size:13.5px; color:#7A8090; margin-top:4px; line-height:1.5;")}>{criada.titulo}</div>
            </div>
            <div style={css("padding:14px 22px 4px; display:flex; flex-direction:column; gap:12px;")}>
              <div style={css("display:flex; align-items:center; gap:11px;")}>
                <span style={css("font-size:11px; font-weight:800; letter-spacing:0.4px; color:#A6AAB6; text-transform:uppercase; width:92px; flex:none;")}>Responsável</span>
                <span style={css("display:flex; align-items:center; gap:8px; min-width:0;")}>
                  <Avatar ini={criada.respIni ?? "?"} cor={criada.respCor ?? "#9398A6"} src={criada.respFoto} size={26} fontSize={11} />
                  <span style={css("font-size:14px; font-weight:700; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{criada.respNome}</span>
                </span>
              </div>
              {criada.rec && (
                <div style={css("display:flex; align-items:flex-start; gap:11px;")}>
                  <span style={css("font-size:11px; font-weight:800; letter-spacing:0.4px; color:#A6AAB6; text-transform:uppercase; width:92px; flex:none; padding-top:2px;")}>Repetição</span>
                  <span style={css("font-size:13.5px; font-weight:600; color:#1B1B28; line-height:1.5;")}>
                    Repete <b>{criada.rec.freqLabel}</b> ({criada.rec.modo === "novo" ? "com histórico" : "sem histórico"}).<br />
                    1ª ocorrência em <b>{isoParaBR(criada.rec.primeira)}</b>, vence {isoParaBR(criada.rec.venc)}.
                  </span>
                </div>
              )}
            </div>
            <div style={css("padding:18px 22px 20px;")}>
              <Hoverable as="button" onClick={fecharCriada} s={css("width:100%; border:none; cursor:pointer; background:#1B1B28; color:#fff; font-weight:700; font-size:14px; padding:12px; border-radius:11px;")} hover="filter:brightness(1.15)">Concluir</Hoverable>
            </div>
          </div>
        </>
      )}
    </>
  );
}

const inp = "width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:10px; font-size:13.5px; padding:11px 13px; outline:none;";

function Field({ label, req, full, children }: { label: string; req?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label style={css("display:block; font-size:13px; font-weight:700; margin-bottom:6px;")}>{label} {req && <span style={{ color: "#E5484D" }}>*</span>}</label>
      {children}
    </div>
  );
}

function SelectBox({ onClick, placeholder, children }: { onClick: () => void; placeholder?: boolean; children: React.ReactNode }) {
  return (
    <div onClick={onClick} style={css(`display:flex; align-items:center; gap:8px; cursor:pointer; border:1px solid #E2E3E9; border-radius:10px; padding:9px 13px; background:#fff; font-size:13.5px; font-weight:600; color:${placeholder ? "#9398A6" : "#1B1B28"};`)}>
      {children}
      <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
    </div>
  );
}
