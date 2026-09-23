import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeSP, addDias, proximaApos } from "./recorrencia";

/**
 * Recorrência no SERVIDOR (colunas rec_* da tabela `tarefas`). O job diário
 * (/api/automacoes/gerar-recorrentes-lote) gera as ocorrências vencidas.
 */

/** Valida a regra (frequência + parâmetro obrigatório). Retorna mensagem de erro ou null. */
export function validarRegra(freq?: string, diaSemana?: number | null, diaMes?: number | null): string | null {
  if (freq !== "diaria" && freq !== "semanal" && freq !== "mensal") return "frequência inválida.";
  if (freq === "semanal" && (diaSemana == null || diaSemana < 0 || diaSemana > 6)) return "dia da semana (0-6) obrigatório p/ semanal.";
  if (freq === "mensal" && (diaMes == null || diaMes < 1 || diaMes > 31)) return "dia do mês (1-31) obrigatório p/ mensal.";
  return null;
}

type Regra = { frequencia: string; dia_semana: number | null; dia_mes: number | null };
type TarefaRecRow = {
  id: string; nome: string; status: string; urgencia: string; responsavel: string | null; tipo: string | null;
  categoria: string; descricao: string | null;
  rec_freq: string; rec_dia_semana: number | null; rec_dia_mes: number | null; rec_prazo_dias: number; rec_modo: string; rec_proxima: string;
};
const SELECT_REC = "id, nome, status, urgencia, responsavel, tipo, categoria, descricao, rec_freq, rec_dia_semana, rec_dia_mes, rec_prazo_dias, rec_modo, rec_proxima";

/**
 * Gera as ocorrências vencidas (rec_ativa e rec_proxima <= hoje). Idempotente por dia.
 *  - modo 'novo': cria uma tarefa NOVA carregando a recorrência adiante e DESLIGA a âncora.
 *  - modo 'reagendar': reseta a MESMA tarefa (status "verificar") e avança o vencimento.
 */
export async function gerarRecorrentes(sb: SupabaseClient): Promise<{ ok: boolean; geradas: number; reagendadas: number; erros: string[] }> {
  const hoje = hojeSP();
  const { data, error } = await sb.from("tarefas").select(SELECT_REC).eq("rec_ativa", true).lte("rec_proxima", hoje);
  if (error) return { ok: false, geradas: 0, reagendadas: 0, erros: [error.message] };

  let geradas = 0, reagendadas = 0;
  const erros: string[] = [];
  let i = 0;
  for (const t of (data ?? []) as TarefaRecRow[]) {
    const regra: Regra = { frequencia: t.rec_freq, dia_semana: t.rec_dia_semana, dia_mes: t.rec_dia_mes };
    const occ = t.rec_proxima;
    let prox = proximaApos(occ, regra);
    while (prox <= hoje) prox = proximaApos(prox, regra); // pula ocorrências perdidas
    const vence = `${addDias(occ, Math.max(0, t.rec_prazo_dias || 0))}T23:59:00-03:00`;

    if (t.rec_modo === "reagendar") {
      const upd = await sb.from("tarefas").update({ status: "verificar", vence_em: vence, rec_proxima: prox }).eq("id", t.id);
      if (upd.error) { erros.push(`${t.id}: ${upd.error.message}`); continue; }
      reagendadas++;
    } else {
      const log = { id: `c-${Date.now()}-${Math.round(Math.random() * 1e6)}`, message: "🔁 Criada automaticamente pela recorrência.", author: "sistema", created_at: new Date().toISOString(), tipo: "log" as const };
      const nova = {
        id: `t-${Date.now()}-${i++}`, nome: t.nome, status: "verificar", urgencia: t.urgencia,
        responsavel: t.responsavel, tipo: t.tipo, categoria: t.categoria, parent_id: null, descricao: t.descricao,
        ultimos_comentarios: [log], criada_em: `${occ}T09:00:00-03:00`, vence_em: vence,
        rec_ativa: true, rec_freq: t.rec_freq, rec_dia_semana: t.rec_dia_semana, rec_dia_mes: t.rec_dia_mes,
        rec_prazo_dias: t.rec_prazo_dias, rec_modo: t.rec_modo, rec_proxima: prox,
      };
      const ins = await sb.from("tarefas").insert(nova);
      if (ins.error) { erros.push(`${t.id}: ${ins.error.message}`); continue; }
      await sb.from("tarefas").update({ rec_ativa: false, rec_freq: null, rec_dia_semana: null, rec_dia_mes: null, rec_proxima: null }).eq("id", t.id);
      geradas++;
    }
  }
  return { ok: erros.length === 0, geradas, reagendadas, erros };
}
