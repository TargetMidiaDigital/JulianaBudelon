-- Quais grupos de WhatsApp (ids de whatsapp_grupos) recebem o aviso de currículo novo.
-- Vazio = nenhum aviso sai (a tela avisa). Escolhido em Recrutamento → Agente IA → Ferramentas.
alter table agente_ia add column if not exists notificar_grupos text[] not null default '{}';
