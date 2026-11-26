import type { SupabaseClient } from "@supabase/supabase-js";
import { eventoCliqueDe, paginaDe, type BioLink, type BioPagina } from "./bio";

/** Link na Bio no servidor: linhas do banco ↔ tipos do app. */

export type BioLinkRow = { id: string; titulo: string; subtitulo: string | null; url: string; imagem: string | null; ativo: boolean; ordem: number; cliques: number; evento_meta: string | null };

export const linkDe = (r: BioLinkRow): BioLink => ({
  id: r.id, titulo: r.titulo, subtitulo: r.subtitulo ?? "", url: r.url, imagem: r.imagem, ativo: r.ativo, ordem: r.ordem, cliques: r.cliques ?? 0, eventoMeta: eventoCliqueDe(r.evento_meta),
});

/** Página + botões (em ordem). `soAtivos` = como o visitante vê. null = tabelas ainda não existem. */
export async function lerBio(sb: SupabaseClient, soAtivos = false): Promise<{ pagina: BioPagina; links: BioLink[] } | null> {
  let q = sb.from("bio_link").select("*").order("ordem", { ascending: true });
  if (soAtivos) q = q.eq("ativo", true);
  const [{ data: pg, error: e1 }, { data: ls, error: e2 }] = await Promise.all([sb.from("bio_pagina").select("dados").eq("id", 1).maybeSingle(), q]);
  if (e1 || e2) return null;
  return { pagina: paginaDe((pg as { dados?: unknown } | null)?.dados), links: ((ls ?? []) as BioLinkRow[]).map(linkDe) };
}
