-- Catálogo de Natal 2026 (PDF "CATALOGO-NATAL2026-JB") no autoatendimento de Encomendas.
--  * 6 categorias no começo do catálogo (Cheesecakes, Sobremesas, Cake Box Especial Fatias, Cake Box,
--    Chocotones, Empadões); "Camadas de Felicidade" passa para o fim.
--  * 48 produtos com preço, peso, rendimento, descrição e foto (public/encomendas/natal/).
--  * Um item no Estoque (categoria "Encomendas") por produto, ligado pelo produto_estoque_id:
--    produção soma na Fábrica → loja recebe → "Entregue" dá baixa.
-- Idempotente (on conflict do nothing): não sobrescreve o que já foi editado na tela. Depende da 0026 (colunas da vitrine).

insert into enc_categoria (id, nome, descricao, destaque, ordem) values
  ('natal-cheesecakes', 'Cheesecakes', 'Servem de 15 a 20 fatias', true, 0),
  ('natal-sobremesas', 'Sobremesas', 'Para a mesa da ceia', false, 1),
  ('natal-cake-box-especial', 'Cake Box Especial Fatias', 'As maiores, para a família toda', false, 2),
  ('natal-cake-box', 'Cake Box', 'Tortas de 1,2 a 1,3 kg', false, 3),
  ('natal-chocotones', 'Chocotones', 'Recheados e finalizados', false, 4),
  ('natal-empadoes', 'Empadões', 'Vendidos congelados · 4 a 6 porções', false, 5)
on conflict (id) do nothing;
update enc_categoria set ordem = 6 where id = 'camadas-de-felicidade';

insert into produto (id, nome, categoria) values
  ('p-encomendas-natal-cheesecake-pistache', 'Cheesecake Pistache (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cheesecake-frutas-vermelhas', 'Cheesecake Frutas Vermelhas (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-bolo-piscina-red-velvet', 'Bolo Piscina Red Velvet (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-folhata-de-morango', 'Sobremesa Folhata de Morango (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-bombom-de-uva', 'Sobremesa Bombom de Uva (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-pavetonne', 'Sobremesa Pavetonne (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-raffaello', 'Sobremesa Raffaello (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-morango-com-suspiro', 'Sobremesa Morango com Suspiro (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-ferrero', 'Sobremesa Ferrero (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-mineira', 'Sobremesa Mineira (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-quatro-leites', 'Sobremesa Quatro Leites (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-kinder', 'Sobremesa Kinder (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-banoffee', 'Sobremesa Banoffee (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-red-velvet', 'Sobremesa Red Velvet (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-bombom-de-morango', 'Sobremesa Bombom de Morango (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-morango-com-nata', 'Sobremesa Morango com Nata (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-pave-de-nozes', 'Sobremesa Pavê de Nozes (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-sobremesa-bueno', 'Sobremesa Bueno (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-especial-morango-com-nata', 'Cake Box Especial Morango com Nata (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-especial-pistache-nuvem', 'Cake Box Especial Pistache Nuvem (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-especial-morango-cravejado', 'Cake Box Especial Morango Cravejado (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-especial-bem-casado', 'Cake Box Especial Bem Casado (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-especial-pudim', 'Cake Box Especial Pudim (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-especial-marta-rocha', 'Cake Box Especial Marta Rocha (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-especial-mineira', 'Cake Box Especial Mineira (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-especial-pistache-chocolate', 'Cake Box Especial Pistache Chocolate (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-morango-cravejado', 'Cake Box Morango Cravejado (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-bem-casado', 'Cake Box Bem Casado (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-pudim', 'Cake Box Pudim (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-pavetonne', 'Cake Box Pavêtonne (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-duo-chocolates', 'Cake Box Duo Chocolates (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-pistache-nuvem', 'Cake Box Pistache Nuvem (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-banoffee', 'Cake Box Banoffee (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-pistache-chocolate', 'Cake Box Pistache Chocolate (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-morango', 'Cake Box Morango (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-mineira', 'Cake Box Mineira (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-prestigio', 'Cake Box Prestígio (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-cakebox-marta-rocha', 'Cake Box Marta Rocha (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-chocotone-pistache', 'Chocotone de Pistache (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-chocotone-kinder-mix', 'Chocotone de Kinder Mix (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-chocotone-nutellinho', 'Chocotone de Nutellinho (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-empadao-camarao-com-requeijao', 'Empadão de Camarão com Requeijão (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-empadao-file-quatro-queijos', 'Empadão de Filé Quatro Queijos (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-empadao-frango-com-requeijao', 'Empadão de Frango com Requeijão (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-empadao-frango-sem-requeijao', 'Empadão de Frango sem Requeijão (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-empadao-frango-com-palmito', 'Empadão de Frango com Palmito (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-empadao-palmito-cremoso', 'Empadão de Palmito Cremoso (encomenda)', 'Encomendas'),
  ('p-encomendas-natal-empadao-carne-de-panela-com-requeijao', 'Empadão de Carne de Panela com Requeijão (encomenda)', 'Encomendas')
on conflict (id) do nothing;

-- Produtos do Natal antes das tortas Camadas de Felicidade (ordem 100+ deixa espaço para elas).
insert into enc_produto (id, nome, categoria_id, preco, porcoes, peso, descricao, camadas, foto, ativo, produto_estoque_id, ordem) values
  ('natal-cheesecake-pistache', 'Cheesecake Pistache', 'natal-cheesecakes', 230, '15 a 20 fatias', '2,3 kg', 'Massa amanteigada por fora
Massa de cream cheese por dentro
Creme de chocolate branco
Creme de pistache JB
Pistaches picados', '[]'::jsonb, '/encomendas/natal/cheesecake-pistache.webp', true, 'p-encomendas-natal-cheesecake-pistache', 0),
  ('natal-cheesecake-frutas-vermelhas', 'Cheesecake Frutas Vermelhas', 'natal-cheesecakes', 230, '15 a 20 fatias', '2,3 kg', 'Massa amanteigada por fora
Massa de cream cheese por dentro
Creme de chocolate branco
Geleia de frutas vermelhas
Frutas frescas', '[]'::jsonb, '/encomendas/natal/cheesecake-frutas-vermelhas.webp', true, 'p-encomendas-natal-cheesecake-frutas-vermelhas', 1),
  ('natal-bolo-piscina-red-velvet', 'Bolo Piscina Red Velvet', 'natal-cheesecakes', 190, '15 a 20 fatias', '2 kg', 'Massa Red Velvet fofinha
Creme de cream cheese com chocolate branco
Finalizado com frutas vermelhas', '[]'::jsonb, '/encomendas/natal/bolo-piscina-red-velvet.webp', true, 'p-encomendas-natal-bolo-piscina-red-velvet', 2),
  ('natal-sobremesa-folhata-de-morango', 'Folhata de Morango', 'natal-sobremesas', 129, '', '800 g', 'Creme de cinco leites
Biscoito folhado crocante
Morangos frescos', '[]'::jsonb, '/encomendas/natal/sobremesa-folhata-de-morango.webp', true, 'p-encomendas-natal-sobremesa-folhata-de-morango', 3),
  ('natal-sobremesa-bombom-de-uva', 'Bombom de Uva', 'natal-sobremesas', 110, '', '1 kg', 'Creme belga
Uvas sem sementes
Finalizado com ganache meio amarga, uvas e raspas de chocolate branco', '[]'::jsonb, '/encomendas/natal/sobremesa-bombom-de-uva.webp', true, 'p-encomendas-natal-sobremesa-bombom-de-uva', 4),
  ('natal-sobremesa-pavetonne', 'Pavetonne', 'natal-sobremesas', 129, '', '900 g', 'Creme de Ninho
Pedaços de chocotone
Creme de três leites
Finalizado com nuvem de Nutella e barrinhas de Kinder', '[]'::jsonb, '/encomendas/natal/sobremesa-pavetonne.webp', true, 'p-encomendas-natal-sobremesa-pavetonne', 5),
  ('natal-sobremesa-raffaello', 'Raffaello', 'natal-sobremesas', 125, '', '900 g', 'Creme de Raffaello com chocolate branco, amêndoas e coco
Massa branca
Mousse de Raffaello com pedaços de bombom e coco
Finalizado com bombons Raffaello', '[]'::jsonb, '/encomendas/natal/sobremesa-raffaello.webp', true, 'p-encomendas-natal-sobremesa-raffaello', 6),
  ('natal-sobremesa-morango-com-suspiro', 'Morango com Suspiro', 'natal-sobremesas', 110, '', '900 g', 'Creme belga
Massa branca fofinha
Morangos picados
Buttercreme
Finalizado com suspiros e morangos', '[]'::jsonb, '/encomendas/natal/sobremesa-morango-com-suspiro.webp', true, 'p-encomendas-natal-sobremesa-morango-com-suspiro', 7),
  ('natal-sobremesa-ferrero', 'Ferrero', 'natal-sobremesas', 129, '', '900 g', 'Mousse de Ferrero meio amargo
Pedaços de Ferrero
Massa de chocolate fofinha
Creme de avelã crocante com amendoim
Finalizado com avelãs e Ferrero', '[]'::jsonb, '/encomendas/natal/sobremesa-ferrero.webp', true, 'p-encomendas-natal-sobremesa-ferrero', 8),
  ('natal-sobremesa-mineira', 'Mineira', 'natal-sobremesas', 105, '', '900 g', 'Creme de abacaxi com coco fresco
Massa branca fofinha
Finalizado com buttercreme, abacaxi e coco em flocos', '[]'::jsonb, '/encomendas/natal/sobremesa-mineira.webp', true, 'p-encomendas-natal-sobremesa-mineira', 9),
  ('natal-sobremesa-quatro-leites', 'Quatro Leites', 'natal-sobremesas', 100, '', '900 g', 'Creme de quatro leites
Massa branca fofinha
Finalizado com raspas de chocolate branco', '[]'::jsonb, '/encomendas/natal/sobremesa-quatro-leites.webp', true, 'p-encomendas-natal-sobremesa-quatro-leites', 10),
  ('natal-sobremesa-kinder', 'Kinder', 'natal-sobremesas', 129, '', '900 g', 'Creme de chocolate blend
Massa de chocolate
Creme de chocolate branco
Camadas de Kinder Barrinha
Finalizado com ganache de chocolate ao leite e Kinder Barrinha', '[]'::jsonb, '/encomendas/natal/sobremesa-kinder.webp', true, 'p-encomendas-natal-sobremesa-kinder', 11),
  ('natal-sobremesa-banoffee', 'Banoffee', 'natal-sobremesas', 110, '', '900 g', 'Farofa amanteigada crocante
Creme de doce de leite
Rodelas de banana
Finalizado com buttercreme e farofa amanteigada', '[]'::jsonb, '/encomendas/natal/sobremesa-banoffee.webp', true, 'p-encomendas-natal-sobremesa-banoffee', 12),
  ('natal-sobremesa-red-velvet', 'Red Velvet', 'natal-sobremesas', 110, '', '900 g', 'Creme de cream cheese com chocolate branco
Camadas de massa Red Velvet fofinha
Finalizado com morangos e mirtilos', '[]'::jsonb, '/encomendas/natal/sobremesa-red-velvet.webp', true, 'p-encomendas-natal-sobremesa-red-velvet', 13),
  ('natal-sobremesa-bombom-de-morango', 'Bombom de Morango', 'natal-sobremesas', 110, '', '1 kg', 'Creme belga
Massa de chocolate fofinha
Morangos picados
Ganache cremosa meio amarga
Finalizado com flocos de chocolate e morangos', '[]'::jsonb, '/encomendas/natal/sobremesa-bombom-de-morango.webp', true, 'p-encomendas-natal-sobremesa-bombom-de-morango', 14),
  ('natal-sobremesa-morango-com-nata', 'Morango com Nata', 'natal-sobremesas', 110, '', '900 g', 'Creme belga
Massa branca fofinha
Morangos picados
Buttercreme
Finalizado com suspiros e morangos', '[]'::jsonb, '/encomendas/natal/sobremesa-morango-com-nata.webp', true, 'p-encomendas-natal-sobremesa-morango-com-nata', 15),
  ('natal-sobremesa-pave-de-nozes', 'Pavê de Nozes', 'natal-sobremesas', 110, '', '900 g', 'Creme de nata com nozes
Bolacha de leite
Creme de doce de leite
Finalizado com nozes picadas', '[]'::jsonb, '/encomendas/natal/sobremesa-pave-de-nozes.webp', true, 'p-encomendas-natal-sobremesa-pave-de-nozes', 16),
  ('natal-sobremesa-bueno', 'Bueno', 'natal-sobremesas', 129, '', '900 g', 'Ganache meio amargo
Mousse de Bueno White
Finalizado com pedaços de Bueno White', '[]'::jsonb, '/encomendas/natal/sobremesa-bueno.webp', true, 'p-encomendas-natal-sobremesa-bueno', 17),
  ('natal-especial-morango-com-nata', 'Cake Box Especial Morango com Nata', 'natal-cake-box-especial', 359.9, '', '2,3 kg', 'Creme belga
Pão de ló
Morangos frescos
Buttercreme
Suspiros
Finalizado com morangos frescos e suspiros', '[]'::jsonb, '/encomendas/natal/especial-morango-com-nata.webp', true, 'p-encomendas-natal-especial-morango-com-nata', 18),
  ('natal-especial-pistache-nuvem', 'Cake Box Especial Pistache Nuvem', 'natal-cake-box-especial', 359.9, '', '2,35 kg', 'Massa branca
Creme de pistache
Creme belga
Creme nuvem de pistache
Finalizado com creme nuvem de pistache e pistache triturado', '[]'::jsonb, '/encomendas/natal/especial-pistache-nuvem.webp', true, 'p-encomendas-natal-especial-pistache-nuvem', 19),
  ('natal-especial-morango-cravejado', 'Cake Box Especial Morango Cravejado', 'natal-cake-box-especial', 369.6, '', '2,5 kg', 'Massa branca
Creme belga
Morangos frescos
Buttercreme
Cobertura cravejada
Finalizado com 8 mini morangos cravejados', '[]'::jsonb, '/encomendas/natal/especial-morango-cravejado.webp', true, 'p-encomendas-natal-especial-morango-cravejado', 20),
  ('natal-especial-bem-casado', 'Cake Box Especial Bem Casado', 'natal-cake-box-especial', 359.9, '', '2,3 kg', 'Massa branca
Creme de Ninho
Creme de doce de leite
Finalizado com 11 brigadeiros de Ninho', '[]'::jsonb, '/encomendas/natal/especial-bem-casado.webp', true, 'p-encomendas-natal-especial-bem-casado', 21),
  ('natal-especial-pudim', 'Cake Box Especial Pudim', 'natal-cake-box-especial', 359.9, '', '2,3 kg', 'Creme belga
Pão de ló
Creme de doce de leite
Pudim de leite
Finalizado com 5 mini pudins', '[]'::jsonb, '/encomendas/natal/especial-pudim.webp', true, 'p-encomendas-natal-especial-pudim', 22),
  ('natal-especial-marta-rocha', 'Cake Box Especial Marta Rocha', 'natal-cake-box-especial', 359.9, '', '2,5 kg', 'Pão de ló branco
Pão de ló de chocolate
Creme de nozes
Creme de ameixa
Finalizado com creme de ovos', '[]'::jsonb, '/encomendas/natal/especial-marta-rocha.webp', true, 'p-encomendas-natal-especial-marta-rocha', 23),
  ('natal-especial-mineira', 'Cake Box Especial Mineira', 'natal-cake-box-especial', 359.9, '', '2,5 kg', 'Pão de ló
Creme belga com abacaxi e coco
Buttercreme
Finalizado com pedaços de abacaxi e coco em flocos', '[]'::jsonb, '/encomendas/natal/especial-mineira.webp', true, 'p-encomendas-natal-especial-mineira', 24),
  ('natal-especial-pistache-chocolate', 'Cake Box Especial Pistache Chocolate', 'natal-cake-box-especial', 359.9, '', '2,5 kg', 'Pão de ló de chocolate
Creme de chocolate
Creme de pistache
Finalizado com pistache', '[]'::jsonb, '/encomendas/natal/especial-pistache-chocolate.webp', true, 'p-encomendas-natal-especial-pistache-chocolate', 25),
  ('natal-cakebox-morango-cravejado', 'Cake Box Morango Cravejado', 'natal-cake-box', 179.9, '', '1,3 kg', 'Massa branca
Creme belga
Morangos frescos e buttercreme
Com cobertura cravejada
Finalizado com 5 mini morangos cravejados', '[]'::jsonb, '/encomendas/natal/cakebox-morango-cravejado.webp', true, 'p-encomendas-natal-cakebox-morango-cravejado', 26),
  ('natal-cakebox-bem-casado', 'Cake Box Bem Casado', 'natal-cake-box', 169.9, '', '1,3 kg', 'Creme de Ninho
Massa de bolo fofinha
Creme de doce de leite caseiro
Finalizado com 5 mini brigadeiros de Ninho', '[]'::jsonb, '/encomendas/natal/cakebox-bem-casado.webp', true, 'p-encomendas-natal-cakebox-bem-casado', 27),
  ('natal-cakebox-pudim', 'Cake Box Pudim', 'natal-cake-box', 169.9, '', '1,2 kg', 'Camadas de creme
Pão de ló
Creme de doce de leite
Pudim de leite
Finalizado com 2 mini pudins', '[]'::jsonb, '/encomendas/natal/cakebox-pudim.webp', true, 'p-encomendas-natal-cakebox-pudim', 28),
  ('natal-cakebox-pavetonne', 'Cake Box Pavêtonne', 'natal-cake-box', 169.9, '', '1,3 kg', 'Creme de Ninho
Pedaços de chocotone
Creme de três leites
Finalizado com nuvem de Nutella e barrinhas de Kinder', '[]'::jsonb, '/encomendas/natal/cakebox-pavetonne.webp', true, 'p-encomendas-natal-cakebox-pavetonne', 29),
  ('natal-cakebox-duo-chocolates', 'Cake Box Duo Chocolates', 'natal-cake-box', 159.9, '', '1,3 kg', 'Creme belga branco
Massa de chocolate fofinha
Creme belga de chocolate
Finalizado com brigadeiros brancos e tradicionais', '[]'::jsonb, '/encomendas/natal/cakebox-duo-chocolates.webp', true, 'p-encomendas-natal-cakebox-duo-chocolates', 30),
  ('natal-cakebox-pistache-nuvem', 'Cake Box Pistache Nuvem', 'natal-cake-box', 169.9, '', '1,3 kg', 'Massa branca
Creme de pistache
Creme belga
Creme nuvem de pistache
Finalizado com creme nuvem de pistache e pistache triturado', '[]'::jsonb, '/encomendas/natal/cakebox-pistache-nuvem.webp', true, 'p-encomendas-natal-cakebox-pistache-nuvem', 31),
  ('natal-cakebox-banoffee', 'Cake Box Banoffee', 'natal-cake-box', 169.9, '', '1,3 kg', 'Farofa amanteigada
Creme de doce de leite caseiro
Bananas em rodelas
Buttercreme', '[]'::jsonb, '/encomendas/natal/cakebox-banoffee.webp', true, 'p-encomendas-natal-cakebox-banoffee', 32),
  ('natal-cakebox-pistache-chocolate', 'Cake Box Pistache Chocolate', 'natal-cake-box', 169.9, '', '1,3 kg', 'Creme de chocolate
Massa de chocolate molhadinha
Creme de pistache
Finalizado com pistache picado', '[]'::jsonb, '/encomendas/natal/cakebox-pistache-chocolate.webp', true, 'p-encomendas-natal-cakebox-pistache-chocolate', 33),
  ('natal-cakebox-morango', 'Cake Box Morango', 'natal-cake-box', 159.9, '', '1,2 kg', 'Creme belga
Pão de ló
Morangos frescos
Buttercreme
Suspiros
Finalizado com buttercreme e suspiros', '[]'::jsonb, '/encomendas/natal/cakebox-morango.webp', true, 'p-encomendas-natal-cakebox-morango', 34),
  ('natal-cakebox-mineira', 'Cake Box Mineira', 'natal-cake-box', 159.9, '', '1,3 kg', 'Creme belga com abacaxi e coco fresco
Pão de ló
Buttercreme
Finalizado com buttercreme, abacaxi e coco em flocos', '[]'::jsonb, '/encomendas/natal/cakebox-mineira.webp', true, 'p-encomendas-natal-cakebox-mineira', 35),
  ('natal-cakebox-prestigio', 'Cake Box Prestígio', 'natal-cake-box', 169.9, '', '1,3 kg', 'Massa de chocolate fofinha
Creme de coco fresco
Creme de chocolate
Finalizado com coco e chocolate Prestígio', '[]'::jsonb, '/encomendas/natal/cakebox-prestigio.webp', true, 'p-encomendas-natal-cakebox-prestigio', 36),
  ('natal-cakebox-marta-rocha', 'Cake Box Marta Rocha', 'natal-cake-box', 169.9, '', '1,3 kg', 'Camadas de pão de ló branco e de chocolate
Creme de nozes
Creme de ameixa
Finalizado com creme de ovos', '[]'::jsonb, '/encomendas/natal/cakebox-marta-rocha.webp', true, 'p-encomendas-natal-cakebox-marta-rocha', 37),
  ('natal-chocotone-pistache', 'Chocotone de Pistache', 'natal-chocotones', 129.9, '', '800 g', 'Chocotone recheado com creme de chocolate branco
Creme de pistache
Finalizado com creme de pistache e pistache picado', '[]'::jsonb, '/encomendas/natal/chocotone-pistache.webp', true, 'p-encomendas-natal-chocotone-pistache', 38),
  ('natal-chocotone-kinder-mix', 'Chocotone de Kinder Mix', 'natal-chocotones', 139.9, '', '900 g', 'Chocotone recheado com creme de chocolate branco
Creme de chocolate blend
Creme belga
Finalizado com Kinder Bueno White, Kinder Bueno Black, Kinder Ovo, Kinder Barrinha e brigadeiros', '[]'::jsonb, '/encomendas/natal/chocotone-kinder-mix.webp', true, 'p-encomendas-natal-chocotone-kinder-mix', 39),
  ('natal-chocotone-nutellinho', 'Chocotone de Nutellinho', 'natal-chocotones', 129.9, '', '900 g', 'Chocotone recheado com creme de Ninho
Finalizado com creme belga, Ninho e um pote de Nutella de 140 g', '[]'::jsonb, '/encomendas/natal/chocotone-nutellinho.webp', true, 'p-encomendas-natal-chocotone-nutellinho', 40),
  ('natal-empadao-camarao-com-requeijao', 'Empadão de Camarão com Requeijão', 'natal-empadoes', 105, '4 a 6 porções', '1 kg', 'Produto vendido somente congelado
Peso aproximado de 1 kg
Verificar disponibilidade do sabor', '[]'::jsonb, '/encomendas/natal/empadao.webp', true, 'p-encomendas-natal-empadao-camarao-com-requeijao', 41),
  ('natal-empadao-file-quatro-queijos', 'Empadão de Filé Quatro Queijos', 'natal-empadoes', 100, '4 a 6 porções', '1 kg', 'Produto vendido somente congelado
Peso aproximado de 1 kg
Verificar disponibilidade do sabor', '[]'::jsonb, '/encomendas/natal/empadao.webp', true, 'p-encomendas-natal-empadao-file-quatro-queijos', 42),
  ('natal-empadao-frango-com-requeijao', 'Empadão de Frango com Requeijão', 'natal-empadoes', 90, '4 a 6 porções', '1 kg', 'Produto vendido somente congelado
Peso aproximado de 1 kg
Verificar disponibilidade do sabor', '[]'::jsonb, '/encomendas/natal/empadao.webp', true, 'p-encomendas-natal-empadao-frango-com-requeijao', 43),
  ('natal-empadao-frango-sem-requeijao', 'Empadão de Frango sem Requeijão', 'natal-empadoes', 90, '4 a 6 porções', '1 kg', 'Produto vendido somente congelado
Peso aproximado de 1 kg
Verificar disponibilidade do sabor', '[]'::jsonb, '/encomendas/natal/empadao.webp', true, 'p-encomendas-natal-empadao-frango-sem-requeijao', 44),
  ('natal-empadao-frango-com-palmito', 'Empadão de Frango com Palmito', 'natal-empadoes', 90, '4 a 6 porções', '1 kg', 'Produto vendido somente congelado
Peso aproximado de 1 kg
Verificar disponibilidade do sabor', '[]'::jsonb, '/encomendas/natal/empadao.webp', true, 'p-encomendas-natal-empadao-frango-com-palmito', 45),
  ('natal-empadao-palmito-cremoso', 'Empadão de Palmito Cremoso', 'natal-empadoes', 90, '4 a 6 porções', '1 kg', 'Produto vendido somente congelado
Peso aproximado de 1 kg
Verificar disponibilidade do sabor', '[]'::jsonb, '/encomendas/natal/empadao.webp', true, 'p-encomendas-natal-empadao-palmito-cremoso', 46),
  ('natal-empadao-carne-de-panela-com-requeijao', 'Empadão de Carne de Panela com Requeijão', 'natal-empadoes', 90, '4 a 6 porções', '1 kg', 'Produto vendido somente congelado
Peso aproximado de 1 kg
Verificar disponibilidade do sabor', '[]'::jsonb, '/encomendas/natal/empadao.webp', true, 'p-encomendas-natal-empadao-carne-de-panela-com-requeijao', 47)
on conflict (id) do nothing;
update enc_produto set ordem = ordem + 100 where categoria_id = 'camadas-de-felicidade' and ordem < 100;
