"use client";

import { useEffect, useState } from "react";
import { css } from "@/lib/css";

/** Relógio digital dd/mm/aaaa hh:mm (fuso de Brasília). Atualiza a cada segundo. */
function agora(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export default function Relogio({ s }: { s?: string }) {
  // Começa vazio p/ não divergir na hidratação (server não sabe a hora do cliente).
  const [txt, setTxt] = useState("");
  useEffect(() => {
    const tick = () => setTxt(agora());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={css(s ?? "font-size:11.5px; color:#9398A6; font-weight:600; font-variant-numeric:tabular-nums; letter-spacing:0.2px;")}>{txt}</span>;
}
