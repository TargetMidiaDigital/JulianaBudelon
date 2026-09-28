-- Agentes de IA — mesmo desenho do CRM do Cachorrão HD: uma tabela `agente_ia`, uma linha
-- por agente (slug), com o token do OpenRouter, o modelo, o motor de leitura de PDF, o
-- prompt editável e os interruptores das automações (`ferramentas`).
--
-- Aqui só existe o agente de RECRUTAMENTO: lê o currículo, resume e classifica para a vaga.
-- Ele não conversa com ninguém — por isso não há colunas de WhatsApp/horários.
--
-- RLS ligado sem policies (padrão deste projeto): só o servidor acessa, com a service role.
-- O token nunca é devolvido ao navegador (/api/agente/config devolve só "configurado").

create table if not exists agente_ia (
  slug              text primary key,          -- 'recrutamento'
  nome              text not null,
  prompt            text,                      -- instruções editáveis (vazio → padrão do código)
  openrouter_token  text,                      -- chave da conta OpenRouter (write-only p/ o navegador)
  openrouter_modelo text,                      -- ex.: google/gemini-2.5-flash
  pdf_engine        text,                      -- native | mistral-ocr | cloudflare-ai
  ferramentas       jsonb not null default '{}'::jsonb,  -- { analisar_curriculo: true/false, ... }
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table agente_ia enable row level security;

drop trigger if exists trg_agente_ia_updated_at on agente_ia;
create trigger trg_agente_ia_updated_at before update on agente_ia for each row execute function public.set_updated_at();

insert into agente_ia (slug, nome, openrouter_modelo, pdf_engine, ferramentas)
values ('recrutamento', 'RECRUTAMENTO', 'google/gemini-2.5-flash', 'native', '{}'::jsonb)
on conflict (slug) do nothing;
