import type { SupabaseClient } from "@supabase/supabase-js";
import type { Anexo, Comentario, GrupoInterno, LinkBioConfig, NivelAcesso, Prioridade, Talento, Task, TaskStatus, TeamMember, Unidade, Vaga, Workspace } from "./types";
import { DEFAULT_ESCOPO, isCargoFull } from "./acesso";
import { seedLinkBio } from "./seed";

/**
 * Leitura do banco (servidor) → o mesmo formato que o store usa no navegador (`AppData`,
 * igual ao `Db` da fase 1 sem senhas/seed). Roda só em /api/bootstrap.
 */
export type AppData = {
  team: TeamMember[];
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

/** timestamptz ISO → { date: "dd/mm/yyyy", hora: "hh:mm" } no fuso de Brasília. */
export function fmtBR(iso?: string | null): { date?: string; hora?: string } {
  if (!iso) return {};
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("day")}/${get("month")}/${get("year")}`, hora: `${get("hour")}:${get("minute")}` };
}

/** "dd/mm/yyyy" (+ "hh:mm") → ISO timestamptz no fuso de Brasília (-03:00). */
export function toISO(dateBR?: string | null, hora?: string | null): string | null {
  if (!dateBR) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateBR.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const hm = hora && /^\d{1,2}:\d{2}$/.test(hora) ? hora.padStart(5, "0") : "00:00";
  return `${y}-${mo}-${d}T${hm}:00-03:00`;
}

/** jsonb (array) OU string JSON → Comentario[]. */
export function parseComentarios(raw?: unknown): Comentario[] {
  const arr = Array.isArray(raw) ? raw : (() => { try { const v = JSON.parse(String(raw ?? "")); return Array.isArray(v) ? v : []; } catch { return []; } })();
  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x, i) => ({
      id: String(x.id ?? `c-${i}`), message: String(x.message ?? ""),
      html: x.html ? String(x.html) : undefined, author: String(x.author ?? ""),
      created_at: String(x.created_at ?? ""), tipo: x.tipo === "log" ? ("log" as const) : undefined,
    }));
}

export function parseAnexos(raw?: unknown): Anexo[] {
  const arr = Array.isArray(raw) ? raw : (() => { try { const v = JSON.parse(String(raw ?? "")); return Array.isArray(v) ? v : []; } catch { return []; } })();
  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && typeof x.url === "string")
    .map((x, i) => ({
      id: String(x.id ?? `a-${i}`), nome: String(x.nome ?? "arquivo"), url: String(x.url),
      mime: x.mime ? String(x.mime) : undefined, tamanho: typeof x.tamanho === "number" ? x.tamanho : undefined,
      criadoEm: x.criadoEm ? String(x.criadoEm) : undefined, autor: x.autor ? String(x.autor) : undefined,
    }));
}

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

// ───────────────────────── mapeadores linha → tipo do app ─────────────────────────

export type UsuarioRow = { id: string; nome: string; email: string | null; cargo: string; ini: string | null; cor: string | null; foto: string | null; whatsapp: string | null; whatsapp_interno: string | null; ativo: boolean | null };
export function teamDe(r: UsuarioRow): TeamMember {
  return {
    id: r.id, nome: r.nome, cargo: r.cargo, ini: r.ini ?? "", cor: r.cor ?? "#5B6472",
    email: r.email ?? undefined, whatsapp: r.whatsapp ?? undefined, whatsappInterno: r.whatsapp_interno ?? undefined,
    foto: r.foto ?? undefined, ativo: r.ativo !== false,
  };
}

export type TarefaRow = {
  id: string; nome: string; status: string; urgencia: string; responsavel: string | null; tipo: string | null; categoria: string | null;
  parent_id: string | null; descricao: string | null; ultimos_comentarios: unknown; criada_em: string | null; vence_em: string | null; atualizada_em: string | null;
  rec_ativa: boolean | null; rec_freq: string | null; rec_dia_semana: number | null; rec_dia_mes: number | null; rec_prazo_dias: number | null; rec_modo: string | null; rec_proxima: string | null;
};
export function taskDe(t: TarefaRow): Task {
  const cr = fmtBR(t.criada_em);
  const at = fmtBR(t.atualizada_em);
  const vn = fmtBR(t.vence_em);
  return {
    id: t.id, titulo: t.nome, gestor: t.responsavel ?? "",
    status: t.status as TaskStatus, prio: t.urgencia as Prioridade,
    tipo: t.tipo ?? undefined, categoria: t.categoria ?? "operacional", parentId: t.parent_id ?? undefined,
    criada: cr.date ?? "", criadaHora: cr.hora,
    atualizada: at.date, atualizadaHora: at.hora,
    venc: vn.date ?? "", vencHora: vn.hora && vn.hora !== "00:00" ? vn.hora : undefined,
    desc: t.descricao ?? undefined,
    comentarios: parseComentarios(t.ultimos_comentarios),
    rec: t.rec_freq
      ? {
          ativa: !!t.rec_ativa,
          freq: (t.rec_freq === "diaria" || t.rec_freq === "mensal" ? t.rec_freq : "semanal") as "diaria" | "semanal" | "mensal",
          diaSemana: t.rec_dia_semana ?? undefined, diaMes: t.rec_dia_mes ?? undefined,
          prazoDias: t.rec_prazo_dias ?? 0, modo: (t.rec_modo === "reagendar" ? "reagendar" : "novo") as "novo" | "reagendar",
          proxima: t.rec_proxima ?? undefined,
        }
      : undefined,
  };
}

export type TalentoRow = {
  id: string; nome: string; status: string | null; vaga: string | null; vaga_id: string | null; unidade_id: string | null; turno: string | null;
  origem: string | null; fone: string | null; qualidade: string | null; criada: string | null; ultimos_comentarios: unknown; anexos: unknown;
};
export function talentoDe(r: TalentoRow): Talento {
  return {
    id: r.id, nome: r.nome, status: r.status ?? "novo",
    vaga: r.vaga ?? undefined, vagaId: r.vaga_id ?? undefined, unidadeId: r.unidade_id ?? undefined,
    turno: r.turno === "Diurno" || r.turno === "Noturno" ? r.turno : undefined,
    origem: r.origem === "linkbio" ? "linkbio" : r.origem === "manual" ? "manual" : undefined,
    fone: r.fone ?? undefined, qualidade: r.qualidade ?? undefined, criada: r.criada ?? undefined,
    comentarios: parseComentarios(r.ultimos_comentarios), anexos: parseAnexos(r.anexos),
  };
}

export type UnidadeRow = { id: string; slug: string; cidade: string | null; nome: string; ativa: boolean | null; criada: string | null };
export function unidadeDe(r: UnidadeRow): Unidade {
  return { id: r.id, slug: r.slug, cidade: r.cidade ?? "", nome: r.nome, ativa: r.ativa !== false, criada: r.criada ?? undefined };
}

export type VagaRow = { id: string; unidade_id: string; titulo: string; turno: string | null; descricao: string | null; ativa: boolean | null; criada: string | null };
export function vagaDe(r: VagaRow): Vaga {
  const t = r.turno === "Diurno" || r.turno === "Noturno" ? r.turno : "";
  return { id: r.id, unidadeId: r.unidade_id, titulo: r.titulo, turno: t, descricao: r.descricao ?? undefined, ativa: r.ativa !== false, criada: r.criada ?? undefined };
}

export type GrupoRow = { id: string; nome: string; descricao: string | null; setores: unknown; visivel_cargos: unknown; logo: string | null };
export function grupoDe(r: GrupoRow): GrupoInterno {
  return { id: r.id, nome: r.nome, descricao: r.descricao ?? undefined, setores: strArr(r.setores), visivelCargos: strArr(r.visivel_cargos), logo: r.logo ?? undefined };
}

/** jsonb `workspace.vagas_pagina` → LinkBioConfig completa (defaults nos campos ausentes). */
export function linkbioDe(raw: unknown): LinkBioConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<LinkBioConfig>;
  const s = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  return {
    titulo: s(r.titulo, seedLinkBio.titulo), subtitulo: s(r.subtitulo, seedLinkBio.subtitulo), tagline: s(r.tagline, seedLinkBio.tagline),
    instagram: s(r.instagram, seedLinkBio.instagram).replace(/^@/, ""), pixelId: s(r.pixelId, "").replace(/\D/g, ""),
  };
}

// ───────────────────────── carga completa ─────────────────────────

export async function getData(sb: SupabaseClient): Promise<AppData> {
  const [us, tk, tl, un, vg, gr, ws, ca, cp] = await Promise.all([
    sb.from("usuarios").select("*").order("nome", { ascending: true }),
    sb.from("tarefas").select("*").order("criada_em", { ascending: false }).limit(5000),
    sb.from("talento").select("*").order("criada", { ascending: false }).limit(5000),
    sb.from("unidade").select("*").order("criada", { ascending: true }),
    sb.from("vaga").select("*").order("criada", { ascending: true }),
    sb.from("grupo_interno").select("*").order("created_at", { ascending: true }),
    sb.from("workspace").select("nome, logo, vagas_pagina").eq("id", 1).maybeSingle(),
    sb.from("cargo_acesso").select("cargo, page, permitido, pode_editar"),
    sb.from("cargo_permissao").select("cargo, escopo_proprio"),
  ]);
  const erro = [us, tk, tl, un, vg, gr, ws, ca, cp].find((r) => r.error)?.error;
  if (erro) throw new Error(erro.message);

  const acessos: Record<string, Record<string, NivelAcesso>> = {};
  for (const r of (ca.data ?? []) as { cargo: string; page: string; permitido: boolean; pode_editar: boolean }[]) {
    (acessos[r.cargo] ??= {})[r.page] = r.permitido === false ? "nenhum" : r.pode_editar === false ? "ver" : "editar";
  }
  const escopoProprio: Record<string, boolean> = {};
  for (const r of (cp.data ?? []) as { cargo: string; escopo_proprio: boolean }[]) escopoProprio[r.cargo] = !!r.escopo_proprio;

  const w = ws.data as { nome?: string | null; logo?: string | null; vagas_pagina?: unknown } | null;
  return {
    team: ((us.data ?? []) as UsuarioRow[]).map(teamDe),
    tasks: ((tk.data ?? []) as TarefaRow[]).map(taskDe),
    talentos: ((tl.data ?? []) as TalentoRow[]).map(talentoDe),
    unidades: ((un.data ?? []) as UnidadeRow[]).map(unidadeDe),
    vagas: ((vg.data ?? []) as VagaRow[]).map(vagaDe),
    linkbio: linkbioDe(w?.vagas_pagina),
    gruposInternos: ((gr.data ?? []) as GrupoRow[]).map(grupoDe),
    workspace: { nome: w?.nome || "Ju Budelon", logo: w?.logo ?? null },
    acessos, escopoProprio,
  };
}

/**
 * Recorta a AppData ao que o cargo PODE ver — roda no servidor para não enviar ao
 * navegador o que o usuário não veria. Admin/Head recebem tudo.
 *  - escopo próprio (Operacional): só as tarefas sob sua responsabilidade;
 *  - grupos internos: só os visíveis ao cargo.
 */
export function scopeData(data: AppData, cargo: string, userId: string): AppData {
  if (isCargoFull(cargo)) return data;
  const own = data.escopoProprio[cargo] ?? DEFAULT_ESCOPO[cargo] ?? false;
  return {
    ...data,
    tasks: own ? data.tasks.filter((t) => t.gestor === userId) : data.tasks,
    gruposInternos: data.gruposInternos.filter((g) => g.visivelCargos.includes(cargo)),
  };
}
