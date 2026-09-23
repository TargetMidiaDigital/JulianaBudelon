import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { NivelAcesso, ScreenPage } from "./types";
import { nivelPadrao } from "./acesso";
import { spacesTree } from "./seed";

/**
 * Autorização das rotas /api/* (a service role bypassa RLS, então a checagem é aqui).
 * Mesmo desenho da Target: o token Bearer da sessão do Supabase Auth identifica o
 * e-mail; ter linha em `usuarios` com esse e-mail = ser da equipe.
 */

export type Sessao = { ok: true; email: string; cargo: string; userId: string };
export type Recusa = { ok: false; status: number; error: string };

function tokenDe(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

/** Valida que o chamador é da EQUIPE (tem linha em `usuarios`, ativo). */
export async function requireSession(req: Request, sb: SupabaseClient, token?: string): Promise<Sessao | Recusa> {
  const tk = token ?? tokenDe(req);
  if (!tk) return { ok: false, status: 401, error: "Não autenticado." };
  const { data: caller, error } = await sb.auth.getUser(tk);
  const email = caller?.user?.email ?? null;
  if (error || !email) return { ok: false, status: 401, error: "Sessão inválida." };
  const { data: row } = await sb.from("usuarios").select("id, cargo, ativo").eq("email", email).maybeSingle();
  const r = row as { id?: string; cargo?: string; ativo?: boolean } | null;
  if (!r?.cargo || !r.id) return { ok: false, status: 403, error: "Sem acesso." };
  if (r.ativo === false) return { ok: false, status: 403, error: "Usuário inativo." };
  return { ok: true, email, cargo: r.cargo, userId: r.id };
}

/** Valida que o chamador é Administrador. */
export async function requireAdmin(req: Request, sb: SupabaseClient): Promise<Sessao | Recusa> {
  const s = await requireSession(req, sb);
  if (!s.ok) return s;
  if (s.cargo !== "Administrador") return { ok: false, status: 403, error: "Apenas Administrador." };
  return s;
}

const setorDe = (page: ScreenPage) => spacesTree.find((sp) => sp.children.some((k) => k.page === page))?.id ?? "";

/** Nível de acesso do cargo numa tela (Configurações → Acessos, ou o padrão). */
export async function nivelNaTela(sb: SupabaseClient, cargo: string, page: ScreenPage): Promise<NivelAcesso> {
  if (cargo === "Administrador") return "editar";
  const { data } = await sb.from("cargo_acesso").select("permitido, pode_editar").eq("cargo", cargo).eq("page", page).maybeSingle();
  const r = data as { permitido?: boolean; pode_editar?: boolean } | null;
  if (!r) return nivelPadrao(cargo, setorDe(page), page);
  if (r.permitido === false) return "nenhum";
  return r.pode_editar === false ? "ver" : "editar";
}

/** Sessão válida E com nível "editar" na tela — para as rotas de escrita. */
export async function requireEditor(req: Request, sb: SupabaseClient, page: ScreenPage): Promise<Sessao | Recusa> {
  const s = await requireSession(req, sb);
  if (!s.ok) return s;
  if ((await nivelNaTela(sb, s.cargo, page)) !== "editar") return { ok: false, status: 403, error: "Sem permissão para editar nesta tela." };
  return s;
}

/** Acha o usuário de LOGIN (Supabase Auth) pelo e-mail. null = não tem login. */
export async function findAuthUserByEmail(sb: SupabaseClient, email: string): Promise<User | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}
