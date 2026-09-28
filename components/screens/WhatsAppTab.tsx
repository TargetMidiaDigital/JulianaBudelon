"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "@/lib/css";
import { BRAND } from "@/lib/theme";
import { apiJson } from "@/lib/supabase-browser";
import { SETORES_GRUPO, SETOR_PADRAO, type GrupoWhatsApp, type SetorGrupo, type WhatsAppConfigPublica } from "@/lib/grupo";
import { extrairQr, extrairTelefone, instanciaAcao, uazapiConectada } from "@/lib/uazapi-client";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import ConfirmModal from "../ui/ConfirmModal";
import { useApp } from "../store";

/**
 * Configurações → WhatsApp. Mesmo desenho do CRM do Cachorrão HD (Instância + Grupos):
 *  1) Credenciais da Uazapi (URL + token write-only) — /api/whatsapp/config
 *  2) Conexão do número (status, QR Code, desconectar) — /api/whatsapp/instancia
 *  3) Grupos que recebem as notificações (JID, liga/desliga, testar, excluir) — /api/whatsapp/grupos
 * O que é enviado e quando fica em Agente IA → Ferramentas ("Avisar novo currículo no grupo").
 */

const card = "background:#fff; border:1px solid #ECEDF1; border-radius:14px; overflow:hidden;";
const inp = css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; font-size:13.5px; padding:9px 12px; outline:none;");
const mono = { fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" } as const;
const lbl = css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;");
const nota = css("margin:0; font-size:12px; color:#9398A6; line-height:1.5;");
const btnGhost = "display:inline-flex; align-items:center; gap:7px; border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:8px 13px; border-radius:9px;";
const WA = "#25D366";

function Pill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span style={css(`display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:11.5px; font-weight:700; background:${on ? "#E7F6EC" : "#F1F2F5"}; color:${on ? "#1B7F4D" : "#8A90A0"};`)}>
      <span style={css(`width:7px; height:7px; border-radius:50%; background:${on ? "#1B7F4D" : "#B6BAC4"};`)} />{on ? onLabel : offLabel}
    </span>
  );
}

function Cabecalho({ titulo, sub, cor = BRAND, icone, children }: { titulo: string; sub: string; cor?: string; icone: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div style={css("display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid #F4F5F7; flex-wrap:wrap;")}>
      <span style={css(`flex:none; width:38px; height:38px; border-radius:10px; background:${cor}1A; color:${cor}; display:flex; align-items:center; justify-content:center;`)}>{icone}</span>
      <div style={css("flex:1; min-width:160px;")}>
        <div style={css("font-size:14.5px; font-weight:800; color:#1B1B28;")}>{titulo}</div>
        <div style={css("font-size:12.5px; color:#9398A6; margin-top:2px;")}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

const Erro = ({ msg }: { msg: string }) => <div style={css("font-size:12.5px; font-weight:600; color:#B42318; background:#FEF3F2; border:1px solid #FECDCA; border-radius:10px; padding:9px 12px; line-height:1.45;")}>{msg}</div>;

export default function WhatsAppTab() {
  const { demo } = useApp();
  const [cfg, setCfg] = useState<WhatsAppConfigPublica | null>(null);
  const [erroCfg, setErroCfg] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    let ativo = true;
    apiJson<WhatsAppConfigPublica & { demo?: boolean }>("/api/whatsapp/config", "GET")
      .then((j) => { if (ativo && !j.demo) setCfg({ url: j.url, configurado: j.configurado }); })
      .catch((e) => { if (ativo) setErroCfg(e instanceof Error ? e.message : "Falha ao carregar."); });
    return () => { ativo = false; };
  }, [demo]);

  if (demo) {
    return (
      <div style={css(card + " padding:40px 24px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px;")}>
        <div style={css("font-size:15px; font-weight:800; color:#1B1B28;")}>WhatsApp</div>
        <div style={css("font-size:13px; color:#9398A6; max-width:420px; line-height:1.5;")}>A conexão com o WhatsApp (Uazapi) e os grupos de notificação funcionam com o Supabase ligado. No modo demo não há onde guardar as credenciais.</div>
      </div>
    );
  }

  return (
    <div style={css("display:flex; flex-direction:column; gap:14px;")}>
      {erroCfg && <Erro msg={erroCfg} />}
      <div className="m-stack" style={css("display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:stretch;")}>
        <Credenciais cfg={cfg} onSaved={setCfg} />
        <Conexao configurado={!!cfg?.configurado} />
      </div>
      <Grupos configurado={!!cfg?.configurado} />
    </div>
  );
}

/** Credenciais da Uazapi: URL + token (write-only). */
function Credenciais({ cfg, onSaved }: { cfg: WhatsAppConfigPublica | null; onSaved: (c: WhatsAppConfigPublica) => void }) {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [ver, setVer] = useState(false);
  const [estado, setEstado] = useState<"idle" | "salvando" | "salvo">("idle");
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { if (cfg) setUrl(cfg.url); }, [cfg]);
  const configurado = !!cfg?.configurado;
  const mudou = !!token.trim() || url.trim().replace(/\/+$/, "") !== (cfg?.url ?? "");
  const salvar = async () => {
    setErro(null);
    if (!url.trim()) { setErro("Informe a URL da API."); return; }
    if (!configurado && !token.trim()) { setErro("Informe o token da instância."); return; }
    setEstado("salvando");
    try {
      const j = await apiJson<WhatsAppConfigPublica>("/api/whatsapp/config", "POST", { url: url.trim(), ...(token.trim() ? { token: token.trim() } : {}) });
      onSaved({ url: j.url, configurado: j.configurado }); setToken(""); setEstado("salvo"); setTimeout(() => setEstado("idle"), 2000);
    } catch (e) { setEstado("idle"); setErro(e instanceof Error ? e.message : "Falha ao salvar."); }
  };
  const off = !mudou || estado === "salvando";
  return (
    <div style={css(card + " display:flex; flex-direction:column;")}>
      <Cabecalho titulo="Credenciais da API" sub="Conexão com a Uazapi" icone={<Svg size={18} sw={2}><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3-3.5 3.5z" /></Svg>}>
        <Pill on={configurado} onLabel="Configurado" offLabel="Pendente" />
        <Hoverable as="button" onClick={off ? undefined : salvar} s={css(`flex:none; border:none; cursor:${off ? "default" : "pointer"}; font-size:13px; font-weight:700; padding:9px 18px; border-radius:9px; background:${estado === "salvo" ? "#E7F6EE" : off ? "#EDEEF2" : "#1B1B28"}; color:${estado === "salvo" ? "#1B7F4D" : off ? "#9398A6" : "#fff"};`)} hover={off ? undefined : "background:#000"}>{estado === "salvo" ? "Salvo" : estado === "salvando" ? "Salvando…" : "Salvar"}</Hoverable>
      </Cabecalho>
      <div style={css("padding:16px 20px; display:flex; flex-direction:column; gap:14px; flex:1;")}>
        <div>
          <label style={lbl}>URL da API</label>
          <input value={url} onChange={(e) => { setUrl(e.target.value); setErro(null); }} placeholder="https://sua-instancia.uazapi.com" style={{ ...inp, ...mono, fontSize: 12.5 }} />
        </div>
        <div>
          <label style={lbl}>Token da instância</label>
          <div style={css("position:relative;")}>
            <input type={ver ? "text" : "password"} autoComplete="off" value={token} onChange={(e) => { setToken(e.target.value); setErro(null); }} placeholder={configurado ? "•••••••• (mantido — digite para trocar)" : "Token da instância"} style={{ ...inp, ...mono, fontSize: 12.5, paddingRight: 40 }} />
            <Hoverable as="button" type="button" tabIndex={-1} onClick={() => setVer((v) => !v)} title={ver ? "Ocultar" : "Mostrar"} s={css("position:absolute; right:6px; top:50%; transform:translateY(-50%); width:28px; height:28px; border:none; background:transparent; cursor:pointer; color:#9398A6; display:flex; align-items:center; justify-content:center; border-radius:7px;")} hover="background:#F4F4F7">
              <Svg size={15} sw={2}>{ver ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1A10.9 10.9 0 0 1 12 5c5 0 9 4 10 7a11.6 11.6 0 0 1-3 4.3M6.6 6.6C4.4 8 2.8 10 2 12c1 3 5 7 10 7 1.5 0 2.9-.3 4.1-.9" /></> : <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}</Svg>
            </Hoverable>
          </div>
        </div>
        {erro && <div style={css("font-size:12.5px; color:#CC3338; font-weight:600;")}>{erro}</div>}
        <p style={nota}>O token fica só no servidor e nunca volta para o navegador. Os dados vêm do painel da sua instância na Uazapi (<a href="https://docs.uazapi.com/" target="_blank" rel="noreferrer" style={css(`color:${BRAND}; font-weight:700;`)}>docs.uazapi.com</a>).</p>
      </div>
    </div>
  );
}

const POLL_MS = 5000;
const POLL_MAX = 24;

/** Conexão do número: status ao vivo, QR Code para conectar, desconectar. */
function Conexao({ configurado }: { configurado: boolean }) {
  const [conectado, setConectado] = useState(false);
  const [telefone, setTelefone] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [checado, setChecado] = useState(false);
  const [confirmDesc, setConfirmDesc] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollN = useRef(0);

  const pararPoll = useCallback(() => { if (poll.current) clearInterval(poll.current); poll.current = null; pollN.current = 0; }, []);

  const status = useCallback(async () => {
    try {
      const d = await instanciaAcao("status");
      const on = uazapiConectada(d);
      setConectado(on); setTelefone(extrairTelefone(d)); setErro(null);
      if (on) { setQr(null); pararPoll(); }
      return on;
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao consultar a instância."); return false; }
    finally { setChecado(true); }
  }, [pararPoll]);

  useEffect(() => {
    if (!configurado) { setChecado(true); return; }
    void status();
    return () => pararPoll();
  }, [configurado, status, pararPoll]);

  const conectar = async () => {
    setBusy(true); setErro(null);
    try {
      const d = await instanciaAcao("connect");
      const codigo = extrairQr(d);
      if (uazapiConectada(d)) { setConectado(true); setQr(null); }
      else if (codigo) {
        setQr(codigo);
        pararPoll();
        poll.current = setInterval(async () => {
          pollN.current += 1;
          const on = await status();
          if (on || pollN.current >= POLL_MAX) { pararPoll(); if (!on) setQr(null); }
        }, POLL_MS);
      } else setErro("A Uazapi não devolveu um QR Code. Tente de novo em alguns segundos.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao conectar."); }
    finally { setBusy(false); }
  };

  const desconectar = async () => {
    setBusy(true); setErro(null);
    try { await instanciaAcao("disconnect"); setConectado(false); setTelefone(null); setQr(null); pararPoll(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao desconectar."); }
    finally { setBusy(false); }
  };

  return (
    <div style={css(card + " display:flex; flex-direction:column;")}>
      <Cabecalho titulo="Número conectado" sub={conectado ? `WhatsApp ${telefone ? `+${telefone.replace(/\D/g, "")}` : "conectado"} — envia os avisos dos grupos` : "Conecte o número que vai enviar os avisos"} cor={WA} icone={<Svg size={18} sw={2}><path d="M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.5A9 9 0 1 1 21 12z" /><path d="M9 10a4 4 0 0 0 5 5l1-1-2-1-1 1a3 3 0 0 1-2-2l1-1-1-2z" /></Svg>}>
        <Pill on={conectado} onLabel="Conectado" offLabel={configurado ? "Desconectado" : "Sem credenciais"} />
      </Cabecalho>
      <div style={css("padding:16px 20px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:12px; flex:1; justify-content:center;")}>
        {!configurado ? (
          <p style={nota}>Salve a URL e o token da Uazapi ao lado para conectar o número.</p>
        ) : conectado ? (
          <>
            <span style={css(`width:64px; height:64px; border-radius:50%; background:${WA}; color:#fff; display:flex; align-items:center; justify-content:center;`)}><Svg size={30} sw={2.6}><path d="M4 12.6 9.2 18 20 6.6" /></Svg></span>
            <div style={css("font-size:13.5px; font-weight:700; color:#1B1B28;")}>Pronto para enviar</div>
            <div style={css("display:flex; gap:8px;")}>
              <Hoverable as="button" onClick={busy ? undefined : status} s={css(btnGhost)} hover="background:#F4F4F7">Atualizar</Hoverable>
              <Hoverable as="button" onClick={busy ? undefined : () => setConfirmDesc(true)} s={css(btnGhost + "color:#CC3338;")} hover="background:#FDECEC">Desconectar</Hoverable>
            </div>
          </>
        ) : qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR Code do WhatsApp" style={css("width:220px; height:220px; border-radius:10px; border:1px solid #ECEDF1;")} />
            <span style={css("font-size:12px; font-weight:700; color:#1B7F4D; background:#E7F6EC; padding:3px 10px; border-radius:999px;")}>Aguardando leitura do QR…</span>
            <p style={{ ...nota, maxWidth: 300 }}>No celular: <b>WhatsApp → Aparelhos conectados → Conectar um aparelho</b> e escaneie o código.</p>
            <Hoverable as="button" onClick={busy ? undefined : conectar} s={css(btnGhost)} hover="background:#F4F4F7">{busy ? "Gerando…" : "Gerar novo QR Code"}</Hoverable>
          </>
        ) : (
          <>
            <span style={css("width:120px; height:120px; border-radius:12px; border:1px dashed #D6D7DE; background:#FAFAFB; display:flex; align-items:center; justify-content:center; color:#C7CAD2;")}><Svg size={44} sw={1.4}><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM18 18h3v3h-3z" /></Svg></span>
            <p style={{ ...nota, maxWidth: 300 }}>{checado ? "Gere o QR Code e escaneie no WhatsApp do celular para conectar o número." : "Consultando a instância…"}</p>
            <Hoverable as="button" onClick={busy ? undefined : conectar} s={css(`display:inline-flex; align-items:center; gap:7px; border:none; cursor:pointer; background:${WA}; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:10px; opacity:${busy ? 0.6 : 1};`)} hover="filter:brightness(1.08)">{busy ? "Gerando…" : "Gerar QR Code"}</Hoverable>
          </>
        )}
        {erro && <Erro msg={erro} />}
      </div>
      {confirmDesc && (
        <ConfirmModal titulo="Desconectar WhatsApp" mensagem="O número deixa de enviar os avisos dos grupos até ser conectado de novo pelo QR Code. Continuar?" confirmLabel="Desconectar" danger onConfirm={() => { setConfirmDesc(false); void desconectar(); }} onClose={() => setConfirmDesc(false)} />
      )}
    </div>
  );
}

/** Grupos que recebem as notificações. */
function Grupos({ configurado }: { configurado: boolean }) {
  const [grupos, setGrupos] = useState<GrupoWhatsApp[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [jid, setJid] = useState("");
  const [setoresNovo, setSetoresNovo] = useState<SetorGrupo[]>([SETOR_PADRAO]);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<GrupoWhatsApp | null>(null);
  const multiSetor = SETORES_GRUPO.length > 1;

  useEffect(() => {
    let ativo = true;
    apiJson<{ grupos: GrupoWhatsApp[] }>("/api/whatsapp/grupos", "GET").then((j) => { if (ativo) setGrupos(j.grupos ?? []); }).catch((e) => { if (ativo) { setGrupos([]); setErro(e instanceof Error ? e.message : "Erro ao carregar os grupos."); } });
    return () => { ativo = false; };
  }, []);

  const flash = (m: string) => { setAviso(m); setTimeout(() => setAviso(null), 2400); };

  const criar = async () => {
    setErro(null); setSalvando(true);
    try {
      const j = await apiJson<{ grupo: GrupoWhatsApp }>("/api/whatsapp/grupos", "POST", { nome, grupo_id: jid, setores: setoresNovo });
      setGrupos((g) => [...(g ?? []), j.grupo]); setNome(""); setJid(""); setSetoresNovo([SETOR_PADRAO]); setCriando(false); flash("Grupo criado.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao criar o grupo."); }
    finally { setSalvando(false); }
  };

  const alternarAtivo = async (g: GrupoWhatsApp) => {
    setGrupos((l) => (l ?? []).map((x) => (x.id === g.id ? { ...x, ativo: !x.ativo } : x)));
    try { await apiJson("/api/whatsapp/grupos", "PATCH", { id: g.id, ativo: !g.ativo }); }
    catch { setGrupos((l) => (l ?? []).map((x) => (x.id === g.id ? { ...x, ativo: g.ativo } : x))); setErro("Não consegui salvar. Tente de novo."); }
  };

  const alternarSetor = async (g: GrupoWhatsApp, setor: SetorGrupo) => {
    const atuais = g.setores ?? [SETOR_PADRAO];
    const tem = atuais.includes(setor);
    if (tem && atuais.length === 1) { setErro("O grupo precisa de pelo menos um assunto. Para parar de receber, use o interruptor."); return; }
    const novos = tem ? atuais.filter((s) => s !== setor) : [...atuais, setor];
    setErro(null);
    setGrupos((l) => (l ?? []).map((x) => (x.id === g.id ? { ...x, setores: novos } : x)));
    try { await apiJson("/api/whatsapp/grupos", "PATCH", { id: g.id, setores: novos }); }
    catch { setGrupos((l) => (l ?? []).map((x) => (x.id === g.id ? { ...x, setores: atuais } : x))); setErro("Não consegui salvar. Tente de novo."); }
  };

  const excluir = async (g: GrupoWhatsApp) => {
    const antes = grupos ?? [];
    setGrupos(antes.filter((x) => x.id !== g.id));
    try { await apiJson(`/api/whatsapp/grupos?id=${encodeURIComponent(g.id)}`, "DELETE"); flash("Grupo excluído."); }
    catch { setGrupos(antes); setErro("Falha ao excluir."); }
  };

  const testar = async (g: GrupoWhatsApp) => {
    setErro(null); setTestando(g.id);
    try { await apiJson("/api/whatsapp/grupos", "POST", { acao: "testar", grupo_id: g.grupo_id }); flash("Mensagem de teste enviada."); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao enviar o teste."); }
    finally { setTestando(null); }
  };

  const Chip = ({ s, on, onClick }: { s: (typeof SETORES_GRUPO)[number]; on: boolean; onClick: () => void }) => (
    <Hoverable as="button" type="button" title={s.descricao} onClick={onClick} s={css(`display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; padding:3px 10px; border-radius:999px; cursor:pointer; border:1px solid ${on ? "transparent" : "#E2E3E9"}; background:${on ? `${BRAND}1A` : "#fff"}; color:${on ? BRAND : "#9398A6"};`)} hover={on ? undefined : "background:#FAFAFB"}>
      <span style={css(`width:6px; height:6px; border-radius:50%; background:${on ? BRAND : "#D6D7DE"};`)} />{s.label}
    </Hoverable>
  );

  return (
    <div style={css(card)}>
      <Cabecalho titulo="Grupos de notificação" sub="Grupos de WhatsApp que recebem os avisos automáticos (candidatura nova). Cole o ID do grupo (JID, terminado em @g.us) e use “Testar” para confirmar que a mensagem chega." icone={<Svg size={18} sw={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Svg>}>
        {aviso && <span style={css("font-size:12px; font-weight:700; color:#1B7F4D;")}>{aviso}</span>}
        {!criando && <Hoverable as="button" onClick={() => { setCriando(true); setErro(null); }} s={css(btnGhost)} hover="background:#F4F4F7"><Svg size={14} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>Novo grupo</Hoverable>}
      </Cabecalho>
      <div style={css("padding:16px 20px; display:flex; flex-direction:column; gap:12px;")}>
        {erro && <Erro msg={erro} />}
        {!configurado && <div style={css("font-size:12.5px; color:#B45309; background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:9px 12px; line-height:1.45;")}>Sem as credenciais da Uazapi nenhum aviso sai. Você pode cadastrar os grupos agora e conectar depois.</div>}
        {criando && (
          <div style={css("border:1px solid #E2E3E9; border-radius:12px; padding:14px 16px; background:#FAFAFB; display:flex; flex-direction:column; gap:12px;")}>
            <div className="m-grid-1" style={css("display:grid; grid-template-columns:1fr 1fr; gap:12px;")}>
              <div><label style={lbl}>Nome</label><input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: RH Ju Budelon" style={inp} /></div>
              <div><label style={lbl}>ID do grupo (JID)</label><input value={jid} onChange={(e) => setJid(e.target.value)} placeholder="120363296494803912@g.us" style={{ ...inp, ...mono, fontSize: 12.5 }} /></div>
            </div>
            {multiSetor && (
              <div>
                <label style={lbl}>Recebe avisos de</label>
                <div style={css("display:flex; gap:6px; flex-wrap:wrap;")}>{SETORES_GRUPO.map((s) => <Chip key={s.value} s={s} on={setoresNovo.includes(s.value)} onClick={() => setSetoresNovo((a) => (a.includes(s.value) ? a.filter((x) => x !== s.value) : [...a, s.value]))} />)}</div>
              </div>
            )}
            <p style={nota}>Como achar o JID: na Uazapi, a lista de grupos da instância mostra o ID de cada um; ou peça ao suporte da agência. Sem o sufixo <span style={mono}>@g.us</span> a mensagem é tratada como telefone e some.</p>
            <div style={css("display:flex; justify-content:flex-end; gap:8px;")}>
              <Hoverable as="button" onClick={() => { setCriando(false); setNome(""); setJid(""); setErro(null); }} s={css(btnGhost)} hover="background:#F4F4F7">Cancelar</Hoverable>
              <Hoverable as="button" onClick={salvando || nome.trim().length < 2 || !jid.trim() ? undefined : criar} s={css(`border:none; border-radius:9px; padding:9px 18px; font-size:13px; font-weight:700; color:#fff; cursor:pointer; background:${BRAND}; opacity:${salvando || nome.trim().length < 2 || !jid.trim() ? 0.5 : 1};`)} hover="filter:brightness(1.08)">{salvando ? "Salvando…" : "Salvar grupo"}</Hoverable>
            </div>
          </div>
        )}
        {grupos === null ? <div style={css("font-size:13px; color:#9398A6;")}>Carregando…</div> : grupos.length === 0 && !criando ? (
          <div style={css("padding:22px 12px; text-align:center; border:1px dashed #E2E3E9; border-radius:12px; color:#9398A6; font-size:13px;")}>Nenhum grupo cadastrado ainda.</div>
        ) : (
          <div style={css("display:flex; flex-direction:column; gap:8px;")}>
            {grupos.map((g) => (
              <div key={g.id} className="m-wrap" style={css(`display:flex; align-items:center; gap:12px; border:1px solid #ECEDF1; border-radius:12px; padding:11px 14px; ${g.ativo ? "" : "opacity:.75;"}`)}>
                <div style={css("flex:1; min-width:160px;")}>
                  <div style={css("font-size:13.5px; font-weight:700; color:#1B1B28;")}>{g.nome}</div>
                  <div style={{ ...css("font-size:11.5px; color:#9398A6; margin-top:2px; word-break:break-all;"), ...mono }}>{g.grupo_id}</div>
                  {multiSetor && <div style={css("display:flex; gap:6px; flex-wrap:wrap; margin-top:7px;")}>{SETORES_GRUPO.map((s) => <Chip key={s.value} s={s} on={(g.setores ?? []).includes(s.value)} onClick={() => alternarSetor(g, s.value)} />)}</div>}
                </div>
                <Pill on={g.ativo} onLabel="Recebendo" offLabel="Pausado" />
                <Hoverable as="button" role="switch" aria-checked={g.ativo} title={g.ativo ? "Pausar" : "Ligar"} onClick={() => alternarAtivo(g)} s={css(`flex:none; width:44px; height:24px; border-radius:999px; border:none; cursor:pointer; position:relative; background:${g.ativo ? "#1B7F4D" : "#D6D7DE"}; transition:background .15s;`)}>
                  <span style={css(`position:absolute; top:3px; left:${g.ativo ? 23 : 3}px; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.2); transition:left .15s;`)} />
                </Hoverable>
                <Hoverable as="button" title="Enviar mensagem de teste" onClick={testando ? undefined : () => testar(g)} s={css("width:32px; height:32px; flex:none; border:1px solid #E2E3E9; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#5B6472;")} hover="background:#F4F4F7">
                  {testando === g.id ? <span style={css("width:13px; height:13px; border:2px solid #E2E3E9; border-top-color:#5B6472; border-radius:50%; animation:spin .8s linear infinite;")} /> : <Svg size={14} sw={2}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></Svg>}
                </Hoverable>
                <Hoverable as="button" title="Excluir grupo" onClick={() => setConfirmDel(g)} s={css("width:32px; height:32px; flex:none; border:1px solid #E2E3E9; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#CC3338;")} hover="background:#FDF0F0"><Svg size={14}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></Svg></Hoverable>
              </div>
            ))}
          </div>
        )}
        <p style={nota}>Cadastrar aqui não faz o grupo receber nada sozinho: em <b>Recrutamento → Agente IA → Ferramentas</b> → “Avisar novo currículo no grupo” você escolhe quais destes grupos recebem o aviso. A mensagem leva nome, vaga, unidade e o link do candidato; o arquivo do currículo não vai, porque é documento pessoal.</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
      {confirmDel && (
        <ConfirmModal titulo="Excluir grupo" mensagem={<>Excluir <strong style={css("color:#1B1B28;")}>{confirmDel.nome}</strong>? Ele deixa de receber as notificações.</>} confirmLabel="Excluir" danger onConfirm={() => { const g = confirmDel; setConfirmDel(null); void excluir(g); }} onClose={() => setConfirmDel(null)} />
      )}
    </div>
  );
}
