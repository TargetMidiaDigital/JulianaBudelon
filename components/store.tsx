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
 * STORE EM MEMÓRIA (fase sem backend).
 *
 * Todo o "banco" é um objeto (`Db`, ver lib/localdb.ts) guardado no localStorage. As telas
 * usam a mesma API do sistema da Target (useApp), então ligar o Supabase depois é trocar
 * as funções de escrita aqui — as telas não mudam.
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
  authed: boolean;
  hasSession: boolean;
  authReady: boolean;
  hydrated: boolean;
  currentUser: TeamMember;
  login: (email: string, senha: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  /** Troca a senha (na demo, fica no localStorage). */
  setSenha: (userId: string, senha: string) => { ok: boolean; error?: string };
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
  addUsuario: (u: TeamMember, senha: string) => { ok: boolean; error?: string };
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
  /** Apaga as edições locais e volta aos dados de exemplo. */
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

/**
 * Gera as ocorrências vencidas das tarefas recorrentes (o que o cron faria no servidor).
 *  - modo 'novo': cria uma tarefa NOVA carregando a recorrência adiante e desliga a âncora.
 *  - modo 'reagendar': reseta a MESMA tarefa (status "verificar") e avança o vencimento.
 */
function gerarRecorrentes(tasks: Task[]): Task[] {
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
  const [db, setDb] = useState<Db>(seedDb);
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Carrega o "banco" e a sessão do localStorage (uma vez, no cliente).
  useEffect(() => {
    const d = loadDb();
    d.tasks = gerarRecorrentes(d.tasks);
    setDb(d);
    setHydrated(true);
    try { setSessionId(localStorage.getItem(SESSION_KEY)); } catch { /* ignore */ }
    setAuthReady(true);
  }, []);

  // Persiste toda mudança (depois de hidratar, para não sobrescrever com o seed).
  // `skipSave` evita regravar o que acabou de chegar de OUTRA aba (evento storage).
  const skipSave = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (skipSave.current) { skipSave.current = false; return; }
    saveDb(db);
  }, [db, hydrated]);

  // Outra aba gravou (ex.: candidatura pela página pública /vagas) → recarrega.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DB_KEY || !e.newValue) return;
      skipSave.current = true;
      setDb(loadDb());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const patchDb = useCallback((fn: (d: Db) => Partial<Db>) => setDb((d) => ({ ...d, ...fn(d) })), []);

  const { team, tasks, clients: allClients, talentos, unidades, vagas, linkbio, gruposInternos, workspace, acessos, escopoProprio } = db;
  const currentUser: TeamMember = (sessionId && team.find((t) => t.id === sessionId)) || FALLBACK_USER;
  const authed = !!sessionId && currentUser.id !== "";

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

  // Clientes ativos/pausados nas seleções; inativos ficam à parte (só p/ resolver nomes).
  const clients = useMemo(() => allClients.filter((c) => c.status !== "inativo"), [allClients]);
  const clientesInativos = useMemo(() => allClients.filter((c) => c.status === "inativo"), [allClients]);

  const value: Store = {
    authed,
    hasSession: !!sessionId,
    authReady,
    hydrated,
    currentUser,
    login: async (email, senha) => {
      const e = email.trim().toLowerCase();
      const u = team.find((t) => (t.email ?? "").toLowerCase() === e);
      if (!u) return { ok: false, error: "Email ou senha incorretos." };
      if (u.ativo === false) return { ok: false, error: "Usuário inativo." };
      if ((db.senhas[u.id] ?? "") !== senha) return { ok: false, error: "Email ou senha incorretos." };
      setSessionId(u.id);
      try { localStorage.setItem(SESSION_KEY, u.id); } catch { /* ignore */ }
      return { ok: true };
    },
    logout: () => { setSessionId(null); try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } },
    setSenha: (userId, senha) => {
      if (senha.length < 6) return { ok: false, error: "A senha precisa ter ao menos 6 caracteres." };
      patchDb((d) => ({ senhas: { ...d.senhas, [userId]: senha } }));
      return { ok: true };
    },
    isAdmin,
    canSeeAll,
    canEditResponsavel,
    podeTrocarResp,
    acessos,
    setAcessos: (next) => patchDb(() => ({ acessos: next })),
    canAccessPage,
    landingPage,
    canEditPage,
    escopoProprio,
    setEscopoProprio: (next) => patchDb(() => ({ escopoProprio: next })),
    ownScopeOnly,

    team,
    updateUsuario: (id, patch) => patchDb((d) => ({ team: d.team.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    addUsuario: (u, senha) => {
      const e = (u.email ?? "").trim().toLowerCase();
      if (!u.nome.trim()) return { ok: false, error: "Informe o nome." };
      if (!e) return { ok: false, error: "Informe o e-mail." };
      if (team.some((t) => (t.email ?? "").toLowerCase() === e)) return { ok: false, error: "Já existe uma pessoa com este e-mail." };
      if (senha.length < 6) return { ok: false, error: "A senha precisa ter ao menos 6 caracteres." };
      patchDb((d) => ({ team: [...d.team, { ...u, email: e }], senhas: { ...d.senhas, [u.id]: senha } }));
      return { ok: true };
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
    },
    addTask: (t) => patchDb((d) => ({ tasks: [t, ...d.tasks] })),
    removeTask: (id) => patchDb((d) => {
      // Remove o id + todos os descendentes (subtarefas).
      const mortos = new Set<string>([id]);
      let cresceu = true;
      while (cresceu) {
        cresceu = false;
        for (const t of d.tasks) if (t.parentId && mortos.has(t.parentId) && !mortos.has(t.id)) { mortos.add(t.id); cresceu = true; }
      }
      return { tasks: d.tasks.filter((t) => !mortos.has(t.id)) };
    }),
    criarRecorrencia: async (t) => { patchDb((d) => ({ tasks: [t, ...d.tasks] })); return { ok: true }; },
    setRecorrencia: async (id, rec) => {
      patchDb((d) => ({
        tasks: d.tasks.map((t) => {
          if (t.id !== id) return t;
          if (!rec) return { ...t, rec: undefined };
          // Recalcula a próxima ocorrência (a partir de hoje) ao ligar/editar a regra.
          const regra = { frequencia: rec.freq, dia_semana: rec.diaSemana ?? null, dia_mes: rec.diaMes ?? null };
          return { ...t, rec: { ...rec, proxima: rec.proxima ?? proximaApos(hojeSP(), regra) } };
        }),
      }));
      return { ok: true };
    },
    clients,
    clientesInativos,
    talentos,
    addTalento: (t) => patchDb((d) => ({ talentos: [t, ...d.talentos] })),
    updateTalento: (id, patch) => {
      const old = talentos.find((t) => t.id === id);
      if (!old) return;
      const logs = buildTalentoLogs(old, patch, currentUser);
      const fp: Partial<Talento> = logs.length ? { ...patch, comentarios: [...((patch.comentarios ?? old.comentarios) ?? []), ...logs] } : patch;
      patchDb((d) => ({ talentos: d.talentos.map((t) => (t.id === id ? { ...t, ...fp } : t)) }));
    },
    removeTalento: (id) => patchDb((d) => ({ talentos: d.talentos.filter((t) => t.id !== id) })),
    unidades,
    addUnidade: (u) => {
      // Slug único a partir de "cidade nome"; colisão ganha sufixo numérico.
      const base = slugify(`${u.cidade} ${u.nome}`) || `unidade-${Date.now()}`;
      let slug = base, n = 2;
      while (unidades.some((x) => x.slug === slug)) slug = `${base}-${n++}`;
      const nova: Unidade = { ...u, id: `u-${Date.now()}`, slug, criada: new Date().toISOString() };
      patchDb((d) => ({ unidades: [...d.unidades, nova] }));
      return nova;
    },
    updateUnidade: (id, patch) => patchDb((d) => ({ unidades: d.unidades.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    removeUnidade: (id) => patchDb((d) => ({
      unidades: d.unidades.filter((x) => x.id !== id),
      vagas: d.vagas.filter((v) => v.unidadeId !== id),
      talentos: d.talentos.map((t) => (t.unidadeId === id ? { ...t, unidadeId: undefined, vagaId: undefined } : t)),
    })),
    vagas,
    addVaga: (v) => {
      const nova: Vaga = { ...v, id: `v-${Date.now()}`, criada: new Date().toISOString() };
      patchDb((d) => ({ vagas: [...d.vagas, nova] }));
      return nova;
    },
    updateVaga: (id, patch) => patchDb((d) => ({
      vagas: d.vagas.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      // Renomear a vaga reflete no texto dos candidatos vinculados.
      talentos: patch.titulo ? d.talentos.map((t) => (t.vagaId === id ? { ...t, vaga: patch.titulo } : t)) : d.talentos,
    })),
    removeVaga: (id) => patchDb((d) => ({
      vagas: d.vagas.filter((x) => x.id !== id),
      talentos: d.talentos.map((t) => (t.vagaId === id ? { ...t, vagaId: undefined } : t)),
    })),
    linkbio,
    setLinkbio: (patch) => patchDb((d) => ({ linkbio: { ...d.linkbio, ...patch } })),
    gruposInternos,
    criarGrupoInterno: (g) => patchDb((d) => ({ gruposInternos: [...d.gruposInternos, g] })),
    updateGrupoInterno: (id, patch) => patchDb((d) => ({ gruposInternos: d.gruposInternos.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    removerGrupoInterno: (id) => patchDb((d) => ({ gruposInternos: d.gruposInternos.filter((x) => x.id !== id) })),
    workspace,
    setWorkspace: (patch) => patchDb((d) => ({ workspace: { ...d.workspace, ...patch } })),
    restaurarDados: () => { const d = seedDb(); d.tasks = gerarRecorrentes(d.tasks); setDb(d); },

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
