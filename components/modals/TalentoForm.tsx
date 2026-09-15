"use client";

import { useFecharComEsc } from "../ui/useFecharComEsc";
import { useState } from "react";
import { css } from "@/lib/css";
import { normalizarWhatsapp } from "@/lib/format";
import type { Talento } from "@/lib/types";
import { TALENTO_STATUS, QUALIDADE_TALENTO, corDeTexto } from "@/lib/talento-dims";
import { unidadeLabel } from "@/lib/localdb";
import { CARGOS_VAGA } from "@/lib/seed";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import { useApp } from "../store";

/** Drawer "Novo candidato" (Recrutamento → Banco de Talentos). */
export default function TalentoForm() {
  const { talentoFormOpen, setTalentoFormOpen, addTalento, vagas, unidades } = useApp();
  const [nome, setNome] = useState("");
  const [vaga, setVaga] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [fone, setFone] = useState("");
  const [qualidade, setQualidade] = useState("Aguardando Análise");
  const [status, setStatus] = useState("novo");
  const [obs, setObs] = useState("");

  useFecharComEsc(talentoFormOpen, () => close());
  if (!talentoFormOpen) return null;

  const reset = () => { setNome(""); setVaga(""); setUnidadeId(""); setFone(""); setQualidade("Aguardando Análise"); setStatus("novo"); setObs(""); };
  const close = () => { setTalentoFormOpen(false); reset(); };
  const valido = !!nome.trim();

  const cargos = [...new Set([...CARGOS_VAGA, ...vagas.map((v) => v.titulo)])];
  const un = unidades.find((u) => u.id === unidadeId);
  // Vínculo com a vaga cadastrada quando cargo + unidade batem (conta no painel de Vagas).
  const vg = vaga && unidadeId ? vagas.find((v) => v.titulo === vaga && v.unidadeId === unidadeId) : undefined;
  const submit = () => {
    if (!valido) return;
    const t: Talento = {
      id: `tal-${Date.now()}`,
      nome: nome.trim(),
      status,
      vaga: vaga || undefined,
      vagaId: vg?.id,
      unidadeId: unidadeId || undefined,
      turno: vg?.turno,
      origem: "manual",
      fone: fone ? normalizarWhatsapp(fone) : undefined,
      qualidade: qualidade || undefined,
      criada: new Date().toISOString(),
      comentarios: obs.trim() ? [{ id: crypto.randomUUID(), message: obs.trim(), author: "", created_at: new Date().toISOString() }] : [],
      anexos: [],
    };
    addTalento(t);
    close();
  };

  const st = TALENTO_STATUS.find((s) => s.key === status);
  const ql = QUALIDADE_TALENTO.find((q) => q.v === qualidade);

  return (
    <>
      <div onClick={close} style={css("position:fixed; inset:0; z-index:64; background:rgba(20,24,40,.32);")} />
      <div style={css("position:fixed; top:0; right:0; bottom:0; z-index:65; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:560px; max-width:96vw; display:flex; flex-direction:column; overflow:hidden;")}>
        <div style={css("display:flex; align-items:center; gap:10px; padding:18px 24px; border-bottom:1px solid #ECEDF1;")}>
          <h2 style={css("margin:0; font-size:18px; font-weight:800; letter-spacing:-0.3px;")}>Novo candidato</h2>
          <span style={{ flex: 1 }} />
          <Hoverable as="button" onClick={close} s={css("width:32px; height:32px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={16} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:22px 24px; display:flex; flex-direction:column; gap:18px;")}>
          <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:18px 22px;")}>
            <Field label="Nome" req full>
              <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do candidato" style={css(inp)} />
            </Field>
            <Field label="Vaga">
              <Menu trigger={(tg) => (
                <SelectBox onClick={tg} placeholder={!vaga}>
                  {vaga && <span style={css(`width:8px; height:8px; border-radius:50%; background:${corDeTexto(vaga)};`)} />}
                  <span style={{ flex: 1 }}>{vaga || "Selecionar vaga"}</span>
                </SelectBox>
              )} z={70} width={300} popStyle="max-height:300px; overflow-y:auto;">
                {(c) => (
                  <>
                    <MenuItem checked={!vaga} onClick={() => { setVaga(""); c(); }}><span style={{ flex: 1, color: "#9398A6" }}>— Nenhuma —</span></MenuItem>
                    {cargos.map((v) => (<MenuItem key={v} checked={vaga === v} onClick={() => { setVaga(v); c(); }}><span style={css(`width:9px; height:9px; border-radius:50%; background:${corDeTexto(v)};`)} /><span style={{ flex: 1 }}>{v}</span></MenuItem>))}
                  </>
                )}
              </Menu>
            </Field>
            <Field label="Unidade">
              <Menu trigger={(tg) => (
                <SelectBox onClick={tg} placeholder={!un}>
                  <span style={{ flex: 1 }}>{un ? unidadeLabel(un) : "Selecionar unidade"}</span>
                </SelectBox>
              )} z={70} width={260}>
                {(c) => (
                  <>
                    <MenuItem checked={!unidadeId} onClick={() => { setUnidadeId(""); c(); }}><span style={{ flex: 1, color: "#9398A6" }}>— Nenhuma —</span></MenuItem>
                    {unidades.map((u) => (<MenuItem key={u.id} checked={unidadeId === u.id} onClick={() => { setUnidadeId(u.id); c(); }}><span style={{ flex: 1 }}>{unidadeLabel(u)}</span></MenuItem>))}
                  </>
                )}
              </Menu>
            </Field>
            <Field label="WhatsApp">
              <input value={fone} onChange={(e) => setFone(e.target.value)} placeholder="(48) 99999-0000" style={css(inp)} />
            </Field>
            <Field label="Status">
              <Menu trigger={(tg) => (
                <SelectBox onClick={tg}>
                  <span style={css(`width:8px; height:8px; border-radius:50%; background:${st?.dot ?? "#9398A6"};`)} /><span style={{ flex: 1 }}>{st?.label ?? status}</span>
                </SelectBox>
              )} z={70} width={230}>
                {(c) => TALENTO_STATUS.map((s) => (<MenuItem key={s.key} checked={status === s.key} onClick={() => { setStatus(s.key); c(); }}><span style={css(`width:9px; height:9px; border-radius:50%; background:${s.dot};`)} /><span style={{ flex: 1 }}>{s.label}</span></MenuItem>))}
              </Menu>
            </Field>
            <Field label="Qualidade">
              <Menu trigger={(tg) => (
                <SelectBox onClick={tg} placeholder={!ql}>
                  {ql && <span style={css(`width:8px; height:8px; border-radius:50%; background:${ql.cor};`)} />}
                  <span style={{ flex: 1 }}>{ql?.v ?? "Selecionar"}</span>
                </SelectBox>
              )} z={70} width={220}>
                {(c) => (
                  <>
                    <MenuItem checked={!qualidade} onClick={() => { setQualidade(""); c(); }}><span style={{ flex: 1, color: "#9398A6" }}>— Nenhuma —</span></MenuItem>
                    {QUALIDADE_TALENTO.map((q) => (<MenuItem key={q.v} checked={qualidade === q.v} onClick={() => { setQualidade(q.v); c(); }}><span style={css(`width:9px; height:9px; border-radius:50%; background:${q.cor};`)} /><span style={{ flex: 1 }}>{q.v}</span></MenuItem>))}
                  </>
                )}
              </Menu>
            </Field>
            <Field label="Observação inicial" full>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={4} placeholder="Como chegou, primeira impressão, disponibilidade…" style={{ ...css(inp), resize: "vertical", lineHeight: 1.55 }} />
            </Field>
          </div>
          <p style={css("margin:0; font-size:12px; color:#9398A6; line-height:1.5;")}>O currículo e outros anexos podem ser adicionados depois, abrindo o candidato.</p>
        </div>
        <div style={css("flex:none; padding:16px 24px; border-top:1px solid #ECEDF1; display:flex; gap:10px;")}>
          <Hoverable as="button" onClick={close} s={css("border:1px solid #E2E3E9; cursor:pointer; background:#fff; color:#5B6472; font-weight:700; font-size:14px; padding:13px 20px; border-radius:11px;")} hover="background:#F4F4F7">Cancelar</Hoverable>
          <Hoverable as="button" onClick={submit} {...{ disabled: !valido }} s={css(`flex:1; border:none; cursor:${valido ? "pointer" : "not-allowed"}; opacity:${valido ? 1 : 0.5}; background:#1B1B28; color:#fff; font-weight:700; font-size:14px; padding:13px; border-radius:11px;`)} hover={valido ? "filter:brightness(1.15)" : undefined}>Adicionar candidato</Hoverable>
        </div>
      </div>
    </>
  );
}

const inp = "width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:10px; font-size:13.5px; padding:11px 13px; outline:none;";

function Field({ label, req, full, children }: { label: string; req?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label style={css("display:block; font-size:13px; font-weight:700; margin-bottom:6px;")}>{label} {req && <span style={{ color: "#E5484D" }}>*</span>}</label>
      {children}
    </div>
  );
}

function SelectBox({ onClick, placeholder, children }: { onClick: () => void; placeholder?: boolean; children: React.ReactNode }) {
  return (
    <div onClick={onClick} style={css(`display:flex; align-items:center; gap:8px; cursor:pointer; border:1px solid #E2E3E9; border-radius:10px; padding:9px 13px; background:#fff; font-size:13.5px; font-weight:600; color:${placeholder ? "#9398A6" : "#1B1B28"};`)}>
      {children}
      <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
    </div>
  );
}
