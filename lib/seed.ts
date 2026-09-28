import type { Client, GrupoInterno, LinkBioConfig, NivelAcesso, Sector, Talento, Task, TeamMember, Unidade, Vaga, Workspace } from "./types";
import { diasAPartirDeHoje, formatBR, TODAY } from "./format";
import { hojeSP, addDias, primeiraOcorrencia, proximaApos } from "./recorrencia";

/**
 * DADOS DE EXEMPLO (fase sem backend). Tudo aqui é fictício e serve para validar
 * as telas. As datas são geradas em relação a hoje, para a lista sempre ter
 * tarefas atrasadas, de hoje e futuras.
 */

export const spacesTree: Sector[] = [
  {
    id: "operacional",
    label: "Operacional",
    children: [
      { label: "Tarefas", page: "listaview" },
    ],
  },
  {
    id: "recrutamento",
    label: "Recrutamento",
    children: [
      { label: "Banco de Talentos", page: "recrutamento-talentos" },
      { label: "Vagas", page: "recrutamento-vagas" },
    ],
  },
];

export const seedWorkspace: Workspace = { nome: "Ju Budelon", logo: null };

export const seedTeam: TeamMember[] = [
  { id: "ju", nome: "Ju Budelon", cargo: "Administrador", ini: "JB", cor: "#955C6B", email: "ju@jubudelon.com.br", whatsapp: "5548999990001", ativo: true },
  { id: "marina", nome: "Marina Lopes", cargo: "Head Operacional", ini: "ML", cor: "#1B7F4D", email: "marina@jubudelon.com.br", whatsapp: "5548999990002", ativo: true },
  { id: "carlos", nome: "Carlos Andrade", cargo: "Operacional", ini: "CA", cor: "#1366A8", email: "carlos@jubudelon.com.br", whatsapp: "5548999990003", ativo: true },
  { id: "ana", nome: "Ana Beatriz", cargo: "Operacional", ini: "AB", cor: "#E5484D", email: "ana@jubudelon.com.br", whatsapp: "5548999990004", ativo: true },
  { id: "pedro", nome: "Pedro Nunes", cargo: "Recrutamento", ini: "PN", cor: "#C2410C", email: "pedro@jubudelon.com.br", whatsapp: "5548999990005", ativo: true },
  { id: "rafa", nome: "Rafaela Costa", cargo: "Operacional", ini: "RC", cor: "#0E9CC0", email: "rafaela@jubudelon.com.br", ativo: false },
];

/** Senha de todos os usuários de exemplo. */
export const SENHA_PADRAO = "123456";
export const seedSenhas: Record<string, string> = Object.fromEntries(seedTeam.map((t) => [t.id, SENHA_PADRAO]));

export const seedClients: Client[] = [
  { id: "clinica-vitalis", nome: "Clínica Vitalis", seg: "Saúde", gestor: "carlos", status: "ativo", cor: "#0E7490" },
  { id: "bella-moda", nome: "Bella Moda", seg: "Moda Feminina", gestor: "ana", status: "ativo", cor: "#BE185D" },
  { id: "casa-verde", nome: "Casa Verde Imóveis", seg: "Imobiliária", gestor: "carlos", status: "ativo", cor: "#15803D" },
  { id: "sabor-da-serra", nome: "Sabor da Serra", seg: "Restaurante", gestor: "ana", status: "ativo", cor: "#B45309" },
  { id: "studio-fit", nome: "Studio Fit", seg: "Academia", gestor: "marina", status: "ativo", cor: "#6D28D9" },
  { id: "auto-prime", nome: "Auto Prime", seg: "Automotivo", gestor: "carlos", status: "ativo", cor: "#1D4ED8" },
  { id: "doce-lar", nome: "Doce Lar Decor", seg: "Decoração", gestor: "ana", status: "pausado", cor: "#0D9488" },
  { id: "petshop-amigo", nome: "Petshop Amigo", seg: "Pet", gestor: "marina", status: "inativo", cor: "#9333EA" },
];

const iso = (diasAtras: number, hora = "10:00") => {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - diasAtras);
  const [h, m] = hora.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const seedTasks: Task[] = [
  {
    id: "t1", titulo: "Revisar campanha de agendamentos", gestor: "carlos", status: "atrasada", prio: "urgente", tipo: "Otimização", categoria: "operacional",
    criada: diasAPartirDeHoje(-6), criadaHora: "08:15", atualizada: diasAPartirDeHoje(-1), atualizadaHora: "17:40", venc: diasAPartirDeHoje(-2), vencHora: "18:00",
    desc: "<p>O custo por agendamento subiu 40% na última semana.</p><ul><li>Revisar públicos</li><li>Pausar criativos com CTR baixo</li><li>Testar novo texto de anúncio</li></ul>",
    comentarios: [
      { id: "c1", message: "Já pausei dois criativos, mas o custo continua alto. Vou testar um público novo amanhã.", html: "<p>Já pausei dois criativos, mas o custo continua alto. Vou testar um público novo amanhã.</p>", author: "carlos", created_at: iso(2, "16:20") },
      { id: "c2", message: "Marina Lopes mudou a prioridade para \"Urgente\"", author: "marina", created_at: iso(1, "09:05"), tipo: "log" },
    ],
  },
  { id: "t2", titulo: "Subir coleção de inverno nos anúncios", gestor: "ana", status: "atrasada", prio: "alta", tipo: "Criativo", categoria: "operacional", criada: diasAPartirDeHoje(-5), criadaHora: "09:40", venc: diasAPartirDeHoje(-1), vencHora: "12:00", desc: "<p>Cliente enviou 12 fotos novas. Montar 3 variações de carrossel.</p>" },
  { id: "t3", titulo: "Otimizar campanha de captação de leads", gestor: "carlos", status: "em andamento", prio: "alta", tipo: "Otimização", categoria: "operacional", criada: diasAPartirDeHoje(-3), criadaHora: "10:05", atualizada: diasAPartirDeHoje(0), atualizadaHora: "08:30", venc: diasAPartirDeHoje(1), vencHora: "18:00",
    comentarios: [{ id: "c3", message: "Formulário novo publicado, aguardando os primeiros leads.", html: "<p>Formulário novo publicado, aguardando os primeiros leads.</p>", author: "carlos", created_at: iso(0, "08:30") }] },
  { id: "t4", titulo: "Configurar cardápio no WhatsApp", gestor: "ana", status: "em andamento", prio: "normal", tipo: "Configuração", categoria: "operacional", criada: diasAPartirDeHoje(-4), criadaHora: "11:20", venc: diasAPartirDeHoje(2), vencHora: "18:00" },
  { id: "t5", titulo: "Montar relatório mensal", gestor: "marina", status: "em andamento", prio: "normal", tipo: "Relatório", categoria: "operacional", criada: diasAPartirDeHoje(-2), criadaHora: "13:35", venc: diasAPartirDeHoje(5), vencHora: "18:00", desc: "<p>Comparar com o mês anterior e destacar os 3 melhores anúncios.</p>" },
  { id: "t6", titulo: "Validar pixel de conversão", gestor: "carlos", status: "verificar", prio: "alta", tipo: "Configuração", categoria: "operacional", criada: diasAPartirDeHoje(-1), criadaHora: "14:10", venc: diasAPartirDeHoje(3), vencHora: "18:00" },
  { id: "t7", titulo: "Recarregar saldo da conta", gestor: "marina", status: "verificar", prio: "urgente", tipo: "Financeiro", categoria: "operacional", criada: diasAPartirDeHoje(0), criadaHora: "08:50", venc: diasAPartirDeHoje(0), vencHora: "18:00" },
  { id: "t8", titulo: "Ajustar criativos do feed", gestor: "ana", status: "verificar", prio: "normal", tipo: "Criativo", categoria: "operacional", criada: diasAPartirDeHoje(0), criadaHora: "09:15", venc: diasAPartirDeHoje(4), vencHora: "18:00" },
  { id: "t9", titulo: "Organizar pasta de referências", gestor: "ana", status: "verificar", prio: "baixa", tipo: "Interno", categoria: "operacional", criada: diasAPartirDeHoje(-1), criadaHora: "10:45", venc: diasAPartirDeHoje(7), vencHora: "18:00" },
  { id: "t10", titulo: "Alinhar retomada das campanhas", gestor: "ana", status: "verificar", prio: "baixa", tipo: "Reunião", categoria: "operacional", criada: diasAPartirDeHoje(-1), criadaHora: "11:55", venc: diasAPartirDeHoje(9), vencHora: "15:00" },
  { id: "t11", titulo: "Enviar relatório semanal", gestor: "carlos", status: "concluida", prio: "normal", tipo: "Relatório", categoria: "operacional", criada: diasAPartirDeHoje(-7), criadaHora: "13:05", atualizada: diasAPartirDeHoje(-3), atualizadaHora: "18:10", venc: diasAPartirDeHoje(-3), vencHora: "18:00",
    comentarios: [{ id: "c4", message: "Enviado por e-mail e no grupo do cliente.", html: "<p>Enviado por e-mail e no grupo do cliente.</p>", author: "carlos", created_at: iso(3, "18:10") }, { id: "c5", message: "Carlos Andrade mudou o status para \"Concluída\"", author: "carlos", created_at: iso(3, "18:11"), tipo: "log" }] },
  { id: "t12", titulo: "Trocar imagem da campanha de matrícula", gestor: "marina", status: "concluida", prio: "normal", tipo: "Criativo", categoria: "operacional", criada: diasAPartirDeHoje(-8), criadaHora: "14:40", venc: diasAPartirDeHoje(-4), vencHora: "18:00" },
  { id: "t13", titulo: "Revisar segmentação por região", gestor: "carlos", status: "validada", prio: "baixa", tipo: "Otimização", categoria: "operacional", criada: diasAPartirDeHoje(-12), criadaHora: "15:20", venc: diasAPartirDeHoje(-6), vencHora: "18:00",
    comentarios: [{ id: "c6", message: "Marina Lopes mudou o status para \"Validada\"", author: "marina", created_at: iso(5, "10:00"), tipo: "log" }] },
];

/** Tarefa recorrente de exemplo: relatório semanal toda segunda-feira. */
{
  const regra = { frequencia: "semanal", dia_semana: 1, dia_mes: null };
  const primeira = primeiraOcorrencia(hojeSP(), regra);
  seedTasks.push({
    id: "t14", titulo: "Relatório semanal de resultados", gestor: "ana", status: "verificar", prio: "normal", tipo: "Relatório", categoria: "operacional",
    criada: formatBR(TODAY), criadaHora: "09:00", venc: addDias(primeira, 1).split("-").reverse().join("/"), vencHora: "23:59",
    rec: { ativa: true, freq: "semanal", diaSemana: 1, prazoDias: 1, modo: "novo", proxima: proximaApos(primeira, regra) },
  });
}

export const seedUnidades: Unidade[] = [
  { id: "u-centro", slug: "florianopolis-centro", cidade: "Florianópolis", nome: "Centro", ativa: true, criada: iso(60) },
  { id: "u-kobrasol", slug: "sao-jose-kobrasol", cidade: "São José", nome: "Kobrasol", ativa: true, criada: iso(40) },
  { id: "u-palhoca", slug: "palhoca-pedra-branca", cidade: "Palhoça", nome: "Pedra Branca", ativa: false, criada: iso(20) },
];

/**
 * Catálogo de cargos da Ju Budelon: título + descrição, requisitos e diferenciais padrão.
 * É o que a IA compara com o currículo (Vagas → Nova vaga preenche a partir daqui; a
 * equipe pode ajustar por unidade).
 */
export type CargoCatalogo = { titulo: string; descricao: string; requisitos: string; diferenciais: string };
export const CATALOGO_VAGAS: CargoCatalogo[] = [
  {
    titulo: "Auxiliar de Cozinha/Confeitaria",
    descricao: "Apoio à produção de doces, bolos, salgados e pães na cozinha da unidade: pré-preparo, pesagem, montagem, finalização, organização e higienização da área.",
    requisitos: "Experiência em cozinha, confeitaria, padaria ou produção de alimentos\nDisponibilidade para o turno da vaga, inclusive fins de semana\nNoções de higiene e manipulação de alimentos\nAgilidade e trabalho em equipe",
    diferenciais: "Curso de manipulação de alimentos / boas práticas\nExperiência com confeitaria artesanal ou panificação\nMorar perto da unidade",
  },
  {
    titulo: "Auxiliar de Serviços Gerais (Limpeza)",
    descricao: "Limpeza e conservação da loja, cozinha, banheiros e áreas comuns; reposição de materiais; apoio à organização do estoque.",
    requisitos: "Experiência em limpeza (comércio, restaurante, hotelaria ou similar)\nDisponibilidade de horário, inclusive fins de semana\nOrganização e atenção a detalhes",
    diferenciais: "Conhecimento de produtos e rotinas de higienização em cozinha\nMorar perto da unidade",
  },
  {
    titulo: "Auxiliar de Expedição",
    descricao: "Separação, conferência e embalagem dos pedidos da produção para as lojas e delivery; controle de saída; organização do estoque e da câmara fria.",
    requisitos: "Experiência em expedição, estoque, almoxarifado ou logística\nAtenção a detalhes e conferência\nDisponibilidade para início cedo / turno da vaga",
    diferenciais: "Experiência com alimentos perecíveis / cadeia fria\nCNH B\nNoções de planilha ou sistema de estoque",
  },
  {
    titulo: "Assistente Administrativo/Financeiro",
    descricao: "Rotinas administrativas e financeiras: contas a pagar e receber, conciliação, emissão de notas, controle de documentos e apoio à gestão.",
    requisitos: "Experiência em rotinas administrativas ou financeiras\nExcel / Planilhas em nível intermediário\nOrganização e boa comunicação escrita",
    diferenciais: "Cursando ou formado em Administração, Contábeis ou áreas afins\nExperiência com sistema de gestão (ERP)\nConhecimento de fluxo de caixa e conciliação bancária",
  },
  {
    titulo: "Estagiário Administrativo – 4h",
    descricao: "Estágio de 4h/dia no administrativo: apoio a lançamentos, organização de documentos, planilhas, atendimento interno e rotinas de RH/financeiro.",
    requisitos: "Cursando ensino superior (Administração, Contábeis, RH, Marketing ou afins)\nDisponibilidade de 4h diárias\nNoções de Excel / Google Planilhas",
    diferenciais: "Boa comunicação\nInteresse em gastronomia e varejo\nPrevisão de formatura em 1 ano ou mais",
  },
  {
    titulo: "Analista de Marketing",
    descricao: "Planejamento e execução do marketing da marca: redes sociais, campanhas, conteúdo, lançamentos de produtos, parcerias e análise de resultados.",
    requisitos: "Experiência em marketing digital ou gestão de redes sociais\nProdução de conteúdo (texto e imagem/vídeo)\nLeitura de métricas (Instagram, Meta Ads)",
    diferenciais: "Formação em Marketing, Publicidade ou Comunicação\nExperiência em food service, varejo ou marcas de consumo\nEdição de vídeo (Reels) e design (Canva/Figma)\nGestão de tráfego pago",
  },
  {
    titulo: "Analista de Recursos Humanos",
    descricao: "Recrutamento e seleção, integração, treinamento, departamento pessoal (ponto, férias, admissão e demissão) e clima da equipe nas unidades.",
    requisitos: "Experiência em RH generalista (R&S e DP)\nConhecimento de legislação trabalhista básica\nOrganização e boa comunicação",
    diferenciais: "Formação em RH, Psicologia ou Administração\nExperiência com alta rotatividade (varejo / food service)\nFerramentas de ponto e folha",
  },
  {
    titulo: "Assistente de Recursos Humanos",
    descricao: "Apoio ao RH: triagem de currículos, agendamento de entrevistas, documentação de admissão, controle de ponto e benefícios.",
    requisitos: "Experiência ou estágio em RH / DP\nOrganização e discrição com dados\nExcel / Planilhas básico",
    diferenciais: "Cursando RH, Psicologia ou Administração\nExperiência com recrutamento de vagas operacionais",
  },
  {
    titulo: "Atendente de Cafeteria",
    descricao: "Atendimento ao cliente no balcão e mesas, preparo de cafés e bebidas, montagem de pedidos, operação de caixa e organização da loja.",
    requisitos: "Experiência em atendimento ao público (cafeteria, restaurante, loja ou similar)\nSimpatia, agilidade e boa comunicação\nDisponibilidade para o turno da vaga, inclusive fins de semana",
    diferenciais: "Curso ou experiência de barista\nExperiência com operação de caixa / PDV\nMorar perto da unidade",
  },
  {
    titulo: "Líder de Produção",
    descricao: "Liderança da equipe da cozinha de produção: planejamento da produção diária, padrão de qualidade, fichas técnicas, controle de perdas, escalas e treinamento.",
    requisitos: "Experiência liderando equipe de cozinha, confeitaria ou produção de alimentos\nDomínio de processos de produção e padronização (fichas técnicas)\nDisponibilidade de horário, inclusive início cedo",
    diferenciais: "Formação em Gastronomia ou Confeitaria\nExperiência com produção em escala para várias lojas\nControle de CMV e perdas",
  },
  {
    titulo: "Supervisora de Loja",
    descricao: "Gestão da unidade: equipe de atendimento, padrão de loja, caixa e fechamento, estoque e pedidos, experiência do cliente e metas de venda.",
    requisitos: "Experiência como líder / supervisor(a) em loja, cafeteria ou restaurante\nGestão de equipe e escalas\nDisponibilidade para fins de semana e feriados",
    diferenciais: "Experiência com metas e indicadores de venda\nConhecimento de PDV, estoque e fechamento de caixa\nFormação em Administração ou Gastronomia",
  },
];

/** Só os títulos (datalist do formulário de vaga e opções de cargo do candidato). */
export const CARGOS_VAGA = CATALOGO_VAGAS.map((c) => c.titulo);

/** Descrição/requisitos/diferenciais padrão de um cargo do catálogo (ou undefined). */
export const cargoDoCatalogo = (titulo: string): CargoCatalogo | undefined =>
  CATALOGO_VAGAS.find((c) => c.titulo.localeCompare(titulo.trim(), "pt", { sensitivity: "base" }) === 0);

export const seedVagas: Vaga[] = [
  // Florianópolis — Centro: catálogo completo
  ...CATALOGO_VAGAS.map(({ titulo, descricao, requisitos, diferenciais }, i): Vaga => ({
    id: `v-${i + 1}`, unidadeId: "u-centro", titulo, turno: "", descricao, requisitos, diferenciais, ativa: true, criada: iso(30 - i),
  })),
  // São José — Kobrasol: só as vagas de loja
  { id: "v-12", unidadeId: "u-kobrasol", ...cargoDoCatalogo("Atendente de Cafeteria")!, turno: "Diurno", ativa: true, criada: iso(8) },
  { id: "v-13", unidadeId: "u-kobrasol", ...cargoDoCatalogo("Auxiliar de Cozinha/Confeitaria")!, turno: "", ativa: true, criada: iso(5) },
];

export const seedLinkBio: LinkBioConfig = {
  titulo: "Trabalhe na Ju Budelon",
  subtitulo: "Estamos contratando AGORA!",
  tagline: "Junte-se ao time da Ju Budelon e cresça com a cozinha criativa mais querida da cidade",
  instagram: "jubudelon",
  pixelId: "",
};

export const seedTalentos: Talento[] = [
  { id: "tal1", nome: "Lucas Ferreira", status: "novo", vaga: "Auxiliar de Cozinha/Confeitaria", vagaId: "v-1", unidadeId: "u-centro", origem: "linkbio", fone: "5548991110001", qualidade: "Aguardando Análise", criada: iso(0, "09:12") },
  { id: "tal2", nome: "Camila Rocha", status: "novo", vaga: "Atendente de Cafeteria", vagaId: "v-9", unidadeId: "u-centro", origem: "linkbio", fone: "5548991110002", qualidade: "Aguardando Análise", criada: iso(1, "14:30") },
  { id: "tal3", nome: "Bruno Martins", status: "banco de talentos", vaga: "Assistente Administrativo/Financeiro", vagaId: "v-4", unidadeId: "u-centro", origem: "linkbio", fone: "5548991110003", qualidade: "Bom", criada: iso(6, "11:00"),
    comentarios: [{ id: "tc1", message: "Boa experiência administrativa, mas sem disponibilidade imediata.", html: "<p>Boa experiência administrativa, mas sem disponibilidade imediata.</p>", author: "pedro", created_at: iso(5, "10:20") }] },
  { id: "tal4", nome: "Fernanda Silva", status: "qualificado", vaga: "Líder de Produção", vagaId: "v-10", unidadeId: "u-centro", origem: "linkbio", fone: "5548991110004", qualidade: "Ótimo", criada: iso(9, "16:45"),
    anexos: [{ id: "a1", nome: "curriculo-fernanda.pdf", url: "/curriculo-exemplo.pdf", mime: "application/pdf", tamanho: 640, criadoEm: iso(9, "16:50"), autor: "pedro" }],
    comentarios: [{ id: "tc2", message: "Pedro Nunes alterou o status de novo para qualificado", author: "pedro", created_at: iso(7, "09:00"), tipo: "log" }, { id: "tc3", message: "Liderou equipe de produção por 3 anos. Agendar conversa com a Ju.", html: "<p>Liderou equipe de produção por 3 anos. Agendar conversa com a Ju.</p>", author: "pedro", created_at: iso(7, "09:05") }] },
  { id: "tal5", nome: "Gabriel Souza", status: "qualificado", vaga: "Analista de Marketing", vagaId: "v-6", unidadeId: "u-centro", origem: "manual", fone: "5548991110005", qualidade: "Bom", criada: iso(10, "10:10") },
  { id: "tal6", nome: "Juliana Prado", status: "reunião agendada", vaga: "Auxiliar de Expedição", vagaId: "v-3", unidadeId: "u-centro", origem: "linkbio", fone: "5548991110006", qualidade: "Ótimo", criada: iso(14, "08:40"),
    comentarios: [{ id: "tc4", message: "Reunião marcada para quinta às 14h com a Ju.", html: "<p>Reunião marcada para <b>quinta às 14h</b> com a Ju.</p>", author: "pedro", created_at: iso(2, "17:00") }] },
  { id: "tal7", nome: "Ricardo Alves", status: "desqualificado", vaga: "Atendente de Cafeteria", vagaId: "v-12", unidadeId: "u-kobrasol", turno: "Diurno", origem: "linkbio", fone: "5548991110007", qualidade: "Ruim", criada: iso(20, "13:00") },
  { id: "tal8", nome: "Patrícia Mendes", status: "contratado", vaga: "Supervisora de Loja", vagaId: "v-11", unidadeId: "u-centro", origem: "linkbio", fone: "5548991110008", qualidade: "Ótimo", criada: iso(45, "09:30") },
  { id: "tal9", nome: "Thiago Lima", status: "antigos", vaga: "Estagiário Administrativo – 4h", origem: "manual", fone: "5548991110009", qualidade: "Bom", criada: iso(120, "15:15") },
  { id: "tal10", nome: "Aline Castro", status: "banco de talentos", vaga: "Assistente de Recursos Humanos", vagaId: "v-8", unidadeId: "u-centro", origem: "linkbio", fone: "5548991110010", qualidade: "Bom", criada: iso(3, "12:25") },
];

export const seedGrupos: GrupoInterno[] = [
  { id: "g1", nome: "Time Operacional", descricao: "Gestores e operação do dia a dia", setores: ["Operacional"], visivelCargos: ["Head Operacional", "Operacional"] },
  { id: "g2", nome: "Recrutamento", descricao: "Seleção e banco de talentos", setores: ["Recrutamento"], visivelCargos: ["Recrutamento"] },
];

export const seedAcessos: Record<string, Record<string, NivelAcesso>> = {};
export const seedEscopoProprio: Record<string, boolean> = {};
