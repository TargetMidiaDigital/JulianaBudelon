"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CARGOS_FULL, DEFAULT_ESCOPO, SETOR_CARGOS, nivelPadrao } from "@/lib/acesso";
import { clienteDe } from "@/lib/selectors";
import { statusInfo, prioInfo } from "@/lib/theme";
import { fmtNowBR } from "@/lib/format";
import { hojeSP, addDias, proximaApos, isoParaBR } from "@/lib/recorrencia";
import { spacesTree } from "@/lib/seed";
import { DB_KEY, loadDb, saveDb, seedDb, slugify, type Db } from "@/lib/localdb";
import { apiJson, authHeaders, getSupabaseBrowser } from "@/lib/supabase-browser";
import { dataUrlParaFile, uploadAvatar } from "@/lib/upload";
import type { AppData } from "@/lib/data";
import type {
  Client,
  Comentario,
  GrupoInterno,
  LinkBioConfig,
  NivelAcesso,
  Prioridade,
  RecConfig,
  ScreenPage,
  Talento,
  Task,
  TaskStatus,
  TeamMember,
  Unidade,
  Vaga,
  Workspace,
} from "@/lib/types";

/**
 * STORE do app. As telas usam a mesma API (useApp) nos dois modos:
 *
 *  - COM SUPABASE (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY definidos): login pelo Supabase
 *    Auth; os dados vêm de /api/bootstrap (recortados por cargo no servidor); toda
 *    escrita é otimista no estado local e persistida nas rotas /api/* (Bearer da
 *    sessão). O realtime_ping (tabela-sinal) avisa quando algo mudou e o app refaz o
 *    bootstrap — várias abas/pessoas ficam em sincronia.
 *  - SEM SUPABASE (modo demo, fase 1): tudo no localStorage (`Db`, lib/localdb.ts).
 */
const SESSION_KEY = "jb.session";

/** Página inicial padrão por cargo (aplicada uma vez ao logar). */
const LANDING_POR_CARGO: Record<string, ScreenPage> = {
  "Administrador": "listaview",
  "Head Operacional": "listaview",
  "Operacional": "listaview",
  "Recrutamento": "recrutamento-talentos",
};

export type ListGroupBy =
  | "status"
  | "responsavel"
  | "prioridade"
  | "vencimento"
  | "tipo"
  | "none";

type Store = {
  // auth / usuário logado
  /** true = modo demo (sem Supabase): dados de exemplo no localStorage. */
  demo: boolean;
  authed: boolean;
  hasSession: boolean;
  authReady: boolean;
  hydrated: boolean;
  /** Falha ao carregar os dados do servidor (mostra "Recarregar"). */
  bootstrapError: string | null;
  /** Erro de acesso mostrado na tela de login (ex.: e-mail sem cadastro na equipe). */
  authErro: string | null;
  reload: () => Promise<void>;
  currentUser: TeamMember;
  login: (email: string, senha: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  /** Troca a senha de uma pessoa (a própria, ou de outra se Administrador). */
  setSenha: (userId: string, senha: string) => Promise<{ ok: boolean; error?: string }>;
  // controle de acesso por cargo
  isAdmin: boolean;
  canSeeAll: boolean;
  canEditResponsavel: boolean;
  podeTrocarResp: (categoria?: string | null, gestorId?: string | null) => boolean;
  acessos: Record<string, Record<string, NivelAcesso>>;
  setAcessos: (next: Record<string, Record<string, NivelAcesso>>) => void;
  canAccessPage: (page: ScreenPage) => boolean;
  landingPage: ScreenPage;
  canEditPage: (page: ScreenPage) => boolean;
  escopoProprio: Record<string, boolean>;
  setEscopoProprio: (next: Record<string, boolean>) => void;
  ownScopeOnly: boolean;

  // dados
  team: TeamMember[];
  updateUsuario: (id: string, patch: Partial<TeamMember>) => void;
  addUsuario: (u: TeamMember, senha: string) => Promise<{ ok: boolean; error?: string }>;
  tasks: Task[];
  updateTask: (id: string, patch: Partial<Task>) => void;
  addTask: (t: Task) => void;
  removeTask: (id: string) => void;
  criarRecorrencia: (t: Task) => Promise<{ ok: boolean; error?: string }>;
  setRecorrencia: (id: string, rec: RecConfig | null) => Promise<{ ok: boolean; error?: string }>;
  clients: Client[];
  clientesInativos: Client[];
  talentos: Talento[];
  addTalento: (t: Talento) => void;
  updateTalento: (id: string, patch: Partial<Talento>) => void;
  removeTalento: (id: string) => void;
  // Recrutamento → Vagas (unidades + vagas + página pública)
  unidades: Unidade[];
  addUnidade: (u: Omit<Unidade, "id" | "slug" | "criada">) => Unidade;
  updateUnidade: (id: string, patch: Partial<Unidade>) => void;
  /** Remove a unidade e as vagas dela; candidatos ficam (perdem só o vínculo). */
  removeUnidade: (id: string) => void;
  vagas: Vaga[];
  addVaga: (v: Omit<Vaga, "id" | "criada">) => Vaga;
  updateVaga: (id: string, patch: Partial<Vaga>) => void;
  removeVaga: (id: string) => void;
  linkbio: LinkBioConfig;
  setLinkbio: (patch: Partial<LinkBioConfig>) => void;
  gruposInternos: GrupoInterno[];
  criarGrupoInterno: (g: GrupoInterno) => void;
  updateGrupoInterno: (id: string, patch: Partial<GrupoInterno>) => void;
  removerGrupoInterno: (id: string) => void;
  workspace: Workspace;
  setWorkspace: (patch: Partial<Workspace>) => void;
  /** Modo demo: apaga as edições locais e volta aos dados de exemplo. Com Supabase: recarrega do servidor. */
  restaurarDados: () => void;

  // navegação
  screen: ScreenPage;
  goto: (s: ScreenPage) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  expanded: Record<string, boolean>;
  toggleSector: (id: string) => void;
  expandSector: (id: string) => void;

  // filtros das listas
  globalGestor: string;
  setGlobalGestor: (g: string) => void;
  escopoGestor: string;
  globalCliente: string;
  setGlobalCliente: (c: string) => void;
  globalStatus: string;
  setGlobalStatus: (s: string) => void;
  globalPrio: string;
  setGlobalPrio: (p: string) => void;
  listView: "list" | "board";
  setListView: (v: "list" | "board") => void;
  listGroupBy: ListGroupBy;
  setListGroupBy: (g: ListGroupBy) => void;

  // modais
  taskDetailOpen: string | null;
  setTaskDetailOpen: (id: string | null) => void;
  taskFormOpen: boolean;
  setTaskFormOpen: (v: boolean) => void;
  taskFormPrefill: { cliente?: string | null; gestor?: string | null } | null;
  setTaskFormPrefill: (p: { cliente?: string | null; gestor?: string | null } | null) => void;
  recModalScope: string | null;
  setRecModalScope: (s: string | null) => void;
  talentoFormOpen: boolean;
  setTalentoFormOpen: (v: boolean) => void;
};

const Ctx = createContext<Store | null>(null);

export function useApp(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}

const FALLBACK_USER: TeamMember = { id: "", nome: "—", cargo: "", ini: "—", cor: "#5B6472" };

/** Db vazio (com Supabase o conteúdo vem do bootstrap; até lá, nada). */
function dbVazio(): Db {
  return { ...seedDb(), team: [], senhas: {}, clients: [], tasks: [], talentos: [], unidades: [], vagas: [], gruposInternos: [], acessos: {}, escopoProprio: {} };
}

/** Cookie com o access token — só para a mídia do /api/anexo (tags <img> e links não
 *  enviam Bearer). Sincronizado com a sessão (login/refresh/logout). */
function setMediaCookie(token: string | null) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = token
    ? `jb-at=${token}; path=/; max-age=3600; SameSite=Lax${secure}`
    : `jb-at=; path=/; max-age=0; SameSite=Lax${secure}`;
}

/**
 * Modo demo: gera as ocorrências vencidas das tarefas recorrentes (o que o cron faz no
 * servidor quando há Supabase).
 */
function gerarRecorrentesLocal(tasks: Task[]): Task[] {
  const hoje = hojeSP();
  const out: Task[] = [];
  let i = 0;
  for (const t of tasks) {
    const r = t.rec;
    if (!r || !r.ativa || !r.proxima || r.proxima > hoje) { out.push(t); continue; }
    const regra = { frequencia: r.freq, dia_semana: r.diaSemana ?? null, dia_mes: r.diaMes ?? null };
    const occ = r.proxima;
    let prox = proximaApos(occ, regra);
    while (prox <= hoje) prox = proximaApos(prox, regra);
    const venc = isoParaBR(addDias(occ, Math.max(0, r.prazoDias || 0)));
    if (r.modo === "reagendar") {
      out.push({ ...t, status: "verificar", venc, vencHora: "23:59", rec: { ...r, proxima: prox } });
    } else {
      const log: Comentario = { id: `c-${Date.now()}-${i}`, message: "🔁 Criada automaticamente pela recorrência.", author: "sistema", created_at: new Date().toISOString(), tipo: "log" };
      out.push({ ...t, rec: undefined });
      out.push({ ...t, id: `t-${Date.now()}-${i++}`, status: "verificar", criada: isoParaBR(occ), criadaHora: "09:00", venc, vencHora: "23:59", comentarios: [log], atualizada: undefined, atualizadaHora: undefined, rec: { ...r, proxima: prox } });
    }
  }
  return out;
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Modo: com Supabase (auth + API) ou demo (localStorage). Decidido uma vez.
  const [demo] = useState(() => !getSupabaseBrowser());
  const [db, setDb] = useState<Db>(demo ? seedDb : dbVazio);
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null); // usuarios.id logado
  const [authEmail, setAuthEmail] = useState<string | null>(null); // e-mail da sessão Supabase
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [authErro, setAuthErro] = useState<string | null>(null);

  // ── modo demo: carrega o "banco" e a sessão do localStorage ─────────────────
  useEffect(() => {
    if (!demo) return;
    const d = loadDb();
    d.tasks = gerarRecorrentesLocal(d.tasks);
    setDb(d);
    setHydrated(true);
    try { setSessionId(localStorage.getItem(SESSION_KEY)); } catch { /* ignore */ }
    setAuthReady(true);
  }, [demo]);

  // Persiste toda mudança (só no demo, depois de hidratar). `skipSave` evita regravar
  // o que acabou de chegar de OUTRA aba (evento storage).
  const skipSave = useRef(false);
  useEffect(() => {
    if (!demo || !hydrated) return;
    if (skipSave.current) { skipSave.current = false; return; }
    saveDb(db);
  }, [db, hydrated, demo]);
  useEffect(() => {
    if (!demo) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DB_KEY || !e.newValue) return;
      skipSave.current = true;
      setDb(loadDb());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [demo]);

  // ── modo Supabase: sessão do Auth ───────────────────────────────────────────
  useEffect(() => {
    if (demo) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      setAuthEmail(session?.user.email ?? null);
      setMediaCookie(session?.access_token ?? null);
      try { sb.realtime.setAuth(session?.access_token ?? null); } catch { /* noop */ }
      setAuthReady(true);
    });
    sb.auth.getSession()
      .then(({ data: s }) => { setAuthEmail(s.session?.user.email ?? null); setMediaCookie(s.session?.access_token ?? null); setAuthReady(true); })
      .catch(() => setAuthReady(true));
    const t = setTimeout(() => setAuthReady(true), 5000); // nunca ficar preso no "Carregando…"
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, [demo]);

  // Re-busca o /api/bootstrap (recortado por cargo) e aplica. `epoch` faz a última
  // resposta vencer. Falha num re-fetch já hidratado não derruba a tela.
  const reloadEpoch = useRef(0);
  const hydratedRef = useRef(false);
  const versaoRef = useRef<string | null>(null);
  const reload = useCallback(async () => {
    if (demo) return;
    const epoch = ++reloadEpoch.current;
    try {
      const res = await fetch("/api/bootstrap", { headers: await authHeaders() });
      if (res.status === 401 || res.status === 403) {
        const j = await res.json().catch(() => ({}));
        await getSupabaseBrowser()?.auth.signOut().catch(() => {});
        setAuthEmail(null); setMediaCookie(null); setSessionId(null);
        setAuthErro(res.status === 403 ? (j?.error === "Usuário inativo." ? "Este usuário está inativo." : "Este e-mail não está cadastrado na equipe.") : null);
        return;
      }
      if (!res.ok) throw new Error(`bootstrap ${res.status}`);
      const j = (await res.json()) as { data?: AppData; userId?: string; versao?: string | null; demo?: boolean };
      if (j.demo) throw new Error("Banco não configurado no servidor (SUPABASE_SERVICE_ROLE_KEY).");
      if (!j.data) throw new Error("bootstrap vazio");
      if (epoch !== reloadEpoch.current) return; // resposta obsoleta
      setDb((d) => ({ ...d, ...j.data, senhas: {}, clients: [] }));
      setSessionId(j.userId ?? null);
      versaoRef.current = typeof j.versao === "string" ? j.versao : null;
      setBootstrapError(null);
      hydratedRef.current = true; setHydrated(true);
    } catch (e) {
      console.error("Falha ao carregar dados (bootstrap):", e);
      if (!hydratedRef.current) setBootstrapError(e instanceof Error ? e.message : String(e));
    }
  }, [demo]);

  // Hidratação inicial (uma vez, após autenticar) + recorrências vencidas do dia.
  useEffect(() => {
    if (demo || !authReady || hydrated || !authEmail) return;
    void (async () => {
      await reload();
      try {
        const r = await apiJson<{ geradas?: number; reagendadas?: number }>("/api/automacoes/gerar-recorrentes-lote", "POST", {});
        if ((r.geradas ?? 0) + (r.reagendadas ?? 0) > 0) void reload();
      } catch { /* o cron do servidor cobre */ }
    })();
  }, [demo, authReady, authEmail, hydrated, reload]);

  // Realtime: assina a tabela-sinal `realtime_ping` e re-busca o bootstrap (debounce).
  // Fallbacks: checagem de versão ao voltar para a aba + backstop de 5 min.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => { void reload(); }, 1000);
  }, [reload]);
  const checarVersao = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap/versao", { headers: await authHeaders() });
      if (!res.ok) return;
      const j = await res.json().catch(() => ({}));
      const v = typeof j?.v === "string" ? j.v : null;
      if (v !== versaoRef.current) scheduleReload();
    } catch { /* offline */ }
  }, [scheduleReload]);
  useEffect(() => {
    if (demo || !authReady || !authEmail) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => { const tk = data.session?.access_token; if (tk) { try { sb.realtime.setAuth(tk); } catch { /* noop */ } } });
    const ch = sb.channel("realtime-ping")
      .on("postgres_changes", { event: "*", schema: "public", table: "realtime_ping" }, () => scheduleReload())
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") void checarVersao(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const backstop = setInterval(() => { if (document.visibilityState === "visible") void checarVersao(); }, 5 * 60_000);
    return () => {
      sb.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(backstop);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [demo, authReady, authEmail, scheduleReload, checarVersao]);

  const patchDb = useCallback((fn: (d: Db) => Partial<Db>) => setDb((d) => ({ ...d, ...fn(d) })), []);

  /** Persistência (modo Supabase). A UI já foi atualizada de forma otimista; se o
   *  servidor recusar, loga e refaz o bootstrap para a tela voltar ao que está gravado. */
  const persist = useCallback(async (url: string, method: "POST" | "PATCH" | "DELETE", body: unknown): Promise<{ ok: boolean; error?: string }> => {
    if (demo) return { ok: true };
    try {
      await apiJson(url, method, body);
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Falha ao salvar (${method} ${url}):`, msg);
      scheduleReload();
      return { ok: false, error: msg };
    }
  }, [demo, scheduleReload]);

  /** Imagem que a tela entregou como data-URL → URL pública no Storage (modo Supabase). */
  const resolverImagem = useCallback(async (valor: string | null | undefined, dir: "usuarios" | "workspace" | "grupos", chave: string): Promise<string | null | undefined> => {
    if (demo || !valor || !valor.startsWith("data:")) return valor;
    return uploadAvatar(dataUrlParaFile(valor), dir, chave);
  }, [demo]);

  const { team, tasks, clients: allClients, talentos, unidades, vagas, linkbio, gruposInternos, workspace, acessos, escopoProprio } = db;
  const currentUser: TeamMember = (sessionId && team.find((t) => t.id === sessionId)) || FALLBACK_USER;
  const authed = !!sessionId && currentUser.id !== "";
  const hasSession = demo ? !!sessionId : !!authEmail;

  // Cargo → acessos.
  const canSeeAll = CARGOS_FULL.includes(currentUser.cargo);
  const isAdmin = currentUser.cargo === "Administrador";
  const canEditResponsavel = canSeeAll;
  const podeTrocarResp = (): boolean => canEditResponsavel;

  const setorDe = (page: ScreenPage) => spacesTree.find((sp) => sp.children.some((k) => k.page === page))?.id ?? "";
  const nivelDaTela = (page: ScreenPage): NivelAcesso =>
    acessos[currentUser.cargo]?.[page] ?? nivelPadrao(currentUser.cargo, setorDe(page), page);

  const canAccessPage = (page: ScreenPage): boolean => {
    if (page === "config") return true; // Perfil/config: todos
    if (isAdmin) return true;
    return nivelDaTela(page) !== "nenhum";
  };
  const landingPage: ScreenPage = (() => {
    const dest = LANDING_POR_CARGO[currentUser.cargo];
    if (dest && canAccessPage(dest)) return dest;
    const primeira = spacesTree.flatMap((sp) => sp.children).find((k) => canAccessPage(k.page));
    return primeira?.page ?? "config";
  })();
  const canEditPage = (page: ScreenPage): boolean => isAdmin || nivelDaTela(page) === "editar";
  const ownScopeOnly = !isAdmin && (escopoProprio[currentUser.cargo] ?? DEFAULT_ESCOPO[currentUser.cargo] ?? false);

  // ── navegação ──────────────────────────────────────────────────────────────
  const initialScreen = ((): ScreenPage => {
    if (typeof window === "undefined") return "listaview";
    const page = new URLSearchParams(window.location.search).get("page");
    const valid: ScreenPage[] = ["listaview", "recrutamento-talentos", "recrutamento-vagas", "config"];
    return (valid as string[]).includes(page ?? "") ? (page as ScreenPage) : "listaview";
  })();
  const [screen, setScreen] = useState<ScreenPage>(initialScreen);
  const landedRef = useRef(false);
  useEffect(() => { if (!authed) landedRef.current = false; }, [authed]);
  useEffect(() => {
    if (!authReady || !authed || landedRef.current) return;
    landedRef.current = true;
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("tarefa") || sp.get("page")) return;
    }
    setScreen(landingPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, authed, currentUser.cargo]);

  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window === "undefined" ? true : window.innerWidth > 768));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ operacional: true, recrutamento: true });

  // ── filtros ────────────────────────────────────────────────────────────────
  const [globalGestor, setGlobalGestorState] = useState("todos");
  const [globalCliente, setGlobalCliente] = useState("");
  const [globalStatus, setGlobalStatus] = useState("");
  const [globalPrio, setGlobalPrio] = useState("");
  const [listView, setListView] = useState<"list" | "board">("list");
  const [listGroupBy, setListGroupByState] = useState<ListGroupBy>("status");
  const gestorKey = (userId: string) => `jb.globalGestor.${userId}`;
  const setGlobalGestor = (g: string) => {
    setGlobalGestorState(g);
    if (!currentUser.id) return;
    try { localStorage.setItem(gestorKey(currentUser.id), g); } catch { /* ignore */ }
  };
  const setListGroupBy = (g: ListGroupBy) => { setListGroupByState(g); try { localStorage.setItem("jb.listGroupBy", g); } catch { /* ignore */ } };
  useEffect(() => {
    try { const lg = localStorage.getItem("jb.listGroupBy"); if (lg) setListGroupByState(lg as ListGroupBy); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { const g = currentUser.id ? localStorage.getItem(gestorKey(currentUser.id)) : null; setGlobalGestorState(g || "todos"); } catch { setGlobalGestorState("todos"); }
  }, [currentUser.id]);

  // ── modais ─────────────────────────────────────────────────────────────────
  const [taskDetailOpen, setTaskDetailOpen] = useState<string | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskFormPrefill, setTaskFormPrefill] = useState<{ cliente?: string | null; gestor?: string | null } | null>(null);
  const [recModalScope, setRecModalScope] = useState<string | null>(null);
  const [talentoFormOpen, setTalentoFormOpen] = useState(false);

  // Clientes (legado do demo): ativos/pausados nas seleções; inativos só p/ resolver nomes.
  const clients = useMemo(() => allClients.filter((c) => c.status !== "inativo"), [allClients]);
  const clientesInativos = useMemo(() => allClients.filter((c) => c.status === "inativo"), [allClients]);

  const value: Store = {
    demo,
    authed,
    hasSession,
    authReady,
    hydrated,
    bootstrapError,
    authErro,
    reload,
    currentUser,
    login: async (email, senha) => {
      setAuthErro(null);
      const e = email.trim().toLowerCase();
      if (demo) {
        const u = team.find((t) => (t.email ?? "").toLowerCase() === e);
        if (!u) return { ok: false, error: "Email ou senha incorretos." };
        if (u.ativo === false) return { ok: false, error: "Usuário inativo." };
        if ((db.senhas[u.id] ?? "") !== senha) return { ok: false, error: "Email ou senha incorretos." };
        setSessionId(u.id);
        try { localStorage.setItem(SESSION_KEY, u.id); } catch { /* ignore */ }
        return { ok: true };
      }
      const sb = getSupabaseBrowser();
      if (!sb) return { ok: false, error: "Login indisponível." };
      const { data: res, error } = await sb.auth.signInWithPassword({ email: e, password: senha });
      if (error || !res.session) return { ok: false, error: /invalid/i.test(error?.message ?? "") ? "Email ou senha incorretos." : (error?.message || "Falha ao entrar.") };
      return { ok: true };
    },
    logout: () => {
      if (demo) { setSessionId(null); try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } return; }
      getSupabaseBrowser()?.auth.signOut().catch(() => {});
      setAuthEmail(null); setMediaCookie(null); setSessionId(null);
      setDb(dbVazio()); setHydrated(false); hydratedRef.current = false; versaoRef.current = null;
    },
    setSenha: async (userId, senha) => {
      if (senha.length < 6) return { ok: false, error: "A senha precisa ter ao menos 6 caracteres." };
      if (demo) { patchDb((d) => ({ senhas: { ...d.senhas, [userId]: senha } })); return { ok: true }; }
      if (userId === currentUser.id) {
        const sb = getSupabaseBrowser();
        const { error } = await sb!.auth.updateUser({ password: senha });
        return error ? { ok: false, error: error.message } : { ok: true };
      }
      try { await apiJson("/api/usuarios", "PATCH", { id: userId, patch: { senha } }); return { ok: true }; }
      catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
    },
    isAdmin,
    canSeeAll,
    canEditResponsavel,
    podeTrocarResp,
    acessos,
    setAcessos: (next) => { patchDb(() => ({ acessos: next })); void persist("/api/acessos", "PATCH", { acessos: next }); },
    canAccessPage,
    landingPage,
    canEditPage,
    escopoProprio,
    setEscopoProprio: (next) => { patchDb(() => ({ escopoProprio: next })); void persist("/api/acessos", "PATCH", { escopoProprio: next }); },
    ownScopeOnly,

    team,
    updateUsuario: (id, patch) => {
      void (async () => {
        let p = patch;
        if ("foto" in patch) {
          try { p = { ...patch, foto: (await resolverImagem(patch.foto, "usuarios", id)) || undefined }; }
          catch (e) { console.error("Falha ao enviar a foto:", e); return; }
        }
        patchDb((d) => ({ team: d.team.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
        void persist("/api/usuarios", "PATCH", { id, patch: p });
      })();
    },
    addUsuario: async (u, senha) => {
      const e = (u.email ?? "").trim().toLowerCase();
      if (!u.nome.trim()) return { ok: false, error: "Informe o nome." };
      if (!e) return { ok: false, error: "Informe o e-mail." };
      if (team.some((t) => (t.email ?? "").toLowerCase() === e)) return { ok: false, error: "Já existe uma pessoa com este e-mail." };
      if (senha.length < 6) return { ok: false, error: "A senha precisa ter ao menos 6 caracteres." };
      if (demo) {
        patchDb((d) => ({ team: [...d.team, { ...u, email: e }], senhas: { ...d.senhas, [u.id]: senha } }));
        return { ok: true };
      }
      try {
        const r = await apiJson<{ user: TeamMember }>("/api/usuarios", "POST", { nome: u.nome.trim(), email: e, cargo: u.cargo, senha });
        patchDb((d) => ({ team: [...d.team.filter((t) => t.id !== r.user.id), r.user] }));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    tasks,
    updateTask: (id, patch) => {
      const old = tasks.find((t) => t.id === id);
      if (!old) return;
      const logs = buildTaskLogs(old, patch, currentUser, team, allClients);
      const nowBR = fmtNowBR();
      const fp: Partial<Task> = logs.length
        ? { ...patch, comentarios: [...((patch.comentarios ?? old.comentarios) ?? []), ...logs], atualizada: nowBR.date, atualizadaHora: nowBR.hora }
        : { ...patch, atualizada: nowBR.date, atualizadaHora: nowBR.hora };
      patchDb((d) => ({ tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...fp } : t)) }));
      void persist("/api/tarefas", "PATCH", { id, patch: fp });
    },
    addTask: (t) => { patchDb((d) => ({ tasks: [t, ...d.tasks] })); void persist("/api/tarefas", "POST", { task: t }); },
    removeTask: (id) => {
      patchDb((d) => {
        // Remove o id + todos os descendentes (subtarefas).
        const mortos = new Set<string>([id]);
        let cresceu = true;
        while (cresceu) {
          cresceu = false;
          for (const t of d.tasks) if (t.parentId && mortos.has(t.parentId) && !mortos.has(t.id)) { mortos.add(t.id); cresceu = true; }
        }
        return { tasks: d.tasks.filter((t) => !mortos.has(t.id)) };
      });
      void persist("/api/tarefas", "DELETE", { id });
    },
    criarRecorrencia: async (t) => {
      const r = await persist("/api/tarefas", "POST", { task: t });
      if (r.ok) patchDb((d) => ({ tasks: [t, ...d.tasks] }));
      return r;
    },
    setRecorrencia: async (id, rec) => {
      const regra = rec ? { frequencia: rec.freq, dia_semana: rec.diaSemana ?? null, dia_mes: rec.diaMes ?? null } : null;
      // Recalcula a próxima ocorrência (a partir de hoje) ao ligar/editar a regra.
      const recFinal = rec && regra ? { ...rec, proxima: rec.proxima ?? proximaApos(hojeSP(), regra) } : rec;
      patchDb((d) => ({ tasks: d.tasks.map((t) => (t.id !== id ? t : recFinal ? { ...t, rec: recFinal } : { ...t, rec: undefined })) }));
      return persist("/api/tarefas", "PATCH", { id, patch: { rec: recFinal } });
    },
    clients,
    clientesInativos,
    talentos,
    addTalento: (t) => { patchDb((d) => ({ talentos: [t, ...d.talentos] })); void persist("/api/talentos", "POST", { talento: t }); },
    updateTalento: (id, patch) => {
      const old = talentos.find((t) => t.id === id);
      if (!old) return;
      const logs = buildTalentoLogs(old, patch, currentUser);
      const fp: Partial<Talento> = logs.length ? { ...patch, comentarios: [...((patch.comentarios ?? old.comentarios) ?? []), ...logs] } : patch;
      patchDb((d) => ({ talentos: d.talentos.map((t) => (t.id === id ? { ...t, ...fp } : t)) }));
      void persist("/api/talentos", "PATCH", { id, patch: fp });
    },
    removeTalento: (id) => { patchDb((d) => ({ talentos: d.talentos.filter((t) => t.id !== id) })); void persist("/api/talentos", "DELETE", { id }); },
    unidades,
    addUnidade: (u) => {
      // Slug único a partir de "cidade nome"; colisão ganha sufixo numérico.
      const base = slugify(`${u.cidade} ${u.nome}`) || `unidade-${Date.now()}`;
      let slug = base, n = 2;
      while (unidades.some((x) => x.slug === slug)) slug = `${base}-${n++}`;
      const nova: Unidade = { ...u, id: `u-${Date.now()}`, slug, criada: new Date().toISOString() };
      patchDb((d) => ({ unidades: [...d.unidades, nova] }));
      void persist("/api/unidades", "POST", { unidade: nova });
      return nova;
    },
    updateUnidade: (id, patch) => { patchDb((d) => ({ unidades: d.unidades.map((x) => (x.id === id ? { ...x, ...patch } : x)) })); void persist("/api/unidades", "PATCH", { id, patch }); },
    removeUnidade: (id) => {
      patchDb((d) => ({
        unidades: d.unidades.filter((x) => x.id !== id),
        vagas: d.vagas.filter((v) => v.unidadeId !== id),
        talentos: d.talentos.map((t) => (t.unidadeId === id ? { ...t, unidadeId: undefined, vagaId: undefined } : t)),
      }));
      void persist("/api/unidades", "DELETE", { id });
    },
    vagas,
    addVaga: (v) => {
      const nova: Vaga = { ...v, id: `v-${Date.now()}`, criada: new Date().toISOString() };
      patchDb((d) => ({ vagas: [...d.vagas, nova] }));
      void persist("/api/vagas", "POST", { vaga: nova });
      return nova;
    },
    updateVaga: (id, patch) => {
      patchDb((d) => ({
        vagas: d.vagas.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        // Renomear a vaga reflete no texto dos candidatos vinculados.
        talentos: patch.titulo ? d.talentos.map((t) => (t.vagaId === id ? { ...t, vaga: patch.titulo } : t)) : d.talentos,
      }));
      void persist("/api/vagas", "PATCH", { id, patch });
    },
    removeVaga: (id) => {
      patchDb((d) => ({ vagas: d.vagas.filter((x) => x.id !== id), talentos: d.talentos.map((t) => (t.vagaId === id ? { ...t, vagaId: undefined } : t)) }));
      void persist("/api/vagas", "DELETE", { id });
    },
    linkbio,
    setLinkbio: (patch) => { patchDb((d) => ({ linkbio: { ...d.linkbio, ...patch } })); void persist("/api/vagas", "PATCH", { pagina: patch }); },
    gruposInternos,
    criarGrupoInterno: (g) => {
      void (async () => {
        let grupo = g;
        try { grupo = { ...g, logo: (await resolverImagem(g.logo, "grupos", g.id)) || undefined }; }
        catch (e) { console.error("Falha ao enviar o logo:", e); }
        patchDb((d) => ({ gruposInternos: [...d.gruposInternos, grupo] }));
        void persist("/api/grupos", "POST", { grupo });
      })();
    },
    updateGrupoInterno: (id, patch) => {
      void (async () => {
        let p = patch;
        if ("logo" in patch) {
          try { p = { ...patch, logo: (await resolverImagem(patch.logo, "grupos", id)) || undefined }; }
          catch (e) { console.error("Falha ao enviar o logo:", e); return; }
        }
        patchDb((d) => ({ gruposInternos: d.gruposInternos.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
        void persist("/api/grupos", "PATCH", { id, patch: p });
      })();
    },
    removerGrupoInterno: (id) => { patchDb((d) => ({ gruposInternos: d.gruposInternos.filter((x) => x.id !== id) })); void persist("/api/grupos", "DELETE", { id }); },
    workspace,
    setWorkspace: (patch) => {
      void (async () => {
        let p = patch;
        if ("logo" in patch) {
          try { p = { ...patch, logo: (await resolverImagem(patch.logo, "workspace", "logo")) || null }; }
          catch (e) { console.error("Falha ao enviar o logo:", e); return; }
        }
        patchDb((d) => ({ workspace: { ...d.workspace, ...p } }));
        void persist("/api/workspace", "PATCH", p);
      })();
    },
    restaurarDados: () => {
      if (!demo) { void reload(); return; }
      const d = seedDb(); d.tasks = gerarRecorrentesLocal(d.tasks); setDb(d);
    },

    screen,
    goto: (s) => {
      // Ao trocar de SETOR, reseta o filtro de Responsável para "Todos".
      if (!ownScopeOnly && setorDe(s) !== setorDe(screen)) setGlobalGestor("todos");
      if (s !== screen) { setGlobalCliente(""); setGlobalStatus(""); setGlobalPrio(""); }
      setScreen(s);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("page", s);
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    },
    sidebarOpen,
    toggleSidebar: () => setSidebarOpen((v) => !v),
    expanded,
    toggleSector: (id) => setExpanded((e) => ({ ...e, [id]: !e[id] })),
    expandSector: (id) => { setSidebarOpen(true); setExpanded({ [id]: true }); },

    // Cargos com escopo próprio só enxergam os próprios dados (filtro travado).
    globalGestor: ownScopeOnly ? currentUser.id : globalGestor,
    setGlobalGestor: ownScopeOnly ? () => {} : setGlobalGestor,
    escopoGestor: ownScopeOnly ? currentUser.id : "todos",
    globalCliente, setGlobalCliente,
    globalStatus, setGlobalStatus,
    globalPrio, setGlobalPrio,
    listView,
    setListView,
    listGroupBy,
    setListGroupBy,

    taskDetailOpen,
    setTaskDetailOpen,
    taskFormOpen,
    setTaskFormOpen,
    taskFormPrefill,
    setTaskFormPrefill,
    recModalScope,
    setRecModalScope,
    talentoFormOpen,
    setTalentoFormOpen,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Helpers shared by screens. */
export function gestorOf(team: TeamMember[], id: string): TeamMember {
  return team.find((t) => t.id === id) ?? team[0] ?? FALLBACK_USER;
}

/** Um comentário de log "Fulano <ação>". */
function logComentario(user: TeamMember, msg: string): Comentario {
  return { id: crypto.randomUUID(), message: `${user.nome} ${msg}`, author: user.id, created_at: new Date().toISOString(), tipo: "log" as const };
}

// Gera comentários de log p/ as mudanças de campos de uma tarefa.
function buildTaskLogs(old: Task, patch: Partial<Task>, user: TeamMember, team: TeamMember[], clients: Client[]): Comentario[] {
  const parts: string[] = [];
  if (patch.titulo != null && patch.titulo !== old.titulo) parts.push(`renomeou a tarefa para "${patch.titulo}"`);
  if (patch.status != null && patch.status !== old.status) parts.push(`mudou o status para "${statusInfo[patch.status].label}"`);
  if (patch.prio != null && patch.prio !== old.prio) parts.push(`mudou a prioridade para "${prioInfo[patch.prio].label}"`);
  if (patch.gestor != null && patch.gestor !== old.gestor) parts.push(`alterou o responsável para ${gestorOf(team, patch.gestor).nome}`);
  if (patch.cliente != null && patch.cliente !== old.cliente) parts.push(`alterou o cliente para ${clienteDe(clients, patch.cliente)?.nome ?? patch.cliente}`);
  if ((patch.venc != null && patch.venc !== old.venc) || (patch.vencHora != null && patch.vencHora !== old.vencHora)) {
    const d = patch.venc ?? old.venc;
    const h = patch.vencHora ?? old.vencHora;
    parts.push(`alterou o vencimento para ${d}${h ? ` ${h}` : ""}`);
  }
  if ("desc" in patch && (patch.desc ?? "") !== (old.desc ?? "")) parts.push("alterou a descrição");
  return parts.map((msg) => logComentario(user, msg));
}

// Log de atividade do CANDIDATO (status/vaga/qualidade).
function buildTalentoLogs(old: Talento, patch: Partial<Talento>, user: TeamMember): Comentario[] {
  const txt = (v: unknown) => (v == null || v === "" ? "—" : String(v));
  const dif = (k: keyof Talento) => k in patch && String(patch[k] ?? "") !== String(old[k] ?? "");
  const parts: string[] = [];
  if (dif("nome")) parts.push(`renomeou o candidato para "${patch.nome}"`);
  if (dif("status")) parts.push(`alterou o status de ${txt(old.status)} para ${txt(patch.status)}`);
  if (dif("vaga")) parts.push(`alterou a vaga de ${txt(old.vaga)} para ${txt(patch.vaga)}`);
  if (dif("qualidade")) parts.push(`alterou a qualidade de ${txt(old.qualidade)} para ${txt(patch.qualidade)}`);
  if (dif("fone")) parts.push(`alterou o WhatsApp`);
  return parts.map((msg) => logComentario(user, msg));
}

export function filterByGestor<T extends { gestor: string }>(items: T[], g: string): T[] {
  return g === "todos" ? items : items.filter((i) => i.gestor === g);
}

const SCOPE_TO_SETOR: Record<string, string> = { operacional: "Operacional", recrutamento: "Recrutamento" };

// Responsáveis elegíveis p/ um escopo de tarefa (ativos + cargo do setor).
export function responsaveisDoScope(team: TeamMember[], scope?: string) {
  const setor = SCOPE_TO_SETOR[scope ?? "operacional"] ?? "Operacional";
  const cargos = SETOR_CARGOS[setor] ?? SETOR_CARGOS.Operacional;
  return team.filter((t) => t.ativo !== false && cargos.includes(t.cargo));
}

// "validada" é omitida de propósito (oculta no front); statusInfo ainda a define.
export const STATUS_ORDER: TaskStatus[] = ["verificar", "em andamento", "atrasada", "concluida"];
export const PRIO_ORDER: Prioridade[] = ["urgente", "alta", "normal", "baixa"];
