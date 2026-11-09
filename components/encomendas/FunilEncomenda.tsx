"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { css } from "@/lib/css";
import { brl, foneBR, normalizePhone } from "@/lib/format";
import { Svg } from "../ui/Svg";
import {
  FOTO_POSICAO, PERIODOS, catalogoPorCategoria, criarPedidoAutoatendimento, dataBR, horariosDoDia, isoDia,
  numeroPedido, pixCopiaECola, respeitaAntecedencia, useEncomendas, type ConfigEncomendas, type PedidoEncomenda, type TipoEntrega,
} from "@/lib/encomendas";

/**
 * Funil do cliente (o "totem" do Cachorrão, adaptado para um catálogo em categorias):
 * 1 escolhe o produto → 2 quantidade e observação → 3 entrega ou retirada → 4 data e horário →
 * 5 nome e WhatsApp com resumo → PIX. Produtos, unidades, taxa e horários vêm da
 * configuração do Autoatendimento. Mobile-first; roda na página pública /encomendar e
 * dentro do celular de pré-visualização em Encomendas → Autoatendimento.
 */

const COR = "#955C6B";
const COR_ESCURA = "#5E2F3E";
const TINTA = "#1B1B28", FRACA = "#9398A6", BORDA = "#E6E7EC", CAMPO = "#F8F9FB";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type Passo = 1 | 2 | 3 | 4 | 5 | 6;

export default function FunilEncomenda({ emTela = true }: { emTela?: boolean }) {
  const { config: cfg, categorias, produtos, produtoDe, carregado, erroCarga } = useEncomendas();
  const unidades = cfg.retiradaAtiva ? cfg.unidades.filter((u) => u.ativo && u.nome.trim()) : [];
  const grupos = catalogoPorCategoria(categorias, produtos);
  const [passo, setPasso] = useState<Passo>(1);
  // Cada passo abre no topo (sem isto, tocar num produto no fim da lista abria o passo 2 rolado).
  const rolagem = useRef<HTMLDivElement>(null);
  useEffect(() => { rolagem.current?.scrollTo(0, 0); }, [passo]);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [qtd, setQtd] = useState(1);
  const [mensagem, setMensagem] = useState("");
  const [tipo, setTipo] = useState<TipoEntrega | null>(null);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [end, setEnd] = useState({ cidade: "", bairro: "", rua: "", numero: "", complemento: "" });
  const [data, setData] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");
  const [pedido, setPedido] = useState<PedidoEncomenda | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pago, setPago] = useState(false);
  const pix = pedido ? pixCopiaECola(cfg, pedido.total, `JB${numeroPedido(pedido.id)}`) : null;

  const produto = produtoId ? produtoDe(produtoId) : undefined;
  const subtotal = (produto?.preco ?? 0) * qtd;
  const taxa = tipo === "Entrega" ? cfg.taxaEntrega : 0;
  const total = subtotal + taxa;
  const endOk = end.cidade.trim().length >= 3 && end.bairro.trim().length >= 2 && end.rua.trim().length >= 3 && end.numero.trim().length >= 1;
  const unidade = unidades.find((u) => u.id === unidadeId);
  // Só uma forma ligada (ex.: só retirada): já vem escolhida, sem a pergunta "Entrega ou retirada?".
  const soRetirada = unidades.length > 0 && !cfg.entregaAtiva;
  const soEntrega = unidades.length === 0 && cfg.entregaAtiva;
  useEffect(() => {
    if (soRetirada && tipo !== "Retirada") setTipo("Retirada");
    else if (soEntrega && tipo !== "Entrega") { setTipo("Entrega"); setUnidadeId(null); }
  }, [soRetirada, soEntrega, tipo]);
  const unidadeNome = unidade?.nome;

  const pode: Record<Passo, boolean> = {
    1: !!produto && produto.ativo,
    2: qtd >= 1 && qtd <= cfg.maxPorPedido,
    3: tipo === "Retirada" ? !!unidade : tipo === "Entrega" ? cfg.entregaAtiva && endOk : false,
    4: !!data && !!hora,
    5: nome.trim().length >= 2 && normalizePhone(whats).length >= 10,
    6: true,
  };

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  useEffect(() => { setErroEnvio(null); }, [passo]);
  const confirmar = async () => {
    if (!produto || !tipo || !data || !hora || enviando) return;
    setEnviando(true); setErroEnvio(null);
    try {
      const p = await criarPedidoAutoatendimento({
        produtoId: produto.id, quantidade: qtd, mensagem: mensagem.trim() || undefined, tipo,
        unidadeId: tipo === "Retirada" ? unidadeId ?? undefined : undefined,
        endereco: tipo === "Entrega" ? { ...end, complemento: end.complemento.trim() || undefined } : undefined,
        data, hora, nome: nome.trim(), whatsapp: whats,
      });
      setPedido(p);
      setPasso(6);
    } catch (e) {
      // Ex.: o horário deixou de respeitar a antecedência, a loja foi desativada… — mostra e deixa corrigir.
      setErroEnvio(e instanceof Error ? e.message : "Não foi possível enviar o pedido. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };
  const avancar = () => {
    if (!pode[passo] || enviando) return;
    if (passo === 5) confirmar();
    else if (passo < 5) setPasso((passo + 1) as Passo);
  };
  const recomecar = () => {
    setPasso(1); setProdutoId(null); setQtd(1); setMensagem(""); setTipo(null); setUnidadeId(null);
    setEnd({ cidade: "", bairro: "", rua: "", numero: "", complemento: "" }); setData(null); setHora(null);
    setNome(""); setWhats(""); setPedido(null); setPago(false);
  };

  const botao = passo === 5 ? (enviando ? "Enviando…" : "Confirmar pedido") : "Continuar";

  return (
    <div style={css(`${emTela ? "height:100dvh;" : "height:100%;"} background:linear-gradient(135deg, ${COR}, ${COR_ESCURA}); display:flex; justify-content:center; font-family:inherit; color:${TINTA};`)}>
      <div style={css(`width:100%; max-width:560px; ${emTela ? "height:100dvh;" : "height:100%;"} background:#fff; display:flex; flex-direction:column; position:relative;`)}>
        {/* Cabeçalho */}
        <div style={css(`flex:none; position:sticky; top:0; z-index:5; background:#fff; padding:${emTela ? "calc(env(safe-area-inset-top) + 12px)" : "12px"} 16px 10px; border-bottom:1px solid ${BORDA};`)}>
          <div style={css("display:flex; align-items:center; gap:10px; min-height:40px;")}>
            {passo > 1 && passo < 6 ? (
              <button onClick={() => setPasso((passo - 1) as Passo)} style={css(`display:inline-flex; align-items:center; gap:4px; border:1px solid ${BORDA}; background:#fff; border-radius:999px; padding:7px 12px; font-size:13px; font-weight:700; color:${TINTA}; cursor:pointer;`)}>
                <Svg size={14} sw={2.4}><path d="m15 18-6-6 6-6" /></Svg>Voltar
              </button>
            ) : <span style={css(`font-size:13px; font-weight:800; color:${COR}; letter-spacing:.3px;`)}>Encomendas</span>}
            <span style={{ flex: 1 }} />
            {passo < 6 && <span style={css(`font-size:12.5px; font-weight:700; color:${FRACA};`)}>{passo} de 5</span>}
            <img src="/icone-jb-180.png" alt="Ju Budelon" style={css("width:38px; height:38px; border-radius:10px;")} />
          </div>
          {passo < 6 && (
            <div style={css("display:grid; grid-template-columns:repeat(5,1fr); gap:5px; margin-top:10px;")}>
              {[1, 2, 3, 4, 5].map((n) => <span key={n} style={css(`height:4px; border-radius:99px; background:${passo >= n ? COR : BORDA};`)} />)}
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div ref={rolagem} style={css("flex:1; min-height:0; overflow-y:auto; padding:18px 16px 24px;")}>
          {passo === 1 && (
            <>
              <h1 style={css("margin:0 0 4px; font-size:22px; font-weight:800; letter-spacing:-.4px;")}>O que você vai querer?</h1>
              <p style={css(`margin:0 0 6px; font-size:13.5px; color:${FRACA};`)}>Escolha um produto para continuar.</p>
              {!carregado && <div style={css(`padding:40px 0; text-align:center; color:${FRACA}; font-size:14px;`)}>Carregando o cardápio…</div>}
              {carregado && erroCarga && <div role="alert" style={css("margin-top:14px; font-size:13.5px; font-weight:600; color:#B42318; background:#FEF3F2; border:1px solid #FECDCA; border-radius:12px; padding:11px 13px;")}>Não foi possível carregar o cardápio agora. Atualize a página em instantes.</div>}
              {carregado && !erroCarga && grupos.length === 0 && <div style={css(`padding:30px 0; text-align:center; color:${FRACA}; font-size:14px;`)}>Nenhum produto disponível para encomenda no momento.</div>}
              {grupos.length > 1 && (
                <div style={css("display:flex; gap:7px; overflow-x:auto; padding:8px 0 4px; scrollbar-width:none;")}>
                  {grupos.map((g) => (
                    <button key={g.categoria?.id ?? "sem"} onClick={() => document.getElementById(`cat-${g.categoria?.id ?? "sem"}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} style={css(`flex:none; border:1px solid ${BORDA}; background:#fff; border-radius:999px; padding:6px 12px; font-size:12.5px; font-weight:700; color:${TINTA}; cursor:pointer; white-space:nowrap;`)}>{g.categoria?.nome ?? "Outros"}</button>
                  ))}
                </div>
              )}
              {grupos.length === 0 && <div style={css(`margin-top:20px; text-align:center; color:${FRACA}; font-size:13.5px;`)}>Nenhum produto disponível no momento.</div>}
              {grupos.map((g) => (
                <section key={g.categoria?.id ?? "sem"} id={`cat-${g.categoria?.id ?? "sem"}`} style={css("margin-top:14px; scroll-margin-top:8px;")}>
                  <h2 style={css(`margin:0 0 10px; font-size:15px; font-weight:800; color:${COR};`)}>{g.categoria?.nome ?? "Outros"}</h2>
                  <div style={css("display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px;")}>
                    {g.produtos.map((p) => {
                      const sel = p.id === produtoId;
                      return (
                        <button key={p.id} onClick={() => { setProdutoId(p.id); if (p.id !== produtoId) setQtd(1); setPasso(2); }} style={css(`text-align:left; padding:0; border:2px solid ${sel ? COR : BORDA}; background:#fff; border-radius:16px; overflow:hidden; cursor:pointer; box-shadow:${sel ? `0 6px 18px ${COR}33` : "none"}; position:relative;`)}>
                          <Foto src={p.foto} alt={p.nome} proporcao="auto" miniatura />
                          {sel && <span style={css(`position:absolute; top:8px; right:8px; width:26px; height:26px; border-radius:50%; background:${COR}; color:#fff; display:flex; align-items:center; justify-content:center;`)}><Svg size={15} sw={3}><path d="M20 6 9 17l-5-5" /></Svg></span>}
                          <div style={css("padding:9px 10px 11px;")}>
                            <div style={css("font-size:13.5px; font-weight:800; line-height:1.25;")}>{p.nome.replace(/^Torta de /, "")}</div>
                            <div style={css(`font-size:13px; font-weight:800; color:${COR}; margin-top:3px;`)}>{brl(p.preco)}</div>
                            {p.peso && <div style={css(`font-size:11.5px; color:${FRACA}; margin-top:1px;`)}>{p.peso}</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </>
          )}

          {passo === 2 && produto && (
            <>
              <div style={css(`border-radius:16px; overflow:hidden; margin-bottom:14px; background:#F6D3DA;`)}><Foto src={produto.foto} alt={produto.nome} proporcao="auto" alturaMax="72vh" /></div>
              <h1 style={css("margin:0; font-size:22px; font-weight:800; letter-spacing:-.4px;")}>{produto.nome}</h1>
              <div style={css(`font-size:13.5px; color:${FRACA}; margin-top:3px;`)}>{[produto.porcoes && `Serve ${produto.porcoes}`, produto.peso && `peso médio ${produto.peso}`].filter(Boolean).join(" · ")}{produto.porcoes || produto.peso ? " · " : ""}<b style={{ color: COR }}>{brl(produto.preco)}</b></div>
              {produto.descricao && <p style={css("margin:10px 0 0; font-size:13.5px; color:#3A3F4C; line-height:1.5;")}>{produto.descricao}</p>}
              {produto.camadas.length > 0 && (
                <div style={css(`margin-top:14px; border:1px solid ${BORDA}; border-radius:14px; padding:12px 14px;`)}>
                  <div style={css(`font-size:11px; font-weight:800; letter-spacing:.5px; text-transform:uppercase; color:${COR}; margin-bottom:8px;`)}>Ordem das camadas</div>
                  <ol style={css("margin:0; padding-left:18px; display:flex; flex-direction:column; gap:3px;")}>
                    {produto.camadas.map((c, i) => <li key={i} style={css("font-size:13px; color:#3A3F4C;")}>{c}</li>)}
                  </ol>
                </div>
              )}
              {/* Quantidade em destaque e centralizada: alvo grande para o dedo e a conta do valor logo abaixo. */}
              <div style={css(`margin-top:18px; background:${CAMPO}; border:1px solid ${BORDA}; border-radius:16px; padding:16px 14px 14px; text-align:center;`)}>
                <div style={css("font-size:15px; font-weight:800;")}>Quantas unidades?</div>
                <div style={css("display:flex; align-items:center; justify-content:center; gap:22px; margin-top:12px;")}>
                  <Passador onClick={() => setQtd((q) => Math.max(1, q - 1))} disabled={qtd <= 1}>−</Passador>
                  <span style={css("font-size:34px; font-weight:800; min-width:44px; text-align:center; font-variant-numeric:tabular-nums; line-height:1;")}>{qtd}</span>
                  <Passador onClick={() => setQtd((q) => Math.min(cfg.maxPorPedido, q + 1))} disabled={qtd >= cfg.maxPorPedido} cheio>+</Passador>
                </div>
                <div style={css("font-size:13.5px; font-weight:700; color:#3A3F4C; margin-top:12px; font-variant-numeric:tabular-nums;")}>
                  {qtd} × {brl(produto.preco)} = <span style={{ color: COR }}>{brl(subtotal)}</span>
                </div>
                <div style={css(`font-size:12px; color:${FRACA}; margin-top:3px;`)}>até {cfg.maxPorPedido} por pedido</div>
              </div>
              <label style={css("display:block; margin-top:18px; font-size:14px; font-weight:800;")}>Alguma observação? <span style={css(`font-weight:600; color:${FRACA};`)}>(opcional)</span></label>
              <textarea value={mensagem} maxLength={300} onChange={(e) => setMensagem(e.target.value)} rows={3} placeholder="Ex.: escrever “Feliz aniversário, Ana!”, embalar para presente…" style={css(campo("margin-top:8px; resize:none;"))} />
              <div style={css(`text-align:right; font-size:11.5px; color:${FRACA}; margin-top:3px;`)}>{mensagem.length}/300</div>
            </>
          )}

          {passo === 3 && (
            <>
              <h1 style={css("margin:0 0 14px; font-size:22px; font-weight:800; letter-spacing:-.4px;")}>{soRetirada ? "Em qual loja você vai retirar?" : soEntrega ? "Onde vamos entregar?" : "Entrega ou retirada?"}</h1>
              {soRetirada && <p style={css(`margin:-6px 0 14px; font-size:14px; color:${FRACA};`)}>A encomenda é retirada na loja, sem taxa.</p>}
              {/* Dois botões grandes lado a lado; some quando só uma forma está ligada. */}
              <div style={css(`display:${soRetirada || soEntrega ? "none" : "grid"}; grid-template-columns:repeat(${unidades.length > 0 && cfg.entregaAtiva ? 2 : 1}, minmax(0,1fr)); gap:12px;`)}>
                {unidades.length > 0 && (
                  <OpcaoGrande sel={tipo === "Retirada"} onClick={() => setTipo("Retirada")} titulo="Retirada" sub="Busco na loja" detalhe="Sem taxa"
                    icone={<><path d="M3 9.5 4.6 4h14.8L21 9.5" /><path d="M5 12v8h14v-8M10 20v-4.5h4V20" /></>} />
                )}
                {cfg.entregaAtiva && (
                  <OpcaoGrande sel={tipo === "Entrega"} onClick={() => { setTipo("Entrega"); setUnidadeId(null); }} titulo="Entrega" sub="Levamos até você" detalhe={cfg.taxaEntrega > 0 ? `+ ${brl(cfg.taxaEntrega)}` : "Grátis"}
                    icone={<><path d="M1 6h13v10H1zM14 10h4l3 3v3h-7" /><circle cx="5.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></>} />
                )}
              </div>
              {tipo === "Retirada" && unidades.length > 0 && (
                <>
                  {!soRetirada && <div style={css("margin:20px 0 8px; font-size:14px; font-weight:800;")}>Em qual unidade você vai retirar?</div>}
                  <div style={css("display:flex; flex-direction:column; gap:8px;")}>
                    {unidades.map((u) => (
                      <Opcao key={u.id} sel={unidadeId === u.id} onClick={() => setUnidadeId(u.id)} titulo={u.nome} sub={u.endereco || "Retire no horário escolhido"}
                        icone={<><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>} />
                    ))}
                  </div>
                </>
              )}
              {tipo === "Entrega" && (
                <>
                  {cfg.taxaEntrega > 0 && <div style={css("margin-top:16px; font-size:13px; color:#92400E; background:#FFFBEB; border:1px solid #FDE68A; border-radius:12px; padding:10px 12px;")}>A entrega tem uma taxa de <b>{brl(cfg.taxaEntrega)}</b>, somada ao total do pedido.</div>}
                  <div style={css("display:flex; flex-direction:column; gap:10px; margin-top:14px;")}>
                    <Campo rotulo="Cidade" valor={end.cidade} onChange={(v) => setEnd({ ...end, cidade: v })} ph="Ex.: Florianópolis" />
                    <Campo rotulo="Bairro" valor={end.bairro} onChange={(v) => setEnd({ ...end, bairro: v })} ph="Ex.: Centro" />
                    <div style={css("display:flex; gap:10px;")}>
                      <div style={{ flex: 1, minWidth: 0 }}><Campo rotulo="Rua" valor={end.rua} onChange={(v) => setEnd({ ...end, rua: v })} ph="Ex.: Rua Felipe Schmidt" /></div>
                      <div style={{ width: 96, flex: "none" }}><Campo rotulo="Número" valor={end.numero} onChange={(v) => setEnd({ ...end, numero: v })} ph="Ex.: 85" /></div>
                    </div>
                    <label style={css("font-size:13px; font-weight:700;")}>Outras informações <span style={css(`font-weight:600; color:${FRACA};`)}>(opcional)</span>
                      <textarea value={end.complemento} onChange={(e) => setEnd({ ...end, complemento: e.target.value })} rows={2} placeholder="Apartamento, ponto de referência…" style={css(campo("margin-top:6px; resize:none;"))} />
                    </label>
                  </div>
                </>
              )}
            </>
          )}

          {passo === 4 && <PassoData cfg={cfg} data={data} hora={hora} onData={(d) => { setData(d); setHora(null); }} onHora={setHora} />}

          {passo === 5 && produto && tipo && data && hora && (
            <>
              <h1 style={css("margin:0 0 4px; font-size:22px; font-weight:800; letter-spacing:-.4px;")}>Quase lá!</h1>
              <p style={css(`margin:0 0 16px; font-size:13.5px; color:${FRACA};`)}>Só precisamos saber para quem é o pedido.</p>
              <div style={css("display:flex; flex-direction:column; gap:10px;")}>
                <Campo rotulo="Seu nome" valor={nome} onChange={setNome} ph="Como podemos te chamar?" />
                <Campo rotulo="WhatsApp" valor={whats} onChange={(v) => setWhats(mascara(v))} ph="(48) 99999-9999" tipo="tel" dica="É por aqui que confirmamos seu pedido." />
              </div>
              <div style={css(`margin-top:18px; background:${CAMPO}; border:1px solid ${BORDA}; border-radius:14px; padding:12px 14px; display:flex; flex-direction:column; gap:7px; font-size:13px;`)}>
                <Linha k={`${qtd}× ${produto.nome}`} v={brl(subtotal)} forte />
                {mensagem.trim() && <Linha k="Observação" v={mensagem.trim()} />}
                <Linha k={tipo === "Entrega" ? "Taxa de entrega" : "Retirada no local"} v={tipo === "Entrega" ? brl(taxa) : "Sem taxa"} />
                {unidadeNome && <Linha k="Unidade" v={unidadeNome} />}
                <Linha k={tipo} v={`${dataBR(data)} às ${hora}`} />
                {tipo === "Entrega" && <Linha k="Endereço" v={`${end.rua}, ${end.numero} · ${end.bairro} · ${end.cidade}`} />}
              </div>
            </>
          )}

          {passo === 6 && pedido && produto && (
            !pago ? (
              <div style={css("text-align:center;")}>
                <div style={css("width:56px; height:56px; border-radius:50%; background:#E7F6EE; color:#1B7F4D; display:flex; align-items:center; justify-content:center; margin:8px auto 12px;")}><Svg size={28} sw={2.6}><path d="M20 6 9 17l-5-5" /></Svg></div>
                <h1 style={css("margin:0; font-size:22px; font-weight:800;")}>Pedido registrado!</h1>
                <p style={css(`margin:6px 0 16px; font-size:13.5px; color:${FRACA};`)}>Agora é só pagar com PIX para entrar na fila de produção.</p>
                {pix ? (
                  <div style={css(`border:1px solid ${BORDA}; border-radius:16px; padding:16px;`)}>
                    <div style={css("font-size:30px; font-weight:800; letter-spacing:-.6px;")}>{brl(pedido.total)}</div>
                    <QrPix codigo={pix} />
                    <div style={css(`font-size:12.5px; color:${FRACA}; margin-bottom:8px;`)}>Escaneie no app do seu banco ou use o código abaixo.</div>
                    <div style={css(`font-family:ui-monospace,monospace; font-size:11px; color:#5B6472; background:${CAMPO}; border-radius:9px; padding:8px; word-break:break-all; user-select:all;`)}>{pix}</div>
                    <button onClick={() => { void navigator.clipboard?.writeText(pix).catch(() => {}); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} style={css(`margin-top:10px; border:1.5px solid ${COR}; background:#fff; color:${COR}; border-radius:999px; padding:9px 18px; font-size:13.5px; font-weight:800; cursor:pointer;`)}>{copiado ? "Copiado!" : "Copiar código PIX"}</button>
                  </div>
                ) : (
                  // Chave PIX ainda não cadastrada em Autoatendimento → Configurações: nada de PIX falso.
                  <div style={css(`border:1px solid ${BORDA}; border-radius:16px; padding:16px;`)}>
                    <div style={css("font-size:30px; font-weight:800; letter-spacing:-.6px;")}>{brl(pedido.total)}</div>
                    <div style={css("margin-top:10px; font-size:13.5px; color:#1E3A8A; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:12px; padding:10px 12px;")}>Nossa equipe vai te enviar a chave PIX pelo WhatsApp <b>{foneBR(normalizePhone(whats))}</b> para você pagar.</div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h1 style={css("margin:6px 0 4px; font-size:22px; font-weight:800;")}>Obrigado, {nome.trim().split(" ")[0]}!</h1>
                <p style={css(`margin:0 0 14px; font-size:13.5px; color:${FRACA};`)}>Recebemos sua encomenda.</p>
                <div style={css("background:#EFF6FF; border:1px solid #BFDBFE; border-radius:14px; padding:12px 14px; font-size:13px; color:#1E3A8A; margin-bottom:14px;")}>
                  <b>Vamos entrar em contato</b><br />Nossa equipe vai te chamar no WhatsApp {foneBR(normalizePhone(whats))} para confirmar o pagamento e o seu pedido.
                </div>
                <div style={css(`border:1px solid ${BORDA}; border-radius:14px; padding:12px 14px; display:flex; flex-direction:column; gap:7px; font-size:13px;`)}>
                  <div style={css(`font-size:11px; font-weight:800; letter-spacing:.5px; color:${FRACA};`)}>PEDIDO #{numeroPedido(pedido.id)}</div>
                  <Linha k={`${pedido.quantidade}× ${produto.nome}`} v={brl(pedido.subtotal)} forte />
                  {pedido.taxa > 0 && <Linha k="Taxa de entrega" v={brl(pedido.taxa)} />}
                  <Linha k="Total" v={brl(pedido.total)} forte />
                  <div style={css(`border-top:1px dashed ${BORDA}; margin:3px 0;`)} />
                  <Linha k="Data" v={`${dataBR(pedido.data)} às ${pedido.hora}`} />
                  <Linha k={pedido.tipo} v={pedido.tipo === "Entrega" ? "No endereço informado" : unidadeNome ?? "No local"} />
                  <Linha k="Pagamento" v="PIX" />
                </div>
                <div style={css(`text-align:center; font-size:12px; color:${FRACA}; margin-top:12px;`)}>Guarde este link — ele é o comprovante do seu pedido.</div>
              </div>
            )
          )}
        </div>

        {/* Rodapé — no passo 1 não tem: tocar no produto já avança. */}
        {passo > 1 && <div style={css(`flex:none; position:sticky; bottom:0; background:#fff; border-top:1px solid ${BORDA}; padding:12px 16px ${emTela ? "calc(env(safe-area-inset-bottom) + 12px)" : "12px"}; display:flex; align-items:center; gap:12px; flex-wrap:wrap;`)}>
          {erroEnvio && passo === 5 && <div role="alert" style={css("flex-basis:100%; font-size:13px; font-weight:600; color:#B42318; background:#FEF3F2; border:1px solid #FECDCA; border-radius:12px; padding:9px 12px;")}>{erroEnvio}</div>}
          {passo < 6 ? (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={css(`font-size:11.5px; font-weight:700; color:${FRACA};`)}>{passo <= 2 ? "Subtotal" : "Total"}</div>
                <div style={css("font-size:18px; font-weight:800; font-variant-numeric:tabular-nums;")}>{brl(passo <= 2 ? subtotal : total)}</div>
              </div>
              <button onClick={avancar} disabled={!pode[passo]} style={css(`border:none; background:${pode[passo] ? COR : "#D9C6CC"}; color:#fff; border-radius:999px; padding:13px 22px; font-size:15px; font-weight:800; cursor:${pode[passo] ? "pointer" : "not-allowed"}; display:inline-flex; align-items:center; gap:6px;`)}>
                {botao}<Svg size={16} sw={2.6}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
              </button>
            </>
          ) : !pago ? (
            <button onClick={() => setPago(true)} style={css(`flex:1; border:none; background:${COR}; color:#fff; border-radius:999px; padding:14px; font-size:15px; font-weight:800; cursor:pointer;`)}>Já fiz o PIX</button>
          ) : (
            <button onClick={recomecar} style={css(`flex:1; border:1.5px solid ${COR}; background:#fff; color:${COR}; border-radius:999px; padding:13px; font-size:15px; font-weight:800; cursor:pointer;`)}>Fazer outra encomenda</button>
          )}
        </div>}
      </div>
    </div>
  );
}

function PassoData({ cfg, data, hora, onData, onHora }: { cfg: ConfigEncomendas; data: string | null; hora: string | null; onData: (d: string) => void; onHora: (h: string) => void }) {
  const hoje = new Date();
  // Primeiro dia com algum horário que respeita a antecedência (busca até 60 dias).
  const disponivel = (iso: string) => horariosDoDia(cfg, iso).some((h) => respeitaAntecedencia(cfg, iso, h));
  const primeiro = useMemo(() => {
    for (let i = 0; i < 60; i++) { const d = new Date(hoje); d.setDate(d.getDate() + i); if (disponivel(isoDia(d))) return d; }
    return hoje;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mes, setMes] = useState(() => new Date(primeiro.getFullYear(), primeiro.getMonth(), 1));
  const limite = new Date(primeiro); limite.setDate(limite.getDate() + 60);
  const inicioGrade = new Date(mes); inicioGrade.setDate(1 - mes.getDay());
  const dias = Array.from({ length: 42 }, (_, i) => { const d = new Date(inicioGrade); d.setDate(d.getDate() + i); return d; });
  const podeVoltar = mes > new Date(primeiro.getFullYear(), primeiro.getMonth(), 1);
  const podeAvancar = new Date(mes.getFullYear(), mes.getMonth() + 1, 1) <= limite;
  const horarios = data ? horariosDoDia(cfg, data) : [];
  const algum = horarios.some((h) => respeitaAntecedencia(cfg, data!, h));

  return (
    <>
      <h1 style={css("margin:0 0 4px; font-size:22px; font-weight:800; letter-spacing:-.4px;")}>Quando você quer receber?</h1>
      <p style={css(`margin:0 0 14px; font-size:13.5px; color:${FRACA};`)}>Precisamos de pelo menos <b>{cfg.antecedenciaHoras}h</b> de antecedência.</p>
      <div style={css(`border:1px solid ${BORDA}; border-radius:16px; padding:12px;`)}>
        <div style={css("display:flex; align-items:center; margin-bottom:8px;")}>
          <span style={css("flex:1; font-size:15px; font-weight:800; text-transform:capitalize;")}>{MESES[mes.getMonth()]} {mes.getFullYear()}</span>
          <SetaMes dir={-1} off={!podeVoltar} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} />
          <SetaMes dir={1} off={!podeAvancar} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} />
        </div>
        <div style={css("display:grid; grid-template-columns:repeat(7,1fr); gap:3px; text-align:center;")}>
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i} style={css(`font-size:11px; font-weight:700; color:${FRACA}; padding:4px 0;`)}>{d}</span>)}
          {dias.map((d) => {
            const iso = isoDia(d);
            const doMes = d.getMonth() === mes.getMonth();
            const ok = doMes && d <= limite && disponivel(iso);
            const sel = iso === data;
            return (
              <button key={iso} disabled={!ok} onClick={() => onData(iso)} style={css(`height:38px; border:none; border-radius:10px; font-size:14px; font-weight:${sel ? 800 : 600}; cursor:${ok ? "pointer" : "default"}; background:${sel ? COR : "transparent"}; color:${sel ? "#fff" : !doMes ? "transparent" : ok ? TINTA : "#CDD0D8"}; ${ok && !sel ? `box-shadow:inset 0 0 0 1px ${BORDA};` : ""}`)}>{d.getDate()}</button>
            );
          })}
        </div>
      </div>
      {data && (
        <>
          <div style={css("margin:18px 0 8px; font-size:14px; font-weight:800;")}>Horário · {dataBR(data)}</div>
          {!algum && <div style={css("font-size:13px; color:#CC3338; font-weight:600;")}>Nenhum horário desse dia atende a antecedência de {cfg.antecedenciaHoras}h. Escolha um dia depois.</div>}
          {PERIODOS.map((p) => {
            const hs = horarios.filter((h) => { const n = Number(h.slice(0, 2)); return n >= p.de && n < p.ate; });
            if (!hs.length) return null;
            return (
              <div key={p.label} style={css("margin-bottom:10px;")}>
                <div style={css(`font-size:12px; font-weight:700; color:${FRACA}; margin-bottom:6px;`)}>{p.label}</div>
                <div style={css("display:grid; grid-template-columns:repeat(4,1fr); gap:7px;")}>
                  {hs.map((h) => {
                    const ok = respeitaAntecedencia(cfg, data, h);
                    const sel = h === hora;
                    return <button key={h} disabled={!ok} onClick={() => onHora(h)} style={css(`height:40px; border-radius:999px; border:1.5px solid ${sel ? COR : BORDA}; background:${sel ? COR : "#fff"}; color:${sel ? "#fff" : TINTA}; font-size:13.5px; font-weight:700; opacity:${ok ? 1 : 0.3}; cursor:${ok ? "pointer" : "default"};`)}>{h}</button>;
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

const campo = (extra = "") => `width:100%; box-sizing:border-box; border:1px solid ${BORDA}; background:${CAMPO}; border-radius:12px; padding:11px 12px; font-size:15px; font-family:inherit; color:${TINTA}; outline:none; ${extra}`;

function Campo({ rotulo, valor, onChange, ph, tipo = "text", dica }: { rotulo: string; valor: string; onChange: (v: string) => void; ph?: string; tipo?: string; dica?: string }) {
  return (
    <label style={css("display:block; font-size:13px; font-weight:700;")}>
      {rotulo}
      <input type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={ph} style={css(campo("margin-top:6px;"))} />
      {dica && <span style={css(`display:block; font-size:12px; font-weight:500; color:${FRACA}; margin-top:4px;`)}>{dica}</span>}
    </label>
  );
}

function Opcao({ sel, onClick, titulo, sub, icone }: { sel: boolean; onClick: () => void; titulo: string; sub: string; icone: React.ReactNode }) {
  return (
    <button onClick={onClick} style={css(`display:flex; align-items:center; gap:12px; text-align:left; width:100%; border:1.5px solid ${sel ? COR : BORDA}; background:${sel ? "#FDF1F4" : "#fff"}; border-radius:14px; padding:12px 14px; cursor:pointer; color:${TINTA};`)}>
      <span style={css(`flex:none; width:40px; height:40px; border-radius:11px; background:${sel ? COR : CAMPO}; color:${sel ? "#fff" : "#5B6472"}; display:flex; align-items:center; justify-content:center;`)}><Svg size={19} sw={2}>{icone}</Svg></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={css("display:block; font-size:14.5px; font-weight:800;")}>{titulo}</span>
        <span style={css(`display:block; font-size:12.5px; color:${FRACA}; margin-top:1px;`)}>{sub}</span>
      </span>
      <span style={css(`flex:none; width:20px; height:20px; border-radius:50%; border:2px solid ${sel ? COR : "#CDD0D8"}; display:flex; align-items:center; justify-content:center;`)}>{sel && <span style={css(`width:10px; height:10px; border-radius:50%; background:${COR};`)} />}</span>
    </button>
  );
}

/** Botão grande de escolha (Retirada / Entrega): ícone em destaque, nome, explicação e taxa. */
function OpcaoGrande({ sel, onClick, titulo, sub, detalhe, icone }: { sel: boolean; onClick: () => void; titulo: string; sub: string; detalhe: string; icone: React.ReactNode }) {
  return (
    <button onClick={onClick} style={css(`position:relative; display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px; min-height:150px; justify-content:center; border:2px solid ${sel ? COR : BORDA}; background:${sel ? "#FDF1F4" : "#fff"}; border-radius:18px; padding:16px 10px; cursor:pointer; color:${TINTA}; box-shadow:${sel ? `0 6px 18px ${COR}2E` : "none"};`)}>
      {sel && <span style={css(`position:absolute; top:10px; right:10px; width:22px; height:22px; border-radius:50%; background:${COR}; color:#fff; display:flex; align-items:center; justify-content:center;`)}><Svg size={13} sw={3}><path d="M20 6 9 17l-5-5" /></Svg></span>}
      <span style={css(`width:56px; height:56px; border-radius:16px; background:${sel ? COR : CAMPO}; color:${sel ? "#fff" : "#5B6472"}; display:flex; align-items:center; justify-content:center;`)}><Svg size={26} sw={1.9}>{icone}</Svg></span>
      <span style={css("font-size:17px; font-weight:800; margin-top:2px;")}>{titulo}</span>
      <span style={css(`font-size:12.5px; color:${FRACA}; line-height:1.3;`)}>{sub}</span>
      <span style={css(`font-size:13px; font-weight:800; color:${sel ? COR : "#3A3F4C"};`)}>{detalhe}</span>
    </button>
  );
}

/** Botão − / + da quantidade; `cheio` = o "+" na cor da marca (a ação principal). */
function Passador({ onClick, disabled, cheio, children }: { onClick: () => void; disabled?: boolean; cheio?: boolean; children: React.ReactNode }) {
  const ativo = cheio && !disabled;
  return <button onClick={onClick} disabled={disabled} style={css(`width:52px; height:52px; border-radius:50%; border:1.5px solid ${ativo ? COR : BORDA}; background:${ativo ? COR : "#fff"}; font-size:26px; font-weight:700; line-height:1; color:${disabled ? "#CDD0D8" : ativo ? "#fff" : TINTA}; cursor:${disabled ? "default" : "pointer"}; display:flex; align-items:center; justify-content:center;`)}>{children}</button>;
}

function SetaMes({ dir, off, onClick }: { dir: 1 | -1; off: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={off} style={css(`width:34px; height:34px; border:none; background:transparent; border-radius:9px; cursor:${off ? "default" : "pointer"}; color:${off ? "#CDD0D8" : "#5B6472"}; display:flex; align-items:center; justify-content:center;`)}>
      <Svg size={17} sw={2.4}>{dir < 0 ? <path d="m15 18-6-6 6-6" /> : <path d="m9 6 6 6-6 6" />}</Svg>
    </button>
  );
}

function Linha({ k, v, forte }: { k: string; v: string; forte?: boolean }) {
  return (
    <div style={css("display:flex; gap:12px; align-items:baseline;")}>
      <span style={css(`flex:1; min-width:0; color:${forte ? TINTA : "#5B6472"}; font-weight:${forte ? 800 : 600};`)}>{k}</span>
      <span style={css(`text-align:right; max-width:60%; font-weight:${forte ? 800 : 600}; color:${TINTA}; word-break:break-word;`)}>{v}</span>
    </div>
  );
}

/** Máscara (48) 99999-9999 enquanto digita. */
function mascara(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** QR Code do PIX copia-e-cola (gerado no navegador, sem serviço externo). */
function QrPix({ codigo }: { codigo: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void import("qrcode").then((q) => q.toDataURL(codigo, { margin: 1, width: 360, color: { dark: TINTA, light: "#ffffff" } })).then((u) => { if (vivo) setSrc(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [codigo]);
  return src
    ? <img src={src} alt="QR Code do PIX" width={180} height={180} style={{ display: "block", margin: "12px auto" }} />
    : <div style={{ width: 180, height: 180, margin: "12px auto", background: CAMPO, borderRadius: 8 }} />;
}

/**
 * Foto do produto SEM CORTE: as artes do catálogo são flyers (texto em volta da torta) e
 * qualquer recorte comia título, preço ou a própria torta. `proporcao="auto"` mostra a
 * imagem inteira na altura natural; com proporção fixa, ela cabe no quadro (contain) sobre
 * o rosa dos flyers. `cortar` só para miniaturas, onde caber inteira ficaria ilegível.
 * Sem foto → quadro neutro com ícone.
 */
export function Foto({ src: original, alt, proporcao, cortar, alturaMax, miniatura }: { src: string | null; alt: string; proporcao: string; cortar?: boolean; alturaMax?: string; miniatura?: boolean }) {
  // Flyer do catálogo: em listas e miniaturas usa a versão "-card" (~24 KB em vez de ~75 KB).
  const flyer = !!original && /^\/encomendas\/torta-[\w-]+\.webp$/.test(original);
  const src = flyer && miniatura ? original!.replace(/\.webp$/, "-card.webp") : original;
  // Lazy nas listas; width/height do flyer reservam o espaço antes de carregar (sem "pulo").
  const extra = { loading: miniatura ? ("lazy" as const) : undefined, decoding: "async" as const, ...(flyer ? { width: 941, height: 1672 } : {}) };
  if (!src) {
    return (
      <div style={css(`width:100%; aspect-ratio:${proporcao === "auto" ? "3/4" : proporcao}; background:#FDF1F4; color:${COR}; display:flex; align-items:center; justify-content:center;`)}>
        <Svg size={34} sw={1.6}><path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M3 7h18v4H3zM12 7v14" /></Svg>
      </div>
    );
  }
  if (proporcao === "auto") {
    return <img src={src} alt={alt} {...extra} style={css(`display:block; width:100%; height:auto; ${alturaMax ? `max-height:${alturaMax}; object-fit:contain;` : ""} background:${FUNDO_FOTO};`)} />;
  }
  return <img src={src} alt={alt} {...extra} style={css(`display:block; width:100%; height:auto; aspect-ratio:${proporcao}; object-fit:${cortar ? "cover" : "contain"}; ${cortar && flyer ? `object-position:${FOTO_POSICAO};` : ""} background:${FUNDO_FOTO};`)} />;
}

/** Rosa de fundo dos flyers: as sobras do "contain" somem na arte. */
const FUNDO_FOTO = "#F6D3DA";
