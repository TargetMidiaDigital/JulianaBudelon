# Gestão · Ju Budelon

Painel de gestão interno da **Ju Budelon**, derivado do sistema da Target Mídia Digital
(mesma base de UI/UX em **Next.js + React + TypeScript**), com um recorte menor de funções.

## Telas

- **Operacional → Tarefas** — lista agrupável (status / responsável / prioridade / vencimento / tipo)
  e quadro kanban; edição inline de título, cliente, responsável, prioridade, status e vencimento;
  seleção múltipla com ações em lote; descrição rica e comentários com imagem/vídeo/anexo;
  recorrências (diária / semanal / mensal); link compartilhável `?tarefa=<id>`.
- **Recrutamento → Banco de Talentos** — quadro por etapa e lista ordenável; detalhe do candidato
  com status, vaga, qualidade, WhatsApp, currículo/anexos e comentários; cadastro de novo candidato.
- **Recrutamento → Vagas** — cadastro de unidades e de vagas (sempre vinculadas a uma unidade), com
  status Ativa/Pausada, contagem de candidatos e os textos da página pública.
- **Página pública `/vagas`** (link na bio, no desenho do linkbio do Cachorrão HD) — hub com um botão
  por unidade → `/vagas/<unidade>` com um botão por vaga → popup nome / WhatsApp / currículo →
  `/vagas/obrigado`. A candidatura entra no Banco de Talentos com status "Novo". O Pixel do Facebook é
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
  navegador quando algo muda e ele refaz o bootstrap. As tarefas recorrentes são geradas
  pelo cron do Vercel ([`vercel.json`](vercel.json), `CRON_SECRET`) e também ao abrir o app.
- **Modo demo** (sem as variáveis): tudo no navegador com **dados de exemplo**
  ([`lib/seed.ts`](lib/seed.ts)) persistidos no `localStorage`; senha de todos `123456`
  (ju@, marina@, carlos@, ana@, pedro@ `jubudelon.com.br`). Em **Configurações → Empresa**
  há um botão para restaurar o cenário inicial.

Banco: projeto Supabase `pqcbenrlejgtpsfqukcr` (sa-east-1). O schema está em
[`supabase/migrations/`](supabase/migrations/) (tabelas `workspace`, `usuarios`,
`cargo_acesso`, `cargo_permissao`, `grupo_interno`, `tarefas`, `unidade`, `vaga`, `talento`,
`realtime_ping`; RLS ligado sem policies — só o servidor acessa, com a service role).
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
