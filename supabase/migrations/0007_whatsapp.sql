-- WhatsApp (Uazapi) — mesmo desenho do CRM do Cachorrão HD.
--
-- 1) Credenciais da instância Uazapi (URL + token) ficam na linha do agente, como lá
--    (o Cachorrão guarda na linha do agente de atendimento; aqui só existe o de
--    recrutamento). O token nunca volta ao navegador — /api/whatsapp/config devolve só
--    a URL e "configurado".
alter table agente_ia
  add column if not exists uazapi_url   text,
  add column if not exists uazapi_token text;

-- 2) Grupos de WhatsApp que recebem as notificações automáticas (Configurações → WhatsApp).
--    `grupo_id` é o JID do grupo ("120363...@g.us") — é para ele que a Uazapi envia.
--    `ativo` é o interruptor geral; `setores` diz DE QUE assunto o grupo quer ser avisado
--    (hoje só 'recrutamento': candidatura nova pela página de vagas).
create table if not exists whatsapp_grupos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  grupo_id    text not null unique,
  ativo       boolean not null default true,
  setores     text[] not null default array['recrutamento'],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint whatsapp_grupos_setores_nao_vazio check (array_length(setores, 1) >= 1)
);
create index if not exists whatsapp_grupos_setores_idx on whatsapp_grupos using gin (setores);

-- RLS ligada SEM policy (padrão deste projeto): destino das notificações internas não é
-- legível pelo anon. Todo acesso passa por /api/whatsapp/grupos com a service role.
alter table whatsapp_grupos enable row level security;

drop trigger if exists trg_whatsapp_grupos_updated_at on whatsapp_grupos;
create trigger trg_whatsapp_grupos_updated_at before update on whatsapp_grupos for each row execute function public.set_updated_at();
