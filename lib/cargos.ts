import type { CargoDef } from "./types";
import { ADMIN } from "./acesso";

/** Nome de cargo válido e sem repetir (ignora maiúsculas e acentos). Tela e servidor usam. */
export function validarNomeCargo(nome: string, outros: CargoDef[]): string | null {
  if (nome.length < 2) return "Dê um nome ao cargo.";
  if (nome.length > 40) return "Use até 40 caracteres.";
  const chave = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (chave(nome) === chave(ADMIN)) return "Esse nome é reservado.";
  if (outros.some((x) => chave(x.nome) === chave(nome))) return "Já existe um cargo com esse nome.";
  return null;
}
