"use client";

import { useEffect, useState } from "react";
import { spacesTree } from "@/lib/seed";
import { BRAND, BRAND_SOFT } from "@/lib/theme";
import type { ScreenPage } from "@/lib/types";
import { css } from "@/lib/css";
import { useIsMobile } from "@/lib/useIsMobile";
import { Svg } from "./ui/Svg";
import Hoverable from "./ui/Hoverable";
import { Avatar } from "./ui/bits";
import { useApp } from "./store";

// Ícone por setor (mesma ordem do spacesTree).
export const sectorIcon: Record<string, React.ReactNode> = {
  operacional: (
    <Svg size={16}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.7" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.7" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.7" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.7" />
    </Svg>
  ),
  recrutamento: (
    <Svg size={17}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
};

/** Botão da barra recolhida (só ícone). */
function RailBtn({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Hoverable
      as="button"
      title={title}
      onClick={onClick}
      s={css(
        `width:42px; height:42px; flex:none; border:none; cursor:pointer; border-radius:11px; display:flex; align-items:center; justify-content:center; background:${active ? BRAND_SOFT : "transparent"}; color:${active ? BRAND : "#5B6472"};`,
      )}
      hover={active ? undefined : "background:#F4F4F7; color:#3A3F4C"}
    >
      {children}
    </Hoverable>
  );
}

export default function Sidebar() {
  const {
    sidebarOpen,
    toggleSidebar,
    tasks,
    talentos,
    vagas,
    expanded,
    toggleSector,
    expandSector,
    screen,
    goto,
    currentUser,
    logout,
    workspace,
    canAccessPage,
  } = useApp();

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // No mobile a barra é um overlay. Fecha sozinha ao NAVEGAR (a tela muda).
  const isMobile = useIsMobile();
  useEffect(() => {
    if (isMobile && sidebarOpen) toggleSidebar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Pendente de ação: "A Verificar", "Em Andamento" e "Atrasada" (exclui Concluída e
  // Validada). Os contadores de TAREFA são "o que está na minha mão".
  const pendente = (t: { status: string }) => t.status === "verificar" || t.status === "em andamento" || t.status === "atrasada";
  const meu = (t: { gestor?: string }) => t.gestor === currentUser.id;
  const minhasPendentes = tasks.filter((t) => !t.parentId && pendente(t) && meu(t)).length;
  // Candidatos em andamento (fora do arquivo: desqualificado/contratado/antigos).
  const talentosAtivos = talentos.filter((t) => !["desqualificado", "contratado", "antigos"].includes(t.status)).length;

  const kidCount: Record<string, number> = {
    listaview: minhasPendentes,
    "recrutamento-talentos": talentosAtivos,
    "recrutamento-vagas": vagas.filter((v) => v.ativa).length,
  };
  const kidActive = (page: ScreenPage) => screen === page;
  const sectorActive = (sp: (typeof spacesTree)[number]) => sp.children.some((k) => k.page === screen);

  // Esconde telas que o cargo não pode acessar; some o setor se ficar vazio.
  const visibleTree = spacesTree
    .map((sp) => ({ ...sp, children: sp.children.filter((k) => canAccessPage(k.page)) }))
    .filter((sp) => sp.children.length > 0);

  // Mobile fechada → nada na tela (o hambúrguer do Topbar abre o overlay).
  if (isMobile && !sidebarOpen) return null;

  // ── Barra recolhida (só ícones): SÓ no desktop. ──
  if (!isMobile && !sidebarOpen) {
    return (
      <aside
        style={css(
          "width:64px; flex:none; background:#FFFFFF; border-right:1px solid #ECEDF1; display:flex; flex-direction:column; align-items:center; padding:14px 0 14px; gap:4px;",
        )}
      >
        <Hoverable
          onClick={toggleSidebar}
          title="Expandir barra lateral"
          s={css("flex:none; cursor:pointer; border-radius:9px; margin-bottom:6px;")}
          hover="filter:brightness(0.97)"
        >
          <img src={workspace.logo || "/logo-2.png"} alt={workspace.nome} style={css("width:34px; height:34px; border-radius:9px; object-fit:contain; display:block;")} />
        </Hoverable>

        <div style={css("width:26px; height:1px; background:#ECEDF1; margin:6px 0;")} />

        {visibleTree.map((sp) => (
          <RailBtn key={sp.id} active={sectorActive(sp)} title={sp.label} onClick={() => expandSector(sp.id)}>
            {sectorIcon[sp.id]}
          </RailBtn>
        ))}

        <div style={{ flex: 1 }} />

        <Hoverable
          onClick={toggleSidebar}
          title={currentUser.nome}
          s={css("flex:none; cursor:pointer; border-radius:50%;")}
          hover="filter:brightness(0.97)"
        >
          <Avatar ini={currentUser.ini} cor={currentUser.cor} src={currentUser.foto} size={34} radius="50%" fontSize={13} />
        </Hoverable>
      </aside>
    );
  }

  // ── Barra expandida (desktop no fluxo; mobile como overlay fixo + backdrop) ──
  const asideStyle = isMobile
    ? "position:fixed; top:0; left:0; bottom:0; z-index:120; width:min(86vw,300px); background:#FFFFFF; border-right:1px solid #ECEDF1; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(20,24,40,.35); overflow-y:auto;"
    : "width:252px; flex:none; background:#FFFFFF; border-right:1px solid #ECEDF1; display:flex; flex-direction:column;";
  return (
    <>
      {isMobile && <div onClick={toggleSidebar} style={css("position:fixed; inset:0; z-index:119; background:rgba(20,24,40,.4);")} />}
      <aside style={css(asideStyle)}>
      <div style={css("display:flex; align-items:center; gap:11px; padding:18px 18px 14px;")}>
        <img
          src={workspace.logo || "/logo-2.png"}
          alt={workspace.nome}
          style={css("width:32px; height:32px; border-radius:8px; object-fit:contain; flex:none;")}
        />
        <div style={css("display:flex; flex-direction:column; line-height:1.1; flex:1; min-width:0;")}>
          <span style={css("font-weight:700; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>{workspace.nome}</span>
        </div>
        <Hoverable
          as="button"
          onClick={toggleSidebar}
          title="Recolher barra lateral"
          s={css(
            "width:28px; height:28px; flex:none; border:none; background:transparent; border-radius:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9398A6;",
          )}
          hover="background:#F2F3F6; color:#3A3F4C"
        >
          <Svg size={17}>
            <rect x="3" y="4" width="18" height="16" rx="2.2" />
            <path d="M9 4v16" />
            <path d="m15.5 9-3 3 3 3" />
          </Svg>
        </Hoverable>
      </div>

      <div style={css("padding:14px 22px 8px;")}>
        <span style={css("font-size:11px; font-weight:700; letter-spacing:0.7px; color:#A6AAB6;")}>
          SETORES
        </span>
      </div>
      <div style={css("flex:1; overflow-y:auto; padding:0 12px 12px;")}>
        {visibleTree.map((sp) => {
          const open = !!expanded[sp.id];
          const act = sectorActive(sp);
          return (
            <div key={sp.id}>
              <Hoverable
                onClick={() => toggleSector(sp.id)}
                s={css(
                  `display:flex; align-items:center; gap:9px; padding:7px 8px; border-radius:8px; color:${act && !open ? BRAND : "#3A3F4C"}; font-weight:700; font-size:13.5px; cursor:pointer; background:${open ? "#F4F4F7" : "transparent"};`,
                )}
                hover="background:#F4F4F7"
              >
                <span style={css(`flex:none; display:flex; color:${act ? BRAND : "#5B6472"};`)}>{sectorIcon[sp.id]}</span>
                <span style={css("flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>
                  {sp.label}
                </span>
                <Svg
                  size={14}
                  sw={2.4}
                  stroke="#9398A6"
                  style={css(
                    `flex:none; transform:rotate(${open ? 180 : 0}deg); transition:transform .15s ease;`,
                  )}
                >
                  <path d="m6 9 6 6 6-6" />
                </Svg>
              </Hoverable>
              {open && (
                <div style={css("padding:2px 0 4px;")}>
                  {sp.children.map((kid, i) => {
                    const kact = kidActive(kid.page);
                    const last = i === sp.children.length - 1;
                    return (
                      <Hoverable
                        key={kid.label}
                        onClick={() => goto(kid.page)}
                        s={css(
                          `position:relative; display:flex; align-items:center; gap:8px; padding:7px 8px 7px 30px; border-radius:8px; color:${kact ? BRAND : "#5B6472"}; font-weight:${kact ? 700 : 500}; font-size:13px; cursor:pointer; background:${kact ? BRAND_SOFT : "transparent"};`,
                        )}
                        hover={kact ? undefined : "background:#F4F4F7; color:#3A3F4C"}
                      >
                        {/* tronco vertical da árvore */}
                        <span style={css(`position:absolute; left:14px; top:0; width:1.5px; background:#D7DAE0; ${last ? "height:50%" : "bottom:0"}`)} />
                        {/* ramal horizontal (├ / └) */}
                        <span style={css("position:absolute; left:14px; top:50%; width:12px; height:1.5px; background:#D7DAE0; transform:translateY(-50%);")} />
                        <span style={css("flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>
                          {kid.label}
                        </span>
                        {kidCount[kid.page] != null && (
                          <span style={css("font-size:12px; color:#A6AAB6; font-weight:600;")}>
                            {kidCount[kid.page]}
                          </span>
                        )}
                      </Hoverable>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={css("border-top:1px solid #ECEDF1; padding:12px; position:relative;")}>
        {userMenuOpen && (
          <>
            <div onClick={() => setUserMenuOpen(false)} style={css("position:fixed; inset:0; z-index:40;")} />
            <div style={css("position:absolute; left:12px; right:12px; bottom:calc(100% - 4px); z-index:41; background:#fff; border:1px solid #E2E3E9; border-radius:10px; box-shadow:0 12px 34px rgba(20,24,40,.18); padding:5px;")}>
              <Hoverable as="button" onClick={() => { setUserMenuOpen(false); goto("config"); }} s={css("display:flex; align-items:center; gap:9px; width:100%; border:none; background:transparent; cursor:pointer; padding:9px 10px; border-radius:7px; font-size:13px; font-weight:600; color:#3A3F4C; text-align:left;")} hover="background:#F4F4F7">
                <Svg size={16} sw={2} stroke="#5B6472"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Svg>
                <span style={{ flex: 1 }}>Configurações</span>
              </Hoverable>
              <Hoverable as="button" onClick={() => { setUserMenuOpen(false); logout(); }} s={css("display:flex; align-items:center; gap:9px; width:100%; border:none; background:transparent; cursor:pointer; padding:9px 10px; border-radius:7px; font-size:13px; font-weight:600; color:#CC3338; text-align:left;")} hover="background:#FDECEC">
                <Svg size={16} sw={2} stroke="#CC3338"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Svg>
                <span style={{ flex: 1 }}>Sair</span>
              </Hoverable>
            </div>
          </>
        )}
        <div style={css("display:flex; align-items:center; gap:11px;")}>
          <Avatar ini={currentUser.ini} cor={currentUser.cor} src={currentUser.foto} size={32} radius="50%" fontSize={12} />
          <div style={css("display:flex; flex-direction:column; line-height:1.2; flex:1; min-width:0;")}>
            <span style={css("font-weight:700; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{currentUser.nome}</span>
            <span style={css("font-size:11.5px; color:#9398A6;")}>{currentUser.cargo}</span>
          </div>
          <Hoverable as="button" onClick={() => setUserMenuOpen((v) => !v)} title="Opções" s={css("width:30px; height:30px; flex:none; border:none; background:transparent; border-radius:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#B6BAC4;")} hover="background:#F2F3F6; color:#5B6472">
            <Svg size={16}>
              <circle cx="12" cy="5.5" r="1.4" />
              <circle cx="12" cy="12" r="1.4" />
              <circle cx="12" cy="18.5" r="1.4" />
            </Svg>
          </Hoverable>
        </div>
      </div>
      </aside>
    </>
  );
}
