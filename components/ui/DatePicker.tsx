"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { css } from "@/lib/css";
import { ACCENT } from "@/lib/theme";
import {
  DEFAULT_DUE_TIME,
  MONTHS_FULL,
  formatBR,
  parseBR,
  sameDay,
} from "@/lib/format";
import { Svg } from "./Svg";

const WEEK = ["do", "2ª", "3ª", "4ª", "5ª", "6ª", "sá"];

/** Data real de hoje (só dia, sem hora) — valor padrão do popup de vencimento. */
const hoje = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

function monthMatrix(year: number, month: number): Date[][] {
  const startDow = new Date(year, month, 1).getDay();
  const start = new Date(year, month, 1 - startDow);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const days: Date[] = [];
    for (let d = 0; d < 7; d++) {
      days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
    }
    weeks.push(days);
  }
  return weeks;
}

function chipLabel(date: Date, time: string): string {
  const d = sameDay(date, hoje()) ? "Hoje" : formatBR(date);
  return `${d} às ${time}`;
}

/**
 * Date + time picker popover (matches the design's due-date calendar).
 * Renders a trigger and an anchored popover; calls onSave(date, time) on Salvar.
 */
export default function DatePicker({
  date,
  time,
  onSave,
  trigger,
  align = "right",
  z = 300,
  minDate,
}: {
  date: string; // dd/mm/yyyy
  time?: string; // hh:mm
  onSave: (date: string, time: string) => void;
  trigger: (toggle: () => void, open: boolean) => ReactNode;
  align?: "left" | "right";
  z?: number;
  minDate?: Date; // bloqueia datas anteriores (ex.: hoje em diante)
}) {
  const minDay = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime() : null;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const initial = parseBR(date) ?? hoje();
  const [sel, setSel] = useState<Date>(initial);
  const [view, setView] = useState<{ y: number; m: number }>({
    y: initial.getFullYear(),
    m: initial.getMonth(),
  });
  const [t, setT] = useState(time || DEFAULT_DUE_TIME);

  const reopen = () => {
    const base = parseBR(date) ?? hoje();
    setSel(base);
    setView({ y: base.getFullYear(), m: base.getMonth() });
    setT(time || DEFAULT_DUE_TIME);
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) {
      const W = 300, H = 404, margin = 8;
      let left = align === "right" ? r.right - W : r.left;
      left = Math.max(margin, Math.min(left, window.innerWidth - W - margin));
      // Abaixo do gatilho; se não couber, abre acima; senão encaixa na tela.
      let top: number;
      if (r.bottom + 5 + H <= window.innerHeight - margin) top = r.bottom + 5;
      else if (r.top - 5 - H >= margin) top = r.top - 5 - H;
      else top = Math.max(margin, window.innerHeight - H - margin);
      setPos({ top, left });
    }
    setOpen(true);
  };
  const toggle = () => (open ? setOpen(false) : reopen());
  const close = () => setOpen(false);

  const weeks = monthMatrix(view.y, view.m);
  const goToday = () => {
    const h = hoje();
    setView({ y: h.getFullYear(), m: h.getMonth() });
    setSel(h);
  };
  const shift = (delta: number) => {
    const m = view.m + delta;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };
  const save = () => {
    onSave(formatBR(sel), t);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {trigger(toggle, open)}
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div onClick={close} style={css(`position:fixed; inset:0; z-index:${z - 1};`)} />
          <div
            style={css(
              `position:fixed; top:${pos.top}px; left:${pos.left}px; z-index:${z}; background:#fff; border:1px solid #E2E3E9; border-radius:12px; box-shadow:0 14px 40px rgba(20,24,40,.20); padding:14px; width:300px; text-align:left; max-height:calc(100vh - 16px); overflow-y:auto;`,
            )}
          >
            <div style={css("display:flex; align-items:center; gap:8px; background:#F2F3F6; border:1px solid #ECEDF1; border-radius:9px; padding:8px 11px; margin-bottom:12px;")}>
              <Svg size={15} stroke="#5B6472"><rect x="3" y="4.5" width="18" height="16" rx="2.2" /><path d="M3 9h18M8 3v3M16 3v3" /></Svg>
              <span style={css("flex:1; font-size:13px; font-weight:700; color:#1B1B28;")}>{chipLabel(sel, t)}</span>
            </div>

            <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:10px;")}>
              <span style={css("flex:1; font-size:14px; font-weight:800;")}>{MONTHS_FULL[view.m]} {view.y}</span>
              <button onClick={goToday} style={css("border:none; background:transparent; cursor:pointer; font-size:12.5px; font-weight:700; color:#5B6472; padding:4px 8px; border-radius:7px;")}>Hoje</button>
              <button onClick={() => shift(-1)} style={css("width:26px; height:26px; border:none; background:transparent; cursor:pointer; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#5B6472;")}><Svg size={15} sw={2.2}><path d="m15 18-6-6 6-6" /></Svg></button>
              <button onClick={() => shift(1)} style={css("width:26px; height:26px; border:none; background:transparent; cursor:pointer; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#5B6472;")}><Svg size={15} sw={2.2}><path d="m9 6 6 6-6 6" /></Svg></button>
            </div>

            <div style={css("display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:4px;")}>
              {WEEK.map((w) => (
                <div key={w} style={css("text-align:center; font-size:11px; font-weight:600; color:#9398A6; padding:3px 0;")}>{w}</div>
              ))}
            </div>
            {weeks.map((wk, wi) => (
              <div key={wi} style={css("display:grid; grid-template-columns:repeat(7,1fr); gap:2px;")}>
                {wk.map((day) => {
                  const inMonth = day.getMonth() === view.m;
                  const selected = sameDay(day, sel);
                  const disabled = minDay != null && day.getTime() < minDay;
                  return (
                    <div
                      key={day.toISOString()}
                      onClick={disabled ? undefined : () => setSel(new Date(day.getFullYear(), day.getMonth(), day.getDate()))}
                      style={css(
                        `height:34px; display:flex; align-items:center; justify-content:center; border-radius:9px; font-size:13px; cursor:${disabled ? "not-allowed" : "pointer"}; color:${disabled ? "#D6D8DE" : inMonth ? "#1B1B28" : "#C7CAD2"}; font-weight:${selected ? 700 : 500}; border:${selected ? `1.5px solid ${ACCENT}` : "1.5px solid transparent"};`,
                      )}
                    >
                      {day.getDate()}
                    </div>
                  );
                })}
              </div>
            ))}

            <div style={css("display:flex; align-items:center; gap:9px; margin-top:12px; padding-top:12px; border-top:1px solid #F0F1F4;")}>
              <span style={css("font-size:12.5px; font-weight:600; color:#7A8090;")}>Horário</span>
              <input type="time" value={t} onChange={(e) => setT(e.target.value || DEFAULT_DUE_TIME)} style={css("flex:1; font-size:13px; font-weight:600; color:#1B1B28; border:1px solid #E2E3E9; border-radius:8px; padding:7px 10px;")} />
            </div>
            <div style={css("display:flex; align-items:center; justify-content:flex-end; gap:10px; margin-top:12px;")}>
              <button onClick={save} style={css(`border:none; cursor:pointer; font-size:13px; font-weight:700; color:#fff; background:${ACCENT}; padding:8px 18px; border-radius:8px;`)}>Salvar</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
