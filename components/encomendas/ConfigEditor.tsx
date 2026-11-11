"use client";

import { useState } from "react";
import { css } from "@/lib/css";
import { brl } from "@/lib/format";
import { BRAND } from "@/lib/theme";
import { CORES_DESTAQUE, DIAS, PERIODOS, horariosDaJanela, useEncomendas, validarConfig, vitrineDe, type ConfigEncomendas, type DiaKey, type Vitrine } from "@/lib/encomendas";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import { Botao, Chave } from "./CatalogoEditor";

/**
 * Autoatendimento → Configurações: unidades de retirada, entrega, horários por dia da
 * semana, regras e pagamento. Edita um rascunho e só grava ao "Salvar configuração"
 * (com as mesmas validações do Cachorrão), para a página do cliente nunca ficar quebrada.
 */
export default function ConfigEditor({ editavel }: { editavel: boolean }) {
  const { config, salvarConfig } = useEncomendas();
  const [c, setC] = useState<ConfigEncomendas>(() => structuredClone(config));
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const sujo = JSON.stringify(c) !== JSON.stringify(config);

  const mudar = (patch: Partial<ConfigEncomendas>) => { setC((x) => ({ ...x, ...patch })); setOk(false); setErro(null); };
  const mudarDia = (k: DiaKey, f: (d: ConfigEncomendas["janelas"][DiaKey]) => ConfigEncomendas["janelas"][DiaKey]) => mudar({ janelas: { ...c.janelas, [k]: f(c.janelas[k]) } });
  const salvar = () => {
    const limpa: ConfigEncomendas = { ...c, unidades: c.unidades.map((u) => ({ ...u, nome: u.nome.trim(), endereco: u.endereco.trim() })) };
    const e = validarConfig(limpa);
    if (e) { setErro(e); return; }
    const falha = salvarConfig(limpa);
    setC(limpa);
    if (falha) setErro(falha); else setOk(true);
  };
  const vit = vitrineDe(c);
  const mudarV = (patch: Partial<Vitrine>) => mudar({ vitrine: { ...vit, ...patch } });
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));
  const ro = !editavel;

  return (
    <div style={css("max-width:860px; display:flex; flex-direction:column; gap:16px; padding-bottom:70px;")}>
      <Cartao titulo="Vitrine (primeira tela)" sub="O que o cliente vê ao abrir a página: faixa de destaque e cards das categorias" icone={<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>}>
        <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(240px,1fr)); gap:10px;")}>
          <Rotulo t="Título"><input disabled={ro} maxLength={80} value={vit.titulo} onChange={(e) => mudarV({ titulo: e.target.value })} placeholder="O que você vai querer?" style={css(campo("width:100%;"))} /></Rotulo>
          <Rotulo t="Texto abaixo do título"><input disabled={ro} maxLength={160} value={vit.subtitulo} onChange={(e) => mudarV({ subtitulo: e.target.value })} placeholder="Escolha uma categoria para ver os produtos." style={css(campo("width:100%;"))} /></Rotulo>
        </div>
        <div style={css("margin-top:14px; border:1px solid #F0F1F4; background:#FAFAFB; border-radius:12px; padding:12px 14px;")}>
          <label style={css("display:flex; align-items:center; gap:10px; font-size:13.5px; font-weight:700; color:#3A3F4C; cursor:pointer;")}>
            <Chave ligado={vit.destaqueAtivo} onChange={(v) => !ro && mudarV({ destaqueAtivo: v })} />
            Faixa de destaque {vit.destaqueAtivo ? "ligada" : "desligada"}
          </label>
          {vit.destaqueAtivo && (
            <>
              <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(240px,1fr)); gap:10px; margin-top:12px;")}>
                <Rotulo t="Título da faixa"><input disabled={ro} maxLength={60} value={vit.destaqueTitulo} onChange={(e) => mudarV({ destaqueTitulo: e.target.value })} placeholder="Natal 2026" style={css(campo("width:100%;"))} /></Rotulo>
                <Rotulo t="Texto da faixa"><input disabled={ro} maxLength={200} value={vit.destaqueTexto} onChange={(e) => mudarV({ destaqueTexto: e.target.value })} placeholder="Encomende com 48 h de antecedência…" style={css(campo("width:100%;"))} /></Rotulo>
              </div>
              <div style={css("margin-top:12px; font-size:12.5px; font-weight:700; color:#5B6472;")}>Cor</div>
              <div style={css("display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;")}>
                {CORES_DESTAQUE.map((k) => {
                  const sel = vit.destaqueCor === k.key;
                  return (
                    <button key={k.key} type="button" disabled={ro} onClick={() => mudarV({ destaqueCor: k.key })} style={css(`display:inline-flex; align-items:center; gap:7px; border:1.5px solid ${sel ? BRAND : "#E2E3E9"}; background:${sel ? "#FDF1F4" : "#fff"}; border-radius:999px; padding:5px 12px 5px 5px; font-size:12.5px; font-weight:700; color:#3A3F4C; cursor:${ro ? "default" : "pointer"};`)}>
                      <span style={css(`width:22px; height:22px; border-radius:50%; background:linear-gradient(135deg, ${k.de}, ${k.ate});`)} />{k.nome}
                    </button>
                  );
                })}
              </div>
              {/* Prévia da faixa como o cliente vê. */}
              <div style={css(`margin-top:12px; border-radius:14px; padding:14px 16px; color:#fff; background:linear-gradient(135deg, ${(CORES_DESTAQUE.find((k) => k.key === vit.destaqueCor) ?? CORES_DESTAQUE[0]).de}, ${(CORES_DESTAQUE.find((k) => k.key === vit.destaqueCor) ?? CORES_DESTAQUE[0]).ate}); max-width:420px;`)}>
                <div style={css("font-size:19px; font-weight:800;")}>{vit.destaqueTitulo || "Título da faixa"}</div>
                {vit.destaqueTexto && <div style={css("font-size:13px; font-weight:600; opacity:.95; margin-top:4px;")}>{vit.destaqueTexto}</div>}
              </div>
            </>
          )}
        </div>
        <div style={css("display:flex; flex-direction:column; gap:10px; margin-top:14px;")}>
          <label style={css("display:flex; align-items:center; gap:10px; font-size:13.5px; font-weight:700; color:#3A3F4C; cursor:pointer;")}>
            <Chave ligado={vit.mostrarQuantidade} onChange={(v) => !ro && mudarV({ mostrarQuantidade: v })} />Mostrar quantas opções a categoria tem (ex.: “6 opções”)
          </label>
          <label style={css("display:flex; align-items:center; gap:10px; font-size:13.5px; font-weight:700; color:#3A3F4C; cursor:pointer;")}>
            <Chave ligado={vit.mostrarPreco} onChange={(v) => !ro && mudarV({ mostrarPreco: v })} />Mostrar o menor preço (ex.: “a partir de R$ 100,00”)
          </label>
        </div>
        <div style={css("font-size:12px; color:#9398A6; margin-top:10px;")}>A foto de capa, a frase de cada card e quais categorias aparecem ficam em <b>Produtos</b>, no botão de editar da categoria.</div>
      </Cartao>

      <Cartao titulo="Retirada na loja" sub="Unidades onde o cliente pode buscar o pedido" icone={<><path d="M3 9.5 4.6 4h14.8L21 9.5" /><path d="M5 12v8h14v-8M10 20v-4.5h4V20" /></>}
        direita={<Chave ligado={c.retiradaAtiva} onChange={(v) => !ro && mudar({ retiradaAtiva: v })} />}>
        {!c.retiradaAtiva && <div style={css("font-size:12.5px; color:#9398A6; font-style:italic; margin-bottom:8px;")}>Retirada desligada — o cliente só vê a opção de entrega.</div>}
        <div style={css(`display:flex; flex-direction:column; gap:8px; opacity:${c.retiradaAtiva ? 1 : 0.55};`)}>
          {c.unidades.length === 0 && <div style={css("font-size:13px; color:#9398A6;")}>Nenhuma unidade cadastrada.</div>}
          {c.unidades.map((u, i) => (
            <div key={u.id} className="m-wrap" style={css("display:flex; align-items:center; gap:8px; background:#FAFAFB; border:1px solid #F0F1F4; border-radius:11px; padding:8px 10px;")}>
              <span className="m-hide" style={{ display: "flex" }}><Svg size={16} stroke="#9398A6" style={css("flex:none;")}><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></Svg></span>
              {/* No celular: nome e endereço em linhas inteiras; chave e lixeira na linha de baixo. */}
              <input className="m-full" disabled={ro} value={u.nome} onChange={(e) => mudar({ unidades: c.unidades.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} placeholder="Nome (ex.: Florianópolis · Centro)" style={css(campo("flex:1; min-width:170px;"))} />
              <input className="m-full" disabled={ro} value={u.endereco} onChange={(e) => mudar({ unidades: c.unidades.map((x, j) => (j === i ? { ...x, endereco: e.target.value } : x)) })} placeholder="Endereço (aparece para o cliente)" style={css(campo("flex:1.4; min-width:200px;"))} />
              <span style={css("display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#7A8090; margin-right:auto;")}>
                <Chave ligado={u.ativo} onChange={(v) => !ro && mudar({ unidades: c.unidades.map((x, j) => (j === i ? { ...x, ativo: v } : x)) })} />{u.ativo ? "Ativa" : "Inativa"}
              </span>
              {!ro && <Lixeira titulo="Remover unidade" onClick={() => mudar({ unidades: c.unidades.filter((_, j) => j !== i) })} />}
            </div>
          ))}
          {!ro && <AddLink onClick={() => mudar({ unidades: [...c.unidades, { id: crypto.randomUUID(), nome: "", endereco: "", ativo: true }] })}>Adicionar unidade</AddLink>}
        </div>
      </Cartao>

      <Cartao titulo="Entrega" sub="Levar o pedido até o cliente" icone={<><path d="M1 6h13v10H1zM14 10h4l3 3v3h-7" /><circle cx="5.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></>}
        direita={<Chave ligado={c.entregaAtiva} onChange={(v) => !ro && mudar({ entregaAtiva: v })} />}>
        {c.entregaAtiva ? (
          <Param rotulo="Taxa de entrega" dica="Somada ao total só quando o cliente escolhe entrega. Zero = entrega grátis." unidade="R$">
            <input disabled={ro} type="number" min={0} step="0.01" value={Number.isNaN(c.taxaEntrega) ? "" : c.taxaEntrega} onChange={(e) => mudar({ taxaEntrega: num(e.target.value) })} style={css(campo("width:110px;"))} />
          </Param>
        ) : <div style={css("font-size:12.5px; color:#9398A6; font-style:italic;")}>Entrega desligada — o cliente só vê a opção de retirada.</div>}
      </Cartao>

      <Cartao titulo="Horários de entrega/retirada" sub="Quando o cliente pode receber ou buscar o pedido" icone={<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>}>
        <div style={css("display:flex; flex-direction:column;")}>
          {DIAS.map((d) => {
            const j = c.janelas[d.key];
            const hs = horariosDaJanela(j, c.intervaloMin);
            const periodos = PERIODOS.filter((p) => hs.some((h) => { const n = Number(h.slice(0, 2)); return n >= p.de && n < p.ate; })).map((p) => p.label);
            return (
              <div key={d.key} className="m-wrap" style={css("display:flex; align-items:flex-start; gap:12px; padding:10px 0; border-bottom:1px solid #F4F5F7;")}>
                <span style={css("display:flex; align-items:center; gap:9px; width:130px; flex:none; padding-top:4px;")}>
                  <Chave ligado={j.ativo} onChange={(v) => !ro && mudarDia(d.key, (x) => ({ ativo: v, intervalos: v && !x.intervalos.length ? [{ inicio: "09:00", fim: "18:00" }] : x.intervalos }))} />
                  <span style={css("font-size:13.5px; font-weight:700;")}>{d.label}</span>
                </span>
                {j.ativo ? (
                  <div style={css("flex:1; min-width:220px; display:flex; flex-direction:column; gap:6px;")}>
                    {j.intervalos.map((b, bi) => (
                      <div key={bi} style={css("display:flex; align-items:center; gap:7px;")}>
                        <input disabled={ro} type="time" value={b.inicio} onChange={(e) => mudarDia(d.key, (x) => ({ ...x, intervalos: x.intervalos.map((y, k) => (k === bi ? { ...y, inicio: e.target.value } : y)) }))} style={css(campo("width:112px;"))} />
                        <span style={css("font-size:12.5px; color:#9398A6;")}>até</span>
                        <input disabled={ro} type="time" value={b.fim} onChange={(e) => mudarDia(d.key, (x) => ({ ...x, intervalos: x.intervalos.map((y, k) => (k === bi ? { ...y, fim: e.target.value } : y)) }))} style={css(campo("width:112px;"))} />
                        {!ro && <Lixeira titulo="Remover bloco" onClick={() => mudarDia(d.key, (x) => ({ ativo: x.intervalos.length > 1, intervalos: x.intervalos.filter((_, k) => k !== bi) }))} />}
                      </div>
                    ))}
                    <div style={css("display:flex; align-items:center; gap:12px; flex-wrap:wrap;")}>
                      {!ro && <AddLink onClick={() => mudarDia(d.key, (x) => ({ ...x, intervalos: [...x.intervalos, { inicio: "14:00", fim: "18:00" }] }))}>bloco</AddLink>}
                      <span style={css("font-size:12px; color:#9398A6;")}>{hs.length} horário{hs.length === 1 ? "" : "s"}{periodos.length ? ` · ${periodos.join(", ")}` : ""}</span>
                    </div>
                  </div>
                ) : <span style={css("flex:1; padding-top:5px; font-size:13px; color:#9398A6; font-style:italic;")}>Fechado</span>}
              </div>
            );
          })}
        </div>
      </Cartao>

      <Cartao titulo="Regras do pedido" sub="Antecedência, intervalo entre horários e quantidade" icone={<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />}>
        <Param rotulo="Antecedência mínima" dica="Não aceita encomenda para menos que isso a partir de agora." unidade="horas">
          <input disabled={ro} type="number" min={0} value={Number.isNaN(c.antecedenciaHoras) ? "" : c.antecedenciaHoras} onChange={(e) => mudar({ antecedenciaHoras: num(e.target.value) })} style={css(campo("width:90px;"))} />
        </Param>
        <Param rotulo="Oferecer um horário a cada" dica="Ex.: 60 = 09:00, 10:00, 11:00…" unidade="min">
          <input disabled={ro} type="number" min={5} step={5} value={Number.isNaN(c.intervaloMin) ? "" : c.intervaloMin} onChange={(e) => mudar({ intervaloMin: num(e.target.value) })} style={css(campo("width:90px;"))} />
        </Param>
        <Param rotulo="Máximo por pedido" dica="Quantas unidades do produto o cliente pode pedir de uma vez." unidade="unid.">
          <input disabled={ro} type="number" min={1} value={Number.isNaN(c.maxPorPedido) ? "" : c.maxPorPedido} onChange={(e) => mudar({ maxPorPedido: num(e.target.value) })} style={css(campo("width:90px;"))} />
        </Param>
      </Cartao>

      <Cartao titulo="Pagamento e contato" sub="PIX mostrado no fim do pedido e WhatsApp da página" icone={<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM17 20h4v-3" /></>}>
        <div style={css("display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:10px;")}>
          <Rotulo t="Chave PIX"><input disabled={ro} value={c.pixChave} onChange={(e) => mudar({ pixChave: e.target.value })} placeholder="CPF/CNPJ, e-mail, +55 celular ou aleatória" style={css(campo("width:100%;"))} /></Rotulo>
          <Rotulo t="Nome do recebedor"><input disabled={ro} maxLength={25} value={c.pixNome} onChange={(e) => mudar({ pixNome: e.target.value })} placeholder="Ju Budelon" style={css(campo("width:100%;"))} /></Rotulo>
          <Rotulo t="Cidade do recebedor"><input disabled={ro} maxLength={15} value={c.pixCidade} onChange={(e) => mudar({ pixCidade: e.target.value })} placeholder="Florianópolis" style={css(campo("width:100%;"))} /></Rotulo>
          <Rotulo t="WhatsApp de contato"><input disabled={ro} value={c.whatsappContato} onChange={(e) => mudar({ whatsappContato: e.target.value.replace(/\D/g, "") })} placeholder="5548999999999" style={css(campo("width:100%;"))} /></Rotulo>
        </div>
        {!c.pixChave && <div style={css("font-size:12px; color:#92400E; margin-top:8px;")}>Sem chave PIX, a página não mostra QR Code: avisa o cliente que a equipe vai mandar o PIX pelo WhatsApp. Celular como chave: use +55 e o DDD (ex.: +5548999999999).</div>}
      </Cartao>

      {/* Barra de salvar só quando há o que salvar (ou um aviso a mostrar): no celular ela ocupava a tela à toa. */}
      {editavel && (sujo || erro || ok) && (
        <div style={css("position:sticky; bottom:0; z-index:5; display:flex; align-items:center; gap:10px; flex-wrap:wrap; background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:12px 14px; box-shadow:0 -6px 24px rgba(20,24,40,.08);")}>
          <span style={css(`flex:1; min-width:200px; font-size:12.5px; font-weight:600; color:${erro ? "#B42318" : ok ? "#1B7F4D" : "#7A8090"};`)}>
            {erro ?? (ok ? "Configuração salva. A página de encomendas já usa as novas regras." : sujo ? "Há alterações não salvas." : `Retirada ${c.retiradaAtiva ? "ligada" : "desligada"} · entrega ${c.entregaAtiva ? `ligada (${brl(c.taxaEntrega)})` : "desligada"}`)}
          </span>
          {sujo && <Botao onClick={() => { setC(structuredClone(config)); setErro(null); setOk(false); }}>Descartar</Botao>}
          <Hoverable as="button" onClick={salvar} {...{ disabled: !sujo }} s={css(`border:none; background:${sujo ? BRAND : "#D9C6CC"}; color:#fff; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:700; cursor:${sujo ? "pointer" : "default"};`)} hover={sujo ? "filter:brightness(1.1)" : undefined}>Salvar configuração</Hoverable>
        </div>
      )}
    </div>
  );
}

const campo = (extra = "") => `box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; padding:8px 10px; font-size:13.5px; outline:none; font-family:inherit; background:#fff; color:#1B1B28; ${extra}`;

function Cartao({ titulo, sub, icone, direita, children }: { titulo: string; sub?: string; icone: React.ReactNode; direita?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={css("background:#fff; border:1px solid #ECEDF1; border-radius:14px; padding:16px 18px;")}>
      <div style={css("display:flex; align-items:center; gap:10px; margin-bottom:12px;")}>
        <span style={css(`width:32px; height:32px; border-radius:9px; background:${BRAND}1A; color:${BRAND}; display:flex; align-items:center; justify-content:center; flex:none;`)}><Svg size={16} sw={2}>{icone}</Svg></span>
        <div style={css("flex:1; min-width:0;")}>
          <div style={css("font-size:15px; font-weight:800;")}>{titulo}</div>
          {sub && <div style={css("font-size:12px; color:#9398A6; margin-top:1px;")}>{sub}</div>}
        </div>
        {direita}
      </div>
      {children}
    </div>
  );
}

function Param({ rotulo, dica, unidade, children }: { rotulo: string; dica?: string; unidade: string; children: React.ReactNode }) {
  return (
    <div className="m-wrap" style={css("display:flex; align-items:center; gap:12px; padding:9px 0; border-bottom:1px solid #F4F5F7;")}>
      <div style={css("flex:1; min-width:200px;")}>
        <div style={css("font-size:13.5px; font-weight:700; color:#3A3F4C;")}>{rotulo}</div>
        {dica && <div style={css("font-size:12px; color:#9398A6; margin-top:2px;")}>{dica}</div>}
      </div>
      <span style={css("display:inline-flex; align-items:center; gap:7px;")}>{unidade === "R$" && <span style={css("font-size:13px; font-weight:700; color:#7A8090;")}>R$</span>}{children}{unidade !== "R$" && <span style={css("font-size:13px; font-weight:700; color:#7A8090;")}>{unidade}</span>}</span>
    </div>
  );
}

function Rotulo({ t, children }: { t: string; children: React.ReactNode }) {
  return <label style={css("display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:700; color:#5B6472;")}>{t}{children}</label>;
}

function Lixeira({ titulo, onClick }: { titulo: string; onClick: () => void }) {
  return (
    <Hoverable as="button" type="button" title={titulo} onClick={onClick} s={css("width:32px; height:32px; flex:none; border:none; background:transparent; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9398A6;")} hover="background:#FDECEC; color:#CC3338">
      <Svg size={15} sw={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg>
    </Hoverable>
  );
}

function AddLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Hoverable as="button" type="button" onClick={onClick} s={css(`align-self:flex-start; display:inline-flex; align-items:center; gap:5px; border:none; background:transparent; color:${BRAND}; font-size:13px; font-weight:700; cursor:pointer; padding:4px 2px;`)} hover="text-decoration:underline">
      <Svg size={14} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>{children}
    </Hoverable>
  );
}
