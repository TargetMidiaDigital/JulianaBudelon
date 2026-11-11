"use client";

import { useRef, useState } from "react";
import { css } from "@/lib/css";
import { brl } from "@/lib/format";
import { BRAND } from "@/lib/theme";
import { catalogoPorCategoria, categoriaAtiva, reduzirFoto, useEncomendas, type Categoria, type ProdutoEncomenda } from "@/lib/encomendas";
import { Svg } from "../ui/Svg";
import Hoverable from "../ui/Hoverable";
import Menu, { MenuItem } from "../ui/Menu";
import ConfirmModal from "../ui/ConfirmModal";
import { useFecharComEsc } from "../ui/useFecharComEsc";
import { Foto } from "./FunilEncomenda";
import { useApp } from "../store";
import { CATEGORIAS_ESTOQUE } from "@/lib/estoque";

/**
 * Autoatendimento → Produtos: categorias (criar, renomear, ordenar, excluir) e produtos
 * (criar, editar, foto, categoria, ativar/desativar, excluir). A ordem das categorias é a
 * ordem em que o cliente vê o catálogo no funil.
 */
export default function CatalogoEditor({ editavel }: { editavel: boolean }) {
  const { categorias, produtos, salvarCategoria, excluirCategoria, moverCategoria, salvarProduto } = useEncomendas();
  const grupos = catalogoPorCategoria(categorias, produtos, false);
  const [editando, setEditando] = useState<ProdutoEncomenda | "novo" | null>(null);
  const [novoEm, setNovoEm] = useState<string | null>(null); // categoria pré-escolhida no "novo"
  const [criandoCat, setCriandoCat] = useState(false);
  const [editandoCat, setEditandoCat] = useState<Categoria | null>(null);
  const [excluindoCat, setExcluindoCat] = useState<Categoria | null>(null);

  const novoProduto = (categoriaId: string | null) => { setNovoEm(categoriaId); setEditando("novo"); };

  return (
    <div>
      <div className="m-wrap" style={css("display:flex; align-items:center; gap:10px; margin-bottom:16px;")}>
        {editavel && (
          <>
            <Hoverable as="button" onClick={() => novoProduto(categorias[0]?.id ?? null)} s={css(`display:inline-flex; align-items:center; gap:7px; border:none; background:${BRAND}; color:#fff; border-radius:10px; padding:9px 15px; font-size:13px; font-weight:700; cursor:pointer;`)} hover="filter:brightness(1.1)">
              <Svg size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>Novo produto
            </Hoverable>
            <Hoverable as="button" onClick={() => setCriandoCat(true)} s={css("display:inline-flex; align-items:center; gap:7px; border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; border-radius:10px; padding:8px 14px; font-size:13px; font-weight:700; cursor:pointer;")} hover="background:#F4F4F7">
              <Svg size={15} sw={2.2}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 11v5M9.5 13.5h5" /></Svg>Nova categoria
            </Hoverable>
          </>
        )}
        <span style={css("font-size:12.5px; font-weight:700; color:#9398A6;")}>{produtos.length} produto{produtos.length === 1 ? "" : "s"} · {categorias.length} categoria{categorias.length === 1 ? "" : "s"}</span>
      </div>

      {criandoCat && (
        <NomeInline titulo="Nova categoria" inicial="" onCancelar={() => setCriandoCat(false)} onSalvar={(nome) => { salvarCategoria({ id: crypto.randomUUID(), nome }); setCriandoCat(false); }} />
      )}

      {grupos.map((g, gi) => {
        const cat = g.categoria;
        const idx = cat ? categorias.findIndex((c) => c.id === cat.id) : -1;
        return (
          <section key={cat?.id ?? "sem"} style={css("margin-bottom:22px;")}>
            {(
              <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;")}>
                <h3 style={css(`margin:0; font-size:15px; font-weight:800; color:${cat ? "#1B1B28" : "#7A8090"};`)}>{cat?.nome ?? "Sem categoria"}</h3>
                <span style={css("font-size:12px; font-weight:700; color:#9398A6; background:#F2F3F6; border-radius:999px; padding:2px 8px;")}>{g.produtos.length}</span>
                {cat && !categoriaAtiva(cat) && <Tag cor="#92400E" bg="#FFFBEB">Oculta da página</Tag>}
                {cat?.destaque && <Tag cor={BRAND} bg="#FDF1F4">Destaque</Tag>}
                {cat?.descricao && <span style={css("font-size:12.5px; color:#9398A6;")}>{cat.descricao}</span>}
                {!cat && <span style={css("font-size:12px; color:#9398A6;")}>— aparecem no fim do catálogo como "Outros"</span>}
                <span style={{ flex: 1 }} />
                {editavel && cat && (
                  <div style={css("display:flex; gap:4px;")}>
                    <IconeBtn titulo="Subir" off={idx <= 0} onClick={() => moverCategoria(cat.id, -1)}><path d="m18 15-6-6-6 6" /></IconeBtn>
                    <IconeBtn titulo="Descer" off={idx >= categorias.length - 1} onClick={() => moverCategoria(cat.id, 1)}><path d="m6 9 6 6 6-6" /></IconeBtn>
                    <IconeBtn titulo="Editar categoria (nome, frase, capa, mostrar/ocultar)" onClick={() => setEditandoCat(cat)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></IconeBtn>
                    <IconeBtn titulo="Excluir categoria" perigo onClick={() => setExcluindoCat(cat)}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></IconeBtn>
                  </div>
                )}
              </div>
            )}
            <div className="m-grid-2" style={css("display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:14px; align-items:stretch;")}>
              {g.produtos.map((p) => (
                <Hoverable key={p.id} onClick={() => editavel && setEditando(p)} s={css(`background:#fff; border:1px solid #ECEDF1; border-radius:14px; overflow:hidden; display:flex; flex-direction:column; cursor:${editavel ? "pointer" : "default"}; opacity:${p.ativo ? 1 : 0.6};`)} hover={editavel ? "box-shadow:0 4px 14px rgba(16,24,40,.08)" : undefined}>
                  {/* Tamanho padrão: foto no mesmo quadro (4:5) e nome em até 2 linhas — todos os cards da linha ficam iguais. */}
                  <Foto src={p.foto} alt={p.nome} proporcao="4/5" cortar miniatura />
                  <div style={css("padding:10px 12px 12px; display:flex; flex-direction:column; gap:6px; flex:1;")}>
                    <div title={p.nome} style={css("font-size:14px; font-weight:800; line-height:1.3; min-height:2.6em; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;")}>{p.nome}</div>
                    <div style={css(`font-size:14px; font-weight:800; color:${BRAND};`)}>{brl(p.preco)}</div>
                    <div style={css("display:flex; gap:5px; flex-wrap:wrap; margin-top:auto;")}>
                      {p.porcoes && <Tag>{p.porcoes}</Tag>}
                      {p.peso && <Tag>{p.peso}</Tag>}
                      <Tag cor={p.ativo ? "#1B7F4D" : "#7A8090"} bg={p.ativo ? "#E7F6EE" : "#F2F3F6"}>{p.ativo ? "Ativo" : "Inativo"}</Tag>
                    </div>
                  </div>
                </Hoverable>
              ))}
              {editavel && (
                <Hoverable onClick={() => novoProduto(cat?.id ?? null)} s={css("min-height:150px; border:1.5px dashed #D9DBE2; border-radius:14px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:#9398A6; font-size:13px; font-weight:700; cursor:pointer;")} hover={`border-color:${BRAND}; color:${BRAND}`}>
                  <Svg size={20} sw={2.2}><path d="M12 5v14M5 12h14" /></Svg>Adicionar produto
                </Hoverable>
              )}
            </div>
            {gi < grupos.length - 1 && <div style={css("height:1px; background:#ECEDF1; margin-top:22px;")} />}
          </section>
        );
      })}

      {editandoCat && (
        <CategoriaForm categoria={editandoCat} capaAuto={produtos.find((p) => p.categoriaId === editandoCat.id && p.ativo && p.foto)?.foto ?? null}
          onClose={() => setEditandoCat(null)} onSalvar={(c) => { salvarCategoria(c); setEditandoCat(null); }} />
      )}
      {editando && (
        <ProdutoForm
          produto={editando === "novo" ? null : editando}
          categoriaInicial={novoEm}
          onClose={() => setEditando(null)}
          onSalvar={(p) => { salvarProduto(p); setEditando(null); }}
        />
      )}
      {excluindoCat && (
        <ConfirmModal
          titulo="Excluir categoria"
          mensagem={<>Excluir a categoria <strong style={css("color:#1B1B28;")}>{excluindoCat.nome}</strong>? {produtos.filter((p) => p.categoriaId === excluindoCat.id).length ? "Os produtos dela não são apagados: ficam em “Sem categoria”." : "Ela não tem produtos."}</>}
          confirmLabel="Excluir"
          danger
          onConfirm={() => { excluirCategoria(excluindoCat.id); setExcluindoCat(null); }}
          onClose={() => setExcluindoCat(null)}
        />
      )}
    </div>
  );
}

/** Drawer de criar/editar produto. */
function ProdutoForm({ produto, categoriaInicial, onClose, onSalvar }: { produto: ProdutoEncomenda | null; categoriaInicial: string | null; onClose: () => void; onSalvar: (p: ProdutoEncomenda) => void }) {
  useFecharComEsc(true, onClose);
  const { categorias, salvarCategoria, excluirProduto, pedidos } = useEncomendas();
  const [f, setF] = useState(() => ({
    nome: produto?.nome ?? "",
    categoriaId: produto ? produto.categoriaId : categoriaInicial,
    preco: produto ? produto.preco.toFixed(2).replace(".", ",") : "",
    porcoes: produto?.porcoes ?? "",
    peso: produto?.peso ?? "",
    descricao: produto?.descricao ?? "",
    camadas: (produto?.camadas ?? []).join("\n"),
    foto: produto?.foto ?? null as string | null,
    ativo: produto?.ativo ?? true,
    produtoEstoqueId: produto?.produtoEstoqueId ?? null,
  }));
  const { produtos: estoque } = useApp();
  // Itens do Estoque agrupados por categoria — "Encomendas" primeiro (é onde ficam as tortas inteiras).
  const gruposEstoque = [...CATEGORIAS_ESTOQUE.map((c) => c.v), ...estoque.map((p) => p.categoria)]
    .filter((c, i, a) => a.indexOf(c) === i)
    .sort((a, b) => (a === "Encomendas" ? -1 : b === "Encomendas" ? 1 : 0))
    .map((c) => ({ categoria: c, itens: estoque.filter((p) => p.categoria === c).sort((a, b) => a.nome.localeCompare(b.nome, "pt")) }))
    .filter((g) => g.itens.length);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [novaCat, setNovaCat] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preco = Number(f.preco.replace(/\./g, "").replace(",", "."));

  const salvar = () => {
    if (f.nome.trim().length < 2) return setErro("Dê um nome ao produto.");
    if (!(preco > 0)) return setErro("Informe um preço maior que zero (ex.: 159,90).");
    onSalvar({
      id: produto?.id ?? crypto.randomUUID(),
      nome: f.nome.trim(), categoriaId: f.categoriaId, preco: Math.round(preco * 100) / 100,
      porcoes: f.porcoes.trim(), peso: f.peso.trim(), descricao: f.descricao.trim() || undefined,
      camadas: f.camadas.split("\n").map((s) => s.trim()).filter(Boolean), foto: f.foto, ativo: f.ativo,
      produtoEstoqueId: f.produtoEstoqueId,
    });
  };
  const enviarFoto = async (arq?: File) => {
    if (!arq) return;
    setEnviando(true); setErro(null);
    try { const url = await reduzirFoto(arq); setF((x) => ({ ...x, foto: url })); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao ler a imagem."); }
    finally { setEnviando(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const catAtual = categorias.find((c) => c.id === f.categoriaId);
  const emPedidos = produto ? pedidos.filter((p) => p.produtoId === produto.id).length : 0;
  const campo = "width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; padding:9px 11px; font-size:13.5px; outline:none; font-family:inherit; margin-top:5px; background:#fff;";
  const rot = "display:block; font-size:12.5px; font-weight:700; color:#5B6472;";

  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:64; background:rgba(20,24,40,.32);")} />
      <div className="m-drawer" style={css("position:fixed; top:0; right:0; bottom:0; z-index:65; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:540px; max-width:96vw; display:flex; flex-direction:column;")}>
        <div style={css("flex:none; display:flex; align-items:center; gap:10px; padding:18px 22px; border-bottom:1px solid #ECEDF1;")}>
          <span style={css("flex:1; font-size:18px; font-weight:800;")}>{produto ? "Editar produto" : "Novo produto"}</span>
          <Hoverable as="button" onClick={onClose} title="Fechar" s={css("width:32px; height:32px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>

        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:18px 22px; display:flex; flex-direction:column; gap:14px;")}>
          <div style={css("display:flex; gap:14px; align-items:center;")}>
            <div style={css("width:120px; flex:none; border-radius:12px; overflow:hidden; border:1px solid #ECEDF1;")}>
              {enviando ? <div style={css("aspect-ratio:1/1; display:flex; align-items:center; justify-content:center; font-size:12px; color:#9398A6;")}>Enviando…</div> : <Foto src={f.foto || null} alt="" proporcao="1/1" miniatura />}
            </div>
            <div style={css("display:flex; flex-direction:column; gap:7px;")}>
              <span style={css(rot)}>Foto</span>
              <div style={css("display:flex; gap:7px; flex-wrap:wrap;")}>
                <Botao onClick={() => fileRef.current?.click()}>{f.foto ? "Trocar foto" : "Enviar foto"}</Botao>
                {f.foto && <Botao onClick={() => setF({ ...f, foto: null })}>Remover</Botao>}
              </div>
              <span style={css("font-size:11.5px; color:#9398A6;")}>JPG ou PNG. A imagem é reduzida automaticamente.</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={(e) => enviarFoto(e.target.files?.[0])} style={{ display: "none" }} />
          </div>

          <label style={css(rot)}>Nome *<input autoFocus={!produto} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Torta de Morango" style={css(campo)} /></label>

          <div>
            <span style={css(rot)}>Categoria</span>
            {novaCat !== null ? (
              <div style={css("display:flex; gap:7px; margin-top:5px;")}>
                <input autoFocus value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Nome da nova categoria" style={css(campo + " margin-top:0;")}
                  onKeyDown={(e) => { if (e.key === "Enter" && novaCat.trim()) { const c = { id: crypto.randomUUID(), nome: novaCat.trim() }; salvarCategoria(c); setF({ ...f, categoriaId: c.id }); setNovaCat(null); } }} />
                <Botao onClick={() => { if (!novaCat.trim()) return; const c = { id: crypto.randomUUID(), nome: novaCat.trim() }; salvarCategoria(c); setF({ ...f, categoriaId: c.id }); setNovaCat(null); }}>Criar</Botao>
                <Botao onClick={() => setNovaCat(null)}>Cancelar</Botao>
              </div>
            ) : (
              <div style={css("margin-top:5px;")}>
                <Menu z={220} width={280} trigger={(tg) => (
                  <button type="button" onClick={tg} style={css("width:100%; display:flex; align-items:center; gap:8px; border:1px solid #E2E3E9; background:#fff; border-radius:9px; padding:9px 11px; font-size:13.5px; cursor:pointer; text-align:left; color:#1B1B28;")}>
                    <span style={css(`flex:1; ${catAtual ? "" : "color:#9398A6;"}`)}>{catAtual?.nome ?? "Sem categoria"}</span>
                    <Svg size={13} sw={2.4} stroke="#9398A6"><path d="m6 9 6 6 6-6" /></Svg>
                  </button>
                )}>
                  {(c) => (
                    <>
                      <MenuItem checked={!f.categoriaId} onClick={() => { setF({ ...f, categoriaId: null }); c(); }}><span style={{ flex: 1, color: "#9398A6" }}>Sem categoria</span></MenuItem>
                      {categorias.map((cat) => <MenuItem key={cat.id} checked={f.categoriaId === cat.id} onClick={() => { setF({ ...f, categoriaId: cat.id }); c(); }}><span style={{ flex: 1 }}>{cat.nome}</span></MenuItem>)}
                      <div style={css("height:1px; background:#ECEDF1; margin:4px 0;")} />
                      <MenuItem onClick={() => { setNovaCat(""); c(); }}><span style={{ flex: 1, color: BRAND, fontWeight: 700 }}>+ Nova categoria</span></MenuItem>
                    </>
                  )}
                </Menu>
              </div>
            )}
          </div>

          <div className="m-grid-2" style={css("display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px;")}>
            <label style={css(rot)}>Preço (R$) *<input inputMode="decimal" value={f.preco} onChange={(e) => setF({ ...f, preco: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="159,90" style={css(campo)} /></label>
            <label style={css(rot)}>Porções<input value={f.porcoes} onChange={(e) => setF({ ...f, porcoes: e.target.value })} placeholder="8 a 10 porções" style={css(campo)} /></label>
            <label style={css(rot)}>Peso<input value={f.peso} onChange={(e) => setF({ ...f, peso: e.target.value })} placeholder="1,3 kg" style={css(campo)} /></label>
          </div>

          <label style={css(rot)}>Descrição <span style={css("font-weight:500; color:#9398A6;")}>(opcional — um item por linha; o cliente vê em lista, um abaixo do outro)</span>
            <textarea value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} rows={6} placeholder={"Creme belga\nPão de ló\nMorangos frescos\nFinalizado com suspiros"} style={css(campo + " resize:vertical;")} />
          </label>

          <label style={css(rot)}>Camadas <span style={css("font-weight:500; color:#9398A6;")}>(uma por linha, de cima para baixo — opcional)</span>
            <textarea value={f.camadas} onChange={(e) => setF({ ...f, camadas: e.target.value })} rows={6} placeholder={"Suspiros\nButtercreme\nPão de ló"} style={css(campo + " resize:vertical;")} />
          </label>

          <label style={css(rot)}>Produto no estoque <span style={css("font-weight:500; color:#9398A6;")}>(a produção soma na Fábrica, a loja recebe e o “Entregue” dá baixa)</span>
            <select value={f.produtoEstoqueId ?? ""} onChange={(e) => setF({ ...f, produtoEstoqueId: e.target.value || null })} style={css(campo + " cursor:pointer;")}>
              <option value="">Não movimentar o estoque</option>
              {gruposEstoque.map((g) => (
                <optgroup key={g.categoria} label={g.categoria}>
                  {g.itens.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </optgroup>
              ))}
              {f.produtoEstoqueId && !estoque.some((p) => p.id === f.produtoEstoqueId) && <option value={f.produtoEstoqueId}>(item fora do estoque)</option>}
            </select>
          </label>

          <label style={css("display:flex; align-items:center; gap:10px; font-size:13.5px; font-weight:700; color:#3A3F4C; cursor:pointer;")}>
            <Chave ligado={f.ativo} onChange={(v) => setF({ ...f, ativo: v })} />
            {f.ativo ? "Ativo — aparece na página de encomendas" : "Inativo — escondido da página de encomendas"}
          </label>

          {erro && <div style={css("font-size:12.5px; font-weight:600; color:#B42318; background:#FEF3F2; border:1px solid #FECDCA; border-radius:10px; padding:9px 12px;")}>{erro}</div>}
        </div>

        <div style={css("flex:none; display:flex; align-items:center; gap:8px; padding:14px 22px; border-top:1px solid #ECEDF1;")}>
          {produto && <Hoverable as="button" onClick={() => setConfirmDel(true)} s={css("border:none; background:transparent; color:#CC3338; font-size:13px; font-weight:700; cursor:pointer; padding:8px 4px;")} hover="text-decoration:underline">Excluir produto</Hoverable>}
          <span style={{ flex: 1 }} />
          <Botao onClick={onClose}>Cancelar</Botao>
          <Hoverable as="button" onClick={salvar} {...{ disabled: enviando }} s={css(`border:none; background:${BRAND}; color:#fff; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:700; cursor:pointer; opacity:${enviando ? 0.5 : 1};`)} hover="filter:brightness(1.1)">Salvar</Hoverable>
        </div>
      </div>
      {confirmDel && produto && (
        <ConfirmModal
          titulo="Excluir produto"
          mensagem={<>Excluir <strong style={css("color:#1B1B28;")}>{produto.nome}</strong> do catálogo?{emPedidos ? ` Os ${emPedidos} pedido(s) já feitos continuam com o nome dele.` : ""} Se for só pausar as vendas, desative em vez de excluir.</>}
          confirmLabel="Excluir"
          danger
          onConfirm={() => { excluirProduto(produto.id); setConfirmDel(false); onClose(); }}
          onClose={() => setConfirmDel(false)}
        />
      )}
    </>
  );
}

/** Editar categoria: nome, frase e capa do card da vitrine, e se aparece na página do cliente. */
function CategoriaForm({ categoria, capaAuto, onClose, onSalvar }: { categoria: Categoria; capaAuto: string | null; onClose: () => void; onSalvar: (c: Categoria) => void }) {
  useFecharComEsc(true, onClose);
  const [f, setF] = useState({ nome: categoria.nome, descricao: categoria.descricao ?? "", foto: categoria.foto ?? null as string | null, ativa: categoriaAtiva(categoria), destaque: !!categoria.destaque });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const enviarFoto = async (arq?: File) => {
    if (!arq) return;
    setEnviando(true); setErro(null);
    try { const url = await reduzirFoto(arq); setF((x) => ({ ...x, foto: url })); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao ler a imagem."); }
    finally { setEnviando(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const salvar = () => {
    if (!f.nome.trim()) return setErro("Dê um nome à categoria.");
    onSalvar({ ...categoria, nome: f.nome.trim(), descricao: f.descricao.trim() || undefined, foto: f.foto, ativa: f.ativa, destaque: f.destaque });
  };
  const campo = "width:100%; box-sizing:border-box; border:1px solid #E2E3E9; border-radius:9px; padding:9px 11px; font-size:13.5px; outline:none; font-family:inherit; margin-top:5px; background:#fff;";
  const rot = "display:block; font-size:12.5px; font-weight:700; color:#5B6472;";
  return (
    <>
      <div onClick={onClose} style={css("position:fixed; inset:0; z-index:64; background:rgba(20,24,40,.32);")} />
      <div className="m-drawer" style={css("position:fixed; top:0; right:0; bottom:0; z-index:65; background:#fff; box-shadow:-10px 0 44px rgba(20,24,40,.18); width:460px; max-width:96vw; display:flex; flex-direction:column;")}>
        <div style={css("flex:none; display:flex; align-items:center; gap:10px; padding:18px 22px; border-bottom:1px solid #ECEDF1;")}>
          <span style={css("flex:1; font-size:18px; font-weight:800;")}>Editar categoria</span>
          <Hoverable as="button" onClick={onClose} title="Fechar" s={css("width:32px; height:32px; flex:none; border:1px solid #ECEDF1; background:#fff; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#7A8090;")} hover="background:#F4F4F7"><Svg size={15} sw={2.2}><path d="M6 6l12 12M18 6 6 18" /></Svg></Hoverable>
        </div>
        <div style={css("flex:1; min-height:0; overflow-y:auto; padding:18px 22px; display:flex; flex-direction:column; gap:14px;")}>
          <label style={css(rot)}>Nome *<input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} maxLength={80} placeholder="Ex.: Cheesecakes" style={css(campo)} /></label>
          <label style={css(rot)}>Frase do card <span style={css("font-weight:500; color:#9398A6;")}>(opcional — ex.: “Servem de 15 a 20 fatias”)</span>
            <input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} maxLength={120} style={css(campo)} />
          </label>
          <div>
            <span style={css(rot)}>Foto de capa</span>
            <div style={css("display:flex; gap:14px; align-items:center; margin-top:6px;")}>
              <div style={css("width:120px; flex:none; border-radius:12px; overflow:hidden; border:1px solid #ECEDF1;")}>
                {enviando ? <div style={css("aspect-ratio:1/1; display:flex; align-items:center; justify-content:center; font-size:12px; color:#9398A6;")}>Enviando…</div> : <Foto src={f.foto || capaAuto} alt="" proporcao="1/1" cortar miniatura />}
              </div>
              <div style={css("display:flex; flex-direction:column; gap:7px;")}>
                <div style={css("display:flex; gap:7px; flex-wrap:wrap;")}>
                  <Botao onClick={() => fileRef.current?.click()}>{f.foto ? "Trocar capa" : "Enviar capa"}</Botao>
                  {f.foto && <Botao onClick={() => setF({ ...f, foto: null })}>Usar automática</Botao>}
                </div>
                <span style={css("font-size:11.5px; color:#9398A6; line-height:1.4;")}>{f.foto ? "Capa própria da categoria." : "Automática: foto do primeiro produto da categoria."}</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={(e) => enviarFoto(e.target.files?.[0])} style={{ display: "none" }} />
            </div>
          </div>
          <label style={css("display:flex; align-items:center; gap:10px; font-size:13.5px; font-weight:700; color:#3A3F4C; cursor:pointer;")}>
            <Chave ligado={f.ativa} onChange={(v) => setF({ ...f, ativa: v })} />
            {f.ativa ? "Aparece na página de encomendas" : "Oculta — a categoria e os produtos dela somem da página"}
          </label>
          <div>
            <label style={css("display:flex; align-items:center; gap:10px; font-size:13.5px; font-weight:700; color:#3A3F4C; cursor:pointer;")}>
              <Chave ligado={f.destaque} onChange={(v) => setF({ ...f, destaque: v })} />
              Card em destaque — ocupa a largura de dois cards
            </label>
            <div style={css("font-size:11.5px; color:#9398A6; margin:6px 0 0 54px; line-height:1.4;")}>A posição segue a ordem das categorias (setas ↑ ↓ em Produtos): suba a categoria para ela abrir a vitrine. Sem nenhuma em destaque, a primeira fica grande quando o número de categorias é ímpar.</div>
          </div>
          {erro && <div style={css("font-size:12.5px; font-weight:600; color:#B42318; background:#FEF3F2; border:1px solid #FECDCA; border-radius:10px; padding:9px 12px;")}>{erro}</div>}
        </div>
        <div style={css("flex:none; display:flex; align-items:center; gap:8px; padding:14px 22px; border-top:1px solid #ECEDF1;")}>
          <span style={{ flex: 1 }} />
          <Botao onClick={onClose}>Cancelar</Botao>
          <Hoverable as="button" onClick={salvar} {...{ disabled: enviando }} s={css(`border:none; background:${BRAND}; color:#fff; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:700; cursor:pointer; opacity:${enviando ? 0.5 : 1};`)} hover="filter:brightness(1.1)">Salvar</Hoverable>
        </div>
      </div>
    </>
  );
}

function NomeInline({ titulo, inicial, onSalvar, onCancelar }: { titulo: string; inicial: string; onSalvar: (nome: string) => void; onCancelar: () => void }) {
  const [v, setV] = useState(inicial);
  const ok = v.trim().length > 0;
  return (
    <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap; background:#fff; border:1px solid #ECEDF1; border-radius:12px; padding:10px 12px;")}>
      <span style={css("font-size:12.5px; font-weight:700; color:#5B6472;")}>{titulo}</span>
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ok) onSalvar(v.trim()); if (e.key === "Escape") onCancelar(); }} placeholder="Ex.: Bolos de festa" style={css("flex:1; min-width:180px; border:1px solid #E2E3E9; border-radius:9px; padding:8px 10px; font-size:13.5px; outline:none;")} />
      <Botao onClick={() => ok && onSalvar(v.trim())}>Salvar</Botao>
      <Botao onClick={onCancelar}>Cancelar</Botao>
    </div>
  );
}

export function Chave({ ligado, onChange }: { ligado: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} onClick={(e) => { e.preventDefault(); onChange(!ligado); }} style={css(`flex:none; width:44px; height:26px; border-radius:999px; border:none; cursor:pointer; position:relative; background:${ligado ? BRAND : "#D5D7DE"}; transition:background .15s;`)}>
      <span style={css(`position:absolute; top:3px; left:${ligado ? 21 : 3}px; width:20px; height:20px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2); transition:left .15s;`)} />
    </button>
  );
}

function IconeBtn({ titulo, onClick, off, perigo, children }: { titulo: string; onClick: () => void; off?: boolean; perigo?: boolean; children: React.ReactNode }) {
  return (
    <Hoverable as="button" title={titulo} onClick={() => !off && onClick()} s={css(`width:32px; height:32px; border:1px solid #ECEDF1; background:#fff; border-radius:8px; cursor:${off ? "default" : "pointer"}; display:flex; align-items:center; justify-content:center; color:${off ? "#D5D7DE" : "#5B6472"};`)} hover={off ? undefined : perigo ? "background:#FDECEC; color:#CC3338; border-color:#F3C2C4" : "background:#F4F4F7"}>
      <Svg size={14} sw={2.2}>{children}</Svg>
    </Hoverable>
  );
}

export function Botao({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <Hoverable as="button" type="button" onClick={onClick} s={css("flex:none; border:1px solid #E2E3E9; background:#fff; color:#3A3F4C; border-radius:9px; padding:8px 13px; font-size:13px; font-weight:700; cursor:pointer;")} hover="background:#F4F4F7">{children}</Hoverable>;
}

function Tag({ children, cor = "#5B6472", bg = "#F2F3F6" }: { children: React.ReactNode; cor?: string; bg?: string }) {
  return <span style={css(`font-size:11px; font-weight:700; padding:2px 8px; border-radius:7px; background:${bg}; color:${cor};`)}>{children}</span>;
}
