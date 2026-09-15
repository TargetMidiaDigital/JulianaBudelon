"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "@/lib/css";
import { BG_GRADIENT } from "@/lib/theme";
import { useIsMobile } from "@/lib/useIsMobile";
import { AppProvider, useApp } from "./store";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ListaView from "./screens/ListaView";
import BancoTalentos from "./screens/BancoTalentos";
import Vagas from "./screens/Vagas";
import Config from "./screens/Config";
import TaskDetail from "./modals/TaskDetail";
import TaskForm from "./modals/TaskForm";
import RecorrenciasModal from "./modals/RecorrenciasModal";
import TalentoForm from "./modals/TalentoForm";
import Login from "./Login";

function Screens() {
  const { screen: rawScreen, canAccessPage, landingPage } = useApp();
  // Tela sem acesso → cai na tela inicial do cargo.
  const screen = canAccessPage(rawScreen) ? rawScreen : landingPage;
  return (
    <div className="m-screens" style={css("flex:1; overflow-y:auto;")}>
      {screen === "listaview" && <ListaView selectable />}
      {screen === "recrutamento-talentos" && <BancoTalentos />}
      {screen === "recrutamento-vagas" && <Vagas />}
      {screen === "config" && <Config />}
    </div>
  );
}

function Shell() {
  // No mobile a moldura é full-bleed (sem a borda de 14px nem o cartão arredondado);
  // a Sidebar vira overlay (position:fixed) e sai do fluxo, então o main ocupa tudo.
  const isMobile = useIsMobile();
  return (
    <div style={css(`height:100vh; width:100%; box-sizing:border-box; padding:${isMobile ? "0" : "14px"}; background:${BG_GRADIENT};`)}>
      <div
        style={css(
          `display:flex; height:100%; width:100%; overflow:hidden; background:#F7F7F9; color:#1B1B28; font-size:14px; ${isMobile ? "" : "border-radius:18px; box-shadow:0 20px 60px rgba(20,24,40,.28);"}`,
        )}
      >
        <Sidebar />
        <main style={css("flex:1; display:flex; flex-direction:column; min-width:0;")}>
          <Topbar />
          <Screens />
        </main>
      </div>
      {/* modais/drawers (position:fixed) ficam fora do container arredondado */}
      <TaskDetail />
      <TaskForm />
      <RecorrenciasModal />
      <TalentoForm />
    </div>
  );
}

/** Tela de "sem acesso" (mesmo estilo da de carregamento). */
function SemAcessoTarefa({ onClose }: { onClose: () => void }) {
  return (
    <div style={css(`height:100vh; width:100%; display:flex; align-items:center; justify-content:center; padding:24px; box-sizing:border-box; background:${BG_GRADIENT};`)}>
      <div style={css("width:100%; max-width:440px; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; gap:14px; background:#fff; border-radius:22px; padding:44px 40px; box-shadow:0 30px 80px rgba(20,24,40,.35); text-align:center;")}>
        <img src="/logo.png" alt="Ju Budelon" style={css("height:96px; width:auto; object-fit:contain; margin-bottom:2px;")} />
        <div style={css("font-size:17px; font-weight:800; color:#1B1B28; letter-spacing:-0.2px;")}>Você não tem acesso a esta tarefa</div>
        <div style={css("font-size:13.5px; font-weight:500; line-height:1.55; color:#7A8090;")}>Peça a um administrador acesso a esta área, ou entre com uma conta autorizada.</div>
        <button onClick={onClose} style={css("margin-top:8px; border:none; cursor:pointer; background:#955C6B; color:#fff; font-weight:700; font-size:14px; padding:11px 28px; border-radius:999px;")}>Ir para o início</button>
      </div>
    </div>
  );
}

function Gate() {
  const { authed, hasSession, authReady, hydrated, tasks, canAccessPage, goto, setTaskDetailOpen } = useApp();
  // Deep-link compartilhado: ?tarefa=<id> (lido uma vez no mount).
  const [linkId] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tarefa")));
  const [denied, setDenied] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!authReady || !authed || !hydrated || !linkId || handledRef.current) return;
    handledRef.current = true;
    const t = tasks.find((x) => x.id === linkId);
    if (t && canAccessPage("listaview")) { goto("listaview"); setTaskDetailOpen(linkId); }
    else setDenied(true);
    if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname);
  }, [authReady, authed, hydrated, linkId, tasks, canAccessPage, goto, setTaskDetailOpen]);

  if (!authReady || !hydrated) return <Carregando />;
  if (!hasSession || !authed) return <Login />;
  if (denied) return <SemAcessoTarefa onClose={() => setDenied(false)} />;
  return <Shell />;
}

/** Tela de carregamento (logo + "Carregando…"). */
function Carregando() {
  return (
    <div style={css(`height:100vh; width:100%; display:flex; align-items:center; justify-content:center; padding:24px; box-sizing:border-box; background:${BG_GRADIENT};`)}>
      <style>{"@keyframes jb-pulse{0%,100%{opacity:.45}50%{opacity:1}}"}</style>
      <div style={css("width:100%; max-width:420px; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; gap:14px; background:#fff; border-radius:22px; padding:48px 40px; box-shadow:0 30px 80px rgba(20,24,40,.35); text-align:center;")}>
        <img src="/logo.png" alt="Ju Budelon" style={css("height:100px; width:auto; object-fit:contain;")} />
        <div style={css("font-size:15px; font-weight:700; color:#7A8090; animation:jb-pulse 1.4s ease-in-out infinite;")}>Carregando…</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  );
}
