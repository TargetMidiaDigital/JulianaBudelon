"use client";

import { useRef, useState } from "react";
import { css } from "@/lib/css";
import { spacesTree } from "@/lib/seed";
import { sectorIcon } from "../Sidebar";
import { CARGOS, corDoCargo, DEFAULT_ESCOPO, nivelPadrao } from "@/lib/acesso";
import { uploadLocal } from "@/lib/upload";
import type { Cargo, GrupoInterno, NivelAcesso, ScreenPage } from "@/lib/types";
import { Avatar } from "../ui/bits";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import EditableTitle from "../ui/EditableTitle";
import ConfirmModal from "../ui/ConfirmModal";
import { useApp } from "../store";

type ConfigTab = "empresa" | "pessoas" | "grupos" | "acessos" | "perfil";

// Grupos internos: setores disponíveis e cargos selecionáveis em "Quem pode ver"
// por setor (Administrador é sempre implícito e não entra na lista).
const GRUPO_SETORES = ["Operacional", "Recrutamento"] as const;
const GRUPO_CARGOS_POR_SETOR: Record<string, Cargo[]> = {
  Operacional: ["Head Operacional", "Operacional"],
  Recrutamento: ["Recrutamento"],
};
const SETOR_COR: Record<string, string> = { Operacional: "#1B7F4D", Recrutamento: "#C2410C" };

/** Página de configurações: Empresa · Pessoas · Grupos · Acessos são só p/ Administrador;
 *  os demais cargos só enxergam o Perfil. */
export default function Config() {
  const { isAdmin } = useApp();
  const TABS: { key: ConfigTab; label: string }[] = [
    ...(isAdmin ? [{ key: "empresa" as ConfigTab, label: "Empresa" }] : []),
    ...(isAdmin ? [{ key: "pessoas" as ConfigTab, label: "Pessoas" }] : []),
    ...(isAdmin ? [{ key: "grupos" as ConfigTab, label: "Grupos" }] : []),
    ...(isAdmin ? [{ key: "acessos" as ConfigTab, label: "Acessos" }] : []),
    { key: "perfil", label: "Perfil" },
  ];
  const [tab, setTab] = useState<ConfigTab>("perfil");

  return (
    <div className="m-pad" style={css("padding:28px 30px;")}>
      <div style={css("display:flex; align-items:center; gap:16px; margin-bottom:20px;")}>
        <div style={{ flex: 1 }}>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Configurações</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>{TABS.find((t) => t.key === tab)?.label}</p>
        </div>
      </div>

      {/* Menu segmentado */}
      <div className="m-wrap" style={css("display:inline-flex; gap:3px; background:#EDEEF2; border-radius:11px; padding:3px; margin-bottom:20px;")}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={css(`border:none; cursor:pointer; font-size:13px; font-weight:600; padding:7px 16px; border-radius:8px; background:${active ? "#fff" : "transparent"}; color:${active ? "#1B1B28" : "#5B6472"}; box-shadow:${active ? "0 1px 2px rgba(16,24,40,.10)" : "none"};`)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "perfil" && <PerfilTab />}
      {tab === "empresa" && (isAdmin ? <EmpresaTab /> : <Placeholder titulo="Empresa" texto="Acesso restrito a Administrador." />)}
      {tab === "pessoas" && (isAdmin ? <PessoasTab /> : <Placeholder titulo="Pessoas" texto="Acesso restrito a Administrador." />)}
      {tab === "grupos" && (isAdmin ? <GruposTab /> : <Placeholder titulo="Grupos" texto="Acesso restrito a Administrador." />)}
      {tab === "acessos" && (isAdmin ? <AcessosTab /> : <Placeholder titulo="Acessos" texto="Acesso restrito a Administrador." />)}
    </div>
  );
}

/** Aba Empresa: edita nome e logo do espaço de trabalho (canto superior esquerdo). */
function EmpresaTab() {
  const { workspace, setWorkspace, restaurarDados } = useApp();
  const [nome, setNome] = useState(workspace.nome);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { const r = await uploadLocal(f); setWorkspace({ logo: r.url }); } catch { /* ignore */ }
  };
  const salvarNome = () => { const v = nome.trim() || "Ju Budelon"; setNome(v); if (v !== workspace.nome) setWorkspace({ nome: v }); };

  return (
    <div style={css("display:flex; flex-direction:column; gap:14px;")}>
      <div style={css("font-size:13px; font-weight:700; color:#7A8090;")}>Geral</div>
      <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; overflow:hidden;")}>
        {/* Avatar / logo */}
        <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} style={{ display: "none" }} />
        <div style={css("display:flex; align-items:center; gap:16px; padding:16px 20px; border-bottom:1px solid #F4F5F7;")}>
          <span style={css("flex:1; font-size:14px; font-weight:600; color:#1B1B28;")}>Avatar</span>
          <Hoverable onClick={() => fileRef.current?.click()} title="Trocar logo" s={css("position:relative; flex:none; cursor:pointer; width:38px; height:38px; border-radius:9px; border:1px solid #ECEDF1; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#fff;")} hover="border-color:#D6D7DE">
            <img src={workspace.logo || "/logo-2.png"} alt="logo" style={css("width:100%; height:100%; object-fit:contain;")} />
          </Hoverable>
          {workspace.logo && (
            <Hoverable as="button" onClick={() => setWorkspace({ logo: null })} title="Remover logo" s={css("flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:8px; padding:6px 10px; font-size:12px; font-weight:700; color:#CC3338; cursor:pointer;")} hover="background:#FDECEC">Remover</Hoverable>
          )}
        </div>
        {/* Nome */}
        <div className="m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:16px 20px;")}>
          <span style={css("flex:1; font-size:14px; font-weight:600; color:#1B1B28;")}>Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={salvarNome}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            placeholder="Ju Budelon"
            style={css("width:280px; max-width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; font-size:13.5px; padding:9px 12px; outline:none; text-align:right;")}
          />
        </div>
      </div>
      <p style={css("margin:0 2px; font-size:12px; color:#9398A6;")}>
        O nome e o logo aparecem no canto superior esquerdo e valem para todos os usuários.
      </p>

      <div style={css("font-size:13px; font-weight:700; color:#7A8090; margin-top:10px;")}>Dados de exemplo</div>
      <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:16px 20px; display:flex; align-items:center; gap:16px;")}>
        <div style={css("flex:1; min-width:0;")}>
          <div style={css("font-size:14px; font-weight:600; color:#1B1B28;")}>Restaurar dados de exemplo</div>
          <div style={css("font-size:12.5px; color:#9398A6; margin-top:3px; line-height:1.45;")}>Nesta fase o sistema não tem banco de dados: tudo fica salvo neste navegador. Este botão apaga as edições e volta ao cenário inicial (tarefas, candidatos, pessoas e grupos).</div>
        </div>
        <Hoverable as="button" onClick={() => setConfirmReset(true)} s={css("flex:none; border:1px solid #E2E3E9; background:#fff; border-radius:9px; padding:9px 16px; font-size:13px; font-weight:700; color:#CC3338; cursor:pointer;")} hover="background:#FDECEC; border-color:#F3C2C4">Restaurar</Hoverable>
      </div>
      {confirmReset && (
        <ConfirmModal
          titulo="Restaurar dados de exemplo"
          mensagem="Todas as edições feitas neste navegador serão perdidas e os dados voltam ao cenário inicial. Continuar?"
          confirmLabel="Restaurar"
          danger
          onConfirm={() => { restaurarDados(); setConfirmReset(false); setNome("Ju Budelon"); }}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}

/** Status Ativo/Inativo como dropdown. Reusado em Pessoas. */
function StatusPill({ ativo, onChange }: { ativo: boolean; onChange: (ativo: boolean) => void }) {
  const info = (a: boolean) =>
    a
      ? { bg: "#E7F6EC", fg: "#1B7F4D", dot: "#1B7F4D", lbl: "Ativo" }
      : { bg: "#F1F2F5", fg: "#8A90A0", dot: "#B6BAC4", lbl: "Inativo" };
  const c = info(ativo);
  return (
    <Menu width={150} trigger={(toggle, open) => (
      <Hoverable as="button" type="button" onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; border:1px solid ${open ? "#D6D7DE" : "transparent"}; background:${c.bg}; color:${c.fg}; font-size:11.5px; font-weight:700; cursor:pointer;`)} hover="border-color:#D6D7DE">
        <span style={css(`width:7px; height:7px; border-radius:50%; flex:none; background:${c.dot};`)} />{c.lbl}
        <Svg size={12} sw={2.4} stroke={c.fg} style={css(`flex:none; opacity:.7; transform:rotate(${open ? 180 : 0}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
      </Hoverable>
    )}>
      {(close) => [true, false].map((a) => {
        const i = info(a);
        return (
          <MenuItem key={String(a)} checked={a === ativo} onClick={() => { onChange(a); close(); }}>
            <span style={css(`width:9px; height:9px; border-radius:50%; flex:none; background:${i.dot};`)} /><span style={{ flex: 1 }}>{i.lbl}</span>
          </MenuItem>
        );
      })}
    </Menu>
  );
}

function PessoasTab() {
  const { team, updateUsuario } = useApp();
  const [criando, setCriando] = useState(false);
  const [verId, setVerId] = useState<string | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({}); // cargos recolhidos/expandidos (default: aberto)

  const pessoas = team
    .map((m) => ({ id: m.id, nome: m.nome, email: m.email ?? "—", cargo: m.cargo, cor: m.cor, ini: m.ini, foto: m.foto as string | undefined, ativo: m.ativo !== false, whatsapp: m.whatsapp ?? undefined, whatsappInterno: m.whatsappInterno ?? undefined }))
    .filter((p) => mostrarInativos || p.ativo);

  // Organiza por cargo, na ordem oficial de CARGOS; cada grupo ordenado por nome.
  const grupos = CARGOS
    .map((c) => ({ cargo: c as string, gente: pessoas.filter((p) => p.cargo === c).sort((a, b) => a.nome.localeCompare(b.nome, "pt")) }))
    .filter((g) => g.gente.length);
  const outros = pessoas.filter((p) => !CARGOS.includes(p.cargo as Cargo)).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  if (outros.length) grupos.push({ cargo: "Outros", gente: outros });

  const sel = pessoas.find((p) => p.id === verId);

  return (
    <div style={css("background:#fff; border:1px solid #E2E3E9; border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:14px;")}>
      {sel && <PessoaDrawer p={sel} onClose={() => setVerId(null)} />}

      <div className="m-wrap" style={css("display:flex; align-items:center; gap:10px;")}>
        <div style={{ flex: 1 }}>
          <div style={css("font-size:15px; font-weight:800;")}>Pessoas com acesso</div>
          <div style={css("font-size:12.5px; color:#9398A6; margin-top:2px;")}>{pessoas.length} {pessoas.length === 1 ? "pessoa" : "pessoas"} · clique num cargo para mostrar ou esconder.</div>
        </div>
        <Hoverable as="button" onClick={() => setMostrarInativos((v) => !v)} s={css(`display:inline-flex; align-items:center; gap:7px; border:1px solid ${mostrarInativos ? "#2563EB" : "#E2E3E9"}; background:${mostrarInativos ? "#EAF0FE" : "#fff"}; color:${mostrarInativos ? "#2563EB" : "#5B6472"}; cursor:pointer; font-weight:700; font-size:13px; padding:9px 14px; border-radius:9px;`)} hover={mostrarInativos ? undefined : "background:#F4F4F7"}>
          {mostrarInativos ? "Ocultar inativos" : "Mostrar inativos"}
        </Hoverable>
        {!criando && (
          <Hoverable as="button" onClick={() => setCriando(true)} s={css("display:inline-flex; align-items:center; gap:7px; border:none; cursor:pointer; background:#1B1B28; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:9px;")} hover="background:#000">
            <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>Criar pessoa
          </Hoverable>
        )}
      </div>

      {criando && <CriarPessoa onClose={() => setCriando(false)} />}

      {/* Grupos por cargo — linhas recolhíveis */}
      <div>
        {grupos.map((g) => {
          const cor = corDoCargo(g.cargo);
          const op = abertos[g.cargo] ?? true;
          return (
            <div key={g.cargo} style={css("margin-top:2px;")}>
              <Hoverable
                onClick={() => setAbertos((a) => ({ ...a, [g.cargo]: !(a[g.cargo] ?? true) }))}
                s={css(`display:flex; align-items:center; gap:9px; padding:8px; border-radius:8px; color:#3A3F4C; font-weight:700; font-size:13.5px; cursor:pointer; background:${op ? "#F4F4F7" : "transparent"};`)}
                hover="background:#F4F4F7"
              >
                <span style={css(`width:9px; height:9px; border-radius:50%; flex:none; background:${cor};`)} />
                <span style={{ flex: 1 }}>{g.cargo}</span>
                <span style={css("font-size:12px; font-weight:700; color:#9398A6;")}>{g.gente.length}</span>
                <Svg size={14} sw={2.4} stroke="#9398A6" style={css(`flex:none; transform:rotate(${op ? 180 : 0}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
              </Hoverable>

              {op && g.gente.map((p, i) => (
                <Hoverable key={p.id} onClick={() => setVerId(p.id)} s={css(`display:flex; align-items:center; gap:12px; padding:9px 10px 9px 14px; cursor:pointer; ${i < g.gente.length - 1 ? "border-bottom:1px solid #F4F5F7;" : ""} ${p.ativo ? "" : "opacity:.6;"}`)} hover="background:#FAFAFB">
                  <Avatar ini={p.ini} cor={p.cor} src={p.foto} size={32} radius="9px" fontSize={12.5} />
                  <div style={css("flex:1; min-width:0;")}>
                    <div style={css("font-weight:700; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{p.nome}</div>
                    <div style={css("font-size:12px; color:#9398A6; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{p.email}</div>
                  </div>
                  <div onClick={(e: React.MouseEvent) => e.stopPropagation()}><StatusPill ativo={p.ativo} onChange={(a) => updateUsuario(p.id, { ativo: a })} /></div>
                  <Svg size={17} sw={2.2} stroke="#C7CAD2" style={css("flex:none;")}><path d="m9 18 6-6-6-6" /></Svg>
                </Hoverable>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Pílula de setor (dot + texto colorido) — usada nos grupos internos. */
function SetorPill({ setor }: { setor: string }) {
  const cor = SETOR_COR[setor] ?? "#5B6472";
  return (
    <span style={css(`display:inline-flex; align-items:center; gap:5px; background:${cor}1A; color:${cor}; font-size:11px; font-weight:700; padding:2px 9px; border-radius:999px;`)}>
      <span style={css(`width:6px; height:6px; border-radius:50%; flex:none; background:${cor};`)} />
      {setor}
    </span>
  );
}

/** Aba "Grupos": grupos internos (nome + descrição + setor + quem pode ver). */
function GruposTab() {
  const { gruposInternos, removerGrupoInterno, workspace } = useApp();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<GrupoInterno | null>(null);
  const [excluindo, setExcluindo] = useState<GrupoInterno | null>(null);
  const logoEmpresa = workspace.logo || "/logo-2.png";

  const grupos = gruposInternos.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt"));

  return (
    <div style={css("background:#fff; border:1px solid #E2E3E9; border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:14px;")}>
      <div style={css("display:flex; align-items:center; gap:10px;")}>
        <div style={{ flex: 1 }}>
          <div style={css("font-size:15px; font-weight:800;")}>Grupos internos</div>
          <div style={css("font-size:12.5px; color:#9398A6; margin-top:2px;")}>{grupos.length} {grupos.length === 1 ? "grupo cadastrado" : "grupos cadastrados"} · organize as pessoas por setor e defina quem pode ver cada grupo.</div>
        </div>
        {!criando && !editando && (
          <Hoverable as="button" onClick={() => setCriando(true)} s={css("display:inline-flex; align-items:center; gap:7px; border:none; cursor:pointer; background:#1B1B28; color:#fff; font-weight:700; font-size:13px; padding:9px 16px; border-radius:9px;")} hover="background:#000">
            <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>Criar grupo
          </Hoverable>
        )}
      </div>

      {criando && <CriarGrupo onClose={() => setCriando(false)} />}
      {editando && <CriarGrupo inicial={editando} onClose={() => setEditando(null)} />}

      {grupos.length === 0 && !criando ? (
        <div style={css("padding:18px 4px; font-size:13px; color:#9398A6;")}>Nenhum grupo interno cadastrado ainda.</div>
      ) : (
        <div>
          {grupos.map((g, i) => (
            <div key={g.id} className="m-wrap" style={css(`display:flex; align-items:center; gap:12px; padding:11px 10px; ${i < grupos.length - 1 ? "border-bottom:1px solid #F4F5F7;" : ""}`)}>
              <Avatar ini={(g.nome[0] ?? "G").toUpperCase()} cor="#475569" src={g.logo || logoEmpresa} size={32} radius="9px" fontSize={12.5} />
              <div style={css("flex:1; min-width:0; display:flex; flex-direction:column; gap:3px;")}>
                <div style={css("font-weight:700; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{g.nome}</div>
                <div style={css("font-size:11.5px; color:#9398A6; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{g.descricao || "Sem descrição"}</div>
              </div>
              <div style={css("display:flex; gap:4px; flex:none;")}>{g.setores.map((s) => <SetorPill key={s} setor={s} />)}</div>
              <span style={css("font-size:11.5px; color:#9398A6; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{g.visivelCargos.length ? g.visivelCargos.join(", ") : "Só Administrador"}</span>
              <Hoverable as="button" onClick={() => { setEditando(g); setCriando(false); }} title="Editar" s={css("width:32px; height:32px; flex:none; border:1px solid #E2E3E9; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#5B6472;")} hover="background:#F4F4F7"><Svg size={15} stroke="#5B6472"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg></Hoverable>
              <Hoverable as="button" onClick={() => setExcluindo(g)} title="Excluir" s={css("width:32px; height:32px; flex:none; border:1px solid #E2E3E9; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#CC3338;")} hover="background:#FDF0F0"><Svg size={15} stroke="#CC3338"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></Svg></Hoverable>
            </div>
          ))}
        </div>
      )}
      {excluindo && (
        <ConfirmModal
          titulo="Excluir grupo"
          mensagem={<>Excluir o grupo <strong style={css("color:#1B1B28;")}>{excluindo.nome}</strong>? As pessoas continuam cadastradas.</>}
          confirmLabel="Excluir"
          danger
          onConfirm={() => { removerGrupoInterno(excluindo.id); setExcluindo(null); }}
          onClose={() => setExcluindo(null)}
        />
      )}
    </div>
  );
}

/** Formulário de criar/editar grupo interno. */
function CriarGrupo({ inicial, onClose }: { inicial?: GrupoInterno; onClose: () => void }) {
  const { criarGrupoInterno, updateGrupoInterno, workspace } = useApp();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [setores, setSetores] = useState<string[]>(inicial?.setores ?? []);
  const [visiveis, setVisiveis] = useState<string[]>(inicial?.visivelCargos ?? []);
  const [logo, setLogo] = useState(inicial?.logo ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const logoEmpresa = workspace.logo || "/logo-2.png";

  // Cargos que podem ver = união dos cargos dos setores selecionados.
  const cargosDoSetor = [...new Set(setores.flatMap((s) => GRUPO_CARGOS_POR_SETOR[s] ?? []))] as Cargo[];
  const toggleCargo = (c: string) => setVisiveis((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]));
  // Alterna um setor (multi-seleção) e remove cargos que deixaram de ser válidos.
  const toggleSetor = (s: string) => setSetores((prev) => {
    const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
    const validos = new Set(next.flatMap((x) => GRUPO_CARGOS_POR_SETOR[x] ?? []));
    setVisiveis((v) => v.filter((c) => validos.has(c as Cargo)));
    return next;
  });

  const lbl = css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;");
  const inp = css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; font-size:13.5px; padding:9px 12px; outline:none;");

  const salvar = () => {
    setErro(null);
    if (!nome.trim()) { setErro("Informe o nome do grupo."); return; }
    if (!setores.length) { setErro("Selecione ao menos um setor."); return; }
    const cargosValidos = visiveis.filter((c) => cargosDoSetor.includes(c as Cargo));
    const dados = { nome: nome.trim(), descricao: descricao.trim() || undefined, setores, visivelCargos: cargosValidos, logo: logo || undefined };
    if (inicial) updateGrupoInterno(inicial.id, dados);
    else criarGrupoInterno({ id: `g-${Date.now()}`, ...dados });
    onClose();
  };

  return (
    <div style={css("background:#fff; border:1px solid #E2E3E9; border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:14px;")}>
      <div style={css("display:flex; align-items:center; gap:10px;")}>
        <div style={css("font-size:15px; font-weight:800; flex:1;")}>{inicial ? "Editar grupo" : "Criar grupo"}</div>
        <Hoverable as="button" onClick={onClose} s={css("width:30px; height:30px; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
      </div>
      <div>
        <label style={lbl}>Logo do grupo</label>
        <FotoUpload ini={(nome[0] ?? "G").toUpperCase()} cor="#475569" foto={logo} defaultSrc={logoEmpresa} removerLabel="Usar logo da empresa" size={56} radius="12px" onChange={setLogo} />
      </div>
      <div className="m-grid-1" style={css("display:grid; grid-template-columns:1fr 1fr; gap:14px;")}>
        <div><label style={lbl}>Nome do grupo</label><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Time Operacional" style={inp} /></div>
        <div><label style={lbl}>Descrição</label><input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Para que serve este grupo" style={inp} /></div>
        <div>
          <label style={lbl}>Setor(es)</label>
          <Menu width={240} trigger={(toggle, open) => (
            <Hoverable as="button" type="button" onClick={toggle} s={css(`display:flex; align-items:center; gap:8px; width:100%; box-sizing:border-box; border:1px solid ${open ? "#D6D7DE" : "#E2E3E9"}; border-radius:9px; font-size:13.5px; padding:9px 12px; cursor:pointer; background:#fff; color:${setores.length ? "#1B1B28" : "#9398A6"};`)} hover="background:#FAFAFB">
              <span style={css("flex:1; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{setores.length ? setores.join(" / ") : "Selecionar setor(es)"}</span>
              <Svg size={13} sw={2.4} stroke="#9398A6" style={css(`flex:none; transform:rotate(${open ? 180 : 0}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
            </Hoverable>
          )}>
            {() => GRUPO_SETORES.map((s) => (
              <MenuItem key={s} checked={setores.includes(s)} onClick={() => toggleSetor(s)}>
                <span style={css(`width:9px; height:9px; border-radius:50%; flex:none; background:${SETOR_COR[s] ?? "#5B6472"};`)} />
                <span style={{ flex: 1, fontWeight: 600 }}>{s}</span>
              </MenuItem>
            ))}
          </Menu>
        </div>
        <div>
          <label style={lbl}>Quem pode ver</label>
          <Menu width={240} trigger={(toggle, open) => (
            <Hoverable as="button" type="button" onClick={setores.length ? toggle : undefined} s={css(`display:flex; align-items:center; gap:8px; width:100%; box-sizing:border-box; border:1px solid ${open ? "#D6D7DE" : "#E2E3E9"}; border-radius:9px; font-size:13.5px; padding:9px 12px; cursor:${setores.length ? "pointer" : "not-allowed"}; opacity:${setores.length ? 1 : 0.6}; background:#fff; color:${visiveis.length ? "#1B1B28" : "#9398A6"};`)} hover={setores.length ? "background:#FAFAFB" : undefined}>
              <span style={css("flex:1; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{visiveis.length ? visiveis.join(", ") : (setores.length ? "Selecionar cargos" : "Escolha o setor primeiro")}</span>
              <Svg size={13} sw={2.4} stroke="#9398A6" style={css(`flex:none; transform:rotate(${open ? 180 : 0}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
            </Hoverable>
          )}>
            {() => cargosDoSetor.length ? cargosDoSetor.map((c) => (
              <MenuItem key={c} checked={visiveis.includes(c)} onClick={() => toggleCargo(c)}>
                <span style={css(`width:10px; height:10px; border-radius:50%; flex:none; background:${corDoCargo(c)};`)} />
                <span style={{ flex: 1, fontWeight: 600 }}>{c}</span>
              </MenuItem>
            )) : <div style={css("padding:10px 12px; font-size:12.5px; color:#9398A6;")}>Selecione um setor.</div>}
          </Menu>
        </div>
      </div>
      <p style={css("margin:0; font-size:11.5px; color:#9398A6;")}>O Administrador sempre vê todos os grupos internos.</p>
      {erro && <div style={css("font-size:12.5px; color:#CC3338; font-weight:600;")}>{erro}</div>}
      <div style={css("display:flex; justify-content:flex-end; gap:10px;")}>
        <Hoverable as="button" onClick={onClose} s={css("border:1px solid #E2E3E9; background:#fff; border-radius:10px; padding:9px 16px; font-size:13.5px; font-weight:700; color:#5B6472; cursor:pointer;")} hover="background:#F4F4F7">Cancelar</Hoverable>
        <Hoverable as="button" onClick={salvar} s={css("border:none; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:700; color:#fff; cursor:pointer; background:#955C6B;")} hover="filter:brightness(1.08)">{inicial ? "Salvar" : "Criar grupo"}</Hoverable>
      </div>
    </div>
  );
}

/** Avatar clicável com upload de foto (data-URL) + remover. Reusado em Pessoas, Perfil e Grupos.
 *  `defaultSrc`: imagem mostrada quando não há foto própria (ex.: logo da empresa). */
function FotoUpload({ ini, cor, foto, size, radius, onChange, defaultSrc, removerLabel }: { ini: string; cor: string; foto?: string; size: number; radius: string; onChange: (foto: string) => void; defaultSrc?: string; removerLabel?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErro(null);
    try {
      // Redimensiona para 256px no navegador: o dado fica no localStorage nesta fase.
      const blob = await redimensionar(f, 256);
      const r = await uploadLocal(new File([blob], "foto.jpg", { type: "image/jpeg" }));
      onChange(r.url);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao carregar a foto.");
    }
  };
  const badge = Math.round(size * 0.4);
  return (
    <div style={css("display:flex; align-items:center; gap:14px;")}>
      <input ref={ref} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
      <Hoverable onClick={() => ref.current?.click()} title="Trocar foto" s={css(`position:relative; flex:none; cursor:pointer; border-radius:${radius};`)} hover="filter:brightness(0.96)">
        <Avatar ini={ini} cor={cor} src={foto || defaultSrc} size={size} radius={radius} fontSize={Math.round(size * 0.4)} />
        <span style={css(`position:absolute; right:-3px; bottom:-3px; width:${badge}px; height:${badge}px; border-radius:50%; background:#1B1B28; border:2px solid #fff; display:flex; align-items:center; justify-content:center; color:#fff;`)}>
          <Svg size={Math.round(badge * 0.55)} sw={2}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="3.5" /></Svg>
        </span>
      </Hoverable>
      {foto && (
        <Hoverable as="button" onClick={() => onChange("")} s={css("border:1px solid #ECEDF1; background:#fff; border-radius:8px; padding:6px 11px; font-size:12px; font-weight:700; color:#CC3338; cursor:pointer;")} hover="background:#FDECEC">{removerLabel ?? "Remover foto"}</Hoverable>
      )}
      {erro && <span style={css("font-size:12px; color:#CC3338; font-weight:600;")}>{erro}</span>}
    </div>
  );
}

/** Reduz a imagem para caber em `max`px (lado maior), como JPEG. Avatar não precisa de mais. */
function redimensionar(f: File, max: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const esc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * esc));
      c.height = Math.max(1, Math.round(img.height * esc));
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("canvas indisponível"));
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); // JPEG não tem transparência
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("falha ao converter a imagem"))), "image/jpeg", 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("imagem inválida")); };
    img.src = url;
  });
}

/** Detalhe + edição de uma pessoa em drawer lateral (nome e cargo editáveis). */
function PessoaDrawer({ p, onClose }: { p: { id: string; nome: string; email: string; cargo: string; cor: string; ini: string; foto?: string; ativo: boolean; whatsapp?: string; whatsappInterno?: string }; onClose: () => void }) {
  const { updateUsuario } = useApp();
  const [nome, setNome] = useState(p.nome);
  const [cargo, setCargo] = useState(p.cargo);
  const ini = inits(nome);

  const salvarNome = () => { const v = nome.trim(); if (v && v !== p.nome) updateUsuario(p.id, { nome: v, ini: inits(v) }); else if (!v) setNome(p.nome); };
  const lbl = css("width:130px; flex:none; font-size:13px; color:#7A8090; font-weight:600;");
  const row = css("display:flex; align-items:center; gap:16px; padding:13px 0; border-bottom:1px solid #F4F5F7;");
  const fieldInp = css("flex:1; min-width:0; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; font-size:14px; font-weight:600; color:#1B1B28; padding:9px 12px; outline:none; background:#fff;");
  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; background:rgba(20,24,40,.30); z-index:50;")} />
      <div className="m-drawer" style={css("position:fixed; top:0; right:0; bottom:0; width:480px; max-width:96vw; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); z-index:51; display:flex; flex-direction:column;")}>
        <div style={css("display:flex; align-items:center; gap:14px; padding:22px 24px; border-bottom:1px solid #ECEDF1; flex:none;")}>
          <Avatar ini={ini} cor={p.cor} src={p.foto} size={52} radius="13px" fontSize={20} />
          <div style={css("flex:1; min-width:0;")}>
            <div style={css("font-size:18px; font-weight:800; letter-spacing:-0.3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{nome || "—"}</div>
            <div style={css("font-size:13px; color:#7A8090; font-weight:600; margin-top:2px;")}>{cargo}</div>
          </div>
          <Hoverable as="button" onClick={onClose} s={css("width:34px; height:34px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7">
            <Svg size={16} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg>
          </Hoverable>
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:8px 24px 24px;")}>
          {/* Foto (upload) */}
          <div style={row}>
            <span style={lbl}>Foto</span>
            <div style={{ flex: 1 }}>
              <FotoUpload ini={ini} cor={p.cor} foto={p.foto} size={48} radius="12px" onChange={(f) => updateUsuario(p.id, { foto: f })} />
            </div>
          </div>
          {/* Nome (editável) */}
          <div style={row}>
            <span style={lbl}>Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} onBlur={salvarNome} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} style={fieldInp} />
          </div>
          {/* Cargo (dropdown editável) */}
          <div style={row}>
            <span style={lbl}>Cargo</span>
            <div style={{ flex: 1 }}>
              <Menu width={210} trigger={(toggle, open) => {
                const cor = corDoCargo(cargo);
                return (
                  <Hoverable as="button" type="button" onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700; padding:6px 12px; border-radius:999px; cursor:pointer; background:${cor}1A; color:${cor}; border:1px solid ${open ? "#D6D7DE" : "transparent"};`)} hover={`background:${cor}26`}>
                    <span style={css(`width:7px; height:7px; border-radius:50%; flex:none; background:${cor};`)} />
                    <span>{cargo}</span>
                    <Svg size={12} sw={2.4} stroke={cor} style={css(`flex:none; transform:rotate(${open ? 180 : 0}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
                  </Hoverable>
                );
              }}>
                {(close) => CARGOS.map((c) => (
                  <MenuItem key={c} checked={c === cargo} onClick={() => { setCargo(c); updateUsuario(p.id, { cargo: c }); close(); }}>
                    <span style={css(`width:10px; height:10px; border-radius:50%; flex:none; background:${corDoCargo(c)};`)} />
                    <span style={{ flex: 1, fontWeight: 600 }}>{c}</span>
                  </MenuItem>
                ))}
              </Menu>
            </div>
          </div>
          {/* Status (Ativo/Inativo) */}
          <div style={row}>
            <span style={lbl}>Status</span>
            <div style={{ flex: 1 }}><StatusPill ativo={p.ativo} onChange={(a) => updateUsuario(p.id, { ativo: a })} /></div>
          </div>
          {/* WhatsApp (editável com lápis) */}
          <div style={row}>
            <span style={lbl}>WhatsApp</span>
            <div style={css("flex:1; min-width:0;")}>
              <EditableTitle fill value={p.whatsapp ?? ""} placeholder="—" onSave={(v) => updateUsuario(p.id, { whatsapp: v.trim() })} textStyle="font-size:14px; font-weight:600; color:#1B1B28;" />
            </div>
          </div>
          {/* WhatsApp interno (editável com lápis) */}
          <div style={row}>
            <span style={lbl}>WhatsApp interno</span>
            <div style={css("flex:1; min-width:0;")}>
              <EditableTitle fill value={p.whatsappInterno ?? ""} placeholder="—" onSave={(v) => updateUsuario(p.id, { whatsappInterno: v.trim() })} textStyle="font-size:14px; font-weight:600; color:#1B1B28;" />
            </div>
          </div>
          {/* E-mail (editável com lápis — é a identidade de login) */}
          <div style={row}>
            <span style={lbl}>E-mail</span>
            <div style={css("flex:1; min-width:0;")}>
              <EditableTitle fill value={p.email && p.email !== "—" ? p.email : ""} placeholder="—" onSave={(v) => updateUsuario(p.id, { email: v.trim().toLowerCase() })} textStyle="font-size:14px; font-weight:600; color:#1B1B28;" />
            </div>
          </div>
          <div style={row}><span style={lbl}>Iniciais</span><span style={css("flex:1; font-size:14px; font-weight:600; color:#1B1B28;")}>{ini}</span></div>
          <div style={css("display:flex; align-items:center; gap:16px; padding:13px 0;")}><span style={lbl}>ID do usuário</span><span style={css("flex:1; font-size:14px; font-weight:600; color:#9398A6;")}>{p.id}</span></div>
          <SenhaPessoa id={p.id} nome={p.nome} email={p.email} />
        </div>
      </div>
    </>
  );
}

/** Define a senha de OUTRA pessoa — só Administrador. */
function SenhaPessoa({ id, nome, email }: { id: string; nome: string; email: string }) {
  const { currentUser, setSenha: gravarSenha } = useApp();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [reveal, setReveal] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  if (currentUser.cargo !== "Administrador") return null;
  const temEmail = !!email.trim() && email.trim() !== "—";
  const primeiro = nome.trim().split(" ")[0] || "a pessoa";

  // Sugestão pronta (8 caracteres).
  const gerar = () => {
    const s = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6).toUpperCase();
    setSenha(s); setConfirmar(s); setReveal(true); setMsg(null);
  };

  const salvar = () => {
    setMsg(null);
    if (senha.length < 6) { setMsg({ ok: false, texto: "A senha precisa ter ao menos 6 caracteres." }); return; }
    if (senha !== confirmar) { setMsg({ ok: false, texto: "As senhas não conferem." }); return; }
    const r = gravarSenha(id, senha);
    if (!r.ok) { setMsg({ ok: false, texto: r.error ?? "Falha ao trocar a senha." }); return; }
    setMsg({ ok: true, texto: `Senha alterada. Passe a nova senha para ${primeiro} — já vale no próximo login.` });
    setConfirmar("");
  };

  const f = forcaSenha(senha);
  const inpField = css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; font-size:13.5px; padding:9px 38px 9px 12px; outline:none;");
  const olho = (
    <Hoverable as="button" type="button" onClick={() => setReveal((v) => !v)} title={reveal ? "Ocultar" : "Mostrar"} s={css("position:absolute; right:8px; top:50%; transform:translateY(-50%); border:none; background:transparent; cursor:pointer; color:#9398A6; display:flex; padding:2px;")} hover="color:#5B6472">
      {reveal
        ? <Svg size={16}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M3 3l18 18" /></Svg>
        : <Svg size={16}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>}
    </Hoverable>
  );

  return (
    <div style={css("border-top:1px solid #F4F5F7; padding-top:16px; margin-top:6px;")}>
      <div style={css("display:flex; align-items:center; gap:10px;")}>
        <span style={css("flex:1; font-size:13px; font-weight:700; color:#1B1B28;")}>Senha de acesso</span>
        <Hoverable as="button" type="button" onClick={() => { setAberto((v) => !v); setMsg(null); }} s={css("display:inline-flex; align-items:center; gap:7px; border:1px solid #E2E3E9; background:#fff; color:#5B6472; border-radius:9px; padding:7px 13px; font-size:12.5px; font-weight:700; cursor:pointer;")} hover="background:#F4F4F7">
          <Svg size={14} sw={2.2}><rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></Svg>
          {aberto ? "Cancelar" : "Definir nova senha"}
        </Hoverable>
      </div>
      {!temEmail && (
        <div style={css("font-size:12.5px; color:#9398A6; font-weight:600; margin-top:8px;")}>Sem e-mail cadastrado — esta pessoa não tem login.</div>
      )}
      {aberto && temEmail && (
        <div style={css("display:flex; flex-direction:column; gap:12px; padding:14px 0 4px;")}>
          <div>
            <label style={css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;")}>Nova senha</label>
            <div style={css("position:relative;")}>
              <input type={reveal ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={inpField} />
              {olho}
            </div>
            <ForcaBarra f={f} />
          </div>
          <div>
            <label style={css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;")}>Confirmar nova senha</label>
            <div style={css("position:relative;")}>
              <input type={reveal ? "text" : "password"} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") salvar(); }} placeholder="Repita a nova senha" style={inpField} />
              {olho}
            </div>
          </div>
          <div style={css("display:flex; align-items:center; gap:16px; flex-wrap:wrap;")}>
            <Hoverable as="button" type="button" onClick={salvar} s={css("border:none; border-radius:9px; padding:10px 18px; font-size:13px; font-weight:700; color:#fff; cursor:pointer; background:#955C6B;")} hover="filter:brightness(1.07)">Salvar nova senha</Hoverable>
            <Hoverable as="button" type="button" onClick={gerar} s={css("border:none; background:transparent; color:#955C6B; cursor:pointer; font-size:12.5px; font-weight:700; padding:0; text-decoration:underline;")} hover="filter:brightness(1.1)">Gerar uma senha</Hoverable>
          </div>
        </div>
      )}
      {msg && (
        <div style={css(`font-size:12.5px; font-weight:600; padding:8px 12px; border-radius:9px; margin-top:10px; ${msg.ok ? "background:#E8F6EE; color:#1B7F4D;" : "background:#FDECEC; color:#CC3338;"}`)}>{msg.texto}</div>
      )}
    </div>
  );
}

function CriarPessoa({ onClose }: { onClose: () => void }) {
  const { addUsuario } = useApp();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState<Cargo>("Operacional");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const gerarSenha = () => setSenha(Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6).toUpperCase());

  const salvar = () => {
    setErro(null);
    const id = `u-${Date.now()}`;
    const r = addUsuario({ id, nome: nome.trim(), email: email.trim().toLowerCase(), cargo, ini: inits(nome), cor: corDoCargo(cargo), ativo: true }, senha);
    if (!r.ok) { setErro(r.error ?? "Falha ao criar."); return; }
    onClose();
  };

  const lbl = css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;");
  const inp = css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; font-size:13.5px; padding:9px 12px; outline:none;");

  return (
    <div style={css("background:#fff; border:1px solid #E2E3E9; border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:14px;")}>
      <div style={css("display:flex; align-items:center; gap:10px;")}>
        <div style={css("font-size:15px; font-weight:800; flex:1;")}>Criar pessoa</div>
        <Hoverable as="button" onClick={onClose} s={css("width:30px; height:30px; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
      </div>
      <div className="m-grid-1" style={css("display:grid; grid-template-columns:1fr 1fr; gap:14px;")}>
        <div><label style={lbl}>Nome</label><input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" style={inp} /></div>
        <div><label style={lbl}>E-mail</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" style={inp} /></div>
        <div>
          <label style={lbl}>Cargo (nível de acesso)</label>
          <div>
            <Menu width={210} trigger={(toggle, open) => {
              const cor = corDoCargo(cargo);
              return (
                <Hoverable as="button" type="button" onClick={toggle} s={css(`display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700; padding:6px 12px; border-radius:999px; cursor:pointer; background:${cor}1A; color:${cor}; border:1px solid ${open ? "#D6D7DE" : "transparent"};`)} hover={`background:${cor}26`}>
                  <span style={css(`width:7px; height:7px; border-radius:50%; flex:none; background:${cor};`)} />
                  <span>{cargo}</span>
                  <Svg size={12} sw={2.4} stroke={cor} style={css(`flex:none; transform:rotate(${open ? 180 : 0}deg); transition:transform .15s ease;`)}><path d="m6 9 6 6 6-6" /></Svg>
                </Hoverable>
              );
            }}>
              {(close) => CARGOS.map((c) => (
                <MenuItem key={c} checked={c === cargo} onClick={() => { setCargo(c); close(); }}>
                  <span style={css(`width:10px; height:10px; border-radius:50%; flex:none; background:${corDoCargo(c)};`)} />
                  <span style={{ flex: 1, fontWeight: 600 }}>{c}</span>
                </MenuItem>
              ))}
            </Menu>
          </div>
        </div>
        <div>
          <label style={lbl}>Senha temporária</label>
          <div style={css("position:relative;")}>
            <input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mín. 6 caracteres" style={{ ...inp, paddingRight: 62 }} />
            <Hoverable as="button" onClick={gerarSenha} title="Gerar senha" s={css("position:absolute; right:6px; top:50%; transform:translateY(-50%); border:none; background:transparent; padding:4px 8px; font-size:12px; font-weight:700; color:#955C6B; cursor:pointer;")} hover="color:#7E4A59">Gerar</Hoverable>
          </div>
        </div>
      </div>
      {erro && <div style={css("font-size:12.5px; color:#CC3338; font-weight:600;")}>{erro}</div>}
      <div style={css("display:flex; justify-content:flex-end; gap:10px;")}>
        <Hoverable as="button" onClick={onClose} s={css("border:1px solid #E2E3E9; background:#fff; border-radius:10px; padding:9px 16px; font-size:13.5px; font-weight:700; color:#5B6472; cursor:pointer;")} hover="background:#F4F4F7">Cancelar</Hoverable>
        <Hoverable as="button" onClick={salvar} s={css("border:none; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:700; color:#fff; cursor:pointer; background:#955C6B;")} hover="filter:brightness(1.08)">Criar conta</Hoverable>
      </div>
      <p style={css("margin:0; font-size:11.5px; color:#9398A6;")}>A pessoa entra com o e-mail e a senha temporária; recomende trocar a senha no primeiro acesso.</p>
    </div>
  );
}

function inits(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] ?? ""))).toUpperCase() || "?";
}

/** Força da senha → nível 0–3 (—/Fraca/Média/Forte) + cor. */
function forcaSenha(s: string): { nivel: number; label: string; cor: string } {
  if (!s) return { nivel: 0, label: "", cor: "#E9EAEE" };
  let n = 0;
  if (s.length >= 6) n++;
  if (s.length >= 10) n++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) n++;
  if (/\d/.test(s) && /[^A-Za-z0-9]/.test(s)) n++;
  const nivel = Math.min(3, Math.max(1, n));
  const map = [
    { label: "", cor: "#E9EAEE" },
    { label: "Fraca", cor: "#E5484D" },
    { label: "Média", cor: "#F76808" },
    { label: "Forte", cor: "#1B7F4D" },
  ];
  return { nivel, ...map[nivel] };
}

function ForcaBarra({ f }: { f: { nivel: number; label: string; cor: string } }) {
  return (
    <div style={css("display:flex; align-items:center; gap:9px; margin-top:8px;")}>
      <div style={css("flex:1; display:flex; gap:4px;")}>
        {[1, 2, 3].map((i) => (
          <span key={i} style={css(`flex:1; height:5px; border-radius:999px; background:${f.nivel >= i ? f.cor : "#E9EAEE"}; transition:background .15s ease;`)} />
        ))}
      </div>
      <span style={css(`font-size:11.5px; font-weight:700; color:${f.nivel ? f.cor : "#9398A6"}; width:46px; text-align:right;`)}>{f.label || "—"}</span>
    </div>
  );
}

/** Perfil do usuário logado. */
function PerfilTab() {
  const { currentUser, logout, updateUsuario, setSenha: gravarSenha } = useApp();
  const u = currentUser;
  const fields: { label: string; value: string }[] = [
    { label: "Nome", value: u.nome },
    { label: "E-mail", value: u.email || "—" },
    { label: "Cargo", value: u.cargo },
    { label: "Iniciais", value: u.ini },
    { label: "ID do usuário", value: u.id },
  ];

  const [pwOpen, setPwOpen] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pwReveal, setPwReveal] = useState(false);

  const salvarSenha = () => {
    setPwMsg(null);
    if (novaSenha.length < 6) { setPwMsg({ ok: false, texto: "A senha precisa ter ao menos 6 caracteres." }); return; }
    if (novaSenha !== confirmar) { setPwMsg({ ok: false, texto: "As senhas não conferem." }); return; }
    const r = gravarSenha(u.id, novaSenha);
    if (!r.ok) { setPwMsg({ ok: false, texto: r.error ?? "Falha ao trocar a senha." }); return; }
    setNovaSenha(""); setConfirmar("");
    setPwMsg({ ok: true, texto: "Senha alterada com sucesso." });
  };

  return (
    <>
      <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; overflow:hidden;")}>
        <div style={css("display:flex; align-items:center; gap:14px; padding:22px 24px; border-bottom:1px solid #ECEDF1;")}>
          <Avatar ini={u.ini} cor={u.cor} src={u.foto} size={56} radius="14px" fontSize={22} />
          <div style={css("min-width:0;")}>
            <div style={css("font-size:18px; font-weight:800; letter-spacing:-0.3px;")}>{u.nome}</div>
            <div style={css("font-size:13px; color:#7A8090; font-weight:600; margin-top:2px;")}>{u.cargo}</div>
          </div>
        </div>

        <div style={css("padding:8px 24px 16px;")}>
          <div style={css("display:flex; align-items:center; gap:16px; padding:13px 0; border-bottom:1px solid #F4F5F7;")}>
            <span style={css("width:140px; flex:none; font-size:13px; color:#7A8090; font-weight:600;")}>Foto</span>
            <div style={{ flex: 1 }}>
              <FotoUpload ini={u.ini} cor={u.cor} foto={u.foto} size={48} radius="12px" onChange={(f) => updateUsuario(u.id, { foto: f })} />
            </div>
          </div>
          {fields.map((f) => (
            <div key={f.label} style={css("display:flex; align-items:center; gap:16px; padding:13px 0; border-bottom:1px solid #F4F5F7;")}>
              <span style={css("width:140px; flex:none; font-size:13px; color:#7A8090; font-weight:600;")}>{f.label}</span>
              <span style={css("flex:1; min-width:0; font-size:14px; font-weight:600; color:#1B1B28; overflow:hidden; text-overflow:ellipsis;")}>{f.value}</span>
            </div>
          ))}
          {/* Senha (alterar) */}
          <div style={css("display:flex; align-items:center; gap:16px; padding:13px 0;")}>
            <span style={css("width:140px; flex:none; font-size:13px; color:#7A8090; font-weight:600;")}>Senha</span>
            <div style={{ flex: 1 }}>
              <Hoverable as="button" onClick={() => { setPwOpen((v) => !v); setPwMsg(null); }} s={css("display:inline-flex; align-items:center; gap:8px; border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; border-radius:9px; padding:8px 14px; font-size:13px; font-weight:700; cursor:pointer;")} hover="background:#F4F4F7">
                <Svg size={15} sw={2}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>
                {pwOpen ? "Fechar" : "Alterar senha"}
              </Hoverable>
            </div>
          </div>
          {pwOpen && (() => {
            const f = forcaSenha(novaSenha);
            const inpField = css("width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; font-size:13.5px; padding:9px 38px 9px 12px; outline:none;");
            const eye = (
              <Hoverable as="button" type="button" onClick={() => setPwReveal((v) => !v)} title={pwReveal ? "Ocultar" : "Mostrar"} s={css("position:absolute; right:8px; top:50%; transform:translateY(-50%); border:none; background:transparent; cursor:pointer; color:#9398A6; display:flex; padding:2px;")} hover="color:#5B6472">
                {pwReveal
                  ? <Svg size={16}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M3 3l18 18" /></Svg>
                  : <Svg size={16}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>}
              </Hoverable>
            );
            return (
              <div style={css("display:flex; flex-direction:column; gap:12px; padding:6px 0 16px; max-width:440px;")}>
                <div>
                  <label style={css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;")}>Nova senha</label>
                  <div style={css("position:relative;")}>
                    <input type={pwReveal ? "text" : "password"} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={inpField} />
                    {eye}
                  </div>
                  <ForcaBarra f={f} />
                </div>
                <div>
                  <label style={css("display:block; font-size:12px; font-weight:700; color:#5B6472; margin-bottom:6px;")}>Confirmar nova senha</label>
                  <div style={css("position:relative;")}>
                    <input type={pwReveal ? "text" : "password"} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") salvarSenha(); }} placeholder="Repita a nova senha" style={inpField} />
                    {eye}
                  </div>
                </div>
                <div style={css("display:flex; align-items:center; gap:16px; margin-top:2px; flex-wrap:wrap;")}>
                  <Hoverable as="button" onClick={salvarSenha} s={css("border:none; border-radius:9px; padding:10px 18px; font-size:13px; font-weight:700; color:#fff; cursor:pointer; background:#955C6B;")} hover="filter:brightness(1.07)">Salvar nova senha</Hoverable>
                </div>
                {pwMsg && (
                  <div style={css(`font-size:12.5px; font-weight:600; padding:8px 12px; border-radius:9px; ${pwMsg.ok ? "background:#E8F6EE; color:#1B7F4D;" : "background:#FDECEC; color:#CC3338;"}`)}>{pwMsg.texto}</div>
                )}
              </div>
            );
          })()}
        </div>

        <div style={css("display:flex; justify-content:flex-end; padding:16px 24px 22px;")}>
          <Hoverable as="button" onClick={logout} s={css("display:inline-flex; align-items:center; gap:8px; border:1px solid #F5C2C2; background:#fff; color:#CC3338; border-radius:9px; padding:9px 16px; font-size:13.5px; font-weight:700; cursor:pointer;")} hover="background:#FDECEC">
            <Svg size={15} sw={2.2}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Svg>
            Sair do sistema
          </Hoverable>
        </div>
      </div>

      <p style={css("margin:16px 2px 0; font-size:12px; color:#9398A6;")}>
        Você pode trocar sua <strong>foto</strong> e a <strong>senha</strong> aqui. Os demais dados (nome, cargo, e-mail) são geridos por um administrador.
      </p>
    </>
  );
}

// Ciclo dos 3 estados de acesso a uma tela.
const NIVEIS: NivelAcesso[] = ["nenhum", "ver", "editar"];
const proximoNivel = (n: NivelAcesso): NivelAcesso => NIVEIS[(NIVEIS.indexOf(n) + 1) % 3];
const ICONE_NIVEL: Record<NivelAcesso, React.ReactNode> = {
  nenhum: <Svg size={13} sw={2.4}><path d="M5 12h14" /></Svg>,
  ver: <Svg size={13} sw={2}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Svg>,
  editar: <Svg size={12} sw={2.2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>,
};

/** Aba Acessos: matriz cargo × tela com 3 níveis (Sem acesso / Visualizar /
 *  Editar) + escopo "ver só o que é dele" por cargo. Administrador é total. */
function AcessosTab() {
  const { acessos, setAcessos, escopoProprio, setEscopoProprio } = useApp();

  // Estado inicial dos níveis: o que já estiver salvo tem prioridade; senão o padrão de código.
  const [map, setMap] = useState<Record<string, Record<string, NivelAcesso>>>(() => {
    const m: Record<string, Record<string, NivelAcesso>> = {};
    for (const c of CARGOS) {
      if (c === "Administrador") continue;
      m[c] = {};
      for (const sp of spacesTree) for (const kid of sp.children) {
        m[c][kid.page] = acessos[c]?.[kid.page] ?? nivelPadrao(c, sp.id, kid.page);
      }
    }
    return m;
  });

  const [escopo, setEscopo] = useState<Record<string, boolean>>(() => {
    const e: Record<string, boolean> = {};
    for (const c of CARGOS) {
      if (c === "Administrador") continue;
      e[c] = escopoProprio[c] ?? DEFAULT_ESCOPO[c] ?? false;
    }
    return e;
  });

  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const nivel = (cargo: string, page: string): NivelAcesso => map[cargo]?.[page] ?? "editar";
  const cicla = (cargo: string, page: ScreenPage) => {
    setMsg(null);
    setMap((m) => ({ ...m, [cargo]: { ...m[cargo], [page]: proximoNivel(m[cargo]?.[page] ?? "editar") } }));
  };
  const toggleEscopo = (cargo: string) => {
    setMsg(null);
    setEscopo((e) => ({ ...e, [cargo]: !e[cargo] }));
  };

  const salvar = () => {
    const nextAcessos: Record<string, Record<string, NivelAcesso>> = {};
    for (const c of CARGOS) {
      if (c === "Administrador") continue;
      for (const sp of spacesTree) for (const kid of sp.children) (nextAcessos[c] ??= {})[kid.page] = nivel(c, kid.page);
    }
    setAcessos(nextAcessos);
    setEscopoProprio(Object.fromEntries(CARGOS.filter((c) => c !== "Administrador").map((c) => [c, !!escopo[c]])));
    setMsg({ ok: true, texto: "Permissões salvas." });
  };

  // Mostrar/esconder cada setor (igual à árvore SETORES do menu lateral).
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(spacesTree.map((sp) => [sp.id, true])),
  );
  const toggleSetor = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // Mesma grade para cabeçalho e linhas → colunas de cargo sempre alinhadas.
  const GRID = `display:grid; grid-template-columns:minmax(170px,1fr) repeat(${CARGOS.length}, 110px); align-items:center;`;
  const MIN_W = 170 + CARGOS.length * 110 + 16;

  // Pílula de 3 estados de uma célula (cargo × tela).
  const NivelCell = ({ cargo, page }: { cargo: string; page: ScreenPage }) => {
    const admin = cargo === "Administrador";
    const n: NivelAcesso = admin ? "editar" : nivel(cargo, page);
    const cor = corDoCargo(cargo);
    const estilo =
      n === "editar" ? `background:${cor}; color:#fff; border:1px solid ${cor};`
      : n === "ver" ? `background:${cor}1A; color:${cor}; border:1px solid ${cor}55;`
      : "background:#fff; color:#C4C8D0; border:1px dashed #D7DAE0;";
    return (
      <div style={css("display:flex; justify-content:center; padding:5px 8px;")}>
        <Hoverable
          as="button"
          type="button"
          onClick={admin ? undefined : () => cicla(cargo, page)}
          title={admin ? "Editar" : n === "nenhum" ? "Sem acesso" : n === "ver" ? "Visualizar" : "Editar"}
          s={css(`display:inline-flex; align-items:center; justify-content:center; width:30px; height:26px; border-radius:8px; cursor:${admin ? "not-allowed" : "pointer"}; ${estilo} ${admin ? "opacity:.55;" : ""}`)}
          hover={admin ? undefined : "filter:brightness(0.97)"}
        >
          {ICONE_NIVEL[n]}
        </Hoverable>
      </div>
    );
  };

  return (
    <div style={css("background:#fff; border:1px solid #E2E3E9; border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:14px;")}>
      <div style={css("display:flex; align-items:center; gap:10px;")}>
        <div style={{ flex: 1 }}>
          <div style={css("font-size:15px; font-weight:800;")}>Acessos e permissões por cargo</div>
          <div style={css("font-size:12.5px; color:#9398A6; margin-top:2px;")}>Clique na célula para alternar entre Sem acesso · Visualizar · Editar. Administrador tem acesso total.</div>
        </div>
        <Hoverable as="button" onClick={salvar} s={css("border:none; cursor:pointer; font-size:13px; font-weight:700; padding:9px 18px; border-radius:9px; background:#1B1B28; color:#fff;")} hover="background:#000">
          Salvar
        </Hoverable>
      </div>

      {/* Legenda dos 3 estados */}
      <div style={css("display:flex; gap:16px; flex-wrap:wrap; font-size:12px; color:#5B6472;")}>
        {([["nenhum", "Sem acesso"], ["ver", "Visualizar"], ["editar", "Editar"]] as [NivelAcesso, string][]).map(([k, lbl]) => (
          <span key={k} style={css("display:inline-flex; align-items:center; gap:6px;")}>
            <span style={css(`display:inline-flex; align-items:center; justify-content:center; width:24px; height:21px; border-radius:7px; ${k === "editar" ? "background:#5B6472; color:#fff; border:1px solid #5B6472;" : k === "ver" ? "background:#5B64721A; color:#5B6472; border:1px solid #5B647255;" : "background:#fff; color:#C4C8D0; border:1px dashed #D7DAE0;"}`)}>{ICONE_NIVEL[k]}</span>
            {lbl}
          </span>
        ))}
      </div>

      {msg && (
        <div style={css(`font-size:12.5px; font-weight:600; padding:8px 12px; border-radius:9px; ${msg.ok ? "background:#E8F6EE; color:#1B7F4D;" : "background:#FDECEC; color:#CC3338;"}`)}>{msg.texto}</div>
      )}

      <div style={css("overflow-x:auto;")}>
        <div style={css(`min-width:${MIN_W}px;`)}>
          {/* Cabeçalho: "Tela" + um cargo por coluna */}
          <div style={css(`${GRID} align-items:end; padding:0 8px 10px; border-bottom:1px solid #ECEDF1;`)}>
            <span style={css("font-size:12px; font-weight:700; color:#5B6472;")}>Tela</span>
            {CARGOS.map((c) => (
              <span key={c} style={css(`text-align:center; font-size:11px; font-weight:700; line-height:1.25; padding:0 4px; color:${corDoCargo(c)};`)}>{c}</span>
            ))}
          </div>

          {spacesTree.map((sp) => {
            const op = !!open[sp.id];
            return (
              <div key={sp.id} style={css("margin-top:6px;")}>
                <Hoverable
                  onClick={() => toggleSetor(sp.id)}
                  s={css(`display:flex; align-items:center; gap:9px; padding:8px; border-radius:8px; color:#3A3F4C; font-weight:700; font-size:13.5px; cursor:pointer; background:${op ? "#F4F4F7" : "transparent"};`)}
                  hover="background:#F4F4F7"
                >
                  <span style={css("flex:none; display:flex; color:#5B6472;")}>{sectorIcon[sp.id]}</span>
                  <span style={{ flex: 1 }}>{sp.label}</span>
                  <Svg size={14} sw={2.4} stroke="#9398A6" style={css(`flex:none; transform:rotate(${op ? 180 : 0}deg); transition:transform .15s ease;`)}>
                    <path d="m6 9 6 6 6-6" />
                  </Svg>
                </Hoverable>

                {op && sp.children.map((kid, i) => {
                  const last = i === sp.children.length - 1;
                  return (
                    <div key={kid.page} style={css(`${GRID}`)}>
                      <div style={css("position:relative; padding:8px 8px 8px 30px; font-size:13px; font-weight:500; color:#5B6472;")}>
                        <span style={css(`position:absolute; left:22px; top:0; width:1.5px; background:#D7DAE0; ${last ? "height:50%" : "bottom:0"}`)} />
                        <span style={css("position:absolute; left:22px; top:50%; width:12px; height:1.5px; background:#D7DAE0; transform:translateY(-50%);")} />
                        {kid.label}
                      </div>
                      {CARGOS.map((c) => (
                        <NivelCell key={c} cargo={c} page={kid.page} />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Escopo: ver só o que é dele (por cargo) */}
          <div style={css(`${GRID} margin-top:18px; padding-top:12px; border-top:1px solid #ECEDF1;`)}>
            <div style={css("font-size:13px; font-weight:700; color:#3A3F4C;")}>
              Visualização
              <div style={css("font-size:11.5px; font-weight:500; color:#9398A6; margin-top:2px;")}>Limita as tarefas às que estão sob a responsabilidade do usuário.</div>
            </div>
            {CARGOS.map((c) => {
              const admin = c === "Administrador";
              const on = !admin && !!escopo[c];
              return (
                <div key={c} style={css("text-align:center; padding:6px 8px;")}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={admin}
                    onChange={() => toggleEscopo(c)}
                    style={css(`width:17px; height:17px; cursor:${admin ? "not-allowed" : "pointer"}; accent-color:${corDoCargo(c)}; ${admin ? "opacity:.5;" : ""}`)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Placeholder({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:40px 24px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px;")}>
      <div style={css("font-size:15px; font-weight:800; color:#1B1B28;")}>{titulo}</div>
      <div style={css("font-size:13px; color:#9398A6; max-width:380px;")}>{texto}</div>
    </div>
  );
}
