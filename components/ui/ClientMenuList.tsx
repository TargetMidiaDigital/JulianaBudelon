"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { Avatar } from "./bits";
import { MenuItem } from "./Menu";
import { clientLetter } from "@/lib/selectors";
import { useApp } from "../store";
import type { Client } from "@/lib/types";

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Lista de clientes pesquisável para usar dentro de um <Menu> (render-prop).
 * `onSelect` recebe o id e deve fechar o menu (chamar o `close`).
 * `incluirTodos`: adiciona no topo um item "Todos os clientes" (logo da Target) → onSelect("").
 */
export default function ClientMenuList({ clients, selectedId, onSelect, incluirTodos = false, avatarSize = 20, avatarFont = 9 }: { clients: Client[]; selectedId?: string; onSelect: (id: string) => void; incluirTodos?: boolean; avatarSize?: number; avatarFont?: number }) {
  const { workspace } = useApp();
  const [q, setQ] = useState("");
  const query = norm(q.trim());
  const list = query ? clients.filter((o) => norm(o.nome).includes(query)) : clients;
  return (
    <>
      <div style={css("position:sticky; top:0; background:#fff; padding:2px 2px 6px; z-index:1;")} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 13, border: "1px solid #E2E3E9", borderRadius: 8, outline: "none" }} />
      </div>
      {incluirTodos && !query && (
        <MenuItem checked={!selectedId} onClick={() => onSelect("")}>
          <Avatar ini="T" cor="#955C6B" src={workspace.logo || "/logo-2.png"} size={avatarSize} radius="6px" fontSize={avatarFont} />
          <span style={css("flex:1; min-width:0; font-weight:700; font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>Todos os clientes</span>
        </MenuItem>
      )}
      {list.length ? (
        list.map((o) => (
          <MenuItem key={o.id} checked={selectedId === o.id} onClick={() => onSelect(o.id)}>
            <Avatar ini={clientLetter(o.nome)} cor={o.cor} src={o.logo} size={avatarSize} radius="6px" fontSize={avatarFont} />
            <span style={css("flex:1; min-width:0; font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{o.nome}</span>
          </MenuItem>
        ))
      ) : (
        <div style={css("padding:10px 9px; font-size:12.5px; color:#9398A6;")}>Nenhum cliente encontrado</div>
      )}
    </>
  );
}
