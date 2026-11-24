"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { BRAND } from "@/lib/theme";
import { corDoLocal } from "@/lib/estoque";
import { resumoHorario, useEncomendas, type DiaKey, type JanelaDia } from "@/lib/encomendas";
import type { Unidade } from "@/lib/types";
import { useApp } from "../store";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import ConfirmModal from "../ui/ConfirmModal";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Chave } from "../encomendas/CatalogoEditor";
import { EditorJanelas } from "../encomendas/ConfigEditor";

/**
 * Configurações → Lojas: o cadastro único das lojas. Cada loja aparece, conforme as chaves, em
 *  - Operação: Ordem de Serviço, Produção, Expedição, Lojas, Estoque, Indicadores e filtros;
 *  - Vagas: RH → Vagas e a página pública "Trabalhe conosco";
 *  - Retirada: a página de encomendas (com endereço e horário de funcionamento).
 * Loja com histórico não é excluída — desliga as chaves. O código (estoque/tarefas) e o link de vagas não mudam.
 */
export default function LojasConfig() {
  const { unidades, vagas, talentos, addUnidade, updateUnidade, removeUnidade } = useApp();
  const [editando, setEditando] = useState<Unidade | "nova" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<Unidade | null>(null);

  const ordenar = (a: Unidade, b: Unidade) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, "pt");
  const lojas = [...unidades].sort(ordenar);
  const nVagas = (u: Unidade) => vagas.filter((v) => v.unidadeId === u.id && v.ativa).length;
  const nCand = (u: Unidade) => talentos.filter((t) => t.unidadeId === u.id).length;
  // Excluir só loja sem nada: sem vagas, sem candidatos e fora da operação/retirada.
  const temHistorico = (u: Unidade) => !!u.operacao || !!u.retirada || vagas.some((v) => v.unidadeId === u.id) || nCand(u) > 0;
  const falhou = (e: string) => setAviso(`Não foi possível salvar: ${e}`);

  // Sobe/desce: renumera a ordem de todas as lojas (1, 2, 3…) e grava só as que mudaram.
  const mover = (u: Unidade, d: -1 | 1) => {
    const lista = [...lojas];
    const i = lista.findIndex((x) => x.id === u.id), j = i + d;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    lista.forEach((x, k) => { if ((x.ordem ?? 0) !== k + 1) updateUnidade(x.id, { ordem: k + 1 }, falhou); });
  };

  return (
    <div style={css("max-width:880px; display:flex; flex-direction:column; gap:14px;")}>
      <div className="m-wrap" style={css("display:flex; align-items:flex-start; gap:12px;")}>
        <p style={css("margin:0; flex:1; min-width:240px; font-size:13px; color:#5B6472; line-height:1.55;")}>
          Cadastro único das lojas. Cada loja aparece no sistema conforme as chaves: <b>Operação</b> (Ordem de Serviço, Produção, Expedição, Estoque, Indicadores e filtros), <b>Vagas</b> (RH e a página “Trabalhe conosco”) e <b>Retirada</b> (página de encomendas).
        </p>
        <Hoverable as="button" onClick={() => setEditando("nova")} s={css(`flex:none; display:inline-flex; align-items:center; gap:7px; border:none; cursor:pointer; background:${BRAND}; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:10px;`)} hover="filter:brightness(1.12)">
          <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>Nova loja
        </Hoverable>
      </div>
      {aviso && (
        <div role="alert" style={css("display:flex; gap:10px; align-items:center; font-size:13px; font-weight:600; color:#B42318; background:#FEF3F2; border:1px solid #FECDCA; border-radius:11px; padding:10px 12px;")}>
          <span style={{ flex: 1 }}>{aviso}</span>
          <button onClick={() => setAviso(null)} style={css("border:none; background:transparent; color:#B42318; font-weight:800; cursor:pointer;")}>Fechar</button>
        </div>
      )}

      {lojas.map((u, i) => (
        <LinhaLoja key={u.id} u={u} vagasAbertas={nVagas(u)} candidatos={nCand(u)}
          primeira={i === 0} ultima={i === lojas.length - 1} onMover={(d) => mover(u, d)} onEditar={() => setEditando(u)}
          onExcluir={temHistorico(u) ? undefined : () => setExcluir(u)} />
      ))}
      {lojas.length === 0 && <div style={css("padding:20px; text-align:center; color:#9398A6; font-size:13px;")}>Nenhuma loja cadastrada.</div>}

      {editando && (
        <LojaForm
          loja={editando === "nova" ? null : editando}
          onClose={() => setEditando(null)}
          onSalvar={(dados) => {
            if (editando === "nova") addUnidade(dados, falhou);
            else updateUnidade(editando.id, dados, falhou);
            setEditando(null);
          }}
        />
      )}
      {excluir && (
        <ConfirmModal danger titulo="Excluir loja" confirmLabel="Excluir"
          mensagem={<>Excluir <strong style={css("color:#1B1B28;")}>{excluir.nome}</strong>? Ela não tem vagas nem candidatos e está fora da operação e da retirada.</>}
          onConfirm={() => { removeUnidade(excluir.id, falhou); setExcluir(null); }} onClose={() => setExcluir(null)} />
      )}
    </div>
  );
}

function Selo({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span style={css(`display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; padding:3px 9px; border-radius:999px; background:${on ? "#E7F6EE" : "#F2F3F6"}; color:${on ? "#1B7F4D" : "#9398A6"};`)}>
      <span style={css(`width:6px; height:6px; border-radius:50%; background:${on ? "#16A34A" : "#C4C7D0"};`)} />{children}
    </span>
  );
}

function BotaoIcone({ titulo, off, onClick, children }: { titulo: string; off?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Hoverable as="button" title={titulo} aria-label={titulo} onClick={off ? undefined : onClick} {...{ disabled: off }}
      s={css(`width:30px; height:30px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#7A8090; cursor:${off ? "default" : "pointer"}; opacity:${off ? 0.35 : 1};`)}
      hover={off ? undefined : "background:#F4F4F7"}>
      <Svg size={14} sw={2.2}>{children}</Svg>
    </Hoverable>
  );
}

function LinhaLoja({ u, vagasAbertas, candidatos, primeira, ultima, onMover, onEditar, onExcluir }: {
  u: Unidade; vagasAbertas: number; candidatos: number; primeira?: boolean; ultima?: boolean;
  onMover?: (d: -1 | 1) => void; onEditar: () => void; onExcluir?: () => void;
}) {
  return (
    <div style={css(`background:#fff; border:1px solid #ECEDF1; border-left:3px solid ${u.codigo ? corDoLocal(u.codigo) : "#D9DBE2"}; border-radius:12px; padding:12px 14px;`)}>
      <div className="m-wrap" style={css("display:flex; align-items:center; gap:10px;")}>
        <div style={css("flex:1; min-width:180px;")}>
          <div style={css("font-size:15px; font-weight:800;")}>{u.nome}<span style={css("font-weight:600; color:#9398A6; font-size:13px;")}>{u.cidade ? ` · ${u.cidade}` : ""}</span></div>
          <div style={css("display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;")}>
            <Selo on={!!u.operacao}>Operação</Selo>
            <Selo on={u.ativa}>Vagas</Selo>
            <Selo on={!!u.retirada}>Retirada</Selo>
          </div>
        </div>
        <div style={css("display:flex; gap:6px; align-items:center;")}>
          {onMover && <BotaoIcone titulo="Subir" off={primeira} onClick={() => onMover(-1)}><path d="m18 15-6-6-6 6" /></BotaoIcone>}
          {onMover && <BotaoIcone titulo="Descer" off={ultima} onClick={() => onMover(1)}><path d="m6 9 6 6 6-6" /></BotaoIcone>}
          {onExcluir && <BotaoIcone titulo="Excluir loja" onClick={onExcluir}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></BotaoIcone>}
          <Hoverable as="button" onClick={onEditar} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; border-radius:9px; padding:6px 14px; font-size:13px; font-weight:700; cursor:pointer;")} hover="background:#F4F4F7">Editar</Hoverable>
        </div>
      </div>
      <div style={css("display:flex; gap:14px; flex-wrap:wrap; margin-top:8px; font-size:12.5px; color:#7A8090;")}>
        <span>{u.endereco ? u.endereco : <i style={{ color: "#B6BAC4" }}>sem endereço</i>}</span>
        <span>{vagasAbertas} {vagasAbertas === 1 ? "vaga aberta" : "vagas abertas"} · {candidatos} {candidatos === 1 ? "candidato" : "candidatos"}</span>
        <span>/vagas/{u.slug}</span>
      </div>
    </div>
  );
}

type DadosLoja = Pick<Unidade, "cidade" | "nome" | "ativa" | "operacao" | "retirada" | "endereco" | "horarios">;

function LojaForm({ loja, onClose, onSalvar }: { loja: Unidade | null; onClose: () => void; onSalvar: (d: DadosLoja) => void }) {
  useFecharComEsc(true, onClose);
  const { config } = useEncomendas();
  const [f, setF] = useState<DadosLoja>(() => ({
    cidade: loja?.cidade ?? "", nome: loja?.nome ?? "", ativa: loja?.ativa ?? true,
    operacao: loja ? !!loja.operacao : true, retirada: loja ? !!loja.retirada : true,
    endereco: loja?.endereco ?? "", horarios: loja?.horarios ?? null,
  }));
  const [erro, setErro] = useState<string | null>(null);
  const campo = "width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; padding:9px 11px; font-size:13.5px; outline:none; font-family:inherit; margin-top:5px; background:#fff;";
  const rot = "display:block; font-size:12.5px; font-weight:700; color:#5B6472;";
  const salvar = () => {
    if (f.nome.trim().length < 2) return setErro("Informe o nome da loja (ex.: Centro).");
    onSalvar({ ...f, nome: f.nome.trim(), cidade: f.cidade.trim(), endereco: (f.endereco ?? "").trim() });
  };
  const chave = (rotulo: string, texto: string, ligado: boolean, set: (v: boolean) => void, off?: boolean) => (
    <label style={css(`display:flex; gap:12px; align-items:flex-start; padding:11px 12px; border:1px solid #F0F1F4; background:#FAFAFB; border-radius:11px; cursor:${off ? "default" : "pointer"}; opacity:${off ? 0.55 : 1};`)}>
      <Chave ligado={ligado} onChange={(v) => !off && set(v)} />
      <span><span style={css("display:block; font-size:13.5px; font-weight:800; color:#1B1B28;")}>{rotulo}</span><span style={css("display:block; font-size:12px; color:#7A8090; line-height:1.45; margin-top:2px;")}>{texto}</span></span>
    </label>
  );

  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:64; background:rgba(20,24,40,.32);")} />
      <div className="m-drawer" role="dialog" aria-label={loja ? "Editar loja" : "Nova loja"} style={css("position:fixed; top:0; right:0; bottom:0; z-index:65; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:540px; max-width:96vw; display:flex; flex-direction:column;")}>
        <div style={css("flex:none; display:flex; align-items:center; gap:10px; padding:18px 22px; border-bottom:1px solid #ECEDF1;")}>
          <span style={css("flex:1; font-size:18px; font-weight:800;")}>{loja ? "Editar loja" : "Nova loja"}</span>
          <Hoverable as="button" onClick={onClose} title="Fechar" s={css("width:32px; height:32px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:18px 22px; display:flex; flex-direction:column; gap:14px;")}>
          <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:10px;")}>
            <label style={css(rot)}>Nome da loja *<input autoFocus={!loja} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Centro" style={css(campo)} /></label>
            <label style={css(rot)}>Cidade<input value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} placeholder="Ex.: Florianópolis" style={css(campo)} /></label>
          </div>
          <label style={css(rot)}>Endereço <span style={css("font-weight:500; color:#9398A6;")}>(aparece para o cliente na retirada)</span>
            <input value={f.endereco ?? ""} onChange={(e) => setF({ ...f, endereco: e.target.value })} placeholder="Rua, número — bairro" style={css(campo)} />
          </label>

          <div style={css("display:flex; flex-direction:column; gap:8px;")}>
            <span style={css(rot)}>Onde a loja aparece</span>
            {chave("Operação", "Ordem de Serviço, Produção, Expedição, Lojas, Estoque, Indicadores e filtros.", !!f.operacao, (v) => setF({ ...f, operacao: v }))}
            {chave("Vagas", "RH → Vagas e a página pública “Trabalhe conosco”. Desligada, some do hub (o link continua abrindo, avisando que não há vagas).", f.ativa, (v) => setF({ ...f, ativa: v }))}
            {chave("Retirada de encomendas", "O cliente pode escolher esta loja para retirar a encomenda.", !!f.retirada, (v) => setF({ ...f, retirada: v }))}
          </div>

          <div>
              <span style={css(rot)}>Horário de funcionamento</span>
              <div style={css("display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:6px;")}>
                <span style={css(`font-size:12.5px; color:${f.horarios ? "#3A3F4C" : "#9398A6"}; flex:1; min-width:180px;`)}>
                  {f.horarios ? resumoHorario(f.horarios as Record<DiaKey, JanelaDia>) : "Usa os horários gerais de retirada (Encomendas → Configurações)."}
                </span>
                {f.horarios
                  ? <Link onClick={() => setF({ ...f, horarios: null })}>Usar os horários gerais</Link>
                  : <Link onClick={() => setF({ ...f, horarios: structuredClone(config.janelas) })}>Definir horário da loja</Link>}
              </div>
              {f.horarios && (
                <div style={css("margin-top:8px; border:1px solid #ECEDF1; border-radius:10px; padding:4px 12px 10px;")}>
                  <EditorJanelas janelas={f.horarios as Record<DiaKey, JanelaDia>} intervaloMin={config.intervaloMin} fimIncluso={false} ro={false} onChange={(h) => setF({ ...f, horarios: h })} />
                  <div style={css("font-size:12px; color:#9398A6; margin-top:6px;")}>O cliente só consegue marcar a retirada nesta loja dentro desse horário (o horário de fechar não entra).</div>
                </div>
              )}
          </div>

          {loja && (
            <div style={css("font-size:12px; color:#9398A6; line-height:1.55; border-top:1px solid #F0F1F4; padding-top:10px;")}>
              Link da página de vagas: <b style={{ color: "#5B6472" }}>/vagas/{loja.slug}</b>{loja.codigo && <> · código na operação: <b style={{ color: "#5B6472" }}>{loja.codigo}</b></>}<br />
              O link e o código não mudam (os links divulgados, o estoque e as tarefas continuam ligados à loja).
            </div>
          )}
          {erro && <div role="alert" style={css("font-size:13px; font-weight:600; color:#B42318;")}>{erro}</div>}
        </div>
        <div style={css("flex:none; display:flex; justify-content:flex-end; gap:8px; padding:14px 22px; border-top:1px solid #ECEDF1;")}>
          <Hoverable as="button" onClick={onClose} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; border-radius:10px; padding:9px 16px; font-size:13.5px; font-weight:700; cursor:pointer;")} hover="background:#F4F4F7">Cancelar</Hoverable>
          <Hoverable as="button" onClick={salvar} s={css(`border:none; background:${BRAND}; color:#fff; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:700; cursor:pointer;`)} hover="filter:brightness(1.08)">{loja ? "Salvar" : "Criar loja"}</Hoverable>
        </div>
      </div>
    </>
  );
}

function Link({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} style={css(`border:none; background:transparent; color:${BRAND}; font-size:12.5px; font-weight:700; cursor:pointer; padding:2px 0;`)}>{children}</button>;
}
