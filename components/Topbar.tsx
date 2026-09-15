"use client";

import type { ScreenPage } from "@/lib/types";
import { spacesTree } from "@/lib/seed";
import { css } from "@/lib/css";
import { Svg } from "./ui/Svg";
import Hoverable from "./ui/Hoverable";
import Relogio from "./ui/Relogio";
import { useApp } from "./store";

const TITLES: Record<ScreenPage, string> = {
  listaview: "Tarefas",
  "recrutamento-talentos": "Banco de Talentos",
  "recrutamento-vagas": "Vagas",
  config: "Configurações",
};

export default function Topbar() {
  const { screen, sidebarOpen, toggleSidebar, workspace } = useApp();

  const setorLabel = spacesTree.find((sp) => sp.children.some((k) => k.page === screen))?.label ?? "Geral";

  return (
    <header
      style={css(
        "height:60px; flex:none; border-bottom:1px solid #ECEDF1; background:#FFFFFF; display:flex; align-items:center; gap:16px; padding:0 22px;",
      )}
    >
      <div style={css("display:flex; align-items:center; gap:8px; font-weight:600; min-width:0;")}>
        {!sidebarOpen && (
          <Hoverable
            as="button"
            onClick={toggleSidebar}
            title="Mostrar barra lateral"
            s={css(
              "width:30px; height:30px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090; margin-right:4px;",
            )}
            hover="background:#F2F3F6; color:#3A3F4C"
          >
            <Svg size={17}>
              <rect x="3" y="4" width="18" height="16" rx="2.2" />
              <path d="M9 4v16" />
              <path d="m12.5 9 3 3-3 3" />
            </Svg>
          </Hoverable>
        )}
        <span style={css("color:#9398A6; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>{workspace.nome} · {setorLabel}</span>
        <Svg size={14} sw={2.2} stroke="#C7CAD2">
          <path d="m9 6 6 6-6 6" />
        </Svg>
        <span style={css("font-size:15px; font-weight:700; color:#1B1B28; white-space:nowrap;")}>
          {TITLES[screen]}
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={css("display:flex; align-items:center; gap:7px; flex:none; color:#5B6472; background:#F7F8FA; border:1px solid #ECEDF1; border-radius:9px; padding:6px 12px;")}>
        <Svg size={14} sw={2.2} stroke="#9398A6"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></Svg>
        <Relogio s="font-size:13px; color:#3A3F4C; font-weight:700; font-variant-numeric:tabular-nums; letter-spacing:0.3px;" />
      </div>
    </header>
  );
}
