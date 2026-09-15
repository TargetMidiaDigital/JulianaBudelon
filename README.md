# Gestão · Ju Budelon

Painel de gestão interno da **Ju Budelon**, derivado do sistema da Target Mídia Digital
(mesma base de UI/UX em **Next.js + React + TypeScript**), com um recorte menor de funções.

## Telas (fase 1)

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

## Dados (sem backend nesta fase)

Não há Supabase ainda. Tudo roda no navegador com **dados de exemplo** ([`lib/seed.ts`](lib/seed.ts)),
persistidos no `localStorage` para as edições sobreviverem ao reload. Em
**Configurações → Empresa** há um botão para restaurar o cenário inicial.

Usuários de demonstração (senha de todos: `123456`):

| E-mail                      | Cargo            |
| --------------------------- | ---------------- |
| ju@jubudelon.com.br         | Administrador    |
| marina@jubudelon.com.br     | Head Operacional |
| carlos@jubudelon.com.br     | Operacional      |
| ana@jubudelon.com.br        | Operacional      |
| pedro@jubudelon.com.br      | Recrutamento     |

Toda escrita passa por [`components/store.tsx`](components/store.tsx); ligar o banco depois
é trocar as funções de escrita ali — as telas não mudam.

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:3000
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
