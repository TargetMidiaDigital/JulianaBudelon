# Gestão · Ju Budelon

Painel de gestão interno da **Ju Budelon**, derivado do sistema da Target Mídia Digital
(mesma base de UI/UX em **Next.js + React + TypeScript**), com um recorte menor de funções.

## Telas

- **Operacional → Produção** (as tarefas; id interno `listaview`) — status **A verificar → Em
  produção → Concluída → Validada** (esta só Administrador/Head) e **Atrasada**, que só o sistema
  marca: a cada `/api/bootstrap`, tarefas vencidas em A verificar/Em produção viram Atrasada com
  log ([`lib/tarefas-server.ts`](lib/tarefas-server.ts)); o servidor recusa esses dois status
  vindos de quem não pode. Lista agrupável (status / responsável / prioridade / vencimento / tipo)
  e quadro kanban; edição inline de título, cliente, responsável, prioridade, status e vencimento;
  seleção múltipla com ações em lote; descrição rica e comentários com imagem/vídeo/anexo;
  link compartilhável `?tarefa=<id>` (e `?talento=<id>`
  abre um candidato no Banco de Talentos).
- **Operacional → Indicadores** — painel com filtros (período, unidade, categoria, status) que
  valem para todos os cartões: KPIs (ordens, unidades pedidas, progresso de
  produção e expedição), evolução no tempo (linha/área), ordens por status (rosca), top 5
  produtos, unidades recebidas por loja, tarefas por status (produção × expedição), pedidos por
  categoria, mapa de calor produto × unidade e tarefas por responsável. Clicar numa barra
  filtra; todo gráfico tem vista em tabela. Cálculo no navegador em
  [`lib/indicadores.ts`](lib/indicadores.ts); gráficos com Recharts; cores validadas com o
  validador do skill de dataviz (par produção/expedição, status e rampa sequencial).
- **Operacional → Ordem de Serviço** — lista de ordens (mesmo desenho de Tarefas, sem quadro):
  título, status (Aberta / Em andamento / Concluída / Validada — esta sai da visão padrão), itens, total a receber por
  unidade, entrega, quem criou. "Nova ordem" abre a matriz **produto × unidade** (produtos do
  Estoque, por categoria) para preencher quanto cada loja precisa; a data de entrega é
  obrigatória. **Ao criar a ordem, nasce uma tarefa de produção por produto** em Tarefas
  ("Banoffinha: 10", tipo Produção, detalhe por unidade na descrição, vencendo na data de
  entrega, responsável = quem criou; `tarefas.pedido_id`, migration 0015) **e uma tarefa de
  expedição por unidade**. **A ordem acompanha as tarefas dos dois setores**: alguma iniciada →
  Em andamento; todas concluídas → Concluída (migration 0018; no servidor, em
  [`lib/pedido-server.ts`](lib/pedido-server.ts), com log "Sistema mudou o status…"). O drawer
  da ordem lista as tarefas com progresso, a matriz editável e o histórico (painel recolhível);
  o drawer da tarefa mostra a ordem de origem. Link compartilhável `?pedido=<id>`; excluir a
  ordem apaga as tarefas dela (FK cascade, migration 0017). Tabela `pedido`
  (migration 0014; `itens` = `{ produtoId: { local: qtd } }`), rota `/api/pedidos`, dimensões em
  [`lib/pedido.ts`](lib/pedido.ts).
- **Operacional → Expedição** — mesma lista de Produção (id `expedicao`), mas com as tarefas de
  `categoria = "expedicao"`: uma por **unidade** que recebe a ordem ("Expedição - Centro - dd/mm/aaaa",
  produtos e quantidades na descrição). Separação em [`lib/tarefas.ts`](lib/tarefas.ts); a rota
  `/api/tarefas` exige "editar" na tela da tarefa (Produção ou Expedição).
- **Produção × Estoque** — a tarefa de produção tem Produto e Quantidade (`tarefas.produto_id`,
  `quantidade`, migration 0019; as geradas pela ordem já vêm preenchidas). Ao **concluir** a
  tarefa, a quantidade **soma no estoque da Fábrica** (reabrir estorna), com log no produto e na
  tarefa — no servidor, em [`lib/tarefas-server.ts`](lib/tarefas-server.ts).
- **Romaneio de expedição** — botão "Romaneio" na tarefa de expedição: documento A4 para
  imprimir/PDF e levar com os produtos (destino, ordem, entrega, produtos com pedido e separado,
  coluna "Recebido" em branco para a loja conferir, assinaturas). Em [`lib/romaneio.ts`](lib/romaneio.ts).
- **Operacional → Unidades** — terceira lista de tarefas (id `unidades`, `categoria = "unidade"`):
  cada ordem gera **uma tarefa por unidade** ("Recebimento - Centro - dd/mm/aaaa") para a loja
  conferir o que recebeu da expedição. Fecha o ciclo produção → expedição → unidade; a ordem só
  fica Concluída com as três etapas concluídas. Sem a etapa "Em produção" (como Expedição).
  **Concluir o recebimento move o estoque**: cada produto da ordem para aquela unidade sai da
  Fábrica e entra na unidade (reabrir desfaz; `tarefas.local`, migration 0020). Se a Fábrica não
  tinha o suficiente, o log do produto registra quanto faltou.
- **Conferência e relatório da ordem** — produção gera **uma tarefa por produto × unidade**
  ("Banoffinha - Centro: 3"); a parte da **Fábrica** não gera expedição nem recebimento. Toda
  tarefa da ordem tem a **Conferência** (`tarefas.conferencia`, migration 0021): produto | pedido |
  produzido/separado/recebido. **Só conclui com o realizado preenchido** (botão "Igual ao
  pedido"); concluída, os números travam (reabrir libera). O estoque usa o realizado: produção
  soma o produzido na Fábrica; recebimento move o recebido da Fábrica para a unidade. No drawer
  da ordem, **Relatório** mostra pedido × produzido × separado × recebido por unidade, com as
  etapas onde houve diferença, e imprime/salva em PDF ([`lib/relatorio.ts`](lib/relatorio.ts)).
- **Relatório de estoque** — botão "Relatório" no Estoque (todos ou só com estoque, respeitando
  busca e categoria): A4 deitado para imprimir/PDF, um produto por linha com a quantidade em cada
  unidade e o total, subtotais por categoria e total geral. Só leitura
  ([`lib/relatorio-estoque.ts`](lib/relatorio-estoque.ts)).
- **Operacional → Estoque** — lista de produtos agrupada por categoria (as seções da planilha de
  reposição: Frutas, Caseirinhos, Brownies, Copinhos, Bolos Gelados, Bolos de Potes, Congelados,
  Tortas Acrílico Fatia, Encomendas — em [`lib/estoque.ts`](lib/estoque.ts)); cadastro de produto
  com a quantidade por local — Fábrica, Centro, Santa Mônica, Coqueiros, Areias, Roçado, Pagani
  (`LOCAIS_ESTOQUE`) — e o total; edição inline de nome/categoria/quantidades, busca, filtro por
  categoria e exclusão. Clicar no produto abre o drawer (mesmo desenho da tarefa) com as
  quantidades por unidade e o **histórico**: "Fulano atualizou a quantidade de 8 para 10 na
  unidade Fábrica" (autor `sistema` reservado para automações). Tabela `produto` (migrations
  0010–0013; quantidades no jsonb `estoque`, log no jsonb `historico`), rota `/api/estoque`.
- **Recrutamento → Banco de Talentos** — quadro por etapa e lista ordenável; detalhe do candidato
  com status, vaga, qualidade, WhatsApp, currículo/anexos e comentários; cadastro de novo candidato.
- **Recrutamento → Vagas** — cadastro de unidades e de vagas (sempre vinculadas a uma unidade), com
  status Ativa/Pausada, contagem de candidatos e os textos da página pública. Cada vaga tem
  descrição, requisitos e diferenciais (preenchidos pelo catálogo de cargos em `lib/seed.ts`):
  o candidato lê no popup "Sobre a vaga" antes do formulário, e a IA compara com o currículo.
- **Análise de currículo por IA** — ao entrar uma candidatura pela página pública (ou pelo botão
  "Analisar com IA" no candidato), o servidor lê o currículo (PDF pelo file-parser do OpenRouter;
  imagem pela visão do modelo; DOCX vira texto), junta com a vaga e pede ao modelo um resumo
  (experiência, formação, pontos fortes, alertas) e a classificação candidato × vaga (nota 0–100 +
  Ótimo/Bom/Ruim + justificativa + lacunas), em JSON. A classificação vai para a **Qualidade** do
  candidato (sem análise, fica "Aguardando Análise"; a equipe pode trocar no dropdown e uma nova
  análise grava de novo). Código em
  [`lib/analise-curriculo.ts`](lib/analise-curriculo.ts) e rota `/api/talentos/analisar`.
- **Recrutamento → Agente IA** (tela própria, permissão em Configurações → Acessos) — mesmo desenho do CRM do Cachorrão HD: agente
  **RECRUTAMENTO** com abas **Prompt** (instruções editáveis; o formato JSON é fixo no código),
  **LLM** (token do OpenRouter — write-only, nunca volta ao navegador —, modelo e motor de leitura
  de PDF) e **Ferramentas** (ligar/desligar a análise automática na candidatura). Tudo na tabela
  `agente_ia` (linha `recrutamento`), via `/api/agente/config`. Sem token, o resto do sistema
  funciona e o candidato fica "Aguardando Análise". Nenhuma variável de ambiente de IA.
- **Configurações → WhatsApp** (Administrador) — igual ao Cachorrão HD: credenciais da **Uazapi**
  (URL + token write-only, em `agente_ia`), **conexão do número** (status, QR Code, desconectar,
  pelo proxy `/api/whatsapp/instancia`) e **grupos de notificação** (`whatsapp_grupos`: JID,
  liga/desliga, testar, excluir, via `/api/whatsapp/grupos`). A cada candidatura pela página
  pública, os grupos **escolhidos em Recrutamento → Agente IA → Ferramentas** (entre os
  cadastrados, coluna `agente_ia.notificar_grupos`) recebem nome, vaga, unidade e o link
  `/?talento=<id>` que abre o candidato no painel (o arquivo do currículo não vai: é documento
  pessoal). Nenhum grupo escolhido = nenhum aviso. Em desenvolvimento (link
  `localhost`) o aviso não sai. Código em [`lib/whatsapp.ts`](lib/whatsapp.ts).
- **Página pública `/vagas`** (link na bio, no desenho do linkbio do Cachorrão HD) — hub com um botão
  por unidade → `/vagas/<unidade>` com um botão por vaga → popup "Sobre a vaga" (descrição, requisitos, diferenciais) → nome / WhatsApp / currículo →
  `/vagas/obrigado`. A candidatura entra no Banco de Talentos com status "Novo"; se o WhatsApp já
  estiver cadastrado, é uma **recandidatura**: o cadastro é atualizado (nome, vaga, unidade,
  novo currículo, sobe para o topo) e o histórico registra o que mudou, sem criar duplicata. O Pixel do Facebook é
  configurado em Vagas → Página pública: PageView em todas as páginas e Lead no `/obrigado`.
- **Login** — e-mail + senha.
- **Configurações** — Empresa (nome/logo), Pessoas (cadastro, cargo, status, senha), Grupos,
  Acessos (matriz cargo × tela com Sem acesso / Visualizar / Editar + escopo próprio) e Perfil.

## Dados (fase 2: Supabase)

O app roda em dois modos, decididos pelas variáveis de ambiente (`.env.local`, ver
[`.env.example`](.env.example)):

- **Com Supabase** (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` no navegador,
  `SUPABASE_SERVICE_ROLE_KEY` no servidor): login pelo Supabase Auth; os dados vêm de
  `/api/bootstrap` (recortados por cargo no servidor) e toda escrita passa pelas rotas
  `app/api/*` com o Bearer da sessão. Os anexos ficam no Storage (`task-anexos`, privado,
  servido por `/api/anexo`; `avatars`, público). A tabela-sinal `realtime_ping` avisa o
  navegador quando algo muda e ele refaz o bootstrap.
- **Modo demo** (sem as variáveis): tudo no navegador com **dados de exemplo**
  ([`lib/seed.ts`](lib/seed.ts)) persistidos no `localStorage`; senha de todos `123456`
  (ju@, marina@, carlos@, ana@, pedro@ `jubudelon.com.br`). Em **Configurações → Empresa**
  há um botão para restaurar o cenário inicial.

Banco: projeto Supabase `pqcbenrlejgtpsfqukcr` (sa-east-1). O schema está em
[`supabase/migrations/`](supabase/migrations/) (tabelas `workspace`, `usuarios`,
`cargo_acesso`, `cargo_permissao`, `grupo_interno`, `tarefas`, `unidade`, `vaga`, `talento`,
`realtime_ping`; RLS ligado sem policies — só o servidor acessa, com a service role). A migration
0005 adiciona as colunas da análise por IA em `talento` (`resumo`, `analise`, `nota_ia`,
`qualidade_ia`, `analisado_em`, `analise_erro`) e `requisitos`/`diferenciais` em `vaga`; a 0006
cria `agente_ia` (token do OpenRouter, modelo, motor de PDF, prompt e ferramentas do agente); a
0007 adiciona `uazapi_url`/`uazapi_token` em `agente_ia` e cria `whatsapp_grupos`.
Pessoas entram por **Configurações → Pessoas**, que cria o login no Auth e a linha em `usuarios`
(o e-mail é o vínculo entre os dois).

Toda escrita passa por [`components/store.tsx`](components/store.tsx): a UI é otimista e a
persistência acontece em segundo plano; se o servidor recusar, o app refaz o bootstrap.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # e preencha SUPABASE_SERVICE_ROLE_KEY (ou deixe vazio p/ modo demo)
npm run dev -- -p 3100       # http://localhost:3100
# produção:
npm run build && npm run start
```

## Estrutura

```
app/            # Next.js App Router
components/     # Dashboard (gate de login), Sidebar, Topbar, store (estado + "banco"), screens/, modals/, ui/
lib/            # types, theme (cores), seed (dados de exemplo), acesso (cargos/permissões), format, css()
```

A UI usa o helper [`css()`](lib/css.ts) (strings CSS → objetos de estilo React) e o componente
`Hoverable` para os estados de hover, como no sistema original.
