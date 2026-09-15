import type { Client } from "./types";

export function localSlug(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const clientLetter = (nome: string) =>
  (nome.trim()[0] || "?").toUpperCase();

/** Pseudo-cliente "interno" — para mapear demandas da própria empresa ao criar
 *  tarefas. Não é um cliente real: só aparece ao selecionar/exibir o cliente de uma tarefa. */
export const CLIENTE_INTERNO: Client = {
  id: "ju-budelon",
  nome: "Ju Budelon",
  seg: "Interno",
  gestor: "",
  status: "ativo",
  cor: "#955C6B",
  logo: "/logo-2.png",
};

/** Resolve o cliente de um id, incluindo o pseudo-cliente interno. */
export function clienteDe(clients: Client[], id: string): Client | undefined {
  return clients.find((c) => c.id === id) ?? (id === CLIENTE_INTERNO.id ? CLIENTE_INTERNO : undefined);
}
