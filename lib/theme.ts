import type { ClientStatus, Prioridade, TaskStatus } from "./types";

export const ACCENT = "#955C6B";

// Identidade visual Ju Budelon (Cozinha Criativa): rosa + vinho do logo.
export const BRAND = "#955C6B";
export const BRAND_SOFT = "rgba(149,92,107,0.12)";
export const BG_GRADIENT = "linear-gradient(135deg,#FBD3DC 0%,#F5ABBA 45%,#955C6B 100%)";

export const statusInfo: Record<
  TaskStatus,
  { label: string; bg: string; fg: string; dot: string }
> = {
  atrasada: { label: "Atrasada", bg: "#FDECEC", fg: "#CC3338", dot: "#E5484D" },
  "em andamento": {
    label: "Em andamento",
    bg: "#FFF1E8",
    fg: "#C25712",
    dot: "#F76808",
  },
  verificar: {
    label: "A verificar",
    bg: "#FFF7E0",
    fg: "#9C7414",
    dot: "#EFA417",
  },
  concluida: {
    label: "Concluída",
    bg: "#E7F6EE",
    fg: "#1B7F4D",
    dot: "#30A46C",
  },
  validada: { label: "Validada", bg: "#EAF0FE", fg: "#2563EB", dot: "#3B82F6" },
};

// Order of status columns in the kanban / list grouping.
export const statusOrder: TaskStatus[] = [
  "verificar",
  "em andamento",
  "atrasada",
  "concluida",
];

export const prioInfo: Record<
  Prioridade,
  { label: string; fg: string; dot: string }
> = {
  urgente: { label: "Urgente", fg: "#E5484D", dot: "#E5484D" },
  alta: { label: "Alta", fg: "#EC7B1A", dot: "#EC7B1A" },
  normal: { label: "Normal", fg: "#2F6FEB", dot: "#2F6FEB" },
  baixa: { label: "Baixa", fg: "#8A90A0", dot: "#8A90A0" },
};
export const prioOrder: Prioridade[] = ["urgente", "alta", "normal", "baixa"];

export const clientStatusInfo: Record<
  ClientStatus,
  { label: string; bg: string; fg: string; dot: string }
> = {
  ativo: { label: "Ativo", bg: "#E7F6EE", fg: "#1B7F4D", dot: "#30A46C" },
  pausado: { label: "Pausado", bg: "#FFF6E0", fg: "#9C7414", dot: "#EFA417" },
  inativo: { label: "Inativo", bg: "#F1F2F5", fg: "#6B7280", dot: "#9398A6" },
};
