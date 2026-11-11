-- Encomendas com banco (antes: só no navegador). Catálogo, configuração, contatos, pedidos e agenda.
-- Acesso só pelas rotas /api/encomendas (service role): RLS ligada e sem policies.
--  * enc_categoria / enc_produto: catálogo do autoatendimento (foto = caminho público ou URL do bucket avatars).
--    produto_estoque_id liga a encomenda ao Estoque: produção soma na Fábrica → loja recebe → Entregue dá baixa.
--  * enc_config: uma linha só ("geral") com a configuração (lojas de retirada, horários, PIX…) em JSON.
--  * enc_contato: clientes (WhatsApp único) e o funil de atendimento.
--  * enc_pedido: pedidos com status do CRM; tarefas_criadas/estoque_baixado evitam repetir efeitos.
--  * enc_compromisso: compromissos manuais da Agenda.

create table if not exists enc_categoria (
  id          text primary key,
  nome        text not null,
  ordem       int not null default 0,
  descricao   text,                          -- frase curta no card da vitrine
  foto        text,                          -- capa do card (vazio = foto do 1º produto)
  ativa       boolean not null default true, -- false = escondida da página do cliente
  destaque    boolean not null default false, -- card largo (dois cards) na vitrine
  created_at  timestamptz not null default now()
);

create table if not exists enc_produto (
  id                  text primary key,
  nome                text not null,
  categoria_id        text references enc_categoria(id) on delete set null,
  preco               numeric(10,2) not null check (preco >= 0),
  porcoes             text not null default '',
  peso                text not null default '',
  descricao           text,
  camadas             jsonb not null default '[]'::jsonb,
  foto                text,
  ativo               boolean not null default true,
  produto_estoque_id  text references produto(id) on delete set null,
  ordem               int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_enc_produto_categoria on enc_produto(categoria_id);

create table if not exists enc_config (
  id          text primary key default 'geral' check (id = 'geral'),
  dados       jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists enc_contato (
  id              text primary key,
  numero          text not null unique,
  nome            text not null default '',
  status          text not null default 'Novo contato'
                  check (status in ('Novo contato', 'Followup', 'Em atendimento', 'Venda', 'Desqualificado', 'Perdido')),
  responsavel     text not null default 'I.A' check (responsavel in ('I.A', 'Humano')),
  resumo          text,
  criado_em       timestamptz not null default now(),
  ultimo_contato  timestamptz not null default now()
);

create table if not exists enc_pedido (
  id               text primary key,
  contato_id       text not null references enc_contato(id) on delete cascade,
  produto_id       text,
  produto_nome     text,
  quantidade       int not null check (quantidade > 0),
  mensagem         text,
  tipo             text not null check (tipo in ('Retirada', 'Entrega')),
  unidade_id       text,
  unidade_nome     text,
  endereco         jsonb,
  data             date not null,
  hora             text not null,
  subtotal         numeric(10,2) not null default 0,
  taxa             numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  status           text not null default 'Verificar pagamento'
                   check (status in ('Verificar pagamento', 'Em fila', 'Em produção', 'Entregue')),
  origem           text not null default 'autoatendimento' check (origem in ('autoatendimento', 'manual')),
  tarefas_criadas  boolean not null default false,
  estoque_baixado  boolean not null default false,
  criado_em        timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_enc_pedido_contato on enc_pedido(contato_id);
create index if not exists idx_enc_pedido_data on enc_pedido(data);

create table if not exists enc_compromisso (
  id          text primary key,
  titulo      text not null,
  data        date not null,
  hora        text not null,
  hora_fim    text not null,
  contato     text,
  notas       text,
  created_at  timestamptz not null default now()
);

alter table enc_categoria   enable row level security;
alter table enc_produto     enable row level security;
alter table enc_config      enable row level security;
alter table enc_contato     enable row level security;
alter table enc_pedido      enable row level security;
alter table enc_compromisso enable row level security;

drop trigger if exists trg_enc_produto_updated_at on enc_produto;
create trigger trg_enc_produto_updated_at before update on enc_produto for each row execute function public.set_updated_at();
drop trigger if exists trg_enc_config_updated_at on enc_config;
create trigger trg_enc_config_updated_at before update on enc_config for each row execute function public.set_updated_at();
drop trigger if exists trg_enc_pedido_updated_at on enc_pedido;
create trigger trg_enc_pedido_updated_at before update on enc_pedido for each row execute function public.set_updated_at();

-- Sinal de realtime (só nome da tabela + horário): o painel recarrega as encomendas sozinho.
do $$
declare t text;
begin
  foreach t in array array['enc_categoria', 'enc_produto', 'enc_config', 'enc_contato', 'enc_pedido', 'enc_compromisso'] loop
    execute format('drop trigger if exists trg_realtime_ping on public.%I', t);
    execute format('create trigger trg_realtime_ping after insert or update or delete on public.%I for each statement execute function public.tg_realtime_ping()', t);
  end loop;
end $$;

-- Tortas inteiras de encomenda no Estoque (categoria "Encomendas"), para a produção somar na
-- Fábrica, a loja receber e o "Entregue" dar baixa.
insert into produto (id, nome, categoria) values
  ('p-encomendas-torta-morango', 'Torta de Morango (encomenda)', 'Encomendas'),
  ('p-encomendas-torta-pudim', 'Torta de Pudim (encomenda)', 'Encomendas'),
  ('p-encomendas-torta-duo', 'Torta de Duo (encomenda)', 'Encomendas'),
  ('p-encomendas-torta-maracuja-chocolate', 'Torta de Maracujá com Chocolate (encomenda)', 'Encomendas'),
  ('p-encomendas-torta-brigadeiro', 'Torta de Brigadeiro (encomenda)', 'Encomendas'),
  ('p-encomendas-torta-bem-casado', 'Torta de Bem Casado (encomenda)', 'Encomendas'),
  ('p-encomendas-torta-mineira', 'Torta de Mineira (encomenda)', 'Encomendas'),
  ('p-encomendas-torta-prestigio', 'Torta de Prestígio (encomenda)', 'Encomendas'),
  ('p-encomendas-torta-marta-rocha', 'Torta de Marta Rocha (encomenda)', 'Encomendas')
on conflict (id) do nothing;

-- Catálogo inicial: as 9 tortas "Camadas de Felicidade" do PDF.
insert into enc_categoria (id, nome, ordem) values ('camadas-de-felicidade', 'Camadas de Felicidade', 0) on conflict (id) do nothing;
insert into enc_produto (id, nome, categoria_id, preco, porcoes, peso, camadas, foto, ativo, produto_estoque_id, ordem) values
  ('morango', 'Torta de Morango', 'camadas-de-felicidade', 169.9, '8 a 10 porções', '1,2 kg', '["Suspiros","Buttercreme","Pão de ló","Morangos","Pão de ló","Creme belga"]'::jsonb, '/encomendas/torta-morango.webp', true, 'p-encomendas-torta-morango', 0),
  ('pudim', 'Torta de Pudim', 'camadas-de-felicidade', 169.9, '8 a 10 porções', '1,2 kg', '["Creme","Pão de ló","Pudim de leite","Doce de leite","Pão de ló","Creme"]'::jsonb, '/encomendas/torta-pudim.webp', true, 'p-encomendas-torta-pudim', 1),
  ('duo', 'Torta de Duo', 'camadas-de-felicidade', 159.9, '8 a 10 porções', '1,3 kg', '["Creme belga branco","Massa de chocolate fofinha","Creme belga de chocolate","Finalizada com brigadeiros branco e tradicional"]'::jsonb, '/encomendas/torta-duo.webp', true, 'p-encomendas-torta-duo', 2),
  ('maracuja-chocolate', 'Torta de Maracujá com Chocolate', 'camadas-de-felicidade', 159.9, '8 a 10 porções', '1,3 kg', '["Creme de maracujá","Massa de chocolate fofinha","Creme de chocolate belga","Bem molhadinha"]'::jsonb, '/encomendas/torta-maracuja-chocolate.webp', true, 'p-encomendas-torta-maracuja-chocolate', 3),
  ('brigadeiro', 'Torta de Brigadeiro', 'camadas-de-felicidade', 159.9, '8 a 10 porções', '1,3 kg', '["Creme de brigadeiro","Massa de chocolate","Brigadeiro de panela","Massa de chocolate","Creme de brigadeiro","Brigadeiro de panela"]'::jsonb, '/encomendas/torta-brigadeiro.webp', true, 'p-encomendas-torta-brigadeiro', 4),
  ('bem-casado', 'Torta de Bem Casado', 'camadas-de-felicidade', 169.9, '8 a 10 porções', '1,3 kg', '["Creme de ninho","Massa de bolo fofinha","Doce de leite caseiro","Finalizado com bem casado"]'::jsonb, '/encomendas/torta-bem-casado.webp', true, 'p-encomendas-torta-bem-casado', 5),
  ('mineira', 'Torta de Mineira', 'camadas-de-felicidade', 159.9, '8 a 10 porções', '1,3 kg', '["Abacaxi","Buttercreme","Creme belga","Pão de ló","Creme belga com abacaxi","Pão de ló","Creme belga com abacaxi","Pão de ló","Creme belga com abacaxi"]'::jsonb, '/encomendas/torta-mineira.webp', true, 'p-encomendas-torta-mineira', 6),
  ('prestigio', 'Torta de Prestígio', 'camadas-de-felicidade', 159.9, '8 a 10 porções', '1,3 kg', '["Massa de chocolate fofinha","Creme de coco fresco com belga","Creme de chocolate","Finalizado com coco e chocolate prestígio"]'::jsonb, '/encomendas/torta-prestigio.webp', true, 'p-encomendas-torta-prestigio', 7),
  ('marta-rocha', 'Torta de Marta Rocha', 'camadas-de-felicidade', 159.9, '8 a 10 porções', '1,3 kg', '["Creme de ameixa & nozes","Baba de moça","Pão de ló","Creme de nozes","Creme de ameixa","Massa de chocolate","Creme de nozes","Creme de ameixa","Pão de ló","Creme belga"]'::jsonb, '/encomendas/torta-marta-rocha.webp', true, 'p-encomendas-torta-marta-rocha', 8)
on conflict (id) do nothing;

-- Configuração inicial: só retirada, nas 6 lojas; seg–sex 9h–18h, sáb 9h–14h; 48 h de antecedência.
insert into enc_config (id, dados) values ('geral', '{"retiradaAtiva":true,"unidades":[{"id":"u-centro","nome":"Centro","endereco":"","ativo":true},{"id":"u-santa-monica","nome":"Santa Mônica","endereco":"","ativo":true},{"id":"u-coqueiros","nome":"Coqueiros","endereco":"","ativo":true},{"id":"u-areias","nome":"Areias","endereco":"","ativo":true},{"id":"u-rocado","nome":"Roçado","endereco":"","ativo":true},{"id":"u-pagani","nome":"Pagani","endereco":"","ativo":true}],"entregaAtiva":false,"taxaEntrega":15,"antecedenciaHoras":48,"intervaloMin":60,"maxPorPedido":5,"janelas":{"dom":{"ativo":false,"intervalos":[]},"seg":{"ativo":true,"intervalos":[{"inicio":"09:00","fim":"18:00"}]},"ter":{"ativo":true,"intervalos":[{"inicio":"09:00","fim":"18:00"}]},"qua":{"ativo":true,"intervalos":[{"inicio":"09:00","fim":"18:00"}]},"qui":{"ativo":true,"intervalos":[{"inicio":"09:00","fim":"18:00"}]},"sex":{"ativo":true,"intervalos":[{"inicio":"09:00","fim":"18:00"}]},"sab":{"ativo":true,"intervalos":[{"inicio":"09:00","fim":"14:00"}]}},"pixChave":"","pixNome":"","pixCidade":"","whatsappContato":""}'::jsonb) on conflict (id) do nothing;
