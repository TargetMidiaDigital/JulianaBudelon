-- Cargos novos (13/10/2026): Administrador · Gerente · Produção · Expedição · Líder (Loja) ·
-- Recursos Humanos. Os antigos são RENOMEADOS (usuários, acessos salvos e escopo vão junto):
--   Head Operacional → Gerente · Operacional → Expedição · Recrutamento → Recursos Humanos
-- (a matriz salva de "Operacional" já era a de expedição: edita Expedição/Estoque, vê OS/Produção).
alter type cargo_usuario rename value 'Head Operacional' to 'Gerente';
alter type cargo_usuario rename value 'Operacional' to 'Expedição';
alter type cargo_usuario rename value 'Recrutamento' to 'Recursos Humanos';
alter type cargo_usuario add value if not exists 'Produção';
alter type cargo_usuario add value if not exists 'Líder (Loja)';

-- Grupos internos guardam os cargos como texto (jsonb): renomeia lá também.
update grupo_interno set visivel_cargos = (
  select coalesce(jsonb_agg(case c when 'Head Operacional' then 'Gerente' when 'Operacional' then 'Expedição' when 'Recrutamento' then 'Recursos Humanos' else c end), '[]'::jsonb)
  from jsonb_array_elements_text(visivel_cargos) as c
);
