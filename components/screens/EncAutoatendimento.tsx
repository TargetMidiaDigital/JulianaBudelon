"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { brl, foneBR } from "@/lib/format";
import { BRAND } from "@/lib/theme";
import { useEncomendas } from "@/lib/encomendas";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import FunilEncomenda from "../encomendas/FunilEncomenda";
import CatalogoEditor from "../encomendas/CatalogoEditor";
import ConfigEditor from "../encomendas/ConfigEditor";
import { useApp } from "../store";
import { useIsMobile } from "@/lib/useIsMobile";

/**
 * Encomendas → Autoatendimento: a página pública de encomendas (/encomendar) e o que a
 * alimenta — catálogo (produtos em categorias) e configurações (unidades de retirada,
 * entrega, horários, regras e PIX). Versão sem banco: tudo fica neste navegador.
 */
const ABAS = [
  { id: "pagina", label: "Página de encomendas", desc: "O que o cliente vê e o link para divulgar" },
  { id: "produtos", label: "Produtos", desc: "Produtos e categorias do catálogo" },
  { id: "config", label: "Configurações", desc: "Unidades de retirada, entrega, horários e pagamento" },
] as const;

export default function EncAutoatendimento() {
  const { canEditPage } = useApp();
  const editavel = canEditPage("encomendas-autoatendimento");
  const mobile = useIsMobile();
  const { config, produtos, categorias, restaurarExemplo } = useEncomendas();
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("pagina");
  const [copiado, setCopiado] = useState(false);
  const [chave, setChave] = useState(0); // remonta o funil da prévia (volta ao passo 1) e o editor de configurações
  const link = typeof window !== "undefined" ? `${window.location.origin}/encomendar` : "/encomendar";
  const unidadesAtivas = config.retiradaAtiva ? config.unidades.filter((u) => u.ativo) : [];

  return (
    <div style={css("height:100%; display:flex; flex-direction:column;")}>
      <div className="m-pad m-wrap" style={css("display:flex; align-items:center; gap:16px; padding:24px 30px 6px; flex:none;")}>
        <div>
          <h1 style={css("margin:0 0 3px; font-size:22px; font-weight:800; letter-spacing:-0.4px;")}>Autoatendimento</h1>
          <p style={css("margin:0; color:#7A8090; font-size:13.5px;")}>{ABAS.find((a) => a.id === aba)!.desc}</p>
        </div>
      </div>
      <div className="m-pad m-rail" style={css("display:flex; gap:22px; padding:8px 30px 0; border-bottom:1px solid #ECEDF1; flex:none;")}>
        {ABAS.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)} style={css(`flex:none; border:none; background:transparent; cursor:pointer; padding:10px 0; font-size:13.5px; font-weight:700; color:${aba === a.id ? BRAND : "#7A8090"}; border-bottom:2.5px solid ${aba === a.id ? BRAND : "transparent"}; margin-bottom:-1px; white-space:nowrap;`)}>{a.label}</button>
        ))}
      </div>

      <div className="m-pad" style={css("flex:1; min-height:0; overflow-y:auto; padding:22px 30px 30px;")}>
        <div style={css("display:flex; align-items:center; gap:10px; font-size:12.5px; color:#92400E; background:#FFFBEB; border:1px solid #FDE68A; border-radius:11px; padding:9px 12px; margin-bottom:18px;")}>
          <Svg size={15} sw={2.2} style={css("flex:none;")}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></Svg>
          <span style={{ flex: 1, minWidth: 0 }}>{mobile ? <><b>Demonstração:</b> dados só neste aparelho.</> : <><b>Versão de demonstração:</b> sem banco de dados. Produtos, configurações e pedidos ficam só neste navegador.</>}</span>
          {editavel && <Hoverable as="button" onClick={() => { if (window.confirm("Voltar tudo ao exemplo? Isso apaga os pedidos de teste e desfaz as mudanças em produtos, categorias e configurações.")) { restaurarExemplo(); setChave((k) => k + 1); } }} s={css("flex:none; border:1px solid #FDE68A; background:#fff; color:#92400E; border-radius:8px; padding:5px 10px; font-size:12px; font-weight:700; cursor:pointer;")} hover="background:#FEF3C7">Restaurar exemplo</Hoverable>}
        </div>

        {aba === "pagina" && (
          <div className="m-stack" style={css("display:flex; gap:26px; align-items:flex-start;")}>
            <div style={css("flex:1; min-width:0; display:flex; flex-direction:column; gap:14px; max-width:520px;")}>
              <Cartao titulo="Página de encomendas" icone={<><path d="M3 9.5 4.6 4h14.8L21 9.5" /><path d="M5 12v8h14v-8M10 20v-4.5h4V20" /></>}>
                <div style={css("display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#1B7F4D; margin-bottom:12px;")}>
                  <span style={css("width:8px; height:8px; border-radius:50%; background:#16A34A;")} />No ar — qualquer pessoa com o link pode encomendar.
                </div>
                <div style={css("display:flex; gap:8px; flex-wrap:wrap;")}>
                  <input readOnly value={link} style={css("flex:1; min-width:180px; border:1px solid #E2E3E9; background:#FAFAFB; border-radius:9px; padding:9px 11px; font-size:13px; color:#3A3F4C;")} />
                  <Botao onClick={() => { void navigator.clipboard?.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }}>{copiado ? "Copiado!" : "Copiar"}</Botao>
                  {!mobile && <Botao onClick={() => window.open("/encomendar", "_blank")}>Abrir</Botao>}
                </div>
                {/* No celular a prévia em "celular dentro do celular" não cabe: abre a página de verdade. */}
                {mobile && (
                  <Hoverable as="button" onClick={() => window.open("/encomendar", "_blank")} s={css(`margin-top:12px; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; border:none; background:${BRAND}; color:#fff; border-radius:11px; padding:12px; font-size:14px; font-weight:800; cursor:pointer;`)} hover="filter:brightness(1.1)">
                    <Svg size={16} sw={2.2}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Svg>Ver a página como o cliente
                  </Hoverable>
                )}
                <div style={css("font-size:12.5px; color:#7A8090; margin-top:12px; line-height:1.5;")}>WhatsApp de contato da página: <b>{foneBR(config.whatsappContato) || "—"}</b></div>
              </Cartao>
              <Cartao titulo="Resumo do que o cliente vê" icone={<path d="M3 4h18l-7 8v6l-4 2v-8z" />}>
                <ol style={css("margin:0; padding-left:18px; display:flex; flex-direction:column; gap:7px; font-size:13px; color:#3A3F4C; line-height:1.45;")}>
                  <li><b>Escolhe o produto</b> entre {produtos.filter((p) => p.ativo).length} ativos, em {categorias.length} categoria{categorias.length === 1 ? "" : "s"}.</li>
                  <li><b>Quantidade e observação</b> (até {config.maxPorPedido} por pedido).</li>
                  <li><b>{[unidadesAtivas.length && "Retirada", config.entregaAtiva && "entrega"].filter(Boolean).join(" ou ") || "Nenhuma forma de receber ligada"}</b>
                    {unidadesAtivas.length > 0 && ` — retirada em ${unidadesAtivas.length} unidade${unidadesAtivas.length === 1 ? "" : "s"}`}
                    {config.entregaAtiva && ` — entrega com taxa de ${brl(config.taxaEntrega)}`}.</li>
                  <li><b>Data e horário</b>, com {config.antecedenciaHoras}h de antecedência mínima.</li>
                  <li><b>Nome e WhatsApp</b>, com o resumo do pedido.</li>
                  <li><b>PIX</b>{config.pixChave ? "" : " (de exemplo, sem chave configurada)"}. O pedido entra no CRM em <b>Venda</b> e na Agenda como <b>Verificar pagamento</b>.</li>
                </ol>
                {editavel && (
                  <div style={css("display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;")}>
                    <Botao onClick={() => setAba("produtos")}>Editar produtos</Botao>
                    <Botao onClick={() => setAba("config")}>Editar configurações</Botao>
                  </div>
                )}
              </Cartao>
            </div>
            {!mobile && <div style={css("flex:none; display:flex; flex-direction:column; align-items:center; gap:10px; margin:0 auto;")}>
              <div style={css("width:360px; max-width:100%; height:720px; border-radius:42px; background:#1B1B28; padding:10px; box-shadow:0 24px 60px rgba(20,24,40,.25); box-sizing:border-box;")}>
                <div style={css("width:100%; height:100%; border-radius:33px; overflow:hidden; background:#fff; transform:translateZ(0);")}>
                  <FunilEncomenda key={chave} emTela={false} />
                </div>
              </div>
              <Hoverable as="button" onClick={() => setChave((k) => k + 1)} s={css("border:none; background:transparent; color:#7A8090; font-size:12.5px; font-weight:700; cursor:pointer; padding:4px 8px;")} hover="color:#3A3F4C">Recomeçar a prévia</Hoverable>
            </div>}
          </div>
        )}

        {aba === "produtos" && <CatalogoEditor editavel={editavel} />}
        {aba === "config" && <ConfigEditor key={chave} editavel={editavel} />}
      </div>
    </div>
  );
}

function Cartao({ titulo, icone, children }: { titulo: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:16px 18px;")}>
      <div style={css("display:flex; align-items:center; gap:10px; margin-bottom:12px;")}>
        <span style={css(`width:32px; height:32px; border-radius:9px; background:${BRAND}1A; color:${BRAND}; display:flex; align-items:center; justify-content:center; flex:none;`)}><Svg size={16} sw={2}>{icone}</Svg></span>
        <span style={css("font-size:15px; font-weight:800;")}>{titulo}</span>
      </div>
      {children}
    </div>
  );
}

function Botao({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <Hoverable as="button" onClick={onClick} s={css("border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; border-radius:9px; padding:8px 14px; font-size:13px; font-weight:700; cursor:pointer;")} hover="background:#F4F4F7">{children}</Hoverable>;
}
