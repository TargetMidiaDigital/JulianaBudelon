-- Histórico do produto: log de quem alterou o quê (nome, categoria, quantidade por local),
-- no mesmo formato dos comentários de tarefa ([{ id, message, author, created_at, tipo:"log" }]).
-- Autor "sistema" fica reservado para alterações automáticas.
alter table produto add column if not exists historico jsonb not null default '[]'::jsonb;
