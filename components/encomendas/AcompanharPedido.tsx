"use client";

import { useCallback, useEffect, useState } from "react";
import { css } from "@/lib/css";
import { brl } from "@/lib/format";
import { Svg } from "../ui/Svg";
import { Foto } from "./FunilEncomenda";
import { buscarAcompanhamento, dataBR, etapasCliente, ordemPedido, type Acompanhamento } from "@/lib/encomendas";

/**
 * Acompanhamento do pedido pelo cliente (/pedido/[id]), no estilo dos apps de delivery:
 * etapa atual em destaque, linha do tempo, foto e dados do pedido, loja de retirada e um
 * botão para falar com a loja. Atualiza sozinha a cada 30 s e ao voltar para a aba.
 */

const COR = "#955C6B";
const COR_ESCURA = "#5E2F3E";
const TINTA = "#1B1B28", FRACA = "#7A8090", BORDA = "#ECEDF1";
const VERDE = "#1B7F4D";

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const quando = (iso: string, hora: string) => { const d = DIAS_SEMANA[new Date(`${iso}T12:00:00`).getDay()]; return `${d.charAt(0).toUpperCase()}${d.slice(1)}, ${dataBR(iso)} às ${hora}`; };

export default function AcompanharPedido({ id }: { id: string }) {
  const [pedido, setPedido] = useState<Acompanhamento | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "nao-achou" | "erro">("carregando");
  const [atualizado, setAtualizado] = useState<Date | null>(null);

  const carregar = useCallback(async () => {
    try {
      const p = await buscarAcompanhamento(id);
      if (!p) { setEstado("nao-achou"); return; }
      setPedido(p); setEstado("ok"); setAtualizado(new Date());
    } catch {
      // Já tinha mostrado o pedido: mantém na tela e tenta de novo na próxima rodada.
      setEstado((e) => (e === "ok" ? e : "erro"));
    }
  }, [id]);

  useEffect(() => {
    void carregar();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void carregar(); }, 30_000);
    const ver = () => { if (document.visibilityState === "visible") void carregar(); };
    document.addEventListener("visibilitychange", ver);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", ver); };
  }, [carregar]);

  return (
    <div style={css(`min-height:100dvh; background:linear-gradient(160deg, ${COR}, ${COR_ESCURA}); display:flex; justify-content:center; color:${TINTA};`)}>
      <div style={css("width:100%; max-width:560px; min-height:100dvh; background:#F6F6F8; display:flex; flex-direction:column;")}>
        {estado === "ok" && pedido ? <Conteudo p={pedido} atualizado={atualizado} onAtualizar={() => void carregar()} /> : (
          <>
            <Topo />
            <div style={css("flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px 24px; gap:10px;")}>
              {estado === "carregando" ? (
                <>
                  <span aria-hidden style={css(`width:34px; height:34px; border-radius:50%; border:3px solid ${BORDA}; border-top-color:${COR}; animation:girar .8s linear infinite;`)} />
                  <span style={css(`font-size:15px; color:${FRACA};`)}>Carregando o seu pedido…</span>
                </>
              ) : (
                <>
                  <span style={css(`width:56px; height:56px; border-radius:50%; background:#FDF1F4; color:${COR}; display:flex; align-items:center; justify-content:center;`)}>
                    <Svg size={26} sw={2.2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
                  </span>
                  <h1 style={css("margin:6px 0 0; font-size:21px; font-weight:800;")}>{estado === "nao-achou" ? "Pedido não encontrado" : "Não foi possível carregar"}</h1>
                  <p style={css(`margin:0; font-size:15px; color:${FRACA}; line-height:1.45; max-width:340px;`)}>
                    {estado === "nao-achou" ? "Confira se o link está completo, do jeito que chegou no WhatsApp." : "Verifique a sua internet e tente de novo."}
                  </p>
                  {estado === "erro" && <button onClick={() => { setEstado("carregando"); void carregar(); }} style={css(`margin-top:8px; border:none; background:${COR}; color:#fff; border-radius:999px; padding:13px 24px; font-size:15.5px; font-weight:800; cursor:pointer;`)}>Tentar de novo</button>}
                </>
              )}
            </div>
          </>
        )}
      </div>
      <style>{"@keyframes girar{to{transform:rotate(360deg)}}@keyframes pulso{0%{box-shadow:0 0 0 0 rgba(149,92,107,.45)}70%{box-shadow:0 0 0 10px rgba(149,92,107,0)}100%{box-shadow:0 0 0 0 rgba(149,92,107,0)}}"}</style>
    </div>
  );
}

function Topo({ numero }: { numero?: string }) {
  return (
    <div style={css(`background:#fff; border-bottom:1px solid ${BORDA}; padding:calc(env(safe-area-inset-top) + 12px) 16px 12px; display:flex; align-items:center; gap:12px;`)}>
      <img src="/icone-jb-180.png" alt="Ju Budelon" width={42} height={42} style={css("width:42px; height:42px; border-radius:12px;")} />
      <div style={css("flex:1; min-width:0;")}>
        <div style={css("font-size:16px; font-weight:800;")}>Ju Budelon</div>
        <div style={css(`font-size:13px; color:${FRACA}; font-weight:600;`)}>{numero ? `Pedido #${numero}` : "Acompanhe seu pedido"}</div>
      </div>
    </div>
  );
}

function Conteudo({ p, atualizado, onAtualizar }: { p: Acompanhamento; atualizado: Date | null; onAtualizar: () => void }) {
  const etapas = etapasCliente(p);
  const atual = Math.max(0, ordemPedido(p.status));
  const etapa = etapas[atual] ?? etapas[0];
  const fim = p.status === "Entregue";
  const pronto = p.status === "Pronto para retirada";
  const destaque = fim ? VERDE : pronto ? "#7C3AED" : COR;
  const mapa = p.unidade?.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.unidade.endereco}`)}` : null;

  return (
    <>
      <Topo numero={p.numero} />
      <main style={css("flex:1; padding:14px 14px calc(env(safe-area-inset-bottom) + 20px); display:flex; flex-direction:column; gap:12px;")}>
        {/* Etapa atual */}
        <section aria-live="polite" style={css(`background:#fff; border-radius:18px; padding:18px 16px 16px; box-shadow:0 2px 12px rgba(27,27,40,.06); border-top:4px solid ${destaque};`)}>
          <div style={css(`font-size:14px; color:${FRACA}; font-weight:600;`)}>{p.cliente ? `Olá, ${p.cliente}!` : "Olá!"}</div>
          <div style={css("display:flex; align-items:center; gap:12px; margin-top:6px;")}>
            <span style={css(`width:48px; height:48px; flex:none; border-radius:14px; background:${destaque}1A; color:${destaque}; display:flex; align-items:center; justify-content:center;`)}>
              <IconeEtapa i={atual} />
            </span>
            <div style={css("min-width:0;")}>
              <h1 style={css("margin:0; font-size:23px; font-weight:800; letter-spacing:-.4px; line-height:1.15;")}>{etapa.titulo}</h1>
              <p style={css(`margin:3px 0 0; font-size:15px; color:#5B6472; line-height:1.4;`)}>{etapa.texto}</p>
            </div>
          </div>
          {/* Barra de progresso */}
          <div role="progressbar" aria-valuemin={1} aria-valuemax={etapas.length} aria-valuenow={atual + 1} aria-label="Andamento do pedido" style={css(`display:grid; grid-template-columns:repeat(${etapas.length},1fr); gap:5px; margin-top:16px;`)}>
            {etapas.map((e, i) => <span key={e.status} style={css(`height:6px; border-radius:99px; background:${i <= atual ? destaque : "#E6E7EC"};`)} />)}
          </div>
          <div style={css(`display:flex; align-items:center; gap:8px; margin-top:12px; font-size:14px; color:${TINTA}; font-weight:700;`)}>
            <Svg size={16} sw={2.2} stroke={FRACA}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></Svg>
            <span>{p.tipo === "Retirada" ? "Retirada" : "Entrega"}: {quando(p.data, p.hora)}</span>
          </div>
        </section>

        {/* Linha do tempo */}
        <section style={css("background:#fff; border-radius:18px; padding:16px; box-shadow:0 2px 12px rgba(27,27,40,.06);")}>
          <h2 style={css("margin:0 0 12px; font-size:16px; font-weight:800;")}>Andamento</h2>
          <ol style={css("list-style:none; margin:0; padding:0;")}>
            {etapas.map((e, i) => {
              const feito = i < atual || (fim && i === atual);
              const agora = i === atual && !fim;
              const ultima = i === etapas.length - 1;
              return (
                <li key={e.status} style={css("display:flex; gap:12px;")}>
                  <div style={css("display:flex; flex-direction:column; align-items:center; flex:none; width:24px;")}>
                    <span style={css(`width:24px; height:24px; border-radius:50%; flex:none; display:flex; align-items:center; justify-content:center; background:${feito ? destaque : agora ? "#fff" : "#EDEEF2"}; border:${agora ? `3px solid ${destaque}` : "none"}; color:#fff; ${agora ? "animation:pulso 1.8s infinite;" : ""}`)}>
                      {feito && <Svg size={13} sw={3.2}><path d="M20 6 9 17l-5-5" /></Svg>}
                    </span>
                    {!ultima && <span style={css(`width:2px; flex:1; min-height:18px; background:${i < atual ? destaque : "#E6E7EC"}; margin:3px 0;`)} />}
                  </div>
                  <div style={css(`padding-bottom:${ultima ? 0 : 14}px; min-width:0;`)}>
                    <div style={css(`font-size:15px; font-weight:${agora || feito ? 800 : 600}; color:${agora || feito ? TINTA : "#9398A6"};`)}>{e.titulo}</div>
                    {agora && <div style={css("font-size:13.5px; color:#5B6472; margin-top:2px; line-height:1.4;")}>{e.texto}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Pedido */}
        <section style={css("background:#fff; border-radius:18px; padding:14px; box-shadow:0 2px 12px rgba(27,27,40,.06);")}>
          <h2 style={css("margin:2px 2px 12px; font-size:16px; font-weight:800;")}>Seu pedido</h2>
          <div style={css("display:flex; gap:12px; align-items:flex-start;")}>
            <div style={css("width:88px; flex:none; border-radius:14px; overflow:hidden;")}><Foto src={p.foto} alt={p.produto} proporcao="1/1" cortar miniatura /></div>
            <div style={css("flex:1; min-width:0;")}>
              <div style={css("font-size:16px; font-weight:800; line-height:1.25;")}>{p.quantidade}× {p.produto}</div>
              {p.mensagem && <div style={css("margin-top:6px; font-size:13.5px; color:#7A5512; background:#FFF8E6; border-radius:9px; padding:6px 9px; line-height:1.35;")}><b>Observação:</b> {p.mensagem}</div>}
              <div style={css("display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-top:8px;")}>
                <span style={css(`font-size:13.5px; color:${FRACA}; font-weight:600;`)}>Total · PIX</span>
                <span style={css("font-size:18px; font-weight:800; font-variant-numeric:tabular-nums;")}>{brl(p.total)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Onde */}
        {p.tipo === "Retirada" && p.unidade && (
          <section style={css("background:#fff; border-radius:18px; padding:16px; box-shadow:0 2px 12px rgba(27,27,40,.06);")}>
            <h2 style={css("margin:0 0 10px; font-size:16px; font-weight:800;")}>Onde retirar</h2>
            <div style={css("display:flex; gap:12px;")}>
              <span style={css(`width:40px; height:40px; flex:none; border-radius:12px; background:#FDF1F4; color:${COR}; display:flex; align-items:center; justify-content:center;`)}>
                <Svg size={20} sw={2}><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></Svg>
              </span>
              <div style={css("min-width:0; display:flex; flex-direction:column; gap:3px;")}>
                <div style={css("font-size:15.5px; font-weight:800;")}>Loja {p.unidade.nome}</div>
                {p.unidade.endereco && <div style={css("font-size:14px; color:#5B6472; line-height:1.35;")}>{p.unidade.endereco}</div>}
                {p.unidade.horario && <div style={css(`font-size:13.5px; color:${FRACA}; line-height:1.35;`)}>Funcionamento: {p.unidade.horario}</div>}
                {mapa && <a href={mapa} target="_blank" rel="noopener noreferrer" style={css(`margin-top:4px; font-size:14px; font-weight:800; color:${COR}; text-decoration:none;`)}>Ver no mapa →</a>}
              </div>
            </div>
          </section>
        )}
        {p.tipo === "Entrega" && (
          <section style={css("background:#fff; border-radius:18px; padding:16px; box-shadow:0 2px 12px rgba(27,27,40,.06); font-size:14.5px; color:#5B6472;")}>
            <h2 style={css(`margin:0 0 6px; font-size:16px; font-weight:800; color:${TINTA};`)}>Entrega</h2>
            No endereço informado{p.bairro ? ` (${p.bairro})` : ""}.
          </section>
        )}

        <button onClick={onAtualizar} style={css(`align-self:center; border:none; background:transparent; color:${FRACA}; font-size:13px; font-weight:600; cursor:pointer; padding:6px;`)}>
          {atualizado ? `Atualizado às ${atualizado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · toque para atualizar` : "Atualizar"}
        </button>
      </main>
    </>
  );
}

function IconeEtapa({ i }: { i: number }) {
  const paths = [
    <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>, // recebido
    <><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10.5h19M6.5 15h4" /></>, // pagamento
    <><path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M7 11V8a5 5 0 0 1 10 0v3" /><path d="M12 3v2" /></>, // produção
    <><path d="M3 9.5 4.6 4h14.8L21 9.5" /><path d="M5 12v8h14v-8M10 20v-4.5h4V20" /></>, // na loja
    <path d="M20 6 9 17l-5-5" />, // entregue
  ];
  return <Svg size={24} sw={2}>{paths[i] ?? paths[0]}</Svg>;
}
