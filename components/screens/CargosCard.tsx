"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { css } from "@/lib/css";
import { CORES_CARGO } from "@/lib/acesso";
import { validarNomeCargo } from "@/lib/cargos";
import type { CargoDef } from "@/lib/types";
import { Avatar } from "../ui/bits";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import ConfirmModal from "../ui/ConfirmModal";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { useApp } from "../store";

/**
 * Configurações → Acessos → Cargos: criar, renomear, trocar a cor e excluir cargos. As
 * permissões de cada cargo ficam na matriz logo abaixo. Editar um cargo que tem pessoas
 * pede confirmação: a mudança vale para todas elas. Administrador é fixo.
 */
export default function CargosCard() {
  const { cargos, team } = useApp();
  const [editando, setEditando] = useState<CargoDef | "novo" | null>(null);
  const [excluindo, setExcluindo] = useState<CargoDef | null>(null);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);
  const { excluirCargo } = useApp();
  const pessoasDo = (nome: string) => team.filter((t) => t.cargo === nome);

  return (
    <div style={css("background:#fff; border:1px solid #E2E3E9; border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:14px;")}>
      <div className="m-wrap" style={css("display:flex; align-items:center; gap:10px;")}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={css("font-size:15px; font-weight:800;")}>Cargos</div>
          <div style={css("font-size:12.5px; color:#9398A6; margin-top:2px;")}>Crie e edite os cargos da equipe. O que cada um pode ver e editar fica na matriz abaixo.</div>
        </div>
        <Hoverable as="button" onClick={() => setEditando("novo")} s={css("display:inline-flex; align-items:center; gap:7px; border:none; cursor:pointer; background:#1B1B28; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:9px;")} hover="background:#000">
          <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>Novo cargo
        </Hoverable>
      </div>

      {erroExcluir && <div style={css("font-size:12.5px; font-weight:600; padding:8px 12px; border-radius:9px; background:#FDECEC; color:#CC3338;")}>{erroExcluir}</div>}

      <div style={css("display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:10px;")}>
        {cargos.map((c) => {
          const gente = pessoasDo(c.nome);
          return (
            <div key={c.nome} style={css(`display:flex; align-items:center; gap:11px; border:1px solid #ECEDF1; border-radius:12px; padding:11px 12px; background:#FCFCFD;`)}>
              <span style={css(`flex:none; width:34px; height:34px; border-radius:10px; background:${c.cor}1A; color:${c.cor}; display:flex; align-items:center; justify-content:center;`)}>
                <Svg size={17} sw={2}><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></Svg>
              </span>
              <div style={css("flex:1; min-width:0;")}>
                <div style={css("display:flex; align-items:center; gap:6px;")}>
                  <span style={css(`font-size:13.5px; font-weight:800; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`)}>{c.nome}</span>
                  {c.sistema && <Svg size={13} sw={2.2} stroke="#9398A6" style={css("flex:none;")}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>}
                </div>
                <div style={css("font-size:12px; color:#9398A6; margin-top:1px;")}>
                  {gente.length} {gente.length === 1 ? "pessoa" : "pessoas"}{c.acessoTotal ? " · acesso total" : ""}
                </div>
              </div>
              {c.sistema ? (
                <span title="Cargo fixo do sistema: acesso total, não pode ser renomeado nem excluído." style={css("font-size:11px; font-weight:700; color:#9398A6; background:#F2F3F6; border-radius:7px; padding:3px 8px;")}>Fixo</span>
              ) : (
                <div style={css("display:flex; gap:4px;")}>
                  <IconeBtn titulo="Editar cargo" onClick={() => { setErroExcluir(null); setEditando(c); }}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></IconeBtn>
                  <IconeBtn titulo={gente.length ? "Há pessoas nesse cargo" : "Excluir cargo"} perigo off={gente.length > 0} onClick={() => { setErroExcluir(null); setExcluindo(c); }}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></IconeBtn>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editando && <CargoForm cargo={editando === "novo" ? null : editando} onClose={() => setEditando(null)} />}
      {excluindo && (
        <ConfirmModal
          titulo="Excluir cargo"
          mensagem={<>Excluir o cargo <strong style={css("color:#1B1B28;")}>{excluindo.nome}</strong>? As permissões dele também são apagadas.</>}
          confirmLabel="Excluir"
          danger
          onConfirm={async () => { const r = await excluirCargo(excluindo.nome); setExcluindo(null); if (!r.ok) setErroExcluir(r.error ?? "Não foi possível excluir."); }}
          onClose={() => setExcluindo(null)}
        />
      )}
    </div>
  );
}

/** Criar/editar cargo. Se o cargo tem pessoas, confirma antes de aplicar a mudança a todas. */
function CargoForm({ cargo, onClose }: { cargo: CargoDef | null; onClose: () => void }) {
  const { cargos, team, criarCargo, editarCargo } = useApp();
  useFecharComEsc(true, onClose);
  const [nome, setNome] = useState(cargo?.nome ?? "");
  const [cor, setCor] = useState(cargo?.cor ?? CORES_CARGO.find((k) => !cargos.some((c) => c.cor === k)) ?? CORES_CARGO[0]);
  const [acessoTotal, setAcessoTotal] = useState(cargo?.acessoTotal ?? false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const gente = cargo ? team.filter((t) => t.cargo === cargo.nome) : [];
  const nomeLimpo = nome.trim().replace(/\s+/g, " ");
  const mudou = !cargo || nomeLimpo !== cargo.nome || cor !== cargo.cor || acessoTotal !== cargo.acessoTotal;

  const aplicar = async () => {
    setSalvando(true); setErro(null);
    const r = cargo
      ? await editarCargo(cargo.nome, { nome: nomeLimpo, cor, acessoTotal })
      : await criarCargo({ nome: nomeLimpo, cor, acessoTotal });
    setSalvando(false);
    if (!r.ok) { setConfirmar(false); setErro(r.error ?? "Não foi possível salvar."); return; }
    onClose();
  };
  const salvar = () => {
    if (!mudou) return onClose();
    const e = validarNomeCargo(nomeLimpo, cargos.filter((c) => c.nome !== cargo?.nome));
    if (e) return setErro(e);
    if (gente.length) setConfirmar(true); // tem pessoas: avisa antes
    else void aplicar();
  };

  const lbl = css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;");
  const mudancas = cargo ? [
    nomeLimpo !== cargo.nome && <>o nome passa de <b>{cargo.nome}</b> para <b>{nomeLimpo}</b></>,
    cor !== cargo.cor && <>a cor do cargo (e das fotos sem imagem) muda</>,
    acessoTotal !== cargo.acessoTotal && <>{acessoTotal ? "passam a ter acesso total (veem tudo e validam tarefas)" : "deixam de ter acesso total"}</>,
  ].filter(Boolean) : [];

  return createPortal(
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:300; background:rgba(20,24,40,.32);")} />
      <div style={css("position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:301; background:#fff; border:1px solid #E2E3E9; border-radius:16px; box-shadow:0 24px 70px rgba(20,24,40,.32); width:460px; max-width:94vw; display:flex; flex-direction:column; max-height:92vh;")}>
        <div style={css("display:flex; align-items:center; gap:10px; padding:16px 20px; border-bottom:1px solid #ECEDF1;")}>
          <span style={css("flex:1; font-size:16px; font-weight:800;")}>{cargo ? "Editar cargo" : "Novo cargo"}</span>
          <Hoverable as="button" onClick={onClose} title="Fechar" s={css("width:30px; height:30px; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("padding:18px 20px; display:flex; flex-direction:column; gap:16px; overflow-y:auto;")}>
          {cargo && gente.length > 0 && (
            <div style={css("display:flex; align-items:center; gap:10px; font-size:12.5px; color:#92400E; background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:9px 12px;")}>
              <Svg size={16} sw={2.2} style={css("flex:none;")}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></Svg>
              <span>{gente.length} {gente.length === 1 ? "pessoa tem" : "pessoas têm"} esse cargo. O que você mudar aqui vale para {gente.length === 1 ? "ela" : "todas"}.</span>
            </div>
          )}
          <div>
            <label style={lbl}>Nome do cargo</label>
            <input autoFocus value={nome} maxLength={40} onChange={(e) => { setNome(e.target.value); setErro(null); }} onKeyDown={(e) => { if (e.key === "Enter") salvar(); }} placeholder="ex.: Confeiteira" style={css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; font-size:13.5px; padding:9px 12px; outline:none;")} />
          </div>
          <div>
            <label style={lbl}>Cor</label>
            <div style={css("display:flex; flex-wrap:wrap; gap:8px;")}>
              {CORES_CARGO.map((k) => (
                <button key={k} type="button" title={k} onClick={() => setCor(k)} style={css(`width:30px; height:30px; border-radius:50%; cursor:pointer; background:${k}; border:3px solid ${cor === k ? "#fff" : "transparent"}; box-shadow:${cor === k ? `0 0 0 2px ${k}` : "none"};`)} />
              ))}
            </div>
            <div style={css("display:flex; align-items:center; gap:8px; margin-top:10px; font-size:12px; color:#9398A6;")}>
              Prévia:
              <span style={css(`display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; padding:5px 11px; border-radius:999px; background:${cor}1A; color:${cor};`)}>
                <span style={css(`width:7px; height:7px; border-radius:50%; background:${cor};`)} />{nomeLimpo || "Nome do cargo"}
              </span>
            </div>
          </div>
          <label style={css(`display:flex; align-items:flex-start; gap:10px; cursor:pointer; border:1px solid ${acessoTotal ? "#955C6B55" : "#ECEDF1"}; background:${acessoTotal ? "#FDF1F4" : "#fff"}; border-radius:11px; padding:11px 12px;`)}>
            <input type="checkbox" checked={acessoTotal} onChange={(e) => setAcessoTotal(e.target.checked)} style={css("width:17px; height:17px; margin-top:1px; accent-color:#955C6B; cursor:pointer;")} />
            <span>
              <span style={css("display:block; font-size:13.5px; font-weight:700; color:#1B1B28;")}>Acesso total</span>
              <span style={css("display:block; font-size:12px; color:#9398A6; margin-top:2px;")}>Vê as tarefas de todos, troca responsáveis e pode validar — como o Gerente. As telas que ele abre continuam definidas na matriz.</span>
            </span>
          </label>
          {!cargo && <div style={css("font-size:12px; color:#9398A6;")}>O cargo novo começa sem acesso a nenhuma tela: libere na matriz de acessos logo abaixo.</div>}
          {erro && <div style={css("font-size:12.5px; color:#CC3338; font-weight:600;")}>{erro}</div>}
        </div>
        <div style={css("display:flex; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid #ECEDF1;")}>
          <Hoverable as="button" onClick={onClose} s={css("border:1px solid #E2E3E9; background:#fff; border-radius:10px; padding:9px 16px; font-size:13.5px; font-weight:700; color:#5B6472; cursor:pointer;")} hover="background:#F4F4F7">Cancelar</Hoverable>
          <Hoverable as="button" onClick={salvar} {...{ disabled: salvando }} s={css(`border:none; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:700; color:#fff; cursor:pointer; background:#955C6B; opacity:${salvando ? 0.6 : 1};`)} hover="filter:brightness(1.08)">{salvando ? "Salvando…" : cargo ? "Salvar" : "Criar cargo"}</Hoverable>
        </div>
      </div>

      {confirmar && cargo && (
        <ConfirmModal
          titulo="Alterar cargo com pessoas"
          confirmLabel={salvando ? "Salvando…" : `Alterar para ${gente.length === 1 ? "1 pessoa" : `as ${gente.length}`}`}
          onConfirm={() => { if (!salvando) void aplicar(); }}
          onClose={() => setConfirmar(false)}
          mensagem={
            <div style={css("display:flex; flex-direction:column; gap:12px;")}>
              <span>O cargo <strong style={css("color:#1B1B28;")}>{cargo.nome}</strong> tem {gente.length} {gente.length === 1 ? "pessoa" : "pessoas"}. A alteração vale para {gente.length === 1 ? "ela" : "todas"}:</span>
              <ul style={css("margin:0; padding-left:18px; display:flex; flex-direction:column; gap:3px;")}>
                {mudancas.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
              <div style={css("display:flex; flex-direction:column; gap:6px; max-height:170px; overflow-y:auto; border:1px solid #ECEDF1; border-radius:10px; padding:8px 10px;")}>
                {gente.map((p) => (
                  <div key={p.id} style={css("display:flex; align-items:center; gap:9px; font-size:13px; font-weight:600; color:#3A3F4C;")}>
                    <Avatar ini={p.ini} cor={p.cor} src={p.foto} size={24} fontSize={10} />{p.nome}
                    {p.ativo === false && <span style={css("font-size:11px; color:#9398A6; font-weight:600;")}>(inativo)</span>}
                  </div>
                ))}
              </div>
              {nomeLimpo !== cargo.nome && <span style={css("font-size:12px; color:#9398A6;")}>As permissões, o escopo e os grupos internos do cargo passam para o nome novo.</span>}
            </div>
          }
        />
      )}
    </>,
    document.body,
  );
}

function IconeBtn({ titulo, onClick, off, perigo, children }: { titulo: string; onClick: () => void; off?: boolean; perigo?: boolean; children: React.ReactNode }) {
  return (
    <Hoverable as="button" type="button" title={titulo} onClick={() => !off && onClick()} s={css(`width:30px; height:30px; border:1px solid #ECEDF1; background:#fff; border-radius:8px; cursor:${off ? "not-allowed" : "pointer"}; display:flex; align-items:center; justify-content:center; color:${off ? "#D5D7DE" : "#5B6472"};`)} hover={off ? undefined : perigo ? "background:#FDECEC; color:#CC3338; border-color:#F3C2C4" : "background:#F4F4F7"}>
      <Svg size={14} sw={2.2}>{children}</Svg>
    </Hoverable>
  );
}
