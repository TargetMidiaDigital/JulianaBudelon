"use client";

import { useEffect, useRef, useState } from "react";
import { pixelInit, pixelTrack } from "@/lib/pixel";
import { loadDb, saveDb, unidadeLabel, vagaLabel } from "@/lib/localdb";
import { normalizarWhatsapp } from "@/lib/format";
import type { LinkBioConfig, Talento, Unidade, Vaga, Workspace } from "@/lib/types";

/**
 * PÁGINA PÚBLICA "Trabalhe conosco" (link na bio), no mesmo desenho do linkbio do
 * Cachorrão HD: hub com um botão por unidade → página da unidade com um botão por
 * vaga → popup nome / WhatsApp / currículo → página de obrigado.
 *
 * Os dados vêm de /api/vagas/publico (só unidades ativas, vagas abertas e os textos) e
 * a candidatura vai para /api/vagas/candidatura, que grava o candidato com status
 * "novo" e o currículo no Storage. Sem Supabase (modo demo), a página lê e grava o
 * "banco" local do painel (localStorage).
 *
 * Pixel do Facebook (Recrutamento → Vagas → Página pública): PageView em todas as
 * páginas; Lead só no /obrigado, segmentado por vaga e unidade via query string.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const EXT_OK = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"];

/** O que a página precisa (mesmo formato nos dois modos). */
type Dados = { demo: boolean; unidades: Unidade[]; vagas: Vaga[]; linkbio: LinkBioConfig; workspace: Workspace };

async function carregarDados(): Promise<Dados> {
  try {
    const res = await fetch("/api/vagas/publico", { cache: "no-store" });
    const j = await res.json();
    if (res.ok && j && !j.demo) {
      return { demo: false, unidades: j.unidades ?? [], vagas: j.vagas ?? [], linkbio: j.pagina, workspace: { nome: j.empresa?.nome ?? "", logo: j.empresa?.logo ?? null } };
    }
  } catch { /* cai no modo demo */ }
  const d = loadDb();
  return { demo: true, unidades: d.unidades, vagas: d.vagas, linkbio: d.linkbio, workspace: d.workspace };
}

const CSS = `
.lb-body{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:40px 20px;box-sizing:border-box;color:#fff;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;background:radial-gradient(circle at 50% 32%,#A8697B 0%,#8B4F60 48%,#4E2B36 100%);background-attachment:fixed;-webkit-font-smoothing:antialiased}
.lb-card{width:100%;max-width:640px;text-align:center;opacity:0;transform:translateY(12px);transition:opacity .5s ease,transform .5s ease}
.lb-card.in{opacity:1;transform:translateY(0)}
.lb-logo{width:132px;height:132px;margin:0 auto 28px;border-radius:50%;background:#F5ABBA;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.18);overflow:hidden}
.lb-logo img{width:100%;height:100%;object-fit:cover}
.lb-title{font-weight:300;font-size:clamp(2rem,6vw,2.9rem);letter-spacing:.5px;line-height:1.15;margin:0 0 14px}
.lb-sub{font-weight:600;font-size:clamp(1rem,3.4vw,1.2rem);margin:0 0 30px;opacity:.97}
.lb-sub strong{font-weight:800}
.lb-links{display:flex;flex-direction:column;gap:16px;margin-bottom:30px}
.lb-btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;padding:20px 24px;background:#FFF6F8;color:#7A3F50;font-size:clamp(1rem,3.4vw,1.18rem);font-weight:700;text-decoration:none;border:none;border-radius:14px;box-shadow:0 6px 18px rgba(0,0,0,.16);transition:transform .18s ease,box-shadow .18s ease,background .18s ease;font-family:inherit;cursor:pointer;box-sizing:border-box}
.lb-btn:hover{transform:translateY(-3px);box-shadow:0 12px 26px rgba(0,0,0,.24);background:#fff}
.lb-btn:active{transform:translateY(-1px)}
.lb-pin{width:22px;height:22px;flex-shrink:0;fill:#955C6B}
.lb-note{width:100%;padding:20px 24px;margin-bottom:30px;background:rgba(255,255,255,.12);border:1px dashed rgba(255,255,255,.5);border-radius:14px;font-weight:700;font-size:clamp(1rem,3.2vw,1.12rem);line-height:1.45;box-sizing:border-box}
.lb-tag{font-weight:600;font-size:clamp(.95rem,3vw,1.1rem);line-height:1.5;margin:0 0 34px;opacity:.96}
.lb-handle{display:inline-block;color:#fff;font-weight:700;font-size:1rem;letter-spacing:.3px;text-decoration:none;opacity:.92}
.lb-handle:hover{opacity:1;text-decoration:underline}
.lb-back{display:inline-flex;align-items:center;gap:6px;margin-top:18px;color:#fff;opacity:.8;font-size:.9rem;font-weight:600;text-decoration:none}
.lb-back:hover{opacity:1}
.lb-check{width:96px;height:96px;margin:0 auto 26px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.2)}
.lb-check svg{width:52px;height:52px;fill:none;stroke:#fff;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}
@media (max-width:480px){.lb-logo{width:112px;height:112px}.lb-btn{padding:18px 20px}}
/* modal */
.lb-ov{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(50,15,25,.72);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.lb-modal{width:100%;max-width:460px;max-height:calc(100dvh - 40px);overflow-y:auto;padding:28px 26px 26px;background:#FFF6F8;color:#7A3F50;border-radius:18px;box-shadow:0 18px 48px rgba(0,0,0,.38);text-align:left;position:relative;box-sizing:border-box}
.lb-close{position:absolute;top:14px;right:14px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:rgba(122,63,80,.08);color:#7A3F50;border:none;border-radius:50%;font-size:1.35rem;line-height:1;cursor:pointer}
.lb-close:hover{background:rgba(122,63,80,.18)}
.lb-mhead{margin-bottom:20px;padding-right:40px}
.lb-mtitle{font-size:1.32rem;font-weight:800;line-height:1.25;margin:0 0 6px}
.lb-msub{font-size:.92rem;font-weight:600;line-height:1.4;opacity:.72;margin:0}
.lb-field{margin-bottom:16px}
.lb-field label{display:block;margin-bottom:6px;font-size:.9rem;font-weight:700}
.lb-field input[type=text],.lb-field input[type=tel]{width:100%;box-sizing:border-box;padding:13px 14px;font-family:inherit;font-size:1rem;font-weight:600;color:#7A3F50;background:#fff;border:2px solid rgba(122,63,80,.16);border-radius:11px;transition:border-color .18s ease}
.lb-field input:focus{outline:none;border-color:#955C6B}
.lb-field input.err{border-color:#d32f2f}
.lb-file{display:flex;align-items:center;gap:11px;width:100%;box-sizing:border-box;padding:15px 14px;background:#fff;border:2px dashed rgba(122,63,80,.3);border-radius:11px;font-size:.94rem;font-weight:700;cursor:pointer;transition:border-color .18s ease,background .18s ease}
.lb-file:hover{border-color:#955C6B;background:#fffdf8}
.lb-file.has{border-style:solid;border-color:#25d366}
.lb-file.err{border-color:#d32f2f}
.lb-file svg{width:21px;height:21px;flex-shrink:0;fill:currentColor;opacity:.65}
.lb-file span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-hint{margin:6px 0 0;font-size:.79rem;font-weight:600;line-height:1.35;opacity:.6}
.lb-err{margin:6px 0 0;font-size:.82rem;font-weight:700;color:#c62828}
.lb-submit{width:100%;margin-top:6px;padding:17px 20px;font-family:inherit;font-size:1.06rem;font-weight:800;color:#fff;background:#955C6B;border:none;border-radius:12px;cursor:pointer;transition:background .18s ease,transform .15s ease}
.lb-submit:hover:not(:disabled){background:#7E4A59;transform:translateY(-2px)}
.lb-submit:disabled{opacity:.62;cursor:not-allowed;transform:none}
.lb-gerr{margin-top:14px;padding:12px 14px;background:rgba(198,40,40,.1);border:1px solid rgba(198,40,40,.35);border-radius:10px;font-size:.87rem;font-weight:700;color:#c62828;line-height:1.4}
@media (max-width:480px){.lb-modal{padding:24px 20px 22px}.lb-mtitle{font-size:1.18rem}}
`;

const Pin = () => (
  <svg className="lb-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C7.96 2 4.5 5.18 4.5 9.25c0 4.86 6.1 11.74 6.86 12.58a.86.86 0 0 0 1.28 0c.76-.84 6.86-7.72 6.86-12.58C19.5 5.18 16.04 2 12 2Zm0 10.2a2.95 2.95 0 1 1 0-5.9 2.95 2.95 0 0 1 0 5.9Z" /></svg>
);

function mascara(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length > 6) { const corte = d.length > 10 ? 7 : 6; return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`; }
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d;
}

export default function LinkBio({ view, slug }: { view: "hub" | "unidade" | "obrigado"; slug?: string }) {
  const [db, setDb] = useState<Dados | null>(null);
  const [inAnim, setInAnim] = useState(false);
  const [vagaAberta, setVagaAberta] = useState<Vaga | null>(null);

  useEffect(() => {
    void carregarDados().then(setDb);
    requestAnimationFrame(() => setInAnim(true));
    document.title = view === "obrigado" ? "Candidatura enviada" : "Trabalhe conosco";
  }, [view]);

  // Pixel: inicia quando o ID estiver configurado e dispara os eventos desta página.
  const pixelFeito = useRef(false);
  useEffect(() => {
    const id = (db?.linkbio.pixelId ?? "").trim();
    if (!id || pixelFeito.current) return;
    pixelFeito.current = true;
    pixelInit(id);
    pixelTrack("PageView");
    if (view === "obrigado") {
      const q = new URLSearchParams(window.location.search);
      const dados: Record<string, string> = {};
      if (q.get("vaga")) dados.content_name = q.get("vaga")!;
      if (q.get("unidade")) dados.content_category = q.get("unidade")!;
      pixelTrack("Lead", dados);
    }
  }, [db, view]);

  const lb = db?.linkbio;
  const logo = db?.workspace.logo || "/logo.png";
  const empresa = db?.workspace.nome ?? "";
  const unidade: Unidade | undefined = view === "unidade" ? db?.unidades.find((u) => u.slug === slug) : undefined;
  const vagasUnidade: Vaga[] = unidade ? (db?.vagas ?? []).filter((v) => v.unidadeId === unidade.id && v.ativa) : [];
  // Hub: só unidades ativas com ao menos uma vaga aberta.
  const unidadesHub: Unidade[] = (db?.unidades ?? []).filter((u) => u.ativa && (db?.vagas ?? []).some((v) => v.unidadeId === u.id && v.ativa));

  const enviar = async (dados: { nome: string; whatsapp: string; arquivo: File }) => {
    if (!vagaAberta || !unidade || !db) return;
    if (db.demo) {
      // Modo demo: grava no "banco" local do painel (arquivo vira data-URL).
      const url = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error("leitura")); fr.readAsDataURL(dados.arquivo); });
      const atual = loadDb(); // relê: o painel pode ter gravado desde o load
      const t: Talento = {
        id: `tal-${Date.now()}`, nome: dados.nome, status: "novo",
        vaga: vagaAberta.titulo, vagaId: vagaAberta.id, unidadeId: unidade.id, turno: vagaAberta.turno, origem: "linkbio",
        fone: normalizarWhatsapp(dados.whatsapp), qualidade: "Aguardando Análise", criada: new Date().toISOString(),
        comentarios: [{ id: `c-${Date.now()}`, message: `Candidatura enviada pela página de vagas — ${vagaLabel(vagaAberta)} · ${unidadeLabel(unidade)}.`, author: "sistema", created_at: new Date().toISOString(), tipo: "log" }],
        anexos: [{ id: `a-${Date.now()}`, nome: dados.arquivo.name, url, mime: dados.arquivo.type || "application/octet-stream", tamanho: dados.arquivo.size, criadoEm: new Date().toISOString() }],
      };
      if (!saveDb({ ...atual, talentos: [t, ...atual.talentos] })) throw new Error("Não conseguimos enviar sua candidatura. Tente um arquivo menor ou tente de novo.");
    } else {
      const fd = new FormData();
      fd.append("nome", dados.nome);
      fd.append("whatsapp", dados.whatsapp);
      fd.append("vagaId", vagaAberta.id);
      fd.append("file", dados.arquivo);
      const res = await fetch("/api/vagas/candidatura", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Não conseguimos enviar sua candidatura. Tente de novo.");
    }
    const q = new URLSearchParams();
    q.set("vaga", vagaAberta.titulo);
    q.set("unidade", unidadeLabel(unidade));
    window.location.href = `/vagas/obrigado?${q.toString()}`;
  };

  return (
    <div className="lb-body">
      <style>{CSS}</style>
      <div className={`lb-card${inAnim ? " in" : ""}`}>
        {view === "obrigado" ? (
          <div className="lb-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.6 9.2 18 20 6.6" /></svg></div>
        ) : (
          <div className="lb-logo"><img src={logo} alt={empresa} /></div>
        )}

        {view === "hub" && (
          <>
            <h1 className="lb-title">{lb?.titulo ?? ""}</h1>
            <p className="lb-sub" dangerouslySetInnerHTML={{ __html: destacar(lb?.subtitulo ?? "") }} />
            {db && (unidadesHub.length ? (
              <nav className="lb-links">
                {unidadesHub.map((u) => (
                  <a key={u.id} className="lb-btn" href={`/vagas/${u.slug}`}><Pin /><span>{unidadeLabel(u)}</span></a>
                ))}
              </nav>
            ) : (
              <div className="lb-note">No momento, não estamos com vagas abertas.<br /><br />Fique de olho, em breve teremos novidades!</div>
            ))}
          </>
        )}

        {view === "unidade" && db && (
          <>
            <h1 className="lb-title">{lb?.titulo ?? ""}</h1>
            {unidade ? (
              <>
                <p className="lb-sub">Estamos contratando agora unidade <strong>{unidadeLabel(unidade).toUpperCase()}</strong>!</p>
                {unidade.ativa && vagasUnidade.length ? (
                  <nav className="lb-links">
                    {vagasUnidade.map((v) => (
                      <button key={v.id} type="button" className="lb-btn" onClick={() => setVagaAberta(v)}><span>Vaga — {vagaLabel(v)}</span></button>
                    ))}
                  </nav>
                ) : (
                  <div className="lb-note">No momento, não estamos com vagas abertas nesta unidade.<br /><br />Fique de olho, em breve teremos novidades!</div>
                )}
              </>
            ) : (
              <div className="lb-note">Unidade não encontrada.</div>
            )}
          </>
        )}

        {view === "obrigado" && (
          <>
            <h1 className="lb-title">Candidatura enviada!</h1>
            <p className="lb-sub">Recebemos seus dados e seu currículo. Agora é com a gente.</p>
            <div className="lb-note">Nossa equipe vai analisar seu perfil e, se houver encaixe, <strong>entra em contato pelo WhatsApp</strong> que você informou.<br /><br />Fique de olho no seu celular!</div>
          </>
        )}

        {db && (
          <>
            <p className="lb-tag">{view === "obrigado" ? `Obrigado por querer fazer parte do time ${empresa}` : lb?.tagline}</p>
            {lb?.instagram && <a className="lb-handle" href={`https://instagram.com/${lb.instagram}`} target="_blank" rel="noopener noreferrer">@{lb.instagram}</a>}
            {view === "unidade" && <div><a className="lb-back" href="/vagas">← Ver outras unidades</a></div>}
          </>
        )}
      </div>

      {vagaAberta && unidade && (
        <CandidaturaModal vaga={vagaAberta} unidade={unidade} onClose={() => setVagaAberta(null)} onEnviar={enviar} />
      )}
    </div>
  );
}

/** "Estamos contratando AGORA!" → a palavra em maiúsculas vira <strong>. */
function destacar(s: string): string {
  const esc = s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  return esc.replace(/\b([A-ZÀ-Ú]{3,})\b/g, "<strong>$1</strong>");
}

function CandidaturaModal({ vaga, unidade, onClose, onEnviar }: {
  vaga: Vaga; unidade: Unidade; onClose: () => void;
  onEnviar: (d: { nome: string; whatsapp: string; arquivo: File }) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [zap, setZap] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erros, setErros] = useState<{ nome?: string; whatsapp?: string; curriculo?: string; geral?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const inpNome = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => inpNome.current?.focus(), 120);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = antes; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const validar = () => {
    const e: typeof erros = {};
    if (nome.trim().length < 3) e.nome = "Informe seu nome completo.";
    const d = zap.replace(/\D/g, "");
    if (d.length < 10 || d.length > 11) e.whatsapp = "Informe o WhatsApp com DDD.";
    if (!arquivo) e.curriculo = "Anexe seu currículo.";
    else {
      const ext = (arquivo.name.split(".").pop() || "").toLowerCase();
      if (!EXT_OK.includes(ext)) e.curriculo = "Use PDF, DOC, DOCX, JPG, PNG ou WEBP.";
      else if (arquivo.size > MAX_BYTES) e.curriculo = "Arquivo acima de 3 MB.";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validar() || !arquivo) return;
    setEnviando(true);
    try {
      await onEnviar({ nome: nome.trim(), whatsapp: zap.trim(), arquivo });
    } catch (e) {
      setEnviando(false);
      setErros({ geral: e instanceof Error && e.message ? e.message : "Não conseguimos enviar sua candidatura. Tente um arquivo menor ou tente de novo." });
    }
  };

  return (
    <div className="lb-ov" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lb-modal">
        <div className="lb-mhead">
          <button type="button" className="lb-close" aria-label="Fechar" onClick={onClose}>&times;</button>
          <p className="lb-mtitle">Candidatura — {vaga.titulo}</p>
          <p className="lb-msub">{[unidadeLabel(unidade), vaga.turno].filter(Boolean).join(" · ")}</p>
        </div>
        <form noValidate onSubmit={submit}>
          <div className="lb-field">
            <label htmlFor="c-nome">Nome completo</label>
            <input ref={inpNome} id="c-nome" type="text" autoComplete="name" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} className={erros.nome ? "err" : ""} />
            {erros.nome && <p className="lb-err">{erros.nome}</p>}
          </div>
          <div className="lb-field">
            <label htmlFor="c-zap">WhatsApp</label>
            <input id="c-zap" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(48) 99999-9999" value={zap} onChange={(e) => setZap(mascara(e.target.value))} className={erros.whatsapp ? "err" : ""} />
            {erros.whatsapp && <p className="lb-err">{erros.whatsapp}</p>}
          </div>
          <div className="lb-field">
            <label htmlFor="c-cv">Currículo</label>
            <label className={`lb-file${arquivo ? " has" : ""}${erros.curriculo ? " err" : ""}`} htmlFor="c-cv">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5h2v5h10v-5h2ZM12 3l5 5h-3v6h-4V8H7l5-5Z" /></svg>
              <span>{arquivo ? arquivo.name : "Escolher arquivo"}</span>
            </label>
            <input id="c-cv" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            <p className="lb-hint">PDF, DOC, DOCX, JPG, PNG ou WEBP — até 3 MB.</p>
            {erros.curriculo && <p className="lb-err">{erros.curriculo}</p>}
          </div>
          <button type="submit" className="lb-submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar candidatura"}</button>
          {erros.geral && <p className="lb-gerr">{erros.geral}</p>}
        </form>
      </div>
    </div>
  );
}
