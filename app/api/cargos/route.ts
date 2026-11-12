import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth-admin";
import { lerCargos } from "@/lib/cargos-server";
import { matrizEfetiva } from "@/lib/acesso";
import { validarNomeCargo } from "@/lib/cargos";
import type { NivelAcesso } from "@/lib/types";

/**
 * Cargos (Configurações → Acessos → Cargos). Só Administrador.
 *  POST { acao: "criar", nome, cor, acessoTotal }
 *  POST { acao: "editar", nomeAtual, nome?, cor?, acessoTotal? }
 *       Renomear: a matriz do cargo (salva ou padrão) é gravada inteira antes, e a função
 *       renomear_cargo leva o nome novo para pessoas, acessos, escopo (cascata) e grupos.
 *       Mudar a cor atualiza também a cor das pessoas do cargo.
 *  POST { acao: "excluir", nome }  — só sem pessoas no cargo.
 */
export const dynamic = "force-dynamic";

const COR = /^#[0-9a-fA-F]{6}$/;
const erro = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
const limpar = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return erro("Banco não configurado.", 503);
  const adm = await requireAdmin(req, sb);
  if (!adm.ok) return erro(adm.error, adm.status);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const cargos = await lerCargos(sb);

  if (b.acao === "criar") {
    const nome = limpar(b.nome);
    const e = validarNomeCargo(nome, cargos);
    if (e) return erro(e);
    const cor = typeof b.cor === "string" && COR.test(b.cor) ? b.cor : "#5B6472";
    const ordem = Math.max(0, ...cargos.map((c) => c.ordem)) + 1;
    const { error } = await sb.from("cargo").insert({ nome, cor, ordem, acesso_total: b.acessoTotal === true, sistema: false });
    return error ? erro(error.message, 500) : NextResponse.json({ ok: true });
  }

  if (b.acao === "editar") {
    const nomeAtual = limpar(b.nomeAtual);
    const atual = cargos.find((c) => c.nome === nomeAtual);
    if (!atual) return erro("Cargo não encontrado.", 404);
    const novo = b.nome === undefined ? nomeAtual : limpar(b.nome);
    const cols: Record<string, unknown> = {};
    if (typeof b.cor === "string") {
      if (!COR.test(b.cor)) return erro("Cor inválida.");
      cols.cor = b.cor;
    }
    if (typeof b.acessoTotal === "boolean") {
      if (atual.sistema && !b.acessoTotal) return erro("O Administrador sempre tem acesso total.");
      cols.acesso_total = b.acessoTotal;
    }
    if (Object.keys(cols).length) {
      const { error } = await sb.from("cargo").update(cols).eq("nome", nomeAtual);
      if (error) return erro(error.message, 500);
      if (cols.cor) {
        const { error: e2 } = await sb.from("usuarios").update({ cor: cols.cor }).eq("cargo", nomeAtual);
        if (e2) return erro(e2.message, 500);
      }
    }
    if (novo !== nomeAtual) {
      if (atual.sistema) return erro("O cargo Administrador não pode ser renomeado.");
      const e = validarNomeCargo(novo, cargos.filter((c) => c.nome !== nomeAtual));
      if (e) return erro(e);
      // A matriz padrão é por nome: grava a efetiva antes, para nada mudar com o nome novo.
      const { data } = await sb.from("cargo_acesso").select("page, permitido, pode_editar").eq("cargo", nomeAtual);
      const salvos: Record<string, Record<string, NivelAcesso>> = { [nomeAtual]: {} };
      for (const r of (data ?? []) as { page: string; permitido: boolean; pode_editar: boolean }[]) {
        salvos[nomeAtual][r.page] = r.permitido === false ? "nenhum" : r.pode_editar === false ? "ver" : "editar";
      }
      const linhas = Object.entries(matrizEfetiva(salvos, nomeAtual)).map(([page, n]) => ({ cargo: nomeAtual, page, permitido: n !== "nenhum", pode_editar: n === "editar" }));
      const up = await sb.from("cargo_acesso").upsert(linhas, { onConflict: "cargo,page" });
      if (up.error) return erro(up.error.message, 500);
      const { error } = await sb.rpc("renomear_cargo", { antigo: nomeAtual, novo });
      if (error) return erro(error.message, 500);
    }
    return NextResponse.json({ ok: true });
  }

  if (b.acao === "excluir") {
    const nome = limpar(b.nome);
    const { error } = await sb.rpc("excluir_cargo", { alvo: nome });
    return error ? erro(error.message, 400) : NextResponse.json({ ok: true });
  }

  return erro("Ação inválida.");
}
