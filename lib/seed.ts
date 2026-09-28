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
 * Catálogo de cargos da Ju Budelon: título + descrição, requisitos e diferenciais padrão
 * (textos enviados pela Ju em 28/09/2026; cargos sem texto ficam vazios até ela mandar).
 * Vagas → Nova vaga preenche a partir daqui; o candidato lê na página pública e a IA
 * compara com o currículo.
 */
export type CargoCatalogo = { titulo: string; descricao: string; requisitos: string; diferenciais: string };
export const CATALOGO_VAGAS: CargoCatalogo[] = [
  {
    titulo: "Auxiliar de Cozinha/Confeitaria",
    descricao: "Auxiliar de Produção – Confeitaria (Juliana Budelon Comércio de Doces, bairro Ipiranga, São José/SC). Preparo de massas, cremes, bolos e demais doces e salgados, do balanceamento ao acabamento final dos produtos; manter o local de trabalho limpo e organizado.\nEscala 6x1. CLT efetivo. Salário R$ 2.150,00 + Auxílio Alimentação + Auxílio Mobilidade.",
    requisitos: "Saber trabalhar em equipe\nGostar de processos, padronização e rotina\nDisponibilidade para escala 6x1\nNoções de higiene e manipulação de alimentos",
    diferenciais: "Experiência na área de confeitaria\nExperiência em produção de alimentos (padaria, cozinha industrial)\nMorar perto do bairro Ipiranga (São José)",
  },
  {
    titulo: "Auxiliar de Serviços Gerais (Limpeza)",
    descricao: "Higienização e limpeza das áreas comuns, escritório e produção da fábrica (bairro Ipiranga, São José/SC), incluindo lavação de louça. Perfil: trabalho em equipe, proatividade, atitude positiva e agilidade para resolver problemas.\nEscala 6x1, manhã e tarde, de segunda a sábado. CLT efetivo, tempo integral. Salário R$ 2.150,00 + Vale Alimentação + Auxílio Mobilidade + Assiduidade.",
    requisitos: "Experiência com serviços gerais / limpeza\nExperiência com lavação de louça\nBoa comunicação e relação interpessoal\nCordialidade e gentileza\nDisponibilidade para manhã e tarde, de segunda a sábado, escala 6x1",
    diferenciais: "Experiência em limpeza de cozinha industrial ou fábrica de alimentos\nMorar perto do bairro Ipiranga (São José)",
  },
  {
    titulo: "Auxiliar de Expedição",
    descricao: "Organização, conservação e precificação dos produtos; registro de entrada e saída de mercadorias; controle dos níveis de estoque e solicitação de compra para reposição; entregas e retiradas entre filiais.\nEscala 6x1, das 07h às 15h20. CLT efetivo, tempo integral. Salário fixo R$ 2.300,00 + Auxílio Mobilidade + Vale Alimentação.",
    requisitos: "Experiência comprovada em expedição / estoque\nCNH categoria B\nDisponibilidade para início imediato\nOrganização e gosto por processos\nFacilidade e rapidez de aprendizado",
    diferenciais: "Experiência com alimentos perecíveis / cadeia fria\nNoções de planilha ou sistema de estoque\nMorar perto do bairro Ipiranga (São José)",
  },
  {
    titulo: "Assistente Administrativo/Financeiro",
    descricao: "",
    requisitos: "",
    diferenciais: "",
  },
  {
    titulo: "Estagiário Administrativo – 4h",
    descricao: "",
    requisitos: "",
    diferenciais: "",
  },
  {
    titulo: "Analista de Marketing",
    descricao: "",
    requisitos: "",
    diferenciais: "",
  },
  {
    titulo: "Analista de Recursos Humanos",
    descricao: "Recrutamento e seleção (divulgação, triagem, entrevistas, integração); apoio a programas de treinamento e desenvolvimento; acompanhamento de avaliações de desempenho e PDIs; rotinas de administração de pessoal (ponto, benefícios, folha); implantação e manutenção de políticas e procedimentos de RH; ações de clima, comunicação interna e cultura; relatórios e indicadores (turnover, absenteísmo, horas extras, treinamentos).\nLocal: bairro Ipiranga, São José/SC. Segunda a sexta, 08h às 18h. CLT. Salário R$ 2.300,00 (após 90 dias R$ 2.500,00) + Auxílio Alimentação + Auxílio Mobilidade.",
    requisitos: "Ensino superior completo em Administração, Psicologia, Recursos Humanos ou áreas correlatas\nMínimo de 1 ano de atuação generalista em RH\nPacote Office intermediário a avançado (Excel essencial)\nLegislação trabalhista básica\nResidir com fácil acesso ao bairro Ipiranga (São José/SC) ou disposição para se mudar\nComunicação clara, capacidade analítica, organização, proatividade, discrição e ética",
    diferenciais: "Experiência em RH de empresas do setor alimentar\nExperiência com indicadores de RH (turnover, absenteísmo)\nFerramentas de ponto e folha",
  },
  {
    titulo: "Assistente de Recursos Humanos",
    descricao: "",
    requisitos: "",
    diferenciais: "",
  },
  {
    titulo: "Atendente de Cafeteria",
    descricao: "Demonstração, preparo e venda de produtos (doces, salgados e cafés); organização e limpeza do local de trabalho; foco na experiência do cliente e nas metas da loja.\nPeríodo integral, escala 6x1, CLT efetivo. Loja Coqueiros (R. Vinte e Três de Março, 57 – Itaguaçu, Florianópolis): disponibilidade das 12h30 às 20h30; salário R$ 2.150,00 (após 90 dias R$ 2.300,00) + Auxílio Refeição + Auxílio Mobilidade.",
    requisitos: "Ensino médio completo\nExperiência com atendimento ao cliente\nComunicativo(a) e proativo(a)\nDisponibilidade para período integral em escala 6x1 (Coqueiros: 12h30 às 20h30)",
    diferenciais: "Experiência em cafeteria, confeitaria ou restaurante\nCurso ou experiência de barista\nExperiência com operação de caixa / PDV\nMorar perto da unidade",
  },
  {
    titulo: "Líder de Produção",
    descricao: "",
    requisitos: "",
    diferenciais: "",
  },
  {
    titulo: "Supervisora de Loja",
    descricao: "",
    requisitos: "",
    diferenciais: "",
  },
];

/** Só os títulos (datalist do formulário de vaga e opções de cargo do candidato). */
export const CARGOS_VAGA = CATALOGO_VAGAS.map((c) => c.titulo);

/** Descrição/requisitos/diferenciais padrão de um cargo do catálogo (ou undefined). */
export const cargoDoCatalogo = (titulo: string): CargoCatalogo | undefined => {
  const c = CATALOGO_VAGAS.find((x) => x.titulo.localeCompare(titulo.trim(), "pt", { sensitivity: "base" }) === 0);
  // Cargo ainda sem texto no catálogo conta como "não catalogado" para o preenchimento automático.
  return c && (c.descricao || c.requisitos || c.diferenciais) ? c : undefined;
};

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
