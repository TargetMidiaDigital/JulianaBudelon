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
    id: "t1", titulo: "Clínica Vitalis | Revisar campanha de agendamentos", cliente: "clinica-vitalis", gestor: "carlos", status: "atrasada", prio: "urgente", tipo: "Otimização", categoria: "operacional",
    criada: diasAPartirDeHoje(-6), criadaHora: "08:15", atualizada: diasAPartirDeHoje(-1), atualizadaHora: "17:40", venc: diasAPartirDeHoje(-2), vencHora: "18:00",
    desc: "<p>O custo por agendamento subiu 40% na última semana.</p><ul><li>Revisar públicos</li><li>Pausar criativos com CTR baixo</li><li>Testar novo texto de anúncio</li></ul>",
    comentarios: [
      { id: "c1", message: "Já pausei dois criativos, mas o custo continua alto. Vou testar um público novo amanhã.", html: "<p>Já pausei dois criativos, mas o custo continua alto. Vou testar um público novo amanhã.</p>", author: "carlos", created_at: iso(2, "16:20") },
      { id: "c2", message: "Marina Lopes mudou a prioridade para \"Urgente\"", author: "marina", created_at: iso(1, "09:05"), tipo: "log" },
    ],
  },
  { id: "t2", titulo: "Bella Moda | Subir coleção de inverno nos anúncios", cliente: "bella-moda", gestor: "ana", status: "atrasada", prio: "alta", tipo: "Criativo", categoria: "operacional", criada: diasAPartirDeHoje(-5), criadaHora: "09:40", venc: diasAPartirDeHoje(-1), vencHora: "12:00", desc: "<p>Cliente enviou 12 fotos novas. Montar 3 variações de carrossel.</p>" },
  { id: "t3", titulo: "Casa Verde | Otimizar campanha de captação de leads", cliente: "casa-verde", gestor: "carlos", status: "em andamento", prio: "alta", tipo: "Otimização", categoria: "operacional", criada: diasAPartirDeHoje(-3), criadaHora: "10:05", atualizada: diasAPartirDeHoje(0), atualizadaHora: "08:30", venc: diasAPartirDeHoje(1), vencHora: "18:00",
    comentarios: [{ id: "c3", message: "Formulário novo publicado, aguardando os primeiros leads.", html: "<p>Formulário novo publicado, aguardando os primeiros leads.</p>", author: "carlos", created_at: iso(0, "08:30") }] },
  { id: "t4", titulo: "Sabor da Serra | Configurar cardápio no WhatsApp", cliente: "sabor-da-serra", gestor: "ana", status: "em andamento", prio: "normal", tipo: "Configuração", categoria: "operacional", criada: diasAPartirDeHoje(-4), criadaHora: "11:20", venc: diasAPartirDeHoje(2), vencHora: "18:00" },
  { id: "t5", titulo: "Studio Fit | Montar relatório mensal", cliente: "studio-fit", gestor: "marina", status: "em andamento", prio: "normal", tipo: "Relatório", categoria: "operacional", criada: diasAPartirDeHoje(-2), criadaHora: "13:35", venc: diasAPartirDeHoje(5), vencHora: "18:00", desc: "<p>Comparar com o mês anterior e destacar os 3 melhores anúncios.</p>" },
  { id: "t6", titulo: "Auto Prime | Validar pixel de conversão", cliente: "auto-prime", gestor: "carlos", status: "verificar", prio: "alta", tipo: "Configuração", categoria: "operacional", criada: diasAPartirDeHoje(-1), criadaHora: "14:10", venc: diasAPartirDeHoje(3), vencHora: "18:00" },
  { id: "t7", titulo: "Clínica Vitalis | Recarregar saldo da conta", cliente: "clinica-vitalis", gestor: "marina", status: "verificar", prio: "urgente", tipo: "Financeiro", categoria: "operacional", criada: diasAPartirDeHoje(0), criadaHora: "08:50", venc: diasAPartirDeHoje(0), vencHora: "18:00" },
  { id: "t8", titulo: "Bella Moda | Ajustar criativos do feed", cliente: "bella-moda", gestor: "ana", status: "verificar", prio: "normal", tipo: "Criativo", categoria: "operacional", criada: diasAPartirDeHoje(0), criadaHora: "09:15", venc: diasAPartirDeHoje(4), vencHora: "18:00" },
  { id: "t9", titulo: "Ju Budelon | Organizar pasta de referências", cliente: "ju-budelon", gestor: "ana", status: "verificar", prio: "baixa", tipo: "Interno", categoria: "operacional", criada: diasAPartirDeHoje(-1), criadaHora: "10:45", venc: diasAPartirDeHoje(7), vencHora: "18:00" },
  { id: "t10", titulo: "Doce Lar | Alinhar retomada das campanhas", cliente: "doce-lar", gestor: "ana", status: "verificar", prio: "baixa", tipo: "Reunião", categoria: "operacional", criada: diasAPartirDeHoje(-1), criadaHora: "11:55", venc: diasAPartirDeHoje(9), vencHora: "15:00" },
  { id: "t11", titulo: "Casa Verde | Enviar relatório semanal", cliente: "casa-verde", gestor: "carlos", status: "concluida", prio: "normal", tipo: "Relatório", categoria: "operacional", criada: diasAPartirDeHoje(-7), criadaHora: "13:05", atualizada: diasAPartirDeHoje(-3), atualizadaHora: "18:10", venc: diasAPartirDeHoje(-3), vencHora: "18:00",
    comentarios: [{ id: "c4", message: "Enviado por e-mail e no grupo do cliente.", html: "<p>Enviado por e-mail e no grupo do cliente.</p>", author: "carlos", created_at: iso(3, "18:10") }, { id: "c5", message: "Carlos Andrade mudou o status para \"Concluída\"", author: "carlos", created_at: iso(3, "18:11"), tipo: "log" }] },
  { id: "t12", titulo: "Studio Fit | Trocar imagem da campanha de matrícula", cliente: "studio-fit", gestor: "marina", status: "concluida", prio: "normal", tipo: "Criativo", categoria: "operacional", criada: diasAPartirDeHoje(-8), criadaHora: "14:40", venc: diasAPartirDeHoje(-4), vencHora: "18:00" },
  { id: "t13", titulo: "Auto Prime | Revisar segmentação por região", cliente: "auto-prime", gestor: "carlos", status: "validada", prio: "baixa", tipo: "Otimização", categoria: "operacional", criada: diasAPartirDeHoje(-12), criadaHora: "15:20", venc: diasAPartirDeHoje(-6), vencHora: "18:00",
    comentarios: [{ id: "c6", message: "Marina Lopes mudou o status para \"Validada\"", author: "marina", created_at: iso(5, "10:00"), tipo: "log" }] },
];

/** Tarefa recorrente de exemplo: relatório semanal toda segunda-feira. */
{
  const regra = { frequencia: "semanal", dia_semana: 1, dia_mes: null };
  const primeira = primeiraOcorrencia(hojeSP(), regra);
  seedTasks.push({
    id: "t14", titulo: "Sabor da Serra | Relatório semanal de resultados", cliente: "sabor-da-serra", gestor: "ana", status: "verificar", prio: "normal", tipo: "Relatório", categoria: "operacional",
    criada: formatBR(TODAY), criadaHora: "09:00", venc: addDias(primeira, 1).split("-").reverse().join("/"), vencHora: "23:59",
    rec: { ativa: true, freq: "semanal", diaSemana: 1, prazoDias: 1, modo: "novo", proxima: proximaApos(primeira, regra) },
  });
}

export const seedUnidades: Unidade[] = [
  { id: "u-centro", slug: "florianopolis-centro", cidade: "Florianópolis", nome: "Centro", ativa: true, criada: iso(60) },
  { id: "u-kobrasol", slug: "sao-jose-kobrasol", cidade: "São José", nome: "Kobrasol", ativa: true, criada: iso(40) },
  { id: "u-palhoca", slug: "palhoca-pedra-branca", cidade: "Palhoça", nome: "Pedra Branca", ativa: false, criada: iso(20) },
];

export const seedVagas: Vaga[] = [
  { id: "v-1", unidadeId: "u-centro", titulo: "Auxiliar de Cozinha", turno: "Diurno", descricao: "Apoio na produção diária, organização e higienização da cozinha.", ativa: true, criada: iso(12) },
  { id: "v-2", unidadeId: "u-centro", titulo: "Atendente", turno: "", descricao: "Atendimento ao cliente no balcão e organização do salão.", ativa: true, criada: iso(10) },
  { id: "v-3", unidadeId: "u-centro", titulo: "Confeiteira", turno: "Noturno", descricao: "Produção de doces e sobremesas da casa.", ativa: false, criada: iso(30) },
  { id: "v-4", unidadeId: "u-kobrasol", titulo: "Caixa", turno: "Diurno", descricao: "Recebimento, fechamento de caixa e apoio ao atendimento.", ativa: true, criada: iso(8) },
  { id: "v-5", unidadeId: "u-kobrasol", titulo: "Cozinheira", turno: "", descricao: "Preparo dos pratos do cardápio e controle de insumos.", ativa: true, criada: iso(5) },
];

export const seedLinkBio: LinkBioConfig = {
  titulo: "Trabalhe na Ju Budelon",
  subtitulo: "Estamos contratando AGORA!",
  tagline: "Junte-se ao time da Ju Budelon e cresça com a cozinha criativa mais querida da cidade",
  instagram: "jubudelon",
  pixelId: "",
};

export const seedTalentos: Talento[] = [
  { id: "tal1", nome: "Lucas Ferreira", status: "novo", vaga: "Auxiliar de Cozinha", vagaId: "v-1", unidadeId: "u-centro", turno: "Diurno", origem: "linkbio", fone: "5548991110001", qualidade: "Aguardando Análise", criada: iso(0, "09:12") },
  { id: "tal2", nome: "Camila Rocha", status: "novo", vaga: "Atendente", vagaId: "v-2", unidadeId: "u-centro", origem: "linkbio", fone: "5548991110002", qualidade: "Aguardando Análise", criada: iso(1, "14:30") },
  { id: "tal3", nome: "Bruno Martins", status: "banco de talentos", vaga: "Caixa", vagaId: "v-4", unidadeId: "u-kobrasol", turno: "Diurno", origem: "linkbio", fone: "5548991110003", qualidade: "Bom", criada: iso(6, "11:00"),
    comentarios: [{ id: "tc1", message: "Boa experiência no caixa, mas sem disponibilidade imediata.", html: "<p>Boa experiência no caixa, mas sem disponibilidade imediata.</p>", author: "pedro", created_at: iso(5, "10:20") }] },
  { id: "tal4", nome: "Fernanda Silva", status: "qualificado", vaga: "Cozinheira", vagaId: "v-5", unidadeId: "u-kobrasol", origem: "linkbio", fone: "5548991110004", qualidade: "Ótimo", criada: iso(9, "16:45"),
    anexos: [{ id: "a1", nome: "curriculo-fernanda.pdf", url: "/curriculo-exemplo.pdf", mime: "application/pdf", tamanho: 640, criadoEm: iso(9, "16:50"), autor: "pedro" }],
    comentarios: [{ id: "tc2", message: "Pedro Nunes alterou o status de novo para qualificado", author: "pedro", created_at: iso(7, "09:00"), tipo: "log" }, { id: "tc3", message: "Experiência de 4 anos em cozinha de restaurante. Agendar conversa com a Ju.", html: "<p>Experiência de 4 anos em cozinha de restaurante. Agendar conversa com a Ju.</p>", author: "pedro", created_at: iso(7, "09:05") }] },
  { id: "tal5", nome: "Gabriel Souza", status: "qualificado", vaga: "Atendente", vagaId: "v-2", unidadeId: "u-centro", origem: "manual", fone: "5548991110005", qualidade: "Bom", criada: iso(10, "10:10") },
  { id: "tal6", nome: "Juliana Prado", status: "reunião agendada", vaga: "Confeiteira", vagaId: "v-3", unidadeId: "u-centro", turno: "Noturno", origem: "linkbio", fone: "5548991110006", qualidade: "Ótimo", criada: iso(14, "08:40"),
    comentarios: [{ id: "tc4", message: "Reunião marcada para quinta às 14h com a Ju.", html: "<p>Reunião marcada para <b>quinta às 14h</b> com a Ju.</p>", author: "pedro", created_at: iso(2, "17:00") }] },
  { id: "tal7", nome: "Ricardo Alves", status: "desqualificado", vaga: "Caixa", vagaId: "v-4", unidadeId: "u-kobrasol", turno: "Diurno", origem: "linkbio", fone: "5548991110007", qualidade: "Ruim", criada: iso(20, "13:00") },
  { id: "tal8", nome: "Patrícia Mendes", status: "contratado", vaga: "Auxiliar de Cozinha", vagaId: "v-1", unidadeId: "u-centro", turno: "Diurno", origem: "linkbio", fone: "5548991110008", qualidade: "Ótimo", criada: iso(45, "09:30") },
  { id: "tal9", nome: "Thiago Lima", status: "antigos", vaga: "Cozinheira", origem: "manual", fone: "5548991110009", qualidade: "Bom", criada: iso(120, "15:15") },
  { id: "tal10", nome: "Aline Castro", status: "banco de talentos", vaga: "Atendente", vagaId: "v-2", unidadeId: "u-centro", origem: "linkbio", fone: "5548991110010", qualidade: "Bom", criada: iso(3, "12:25") },
];

export const seedGrupos: GrupoInterno[] = [
  { id: "g1", nome: "Time Operacional", descricao: "Gestores e operação do dia a dia", setores: ["Operacional"], visivelCargos: ["Head Operacional", "Operacional"] },
  { id: "g2", nome: "Recrutamento", descricao: "Seleção e banco de talentos", setores: ["Recrutamento"], visivelCargos: ["Recrutamento"] },
];

export const seedAcessos: Record<string, Record<string, NivelAcesso>> = {};
export const seedEscopoProprio: Record<string, boolean> = {};
