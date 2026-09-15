"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { BRAND } from "@/lib/theme";
import { corDeTexto } from "@/lib/talento-dims";
import { unidadeLabel, vagaLabel } from "@/lib/localdb";
import type { LinkBioConfig, Turno, Unidade, Vaga } from "@/lib/types";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import ConfirmModal from "../ui/ConfirmModal";
import { useApp } from "../store";

const TURNOS: { v: Turno; label: string }[] = [
  { v: "", label: "Sem turno" },
  { v: "Diurno", label: "Diurno" },
  { v: "Noturno", label: "Noturno" },
];

const inp = css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; font-size:13.5px; padding:9px 12px; outline:none;");
const lbl = css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;");
const card = "background:#fff; border:1px solid #E2E3E9; border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:14px;";

/** Pílula Ativa/Pausada clicável (unidade ou vaga). */
function AtivaPill({ ativa, onChange, labels = ["Ativa", "Pausada"], disabled }: { ativa: boolean; onChange: (v: boolean) => void; labels?: [string, string]; disabled?: boolean }) {
  const c = ativa
    ? { bg: "#E7F6EC", fg: "#1B7F4D", dot: "#1B7F4D", lbl: labels[0] }
    : { bg: "#F1F2F5", fg: "#8A90A0", dot: "#B6BAC4", lbl: labels[1] };
  return (
    <Hoverable as="button" type="button" title={disabled ? undefined : ativa ? `Clique para ${labels[1].toLowerCase()}` : `Clique para ${labels[0].toLowerCase()}`} onClick={disabled ? undefined : (e: React.MouseEvent) => { e.stopPropagation(); onChange(!ativa); }} s={css(`display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; border:1px solid transparent; background:${c.bg}; color:${c.fg}; font-size:11.5px; font-weight:700; cursor:${disabled ? "default" : "pointer"};`)} hover={disabled ? undefined : "border-color:#D6D7DE"}>
      <span style={css(`width:7px; height:7px; border-radius:50%; flex:none; background:${c.dot};`)} />{c.lbl}
    </Hoverable>
  );
}

export default function Vagas() {
  const { unidades, vagas, talentos, linkbio, setLinkbio, addUnidade, updateUnidade, removeUnidade, addVaga, updateVaga, removeVaga, canEditPage } = useApp();
  const editavel = canEditPage("recrutamento-vagas");
  const [sel, setSel] = useState<string | null>(null);
  const [formUnidade, setFormUnidade] = useState<{ aberto: boolean; editando?: Unidade }>({ aberto: false });
  const [formVaga, setFormVaga] = useState<{ aberto: boolean; editando?: Vaga }>({ aberto: false });
  const [confirm, setConfirm] = useState<{ tipo: "unidade" | "vaga"; id: string; nome: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const urlHub = `${origin}/vagas`;
  const copiar = async (v: string, key: string) => {
    try { await navigator.clipboard.writeText(v); setCopiado(key); setTimeout(() => setCopiado(null), 1400); } catch { /* ignore */ }
  };

  const ordenadas = unidades.slice().sort((a, b) => unidadeLabel(a).localeCompare(unidadeLabel(b), "pt"));
  const selecionada = ordenadas.find((u) => u.id === sel) ?? ordenadas[0] ?? null;
  const vagasDa = (uid: string) => vagas.filter((v) => v.unidadeId === uid).sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
  const candidatosDa = (vid: string) => talentos.filter((t) => t.vagaId === vid).length;
  const vagasSel = selecionada ? vagasDa(selecionada.id) : [];

  const btnGhost = "display:inline-flex; align-items:center; gap:7px; border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; cursor:pointer; font-size:13px; font-weight:700; padding:8px 13px; border-radius:9px;";
  const iconBtn = "width:30px; height:30px; flex:none; border:1px solid #E2E3E9; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;";

  return (
    <div className="m-pad" style={css("padding:24px 30px 40px; display:flex; flex-direction:column; gap:18px;")}>
      {/* Header */}
      <div className="m-wrap" style={css("display:flex; align-items:center; gap:16px;")}>
        <div style={{ flex: 1 }}>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Vagas</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>{unidades.filter((u) => u.ativa).length} unidades ativas · {vagas.filter((v) => v.ativa).length} vagas abertas na página pública</p>
        </div>
        {editavel && (
          <>
            <Hoverable as="button" onClick={() => setFormUnidade({ aberto: true })} s={css(btnGhost)} hover="background:#F4F4F7">
              <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>Nova unidade
            </Hoverable>
            <Hoverable as="button" onClick={() => setFormVaga({ aberto: true })} {...{ disabled: unidades.length === 0 }} title={unidades.length === 0 ? "Crie uma unidade primeiro" : undefined} s={css(`display:inline-flex; align-items:center; gap:7px; border:none; cursor:${unidades.length ? "pointer" : "not-allowed"}; opacity:${unidades.length ? 1 : 0.5}; background:${BRAND}; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:10px;`)} hover={unidades.length ? "filter:brightness(1.12)" : undefined}>
              <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>Nova vaga
            </Hoverable>
          </>
        )}
      </div>

      {/* Link público */}
      <div className="m-wrap" style={css("display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #E2E3E9; border-radius:14px; padding:14px 18px;")}>
        <span style={css(`flex:none; width:38px; height:38px; border-radius:10px; background:${BRAND}1A; color:${BRAND}; display:flex; align-items:center; justify-content:center;`)}>
          <Svg size={18} sw={2}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Svg>
        </span>
        <div style={css("flex:1; min-width:200px;")}>
          <div style={css("font-size:13.5px; font-weight:800; color:#1B1B28;")}>Página pública de vagas (link na bio)</div>
          <div style={css("font-size:12.5px; color:#7A8090; margin-top:2px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{urlHub}</div>
        </div>
        <Hoverable as="button" onClick={() => copiar(urlHub, "hub")} s={css(btnGhost)} hover="background:#F4F4F7">{copiado === "hub" ? "Copiado!" : "Copiar link"}</Hoverable>
        <a href="/vagas" target="_blank" rel="noreferrer" style={css(btnGhost + "text-decoration:none;")}>Abrir <Svg size={13} sw={2.2}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Svg></a>
      </div>

      {formUnidade.aberto && (
        <UnidadeForm
          inicial={formUnidade.editando}
          onClose={() => setFormUnidade({ aberto: false })}
          onSave={(dados) => {
            if (formUnidade.editando) updateUnidade(formUnidade.editando.id, dados);
            else { const u = addUnidade(dados); setSel(u.id); }
            setFormUnidade({ aberto: false });
          }}
        />
      )}
      {formVaga.aberto && (
        <VagaForm
          inicial={formVaga.editando}
          unidades={ordenadas}
          unidadePadrao={selecionada?.id}
          onClose={() => setFormVaga({ aberto: false })}
          onSave={(dados) => {
            if (formVaga.editando) updateVaga(formVaga.editando.id, dados);
            else addVaga(dados);
            setSel(dados.unidadeId);
            setFormVaga({ aberto: false });
          }}
        />
      )}

      {/* Unidades × Vagas */}
      <div className="m-stack" style={css("display:flex; gap:16px; align-items:stretch;")}>
        {/* Unidades */}
        <div style={css("width:340px; flex:none; " + card)}>
          <div style={css("display:flex; align-items:center; gap:8px;")}>
            <span style={css("font-size:15px; font-weight:800;")}>Unidades</span>
            <span style={css("font-size:12px; font-weight:700; color:#9398A6;")}>{unidades.length}</span>
          </div>
          {ordenadas.length === 0 ? (
            <div style={css("font-size:13px; color:#9398A6; padding:6px 0;")}>Nenhuma unidade. Crie a primeira para começar a abrir vagas.</div>
          ) : (
            <div style={css("display:flex; flex-direction:column; gap:8px;")}>
              {ordenadas.map((u) => {
                const ativo = selecionada?.id === u.id;
                const abertas = vagasDa(u.id).filter((v) => v.ativa).length;
                return (
                  <Hoverable key={u.id} onClick={() => setSel(u.id)} s={css(`display:flex; align-items:center; gap:10px; padding:11px 12px; border-radius:11px; border:1px solid ${ativo ? BRAND : "#ECEDF1"}; background:${ativo ? `${BRAND}0D` : "#fff"}; cursor:pointer; ${u.ativa ? "" : "opacity:.7;"}`)} hover={ativo ? undefined : "background:#FAFAFB"}>
                    <span style={css(`flex:none; width:32px; height:32px; border-radius:9px; background:${BRAND}1A; color:${BRAND}; display:flex; align-items:center; justify-content:center;`)}>
                      <Svg size={16} sw={2}><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></Svg>
                    </span>
                    <div style={css("flex:1; min-width:0;")}>
                      <div style={css("font-size:13.5px; font-weight:700; color:#1B1B28; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{unidadeLabel(u)}</div>
                      <div style={css("font-size:11.5px; color:#9398A6; margin-top:1px;")}>{abertas} {abertas === 1 ? "vaga aberta" : "vagas abertas"} · /vagas/{u.slug}</div>
                    </div>
                    <AtivaPill ativa={u.ativa} disabled={!editavel} onChange={(v) => updateUnidade(u.id, { ativa: v })} />
                  </Hoverable>
                );
              })}
            </div>
          )}
        </div>

        {/* Vagas da unidade selecionada */}
        <div style={css("flex:1; min-width:0; " + card)}>
          {selecionada ? (
            <>
              <div className="m-wrap" style={css("display:flex; align-items:center; gap:10px;")}>
                <div style={css("flex:1; min-width:0;")}>
                  <div style={css("font-size:15px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{unidadeLabel(selecionada)}</div>
                  <div style={css("font-size:12.5px; color:#9398A6; margin-top:2px;")}>{vagasSel.length} {vagasSel.length === 1 ? "vaga cadastrada" : "vagas cadastradas"} · {vagasSel.filter((v) => v.ativa).length} na página pública</div>
                </div>
                <Hoverable as="button" onClick={() => copiar(`${origin}/vagas/${selecionada.slug}`, selecionada.id)} s={css(btnGhost)} hover="background:#F4F4F7">{copiado === selecionada.id ? "Copiado!" : "Copiar link da unidade"}</Hoverable>
                {editavel && (
                  <>
                    <Hoverable as="button" title="Editar unidade" onClick={() => setFormUnidade({ aberto: true, editando: selecionada })} s={css(iconBtn + "color:#5B6472;")} hover="background:#F4F4F7"><Svg size={14}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg></Hoverable>
                    <Hoverable as="button" title="Excluir unidade" onClick={() => setConfirm({ tipo: "unidade", id: selecionada.id, nome: unidadeLabel(selecionada) })} s={css(iconBtn + "color:#CC3338;")} hover="background:#FDF0F0"><Svg size={14}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></Svg></Hoverable>
                  </>
                )}
              </div>

              {vagasSel.length === 0 ? (
                <div style={css("padding:26px 12px; text-align:center; border:1px dashed #E2E3E9; border-radius:12px; color:#9398A6; font-size:13px; line-height:1.5;")}>
                  Nenhuma vaga nesta unidade.<br />Na página pública ela aparece com o aviso “sem vagas abertas”.
                </div>
              ) : (
                <div>
                  {vagasSel.map((v, i) => {
                    const cor = corDeTexto(v.titulo);
                    const n = candidatosDa(v.id);
                    return (
                      <div key={v.id} className="m-wrap" style={css(`display:flex; align-items:center; gap:12px; padding:11px 4px; ${i < vagasSel.length - 1 ? "border-bottom:1px solid #F4F5F7;" : ""}`)}>
                        <span style={css(`flex:none; width:9px; height:9px; border-radius:50%; background:${cor};`)} />
                        <div style={css("flex:1; min-width:0;")}>
                          <div style={css("font-size:13.5px; font-weight:700; color:#1B1B28;")}>{v.titulo}{v.turno ? <span style={css("margin-left:8px; font-size:11px; font-weight:800; color:#5B6472; background:#EDEEF2; padding:2px 8px; border-radius:6px; letter-spacing:.3px;")}>{v.turno.toUpperCase()}</span> : null}</div>
                          <div style={css("font-size:12px; color:#9398A6; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{v.descricao || "Sem descrição"}</div>
                        </div>
                        <span title="Candidatos vinculados" style={css("flex:none; display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:700; color:#5B6472;")}>
                          <Svg size={14} sw={2} stroke="#9398A6"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></Svg>{n}
                        </span>
                        <AtivaPill ativa={v.ativa} disabled={!editavel} onChange={(a) => updateVaga(v.id, { ativa: a })} labels={["Aberta", "Pausada"]} />
                        {editavel && (
                          <>
                            <Hoverable as="button" title="Editar vaga" onClick={() => setFormVaga({ aberto: true, editando: v })} s={css(iconBtn + "color:#5B6472;")} hover="background:#F4F4F7"><Svg size={14}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg></Hoverable>
                            <Hoverable as="button" title="Excluir vaga" onClick={() => setConfirm({ tipo: "vaga", id: v.id, nome: vagaLabel(v) })} s={css(iconBtn + "color:#CC3338;")} hover="background:#FDF0F0"><Svg size={14}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></Svg></Hoverable>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={css("padding:26px 12px; text-align:center; color:#9398A6; font-size:13px;")}>Selecione ou crie uma unidade para ver as vagas.</div>
          )}
        </div>
      </div>

      {/* Página pública: textos */}
      <PaginaConfig linkbio={linkbio} onSave={setLinkbio} editavel={editavel} />

      {confirm && (
        <ConfirmModal
          titulo={confirm.tipo === "unidade" ? "Excluir unidade" : "Excluir vaga"}
          mensagem={confirm.tipo === "unidade"
            ? <>Excluir <strong style={css("color:#1B1B28;")}>{confirm.nome}</strong> apaga também as vagas dela. Os candidatos continuam no Banco de Talentos, sem o vínculo.</>
            : <>Excluir a vaga <strong style={css("color:#1B1B28;")}>{confirm.nome}</strong>? Os candidatos continuam no Banco de Talentos, sem o vínculo.</>}
          confirmLabel="Excluir"
          danger
          onConfirm={() => { if (confirm.tipo === "unidade") { removeUnidade(confirm.id); setSel(null); } else removeVaga(confirm.id); setConfirm(null); }}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function UnidadeForm({ inicial, onClose, onSave }: { inicial?: Unidade; onClose: () => void; onSave: (d: { cidade: string; nome: string; ativa: boolean }) => void }) {
  const [cidade, setCidade] = useState(inicial?.cidade ?? "");
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [ativa, setAtiva] = useState(inicial?.ativa ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = () => {
    if (!nome.trim()) { setErro("Informe o nome da unidade."); return; }
    onSave({ cidade: cidade.trim(), nome: nome.trim(), ativa });
  };
  return (
    <div style={css(card)}>
      <div style={css("display:flex; align-items:center; gap:10px;")}>
        <div style={css("font-size:15px; font-weight:800; flex:1;")}>{inicial ? "Editar unidade" : "Nova unidade"}</div>
        <Hoverable as="button" onClick={onClose} s={css("width:30px; height:30px; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
      </div>
      <div className="m-grid-1" style={css("display:grid; grid-template-columns:1fr 1fr; gap:14px;")}>
        <div><label style={lbl}>Cidade</label><input autoFocus value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="ex.: Florianópolis" style={inp} /></div>
        <div><label style={lbl}>Unidade / bairro</label><input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") salvar(); }} placeholder="ex.: Campeche" style={inp} /></div>
      </div>
      <div style={css("display:flex; align-items:center; gap:10px;")}>
        <AtivaPill ativa={ativa} onChange={setAtiva} />
        <span style={css("font-size:12px; color:#9398A6;")}>Na página pública o botão fica “{cidade.trim() ? `${cidade.trim()} — ` : ""}{nome.trim() || "…"}”. Pausada, a unidade some do hub.</span>
      </div>
      {erro && <div style={css("font-size:12.5px; color:#CC3338; font-weight:600;")}>{erro}</div>}
      <div style={css("display:flex; justify-content:flex-end; gap:10px;")}>
        <Hoverable as="button" onClick={onClose} s={css("border:1px solid #E2E3E9; background:#fff; border-radius:10px; padding:9px 16px; font-size:13.5px; font-weight:700; color:#5B6472; cursor:pointer;")} hover="background:#F4F4F7">Cancelar</Hoverable>
        <Hoverable as="button" onClick={salvar} s={css(`border:none; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:700; color:#fff; cursor:pointer; background:${BRAND};`)} hover="filter:brightness(1.08)">{inicial ? "Salvar" : "Criar unidade"}</Hoverable>
      </div>
    </div>
  );
}

function VagaForm({ inicial, unidades, unidadePadrao, onClose, onSave }: { inicial?: Vaga; unidades: Unidade[]; unidadePadrao?: string; onClose: () => void; onSave: (d: { unidadeId: string; titulo: string; turno: Turno; descricao?: string; ativa: boolean }) => void }) {
  const [unidadeId, setUnidadeId] = useState(inicial?.unidadeId ?? unidadePadrao ?? unidades[0]?.id ?? "");
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [turno, setTurno] = useState<Turno>(inicial?.turno ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [ativa, setAtiva] = useState(inicial?.ativa ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const u = unidades.find((x) => x.id === unidadeId);
  const salvar = () => {
    if (!unidadeId) { setErro("Selecione a unidade."); return; }
    if (!titulo.trim()) { setErro("Informe o título da vaga."); return; }
    onSave({ unidadeId, titulo: titulo.trim(), turno, descricao: descricao.trim() || undefined, ativa });
  };
  const selBox = (open: boolean) => css(`display:flex; align-items:center; gap:8px; width:100%; box-sizing:border-box; border:1px solid ${open ? "#D6D7DE" : "#E2E3E9"}; border-radius:9px; font-size:13.5px; padding:9px 12px; cursor:pointer; background:#fff; text-align:left;`);
  return (
    <div style={css(card)}>
      <div style={css("display:flex; align-items:center; gap:10px;")}>
        <div style={css("font-size:15px; font-weight:800; flex:1;")}>{inicial ? "Editar vaga" : "Nova vaga"}</div>
        <Hoverable as="button" onClick={onClose} s={css("width:30px; height:30px; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
      </div>
      <div className="m-grid-1" style={css("display:grid; grid-template-columns:1fr 1fr; gap:14px;")}>
        <div>
          <label style={lbl}>Unidade</label>
          <Menu width={280} trigger={(toggle, open) => (
            <Hoverable as="button" type="button" onClick={toggle} s={selBox(open)} hover="background:#FAFAFB">
              <span style={css(`flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:${u ? "#1B1B28" : "#9398A6"};`)}>{u ? unidadeLabel(u) : "Selecionar unidade"}</span>
              <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
            </Hoverable>
          )}>
            {(close) => unidades.map((x) => (
              <MenuItem key={x.id} checked={x.id === unidadeId} onClick={() => { setUnidadeId(x.id); close(); }}><span style={{ flex: 1, fontWeight: 600 }}>{unidadeLabel(x)}</span></MenuItem>
            ))}
          </Menu>
        </div>
        <div><label style={lbl}>Título da vaga</label><input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ex.: Auxiliar de Cozinha" style={inp} /></div>
        <div>
          <label style={lbl}>Turno</label>
          <Menu width={200} trigger={(toggle, open) => (
            <Hoverable as="button" type="button" onClick={toggle} s={selBox(open)} hover="background:#FAFAFB">
              <span style={css("flex:1; color:#1B1B28;")}>{TURNOS.find((t) => t.v === turno)?.label}</span>
              <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
            </Hoverable>
          )}>
            {(close) => TURNOS.map((t) => (
              <MenuItem key={t.v || "none"} checked={t.v === turno} onClick={() => { setTurno(t.v); close(); }}><span style={{ flex: 1, fontWeight: 600 }}>{t.label}</span></MenuItem>
            ))}
          </Menu>
        </div>
        <div>
          <label style={lbl}>Status</label>
          <div style={css("padding-top:6px;")}><AtivaPill ativa={ativa} onChange={setAtiva} labels={["Aberta", "Pausada"]} /></div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Descrição (opcional, uso interno)</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Responsabilidades, requisitos, horário…" style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
        </div>
      </div>
      <p style={css("margin:0; font-size:11.5px; color:#9398A6;")}>Na página pública o botão fica “Vaga — {titulo.trim() || "…"}{turno ? ` [${turno.toUpperCase()}]` : ""}”.</p>
      {erro && <div style={css("font-size:12.5px; color:#CC3338; font-weight:600;")}>{erro}</div>}
      <div style={css("display:flex; justify-content:flex-end; gap:10px;")}>
        <Hoverable as="button" onClick={onClose} s={css("border:1px solid #E2E3E9; background:#fff; border-radius:10px; padding:9px 16px; font-size:13.5px; font-weight:700; color:#5B6472; cursor:pointer;")} hover="background:#F4F4F7">Cancelar</Hoverable>
        <Hoverable as="button" onClick={salvar} s={css(`border:none; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:700; color:#fff; cursor:pointer; background:${BRAND};`)} hover="filter:brightness(1.08)">{inicial ? "Salvar" : "Criar vaga"}</Hoverable>
      </div>
    </div>
  );
}

/** Textos da página pública (título, subtítulo, tagline, Instagram, WhatsApp do obrigado). */
function PaginaConfig({ linkbio, onSave, editavel }: { linkbio: LinkBioConfig; onSave: (p: Partial<LinkBioConfig>) => void; editavel: boolean }) {
  const [d, setD] = useState(linkbio);
  const [salvo, setSalvo] = useState(false);
  const mudou = JSON.stringify(d) !== JSON.stringify(linkbio);
  const salvar = () => { onSave({ ...d, instagram: d.instagram.replace(/^@/, "").trim(), pixelId: (d.pixelId ?? "").replace(/\D/g, "") }); setSalvo(true); setTimeout(() => setSalvo(false), 2000); };
  const ro = !editavel;
  return (
    <div style={css(card)}>
      <div style={css("display:flex; align-items:center; gap:10px;")}>
        <div style={{ flex: 1 }}>
          <div style={css("font-size:15px; font-weight:800;")}>Página pública</div>
          <div style={css("font-size:12.5px; color:#9398A6; margin-top:2px;")}>Textos do hub, das páginas de unidade e da confirmação de candidatura, e o Pixel do Facebook.</div>
        </div>
        {editavel && (
          <Hoverable as="button" onClick={mudou ? salvar : undefined} s={css(`border:none; cursor:${mudou ? "pointer" : "default"}; font-size:13px; font-weight:700; padding:9px 18px; border-radius:9px; background:${salvo ? "#E7F6EE" : mudou ? "#1B1B28" : "#EDEEF2"}; color:${salvo ? "#1B7F4D" : mudou ? "#fff" : "#9398A6"};`)} hover={mudou ? "background:#000" : undefined}>
            {salvo ? "Salvo" : "Salvar"}
          </Hoverable>
        )}
      </div>
      <div className="m-grid-1" style={css("display:grid; grid-template-columns:1fr 1fr; gap:14px;")}>
        <div><label style={lbl}>Título</label><input readOnly={ro} value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} style={inp} /></div>
        <div><label style={lbl}>Subtítulo do hub</label><input readOnly={ro} value={d.subtitulo} onChange={(e) => setD({ ...d, subtitulo: e.target.value })} style={inp} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Frase de rodapé</label><input readOnly={ro} value={d.tagline} onChange={(e) => setD({ ...d, tagline: e.target.value })} style={inp} /></div>
        <div><label style={lbl}>Instagram (sem @)</label><input readOnly={ro} value={d.instagram} onChange={(e) => setD({ ...d, instagram: e.target.value })} placeholder="jubudelon" style={inp} /></div>
        <div>
          <label style={lbl}>Pixel do Facebook (ID)</label>
          <input readOnly={ro} value={d.pixelId ?? ""} onChange={(e) => setD({ ...d, pixelId: e.target.value })} placeholder="ex.: 1508174950852749" inputMode="numeric" style={{ ...inp, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" }} />
        </div>
      </div>
      <div style={css("display:flex; flex-direction:column; gap:6px; font-size:11.5px; color:#9398A6; line-height:1.5;")}>
        <span>Na página da unidade o subtítulo vira “Estamos contratando agora unidade NOME!” automaticamente.</span>
        <span><b>Pixel:</b> com o ID preenchido, o hub e as páginas de unidade/vaga disparam <b>PageView</b>; a página de obrigado dispara <b>PageView + Lead</b> (com a vaga em <code>content_name</code> e a unidade em <code>content_category</code>). O ID fica em Meta Business → Gerenciador de Eventos → Fontes de dados.</span>
      </div>
    </div>
  );
}
