"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { BRAND } from "@/lib/theme";
import { useIsMobile } from "@/lib/useIsMobile";
import { PEDIDO_STATUS, isoDia, useEncomendas } from "@/lib/encomendas";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import LeadDetail from "../encomendas/LeadDetail";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { useApp } from "../store";

/**
 * Encomendas → Agenda: entregas/retiradas dos pedidos (cor pelo status) e compromissos
 * manuais, em semana (computador) ou dia (celular) — como a Agenda do Cachorrão.
 */
type Evento = { id: string; titulo: string; data: string; ini: number; fim: number; cor: string; sub: string; leadId?: string; pedidoId?: string; manual?: boolean };

const H0 = 7, H1 = 21, PX = 56; // 07:00–21:00, 56px por hora
const SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const somaDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function EncAgenda() {
  const { canEditPage } = useApp();
  const editavel = canEditPage("encomendas-agenda");
  const { leads, pedidos, compromissos, produtoDe, unidadeDe, addCompromisso, removeCompromisso } = useEncomendas();
  const unidadeNome = (id?: string) => unidadeDe(id)?.nome;
  const mobile = useIsMobile();
  const hojeIso = isoDia(new Date());
  const [sel, setSel] = useState(() => new Date());
  const [aberto, setAberto] = useState<{ leadId: string; pedidoId?: string } | null>(null);
  const [novo, setNovo] = useState<{ data: string; hora: string } | null>(null);

  const eventos: Evento[] = [
    ...pedidos.map((p) => {
      const prod = produtoDe(p.produtoId), lead = leads.find((l) => l.id === p.leadId);
      const st = PEDIDO_STATUS.find((s) => s.key === p.status);
      return {
        id: p.id, data: p.data, ini: min(p.hora), fim: min(p.hora) + 60, cor: st?.agenda ?? "#DC2626", leadId: p.leadId, pedidoId: p.id,
        titulo: `${lead?.nome ?? "Cliente"} · ${p.quantidade}× ${(prod?.nome ?? p.produtoNome ?? "produto").replace(/^Torta de /, "")}`,
        sub: `${p.tipo}${p.tipo === "Retirada" && (p.unidadeNome ?? unidadeNome(p.unidadeId)) ? ` · ${p.unidadeNome ?? unidadeNome(p.unidadeId)}` : ""} · ${p.status}`,
      };
    }),
    ...compromissos.map((c) => ({ id: c.id, titulo: c.titulo, data: c.data, ini: min(c.hora), fim: Math.max(min(c.horaFim), min(c.hora) + 15), cor: BRAND, sub: [c.contato, c.notas].filter(Boolean).join(" · "), manual: true })),
  ];
  const doDia = (iso: string) => eventos.filter((e) => e.data === iso).sort((a, b) => a.ini - b.ini);
  const abrir = (e: Evento) => { if (e.leadId) setAberto({ leadId: e.leadId, pedidoId: e.pedidoId }); };

  const inicioSemana = somaDias(sel, -sel.getDay());
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(inicioSemana, i));
  const proximos = eventos.filter((e) => e.data > hojeIso || (e.data === hojeIso && e.fim > new Date().getHours() * 60 + new Date().getMinutes()))
    .sort((a, b) => (a.data + hhmm(a.ini)).localeCompare(b.data + hhmm(b.ini))).slice(0, 8);
  const quando = (e: Evento) => {
    const d = new Date(`${e.data}T12:00:00`);
    const rot = e.data === hojeIso ? "Hoje" : e.data === isoDia(somaDias(new Date(), 1)) ? "Amanhã" : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    return `${rot} · ${hhmm(e.ini)}–${hhmm(e.fim)}`;
  };

  const cabecalho = (
    <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:24px 30px 14px; flex:none;")}>
      <div style={{ flex: 1 }}>
        <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Agenda</h1>
        <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>Entregas e retiradas de encomendas, e compromissos</p>
      </div>
      <div style={css("display:flex; gap:10px; flex-wrap:wrap;")}>
        {PEDIDO_STATUS.map((s) => <span key={s.key} style={css("display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; color:#5B6472;")}><span style={css(`width:9px; height:9px; border-radius:3px; background:${s.agenda};`)} />{s.key}</span>)}
        <span style={css("display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; color:#5B6472;")}><span style={css(`width:9px; height:9px; border-radius:3px; background:${BRAND};`)} />Compromisso</span>
      </div>
    </div>
  );

  const navegador = (passo: number) => (
    <div style={css("display:flex; align-items:center; gap:6px;")}>
      <Hoverable as="button" onClick={() => setSel(new Date())} s={css("border:1px solid #E2E3E9; background:#fff; border-radius:9px; padding:6px 12px; font-size:13px; font-weight:700; cursor:pointer; color:#3A3F4C;")} hover="background:#F4F4F7">Hoje</Hoverable>
      <Seta onClick={() => setSel(somaDias(sel, -passo))} dir={-1} />
      <Seta onClick={() => setSel(somaDias(sel, passo))} dir={1} />
    </div>
  );

  return (
    <div style={css("height:100%; display:flex; flex-direction:column;")}>
      {cabecalho}
      {mobile ? (
        <div className="m-pad" style={css("flex:1; min-height:0; overflow-y:auto; padding:0 30px 24px;")}>
          <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px;")}>
            <span style={css("flex:1; font-size:15px; font-weight:800; text-transform:capitalize;")}>{MESES[sel.getMonth()]} {sel.getFullYear()}</span>
            {navegador(1)}
          </div>
          <div style={css("display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:14px;")}>
            {dias.map((d) => {
              const iso = isoDia(d), ativo = iso === isoDia(sel), tem = doDia(iso).length > 0;
              return (
                <button key={iso} onClick={() => setSel(d)} style={css(`border:none; border-radius:11px; padding:7px 0; cursor:pointer; background:${ativo ? BRAND : "#F4F5F7"}; color:${ativo ? "#fff" : "#3A3F4C"}; display:flex; flex-direction:column; align-items:center; gap:2px;`)}>
                  <span style={css("font-size:10.5px; font-weight:700; opacity:.8;")}>{SEMANA[d.getDay()]}</span>
                  <span style={css(`font-size:16px; font-weight:800; ${iso === hojeIso && !ativo ? `color:${BRAND};` : ""}`)}>{d.getDate()}</span>
                  <span style={css(`width:5px; height:5px; border-radius:50%; background:${tem ? (ativo ? "#fff" : BRAND) : "transparent"};`)} />
                </button>
              );
            })}
          </div>
          <div style={css("display:flex; align-items:center; margin-bottom:8px;")}>
            <span style={css("flex:1; font-size:14px; font-weight:800;")}>{sel.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}</span>
            {editavel && <Hoverable as="button" onClick={() => setNovo({ data: isoDia(sel), hora: "09:00" })} s={css(`border:none; background:${BRAND}; color:#fff; border-radius:9px; padding:7px 12px; font-size:12.5px; font-weight:700; cursor:pointer;`)} hover="filter:brightness(1.1)">+ Compromisso</Hoverable>}
          </div>
          <div style={css("display:flex; flex-direction:column; gap:8px;")}>
            {doDia(isoDia(sel)).map((e) => <CartaoEvento key={e.id} e={e} quando={`${hhmm(e.ini)}–${hhmm(e.fim)}`} onClick={() => abrir(e)} onRemover={editavel && e.manual ? () => removeCompromisso(e.id) : undefined} />)}
            {doDia(isoDia(sel)).length === 0 && <div style={css("padding:22px 10px; text-align:center; color:#B6BAC4; font-size:13px;")}>Nenhum compromisso neste dia.</div>}
          </div>
        </div>
      ) : (
        <div style={css("flex:1; min-height:0; display:flex; gap:18px; padding:0 30px 24px;")}>
          <aside style={css("width:280px; flex:none; display:flex; flex-direction:column; gap:14px; overflow-y:auto;")}>
            <MiniMes sel={sel} onSel={setSel} marcados={new Set(eventos.map((e) => e.data))} />
            <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:14px;")}>
              <div style={css("font-size:13.5px; font-weight:800; margin-bottom:10px;")}>Próximos</div>
              <div style={css("display:flex; flex-direction:column; gap:8px;")}>
                {proximos.map((e) => <CartaoEvento key={e.id} e={e} quando={quando(e)} compacto onClick={() => { setSel(new Date(`${e.data}T12:00:00`)); abrir(e); }} />)}
                {proximos.length === 0 && <div style={css("font-size:12.5px; color:#B6BAC4;")}>Nenhum pedido futuro.</div>}
              </div>
            </div>
          </aside>
          <div style={css("flex:1; min-width:0; display:flex; flex-direction:column; background:#fff; border:1px solid #ECEDF1; border-radius:14px; overflow:hidden;")}>
            <div style={css("flex:none; display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid #ECEDF1;")}>
              <span style={css("flex:1; font-size:15px; font-weight:800; text-transform:capitalize;")}>{MESES[inicioSemana.getMonth()]} {inicioSemana.getFullYear()}</span>
              {navegador(7)}
            </div>
            <div style={css("flex:none; display:grid; grid-template-columns:52px repeat(7, minmax(0,1fr)); border-bottom:1px solid #ECEDF1;")}>
              <span />
              {dias.map((d) => {
                const hoje = isoDia(d) === hojeIso;
                return (
                  <div key={d.toISOString()} style={css("display:flex; flex-direction:column; align-items:center; gap:3px; padding:8px 0;")}>
                    <span style={css("font-size:11px; font-weight:700; color:#9398A6;")}>{SEMANA[d.getDay()]}</span>
                    <span style={css(`width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; background:${hoje ? BRAND : "transparent"}; color:${hoje ? "#fff" : "#1B1B28"};`)}>{d.getDate()}</span>
                  </div>
                );
              })}
            </div>
            <div style={css("flex:1; min-height:0; overflow-y:auto;")}>
              <div style={css(`display:grid; grid-template-columns:52px repeat(7, minmax(0,1fr)); height:${(H1 - H0) * PX}px; position:relative;`)}>
                <div style={css("position:relative;")}>
                  {Array.from({ length: H1 - H0 }, (_, i) => <span key={i} style={css(`position:absolute; top:${i * PX - 7}px; right:8px; font-size:11px; color:#9398A6; font-weight:600;`)}>{i ? `${String(H0 + i).padStart(2, "0")}:00` : ""}</span>)}
                </div>
                {dias.map((d) => {
                  const iso = isoDia(d);
                  const evs = faixas(doDia(iso));
                  return (
                    <div key={iso} onClick={(ev) => {
                      if (!editavel) return;
                      const y = ev.clientY - (ev.currentTarget as HTMLDivElement).getBoundingClientRect().top;
                      const h = Math.min(H1 - 1, Math.max(H0, H0 + Math.floor(y / PX)));
                      setNovo({ data: iso, hora: `${String(h).padStart(2, "0")}:00` });
                    }} style={css(`position:relative; border-left:1px solid #F0F1F4; cursor:${editavel ? "copy" : "default"}; background:${iso === hojeIso ? "#FDF8F9" : "transparent"}; background-image:repeating-linear-gradient(to bottom, transparent 0, transparent ${PX - 1}px, #F0F1F4 ${PX - 1}px, #F0F1F4 ${PX}px);`)}>
                      {evs.map(({ e, faixa, total }) => {
                        const top = ((Math.max(e.ini, H0 * 60) - H0 * 60) / 60) * PX;
                        const alt = Math.max(22, ((Math.min(e.fim, H1 * 60) - Math.max(e.ini, H0 * 60)) / 60) * PX - 2);
                        return (
                          <div key={e.id} onClick={(ev) => { ev.stopPropagation(); abrir(e); }} title={`${e.titulo}\n${e.sub}`} style={css(`position:absolute; top:${top}px; height:${alt}px; left:calc(${(faixa / total) * 100}% + 2px); width:calc(${100 / total}% - 4px); background:${e.cor}1C; border:1px solid ${e.cor}55; border-left:3px solid ${e.cor}; border-radius:7px; padding:3px 6px; overflow:hidden; cursor:${e.leadId ? "pointer" : "default"}; box-sizing:border-box;`)}>
                            <div style={css(`font-size:11.5px; font-weight:800; color:${e.cor}; line-height:1.25; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`)}>{e.titulo}</div>
                            {total < 3 && <div style={css("font-size:10.5px; color:#5B6472; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>{hhmm(e.ini)}–{hhmm(e.fim)}</div>}
                            {e.manual && editavel && <button onClick={(ev) => { ev.stopPropagation(); removeCompromisso(e.id); }} title="Excluir compromisso" style={css("position:absolute; top:2px; right:2px; border:none; background:transparent; color:#9398A6; cursor:pointer; padding:2px; display:flex;")}><Svg size={12} sw={2.4}><path d="M6 6l12 12M18 6 6 18" /></Svg></button>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {novo && <NovoCompromisso inicial={novo} onClose={() => setNovo(null)} onSalvar={(c) => { addCompromisso(c); setNovo(null); }} />}
      {aberto && <LeadDetail leadId={aberto.leadId} pedidoAberto={aberto.pedidoId} canEdit={canEditPage("encomendas-crm") || editavel} onClose={() => setAberto(null)} />}
    </div>
  );
}

/** Eventos sobrepostos lado a lado (faixas), como no Google Agenda. */
function faixas(evs: Evento[]) {
  const out: { e: Evento; faixa: number; total: number }[] = [];
  let grupo: { e: Evento; faixa: number }[] = [], fimGrupo = -1, fins: number[] = [];
  const fecha = () => { const total = Math.max(1, fins.length); grupo.forEach((g) => out.push({ ...g, total })); grupo = []; fins = []; };
  for (const e of evs) {
    if (e.ini >= fimGrupo) { fecha(); fimGrupo = -1; }
    let f = fins.findIndex((fim) => fim <= e.ini);
    if (f === -1) { f = fins.length; fins.push(e.fim); } else fins[f] = e.fim;
    grupo.push({ e, faixa: f });
    fimGrupo = Math.max(fimGrupo, e.fim);
  }
  fecha();
  return out;
}

function CartaoEvento({ e, quando, onClick, onRemover, compacto }: { e: Evento; quando: string; onClick: () => void; onRemover?: () => void; compacto?: boolean }) {
  return (
    <Hoverable onClick={onClick} s={css(`display:flex; gap:8px; align-items:flex-start; background:#fff; border:1px solid #ECEDF1; border-left:4px solid ${e.cor}; border-radius:10px; padding:${compacto ? "7px 9px" : "10px 12px"}; cursor:${e.leadId ? "pointer" : "default"};`)} hover="background:#FAFAFB">
      <div style={css("flex:1; min-width:0;")}>
        <div style={css(`font-size:${compacto ? 12.5 : 13.5}px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`)}>{e.titulo}</div>
        <div style={css("font-size:11.5px; color:#7A8090; margin-top:2px;")}>{quando}</div>
        {!compacto && e.sub && <div style={css("font-size:12px; color:#5B6472; margin-top:3px;")}>{e.sub}</div>}
      </div>
      {onRemover && <button onClick={(ev) => { ev.stopPropagation(); onRemover(); }} title="Excluir compromisso" style={css("width:30px; height:30px; flex:none; border:none; background:transparent; color:#9398A6; cursor:pointer; border-radius:8px; display:flex; align-items:center; justify-content:center;")}><Svg size={14} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg></button>}
    </Hoverable>
  );
}

function MiniMes({ sel, onSel, marcados }: { sel: Date; onSel: (d: Date) => void; marcados: Set<string> }) {
  const [mes, setMes] = useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1));
  const ini = somaDias(mes, -mes.getDay());
  const hoje = isoDia(new Date()), selIso = isoDia(sel);
  return (
    <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:12px;")}>
      <div style={css("display:flex; align-items:center; margin-bottom:6px;")}>
        <span style={css("flex:1; font-size:13.5px; font-weight:800; text-transform:capitalize;")}>{MESES[mes.getMonth()]} {mes.getFullYear()}</span>
        <Seta dir={-1} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} />
        <Seta dir={1} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} />
      </div>
      <div style={css("display:grid; grid-template-columns:repeat(7,1fr); gap:2px; text-align:center;")}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i} style={css("font-size:10.5px; font-weight:700; color:#9398A6; padding:3px 0;")}>{d}</span>)}
        {Array.from({ length: 42 }, (_, i) => somaDias(ini, i)).map((d) => {
          const iso = isoDia(d), doMes = d.getMonth() === mes.getMonth(), s = iso === selIso;
          return (
            <button key={iso} onClick={() => onSel(d)} style={css(`position:relative; height:30px; border:none; border-radius:8px; cursor:pointer; font-size:12.5px; font-weight:${s || iso === hoje ? 800 : 600}; background:${s ? BRAND : iso === hoje ? "#FDF1F4" : "transparent"}; color:${s ? "#fff" : doMes ? "#1B1B28" : "#C7CAD2"};`)}>
              {d.getDate()}
              {marcados.has(iso) && !s && <span style={css(`position:absolute; bottom:3px; left:50%; transform:translateX(-50%); width:4px; height:4px; border-radius:50%; background:${BRAND};`)} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Seta({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <Hoverable as="button" onClick={onClick} s={css("width:32px; height:32px; border:none; background:transparent; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#5B6472;")} hover="background:#F4F4F7">
      <Svg size={16} sw={2.4}>{dir < 0 ? <path d="m15 18-6-6 6-6" /> : <path d="m9 6 6 6-6 6" />}</Svg>
    </Hoverable>
  );
}

function NovoCompromisso({ inicial, onClose, onSalvar }: { inicial: { data: string; hora: string }; onClose: () => void; onSalvar: (c: { titulo: string; data: string; hora: string; horaFim: string; contato?: string; notas?: string }) => void }) {
  useFecharComEsc(true, onClose);
  const fimPadrao = hhmm(Math.min(min(inicial.hora) + 60, 23 * 60 + 59));
  const [f, setF] = useState({ titulo: "", data: inicial.data, hora: inicial.hora, horaFim: fimPadrao, contato: "", notas: "" });
  const ok = f.titulo.trim().length > 0 && min(f.horaFim) > min(f.hora);
  const campo = "width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; padding:9px 11px; font-size:13.5px; outline:none; font-family:inherit; margin-top:5px;";
  const rot = "display:block; font-size:12.5px; font-weight:700; color:#5B6472;";
  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:70; background:rgba(20,24,40,.35);")} />
      <div style={css("position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:71; width:440px; max-width:94vw; max-height:90vh; overflow-y:auto; background:#fff; border-radius:16px; box-shadow:0 24px 70px rgba(20,24,40,.32); padding:20px; display:flex; flex-direction:column; gap:12px;")}>
        <div style={css("font-size:17px; font-weight:800;")}>Novo compromisso</div>
        <label style={css(rot)}>Título<input autoFocus value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Degustação com cliente" style={css(campo)} /></label>
        <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:10px;")}>
          <label style={css(rot + " grid-column:1 / -1;")}>Data<input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} style={css(campo)} /></label>
          <label style={css(rot)}>Início<input type="time" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} style={css(campo)} /></label>
          <label style={css(rot)}>Fim<input type="time" value={f.horaFim} onChange={(e) => setF({ ...f, horaFim: e.target.value })} style={css(campo)} /></label>
        </div>
        <label style={css(rot)}>Contato (opcional)<input value={f.contato} onChange={(e) => setF({ ...f, contato: e.target.value })} placeholder="Nome ou telefone" style={css(campo)} /></label>
        <label style={css(rot)}>Notas (opcional)<textarea value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} rows={3} style={css(campo + " resize:none;")} /></label>
        {!ok && f.titulo.trim() && <div style={css("font-size:12px; color:#CC3338; font-weight:600;")}>O fim precisa ser depois do início.</div>}
        <div style={css("display:flex; justify-content:flex-end; gap:8px; margin-top:4px;")}>
          <Hoverable as="button" onClick={onClose} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; border-radius:10px; padding:9px 16px; font-size:13.5px; font-weight:700; cursor:pointer;")} hover="background:#F4F4F7">Cancelar</Hoverable>
          <Hoverable as="button" onClick={() => ok && onSalvar({ titulo: f.titulo.trim(), data: f.data, hora: f.hora, horaFim: f.horaFim, contato: f.contato.trim() || undefined, notas: f.notas.trim() || undefined })} s={css(`border:none; background:${ok ? BRAND : "#D9C6CC"}; color:#fff; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:700; cursor:${ok ? "pointer" : "not-allowed"};`)} hover={ok ? "filter:brightness(1.1)" : undefined}>Salvar</Hoverable>
        </div>
      </div>
    </>
  );
}
