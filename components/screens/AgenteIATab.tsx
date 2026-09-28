"use client";

import { useEffect, useState } from "react";
import { css } from "@/lib/css";
import { BRAND } from "@/lib/theme";
import { apiJson } from "@/lib/supabase-browser";
import {
  FERRAMENTAS_RECRUTAMENTO, MODELOS_RECRUTAMENTO, MODELO_RECRUTAMENTO_PADRAO,
  PDF_ENGINES, PDF_ENGINE_PADRAO, PROMPT_RECRUTAMENTO_PADRAO, type AgenteConfigPublica,
} from "@/lib/agente";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import { useApp } from "../store";

/**
 * Configurações → Agente IA. Mesmo desenho do CRM do Cachorrão HD (Agente IA → RECRUTAMENTO):
 * um agente que não conversa com ninguém — lê currículo, resume e classifica para a vaga —
 * com três abas: Prompt (instruções), LLM (token OpenRouter + modelo + motor de PDF) e
 * Ferramentas (interruptores das automações). Lê/grava em /api/agente/config; o token é
 * write-only (o servidor devolve só "configurado").
 */

type Sub = "prompt" | "llm" | "ferramentas";
const SUBS: { key: Sub; label: string }[] = [
  { key: "prompt", label: "Prompt" },
  { key: "llm", label: "LLM" },
  { key: "ferramentas", label: "Ferramentas" },
];

const card = "background:#fff; border:1px solid #ECEDF1; border-radius:14px; overflow:hidden;";
const inp = css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; font-size:13.5px; padding:9px 12px; outline:none;");
const lbl = css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;");
const nota = css("margin:0; font-size:12px; color:#9398A6; line-height:1.5;");

function Cabecalho({ titulo, sub, children }: { titulo: string; sub: string; children?: React.ReactNode }) {
  return (
    <div style={css("display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid #F4F5F7;")}>
      <span style={css(`flex:none; width:38px; height:38px; border-radius:10px; background:${BRAND}1A; color:${BRAND}; display:flex; align-items:center; justify-content:center;`)}>
        <Svg size={18} sw={2}><path d="M12 3l1.9 5.6H20l-4.8 3.5 1.8 5.6L12 14.3l-5 3.4 1.8-5.6L4 8.6h6.1z" /></Svg>
      </span>
      <div style={css("flex:1; min-width:0;")}>
        <div style={css("font-size:14.5px; font-weight:800; color:#1B1B28;")}>{titulo}</div>
        <div style={css("font-size:12.5px; color:#9398A6; margin-top:2px;")}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

function BotaoSalvar({ onClick, estado, disabled }: { onClick: () => void; estado: "idle" | "salvando" | "salvo"; disabled?: boolean }) {
  const off = disabled || estado === "salvando";
  return (
    <Hoverable as="button" onClick={off ? undefined : onClick} s={css(`flex:none; border:none; cursor:${off ? "default" : "pointer"}; font-size:13px; font-weight:700; padding:9px 18px; border-radius:9px; background:${estado === "salvo" ? "#E7F6EE" : off ? "#EDEEF2" : "#1B1B28"}; color:${estado === "salvo" ? "#1B7F4D" : off ? "#9398A6" : "#fff"};`)} hover={off ? undefined : "background:#000"}>
      {estado === "salvo" ? "Salvo" : estado === "salvando" ? "Salvando…" : "Salvar"}
    </Hoverable>
  );
}

export default function AgenteIATab() {
  const { demo } = useApp();
  const [sub, setSub] = useState<Sub>("prompt");
  const [cfg, setCfg] = useState<AgenteConfigPublica | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    let ativo = true;
    apiJson<AgenteConfigPublica & { demo?: boolean }>("/api/agente/config", "GET")
      .then((j) => { if (ativo && !j.demo) setCfg(j); })
      .catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : "Falha ao carregar."); });
    return () => { ativo = false; };
  }, [demo]);

  const salvar = async (body: Record<string, unknown>) => {
    const j = await apiJson<AgenteConfigPublica & { ok: boolean }>("/api/agente/config", "POST", body);
    setCfg(j);
  };

  if (demo) {
    return (
      <div style={css(card + " padding:40px 24px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px;")}>
        <div style={css("font-size:15px; font-weight:800; color:#1B1B28;")}>Agente IA</div>
        <div style={css("font-size:13px; color:#9398A6; max-width:420px; line-height:1.5;")}>A análise de currículos por IA funciona com o Supabase ligado. No modo demo não há onde guardar o token do OpenRouter nem currículos no Storage.</div>
      </div>
    );
  }

  return (
    <div style={css("display:flex; flex-direction:column; gap:14px;")}>
      {/* Cabeçalho do agente + sub-abas */}
      <div style={css("display:flex; align-items:center; gap:14px; flex-wrap:wrap;")}>
        <div style={css("display:flex; align-items:center; gap:10px;")}>
          <span style={css(`width:34px; height:34px; border-radius:10px; background:${BRAND}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800;`)}>IA</span>
          <div>
            <div style={css("font-size:14px; font-weight:800; color:#1B1B28;")}>RECRUTAMENTO</div>
            <div style={css("font-size:12px; color:#9398A6;")}>Lê o currículo, resume e classifica o candidato para a vaga</div>
          </div>
          {cfg && (
            <span style={css(`margin-left:6px; display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:11.5px; font-weight:700; background:${cfg.configurado ? "#E7F6EC" : "#F1F2F5"}; color:${cfg.configurado ? "#1B7F4D" : "#8A90A0"};`)}>
              <span style={css(`width:7px; height:7px; border-radius:50%; background:${cfg.configurado ? "#1B7F4D" : "#B6BAC4"};`)} />{cfg.configurado ? "Configurado" : "Sem token"}
            </span>
          )}
        </div>
        <span style={{ flex: 1 }} />
        <div style={css("display:inline-flex; gap:3px; background:#EDEEF2; border-radius:11px; padding:3px;")}>
          {SUBS.map((s) => {
            const active = sub === s.key;
            return <button key={s.key} onClick={() => setSub(s.key)} style={css(`border:none; cursor:pointer; font-size:13px; font-weight:600; padding:7px 16px; border-radius:8px; background:${active ? "#fff" : "transparent"}; color:${active ? "#1B1B28" : "#5B6472"}; box-shadow:${active ? "0 1px 2px rgba(16,24,40,.10)" : "none"};`)}>{s.label}</button>;
          })}
        </div>
      </div>

      {erro && <div style={css("font-size:12.5px; font-weight:600; color:#B42318; background:#FEF3F2; border:1px solid #FECDCA; border-radius:10px; padding:9px 12px;")}>{erro}</div>}
      {!cfg && !erro && <div style={css("font-size:13px; color:#9398A6; padding:6px 2px;")}>Carregando…</div>}

      {cfg && sub === "prompt" && <PromptSub cfg={cfg} onSave={salvar} />}
      {cfg && sub === "llm" && <LLMSub cfg={cfg} onSave={salvar} />}
      {cfg && sub === "ferramentas" && <FerramentasSub cfg={cfg} onSave={salvar} />}
    </div>
  );
}

/** Aba Prompt: instruções que a IA segue. O formato JSON da resposta é fixo no código. */
function PromptSub({ cfg, onSave }: { cfg: AgenteConfigPublica; onSave: (b: Record<string, unknown>) => Promise<void> }) {
  const [prompt, setPrompt] = useState(cfg.prompt || PROMPT_RECRUTAMENTO_PADRAO);
  const [estado, setEstado] = useState<"idle" | "salvando" | "salvo">("idle");
  const [erro, setErro] = useState<string | null>(null);
  const ehPadrao = prompt.trim() === PROMPT_RECRUTAMENTO_PADRAO.trim();
  const mudou = prompt.trim() !== (cfg.prompt || PROMPT_RECRUTAMENTO_PADRAO).trim();
  const salvar = async () => {
    setEstado("salvando"); setErro(null);
    try { await onSave({ prompt: ehPadrao ? "" : prompt }); setEstado("salvo"); setTimeout(() => setEstado("idle"), 2000); }
    catch (e) { setEstado("idle"); setErro(e instanceof Error ? e.message : "Falha ao salvar."); }
  };
  return (
    <div style={css(card)}>
      <Cabecalho titulo="Instruções da análise" sub="Como a IA deve ler o currículo e dar a nota para a vaga.">
        <Hoverable as="button" title="Restaurar o texto padrão" onClick={() => setPrompt(PROMPT_RECRUTAMENTO_PADRAO)} s={css("flex:none; width:34px; height:34px; border:1px solid #E2E3E9; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#5B6472;")} hover="background:#F4F4F7">
          <Svg size={15} sw={2.2}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></Svg>
        </Hoverable>
        <BotaoSalvar onClick={salvar} estado={estado} disabled={!mudou} />
      </Cabecalho>
      <div style={css("padding:16px 20px; display:flex; flex-direction:column; gap:10px;")}>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={18} style={{ ...inp, resize: "vertical", lineHeight: 1.55, fontFamily: "inherit" }} />
        {erro && <div style={css("font-size:12.5px; color:#CC3338; font-weight:600;")}>{erro}</div>}
        <p style={nota}>
          A análise aparece no detalhe do candidato, em <b>Banco de Talentos</b>, e alimenta a coluna <b>Nota IA</b>. O <b>formato da resposta</b> (resumo, nota 0–100, Ótimo/Bom/Ruim, justificativa, lacunas) é fixo no código e vai anexado a este texto — editar aqui não quebra a leitura do resultado. Vale manter a instrução de usar só o que está escrito no documento: sem ela o modelo preenche lacuna inventando. E a linha que proíbe comentar idade, gênero ou aparência existe de propósito: isso alimenta decisão de contratação.
        </p>
      </div>
    </div>
  );
}

/** Aba LLM: token do OpenRouter (write-only), modelo e motor de leitura de PDF. */
function LLMSub({ cfg, onSave }: { cfg: AgenteConfigPublica; onSave: (b: Record<string, unknown>) => Promise<void> }) {
  const [token, setToken] = useState("");
  const [modelo, setModelo] = useState(cfg.modelo || MODELO_RECRUTAMENTO_PADRAO);
  const [engine, setEngine] = useState(cfg.engine || PDF_ENGINE_PADRAO);
  const [estado, setEstado] = useState<"idle" | "salvando" | "salvo">("idle");
  const [erro, setErro] = useState<string | null>(null);
  const modeloConhecido = MODELOS_RECRUTAMENTO.find((m) => m.id === modelo);
  const engineAtual = PDF_ENGINES.find((e) => e.value === engine);
  const mudou = !!token.trim() || modelo.trim() !== cfg.modelo || engine !== cfg.engine;
  const salvar = async () => {
    if (!token.trim() && !cfg.configurado) { setErro("Informe o token do OpenRouter."); return; }
    if (!modelo.trim()) { setErro("Informe o modelo."); return; }
    setEstado("salvando"); setErro(null);
    try {
      await onSave({ modelo: modelo.trim(), engine, ...(token.trim() ? { token: token.trim() } : {}) });
      setToken(""); setEstado("salvo"); setTimeout(() => setEstado("idle"), 2000);
    } catch (e) { setEstado("idle"); setErro(e instanceof Error ? e.message : "Falha ao salvar."); }
  };
  const selBox = (open: boolean) => css(`display:flex; align-items:center; gap:8px; width:100%; box-sizing:border-box; border:1px solid ${open ? "#D6D7DE" : "#E2E3E9"}; border-radius:9px; font-size:13.5px; padding:9px 12px; cursor:pointer; background:#fff; text-align:left;`);
  return (
    <div style={css(card)}>
      <Cabecalho titulo="LLM do recrutamento" sub="Conta do OpenRouter e modelo que lê o currículo e escreve a análise.">
        <BotaoSalvar onClick={salvar} estado={estado} disabled={!mudou} />
      </Cabecalho>
      <div style={css("padding:16px 20px; display:flex; flex-direction:column; gap:16px;")}>
        <div>
          <div style={css("display:flex; align-items:center; gap:10px; margin-bottom:6px;")}>
            <label style={{ ...lbl, marginBottom: 0 }}>Token do OpenRouter</label>
            <span style={css(`display:inline-flex; align-items:center; gap:6px; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:700; background:${cfg.configurado ? "#E7F6EC" : "#F1F2F5"}; color:${cfg.configurado ? "#1B7F4D" : "#8A90A0"};`)}>{cfg.configurado ? "Configurado" : "Não configurado"}</span>
          </div>
          <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={cfg.configurado ? "•••••••• (mantido — digite para trocar)" : "sk-or-v1-…"} style={{ ...inp, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" }} />
          <p style={{ ...nota, marginTop: 6 }}>A chave fica só no servidor e nunca volta para o navegador. Crie em <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={css(`color:${BRAND}; font-weight:700;`)}>openrouter.ai/keys</a>.</p>
        </div>
        <div className="m-grid-1" style={css("display:grid; grid-template-columns:1fr 1fr; gap:14px;")}>
          <div>
            <label style={lbl}>Modelo</label>
            <Menu width={360} trigger={(toggle, open) => (
              <Hoverable as="button" type="button" onClick={toggle} s={selBox(open)} hover="background:#FAFAFB">
                <span style={css("flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#1B1B28;")}>{modeloConhecido?.label ?? `Outro: ${modelo}`}</span>
                <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
              </Hoverable>
            )}>
              {(close) => MODELOS_RECRUTAMENTO.map((m) => (
                <MenuItem key={m.id} checked={m.id === modelo} onClick={() => { setModelo(m.id); close(); }}><span style={{ flex: 1, fontWeight: 600 }}>{m.label}</span></MenuItem>
              ))}
            </Menu>
            <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="ex.: google/gemini-2.5-flash" style={{ ...inp, marginTop: 8, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 12.5 }} />
            <p style={{ ...nota, marginTop: 6 }}>Precisa ser multimodal e aceitar saída em JSON: o currículo chega como PDF, mas também como foto do papel. <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer" style={css(`color:${BRAND}; font-weight:700;`)}>Ver modelos</a>.</p>
          </div>
          <div>
            <label style={lbl}>Leitura do PDF</label>
            <Menu width={260} trigger={(toggle, open) => (
              <Hoverable as="button" type="button" onClick={toggle} s={selBox(open)} hover="background:#FAFAFB">
                <span style={css("flex:1; color:#1B1B28;")}>{engineAtual?.label ?? engine}</span>
                <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
              </Hoverable>
            )}>
              {(close) => PDF_ENGINES.map((e) => (
                <MenuItem key={e.value} checked={e.value === engine} onClick={() => { setEngine(e.value); close(); }}><span style={{ flex: 1, fontWeight: 600 }}>{e.label}</span></MenuItem>
              ))}
            </Menu>
            <p style={{ ...nota, marginTop: 8 }}>{engineAtual?.custo}</p>
            <p style={{ ...nota, marginTop: 4 }}>Só vale para PDF. Currículo em imagem vai direto pela visão do modelo; DOCX vira texto no servidor.</p>
          </div>
        </div>
        {erro && <div style={css("font-size:12.5px; color:#CC3338; font-weight:600;")}>{erro}</div>}
      </div>
    </div>
  );
}

/** Aba Ferramentas: interruptores das automações do recrutamento. */
function FerramentasSub({ cfg, onSave }: { cfg: AgenteConfigPublica; onSave: (b: Record<string, unknown>) => Promise<void> }) {
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ligada = (k: string) => cfg.ferramentas[k] !== false;
  const alternar = async (k: string) => {
    setSalvando(k); setErro(null);
    try { await onSave({ ferramentas: { [k]: !ligada(k) } }); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setSalvando(null); }
  };
  return (
    <div style={css(card)}>
      <Cabecalho titulo="Automações do recrutamento" sub="O que o agente faz sozinho. Desligado, a ação continua disponível pelo botão no candidato." />
      <div>
        {FERRAMENTAS_RECRUTAMENTO.map((f, i) => {
          const on = ligada(f.key);
          return (
            <div key={f.key} style={css(`display:flex; align-items:flex-start; gap:16px; padding:16px 20px; ${i < FERRAMENTAS_RECRUTAMENTO.length - 1 ? "border-bottom:1px solid #F4F5F7;" : ""}`)}>
              <div style={css("flex:1; min-width:0;")}>
                <div style={css("font-size:14px; font-weight:600; color:#1B1B28;")}>{f.nome}</div>
                <div style={css("font-size:12.5px; color:#9398A6; margin-top:3px; line-height:1.5;")}>{f.descricao}</div>
              </div>
              <Hoverable as="button" role="switch" aria-checked={on} title={on ? "Desligar" : "Ligar"} onClick={salvando ? undefined : () => alternar(f.key)} s={css(`flex:none; width:44px; height:24px; border-radius:999px; border:none; cursor:pointer; position:relative; background:${on ? "#1B7F4D" : "#D6D7DE"}; opacity:${salvando === f.key ? 0.6 : 1}; transition:background .15s;`)}>
                <span style={css(`position:absolute; top:3px; left:${on ? 23 : 3}px; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.2); transition:left .15s;`)} />
              </Hoverable>
            </div>
          );
        })}
        {!cfg.configurado && <div style={css("padding:12px 20px; font-size:12.5px; color:#B45309; background:#FFFBEB; border-top:1px solid #FDE68A;")}>Sem token do OpenRouter (aba LLM) nenhuma automação roda: o candidato fica “Aguardando Análise”.</div>}
        {erro && <div style={css("padding:10px 20px; font-size:12.5px; color:#CC3338; font-weight:600;")}>{erro}</div>}
      </div>
    </div>
  );
}
