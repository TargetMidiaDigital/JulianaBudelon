"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { CATEGORIAS_ESTOQUE, LOCAIS_ESTOQUE, chaveProduto, corDaCategoria, parseQuantidades } from "@/lib/estoque";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import { useApp } from "../store";

/** Drawer "Novo produto" (Operacional → Estoque): nome, categoria e quantidade por local. */
export default function ProdutoForm({ open, onClose, categoriaInicial }: { open: boolean; onClose: () => void; categoriaInicial?: string }) {
  const { produtos, addProduto } = useApp();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [qtd, setQtd] = useState<Record<string, string>>({});

  const close = () => { onClose(); setNome(""); setCategoria(""); setQtd({}); };
  useFecharComEsc(open, close);
  if (!open) return null;

  const cat = categoria || categoriaInicial || "";
  const repetido = !!nome.trim() && !!cat && produtos.some((p) => chaveProduto(p.nome, p.categoria) === chaveProduto(nome, cat));
  const valido = !!nome.trim() && !!cat && !repetido;

  const submit = () => {
    if (!valido) return;
    addProduto({ nome: nome.trim(), categoria: cat, quantidades: parseQuantidades(qtd) });
    close();
  };
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === "Enter") submit(); };

  return (
    <>
      <div onClick={close} style={css("position:fixed; inset:0; z-index:64; background:rgba(20,24,40,.32);")} />
      <div style={css("position:fixed; top:0; right:0; bottom:0; z-index:65; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:520px; max-width:96vw; display:flex; flex-direction:column; overflow:hidden;")}>
        <div style={css("display:flex; align-items:center; gap:10px; padding:18px 24px; border-bottom:1px solid #ECEDF1;")}>
          <h2 style={css("margin:0; font-size:18px; font-weight:800; letter-spacing:-0.3px;")}>Novo produto</h2>
          <span style={{ flex: 1 }} />
          <Hoverable as="button" onClick={close} s={css("width:32px; height:32px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={16} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:22px 24px; display:flex; flex-direction:column; gap:18px;")}>
          <Field label="Nome" req>
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={onEnter} placeholder="ex.: Cookies Nutella" style={css(inp)} />
            {repetido && <p style={css("margin:6px 0 0; font-size:12px; font-weight:600; color:#CC3338;")}>Já existe um produto com este nome em {cat}.</p>}
          </Field>
          <Field label="Categoria" req>
            <Menu trigger={(tg) => (
              <div onClick={tg} style={css(`display:flex; align-items:center; gap:8px; cursor:pointer; border:1px solid #E2E3E9; border-radius:10px; padding:9px 13px; background:#fff; font-size:13.5px; font-weight:600; color:${cat ? "#1B1B28" : "#9398A6"};`)}>
                {cat && <span style={css(`width:8px; height:8px; border-radius:50%; background:${corDaCategoria(cat)};`)} />}
                <span style={{ flex: 1 }}>{cat || "Selecionar categoria"}</span>
                <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
              </div>
            )} z={70} width={260}>
              {(c) => CATEGORIAS_ESTOQUE.map((k) => (
                <MenuItem key={k.v} checked={cat === k.v} onClick={() => { setCategoria(k.v); c(); }}>
                  <span style={css(`width:9px; height:9px; border-radius:50%; background:${k.cor};`)} /><span style={{ flex: 1 }}>{k.v}</span>
                </MenuItem>
              ))}
            </Menu>
          </Field>
          <Field label="Quantidade por local">
            <div style={css("display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:10px 12px;")}>
              {LOCAIS_ESTOQUE.map((l) => (
                <div key={l.id}>
                  <span style={css("display:block; font-size:11.5px; font-weight:700; color:#7A8090; margin-bottom:4px;")}>{l.label}</span>
                  <input value={qtd[l.id] ?? ""} onChange={(e) => setQtd((q) => ({ ...q, [l.id]: e.target.value.replace(/[^\d]/g, "") }))} onKeyDown={onEnter} inputMode="numeric" placeholder="0" style={css(inp + " padding:9px 11px;")} />
                </div>
              ))}
            </div>
            <p style={css("margin:8px 0 0; font-size:12px; color:#9398A6; line-height:1.5;")}>Em branco = 0. As quantidades podem ser ajustadas direto na lista depois.</p>
          </Field>
        </div>
        <div style={css("flex:none; padding:16px 24px; border-top:1px solid #ECEDF1; display:flex; gap:10px;")}>
          <Hoverable as="button" onClick={close} s={css("border:1px solid #E2E3E9; cursor:pointer; background:#fff; color:#5B6472; font-weight:700; font-size:14px; padding:13px 20px; border-radius:11px;")} hover="background:#F4F4F7">Cancelar</Hoverable>
          <Hoverable as="button" onClick={submit} {...{ disabled: !valido }} s={css(`flex:1; border:none; cursor:${valido ? "pointer" : "not-allowed"}; opacity:${valido ? 1 : 0.5}; background:#1B1B28; color:#fff; font-weight:700; font-size:14px; padding:13px; border-radius:11px;`)} hover={valido ? "filter:brightness(1.15)" : undefined}>Cadastrar produto</Hoverable>
        </div>
      </div>
    </>
  );
}

const inp = "width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:10px; font-size:13.5px; padding:11px 13px; outline:none;";

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={css("display:block; font-size:13px; font-weight:700; margin-bottom:6px;")}>{label} {req && <span style={{ color: "#E5484D" }}>*</span>}</label>
      {children}
    </div>
  );
}
