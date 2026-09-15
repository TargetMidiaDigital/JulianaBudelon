"use client";

import { statusInfo, prioInfo } from "@/lib/theme";
import { spacesTree } from "@/lib/seed";
import { SETOR_CARGOS } from "@/lib/acesso";
import { STATUS_ORDER, PRIO_ORDER, useApp } from "./store";
import FiltroMenu, { type FiltroTipo, type FiltroOpt } from "./ui/FiltroMenu";

/**
 * Filtro multi-tipo da lista de tarefas (Responsável / Status / Prioridade),
 * dirigido pelo estado GLOBAL do store.
 *  - Responsável → globalGestor ("todos" = sem filtro).
 *  - Status/Prioridade → globalStatus/globalPrio ("" = sem filtro).
 */
export default function FiltroTarefas() {
  const { screen, team, workspace, globalGestor, setGlobalGestor, globalStatus, setGlobalStatus, globalPrio, setGlobalPrio, ownScopeOnly } = useApp();

  // Responsáveis elegíveis: os cargos do setor da tela atual.
  const setorLabel = spacesTree.find((sp) => sp.children.some((k) => k.page === screen))?.label ?? "Operacional";
  const cargosResp = SETOR_CARGOS[setorLabel] ?? SETOR_CARGOS.Operacional;
  const membros = team.filter((t) => t.ativo !== false && cargosResp.includes(t.cargo));

  const optsResp: FiltroOpt[] = [
    { id: "todos", label: "Todos", cor: "#9398A6", ini: "JB", foto: workspace.logo || "/logo-2.png" },
    ...membros.map((m) => ({ id: m.id, label: m.nome, cor: m.cor, ini: m.ini, foto: m.foto as string | undefined })),
  ];
  const optsStatus: FiltroOpt[] = [{ id: "", label: "Todos os status", cor: "#9398A6" }, ...[...STATUS_ORDER, "validada" as const].map((s) => ({ id: s, label: statusInfo[s].label, cor: statusInfo[s].dot }))];
  const optsPrio: FiltroOpt[] = [{ id: "", label: "Todas as prioridades", cor: "#9398A6" }, ...PRIO_ORDER.map((p) => ({ id: p, label: prioInfo[p].label, cor: prioInfo[p].dot }))];

  const tipos: FiltroTipo[] = [
    ...(ownScopeOnly ? [] : [{ key: "responsavel", label: "Responsável", opts: optsResp, value: globalGestor, vazio: "todos", set: setGlobalGestor }]),
    { key: "status", label: "Status", opts: optsStatus, value: globalStatus, vazio: "", set: setGlobalStatus },
    { key: "prioridade", label: "Prioridade", opts: optsPrio, value: globalPrio, vazio: "", set: setGlobalPrio },
  ];

  return <FiltroMenu tipos={tipos} />;
}
