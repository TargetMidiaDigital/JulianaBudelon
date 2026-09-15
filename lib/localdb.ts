import type { Client, GrupoInterno, LinkBioConfig, NivelAcesso, Talento, Task, TeamMember, Unidade, Vaga, Workspace } from "./types";
import {
  seedTeam, seedSenhas, seedClients, seedTasks, seedTalentos, seedGrupos, seedWorkspace, seedAcessos, seedEscopoProprio,
  seedUnidades, seedVagas, seedLinkBio,
} from "./seed";

/**
 * "BANCO" LOCAL (fase sem backend): um objeto no localStorage, compartilhado entre o
 * painel (store.tsx) e a página pública de vagas (/vagas), que grava candidaturas aqui.
 * Quando houver Supabase, este módulo vira a camada de acesso ao banco.
 */
export type Db = {
  team: TeamMember[];
  senhas: Record<string, string>; // id do usuário → senha (só na demo)
  clients: Client[];
  tasks: Task[];
  talentos: Talento[];
  unidades: Unidade[];
  vagas: Vaga[];
  linkbio: LinkBioConfig;
  gruposInternos: GrupoInterno[];
  workspace: Workspace;
  acessos: Record<string, Record<string, NivelAcesso>>;
  escopoProprio: Record<string, boolean>;
};

export const DB_KEY = "jb.db.v1";

export function seedDb(): Db {
  return {
    team: seedTeam, senhas: seedSenhas, clients: seedClients, tasks: seedTasks, talentos: seedTalentos,
    unidades: seedUnidades, vagas: seedVagas, linkbio: seedLinkBio,
    gruposInternos: seedGrupos, workspace: seedWorkspace, acessos: seedAcessos, escopoProprio: seedEscopoProprio,
  };
}

export function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return seedDb();
    const d = JSON.parse(raw) as Partial<Db>;
    // Campos novos (unidades/vagas/linkbio) entram do seed se o banco salvo for de antes deles.
    return { ...seedDb(), ...d };
  } catch {
    return seedDb();
  }
}

export function saveDb(d: Db): boolean {
  try { localStorage.setItem(DB_KEY, JSON.stringify(d)); return true; } catch { return false; }
}

/** "Florianópolis Campeche" → "florianopolis-campeche". */
export function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Rótulo de exibição da unidade: "Florianópolis — Campeche". */
export function unidadeLabel(u?: Unidade | null): string {
  if (!u) return "—";
  return u.cidade ? `${u.cidade} — ${u.nome}` : u.nome;
}

/** Rótulo do botão de vaga: "Vaga — Caixa [DIURNO]". */
export function vagaLabel(v: Vaga): string {
  return v.turno ? `${v.titulo} [${v.turno.toUpperCase()}]` : v.titulo;
}
