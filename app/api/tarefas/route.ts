import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireEditor } from "@/lib/auth-admin";
import { isCargoFull } from "@/lib/acesso";
import { toISO } from "@/lib/data";
import { hojeSP, primeiraOcorrencia, proximaApos, addDias } from "@/lib/recorrencia";
import { validarRegra } from "@/lib/recorrencia-server";
import type { Task } from "@/lib/types";

/**
 * Write-back das tarefas (tabela `tarefas`).
 *  - POST   { task }        → cria
 *  - PATCH  { id, patch }   → atualiza (só os campos enviados)
 *  - DELETE { id }          → exclui (subtarefas caem em cascata)
 * Autorização: nível "editar" em Operacional → Tarefas. Cargos sem acesso total
 * (Operacional) só mexem nas PRÓPRIAS tarefas e não trocam o responsável.
 */
export const dynamic = "force-dynamic";

/** Campos do app → colunas da tabela (apenas os presentes no patch). */
function mapPatch(patch: Partial<Task>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if ("titulo" in patch) c.nome = patch.titulo;
  if ("gestor" in patch) c.responsavel = patch.gestor || null;
  if ("status" in patch) c.status = patch.status;
  if ("prio" in patch) c.urgencia = patch.prio;
  if ("tipo" in patch) c.tipo = patch.tipo ?? null;
  if ("desc" in patch) c.descricao = patch.desc ?? null;
  if ("comentarios" in patch) c.ultimos_comentarios = patch.comentarios ?? [];
  if ("categoria" in patch) c.categoria = patch.categoria ?? "operacional";
  if ("parentId" in patch) c.parent_id = patch.parentId ?? null;
  if ("venc" in patch || "vencHora" in patch) c.vence_em = toISO(patch.venc, patch.vencHora);
  if ("criada" in patch || "criadaHora" in patch) c.criada_em = toISO(patch.criada, patch.criadaHora);
  return c;
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "listaview");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { task } = (await req.json().catch(() => ({}))) as { task?: Task };
  if (!task?.id || !task.titulo) return NextResponse.json({ error: "task.id e task.titulo são obrigatórios." }, { status: 400 });
  if (!isCargoFull(sess.cargo) && task.gestor && task.gestor !== sess.userId) {
    return NextResponse.json({ error: "Sem permissão para atribuir a outra pessoa." }, { status: 403 });
  }
  const row: Record<string, unknown> = {
    id: task.id, nome: task.titulo, status: task.status, urgencia: task.prio,
    responsavel: task.gestor || null, tipo: task.tipo ?? null, categoria: task.categoria ?? "operacional",
    parent_id: task.parentId ?? null, descricao: task.desc ?? null, ultimos_comentarios: task.comentarios ?? [],
    criada_em: toISO(task.criada, task.criadaHora) ?? new Date().toISOString(), vence_em: toISO(task.venc, task.vencHora),
  };
  // Criando já recorrente: esta tarefa É a 1ª ocorrência; a próxima fica agendada p/ o cron.
  if (task.rec?.ativa) {
    const erro = validarRegra(task.rec.freq, task.rec.diaSemana, task.rec.diaMes);
    if (erro) return NextResponse.json({ error: erro }, { status: 400 });
    const regra = { frequencia: task.rec.freq, dia_semana: task.rec.diaSemana ?? null, dia_mes: task.rec.diaMes ?? null };
    const firstOcc = primeiraOcorrencia(hojeSP(), regra);
    const prazo = Math.max(0, task.rec.prazoDias || 0);
    row.status = "verificar";
    row.vence_em = `${addDias(firstOcc, prazo)}T23:59:00-03:00`;
    Object.assign(row, {
      rec_ativa: true, rec_freq: task.rec.freq, rec_dia_semana: task.rec.diaSemana ?? null, rec_dia_mes: task.rec.diaMes ?? null,
      rec_prazo_dias: prazo, rec_modo: task.rec.modo === "reagendar" ? "reagendar" : "novo", rec_proxima: proximaApos(firstOcc, regra),
    });
  }
  const { error } = await sb.from("tarefas").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function PATCH(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "listaview");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<Task> };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });

  if (!isCargoFull(sess.cargo)) {
    const { data: atual } = await sb.from("tarefas").select("responsavel").eq("id", id).maybeSingle();
    if (!atual) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    if ((atual as { responsavel?: string | null }).responsavel !== sess.userId) return NextResponse.json({ error: "Sem permissão nesta tarefa." }, { status: 403 });
    if (patch && "gestor" in patch && patch.gestor !== sess.userId) return NextResponse.json({ error: "Sem permissão para alterar o responsável." }, { status: 403 });
  }

  const cols = mapPatch(patch ?? {});
  // Recorrência: objeto ativa:true → liga/edita; ativa:false → pausa; null → remove.
  if (patch && "rec" in patch) {
    const rec = patch.rec;
    if (!rec) Object.assign(cols, { rec_ativa: false, rec_freq: null, rec_dia_semana: null, rec_dia_mes: null, rec_proxima: null });
    else if (!rec.ativa) cols.rec_ativa = false;
    else {
      const erro = validarRegra(rec.freq, rec.diaSemana, rec.diaMes);
      if (erro) return NextResponse.json({ error: erro }, { status: 400 });
      const regra = { frequencia: rec.freq, dia_semana: rec.diaSemana ?? null, dia_mes: rec.diaMes ?? null };
      Object.assign(cols, {
        rec_ativa: true, rec_freq: rec.freq, rec_dia_semana: rec.diaSemana ?? null, rec_dia_mes: rec.diaMes ?? null,
        rec_prazo_dias: Math.max(0, rec.prazoDias || 0), rec_modo: rec.modo === "reagendar" ? "reagendar" : "novo",
        rec_proxima: rec.proxima ?? proximaApos(hojeSP(), regra),
      });
    }
  }
  if (Object.keys(cols).length === 0) return NextResponse.json({ persisted: true });
  const { error } = await sb.from("tarefas").update(cols).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ persisted: false });
  const sess = await requireEditor(req, sb, "listaview");
  if (!sess.ok) return NextResponse.json({ error: sess.error }, { status: sess.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  if (!isCargoFull(sess.cargo)) {
    const { data: atual } = await sb.from("tarefas").select("responsavel").eq("id", id).maybeSingle();
    if ((atual as { responsavel?: string | null } | null)?.responsavel !== sess.userId) return NextResponse.json({ error: "Sem permissão nesta tarefa." }, { status: 403 });
  }
  const { error } = await sb.from("tarefas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persisted: true });
}
