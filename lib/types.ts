export type TaskStatus =
  | "atrasada"
  | "em andamento"
  | "verificar"
  | "concluida"
  | "validada";

export type Prioridade = "urgente" | "alta" | "normal" | "baixa";

/** Cargos do sistema. Administrador tem acesso total; os demais seguem Configurações → Acessos. */
export type Cargo = "Administrador" | "Head Operacional" | "Operacional" | "Recrutamento";

export type TeamMember = {
  id: string;
  nome: string;
  cargo: string;
  ini: string;
  cor: string;
  email?: string;
  whatsapp?: string;
  whatsappInterno?: string;
  foto?: string; // URL/data-URL da foto
  ativo?: boolean; // status Ativo/Inativo
};

/** Comentário de uma tarefa/candidato. */
export type Comentario = {
  id: string;
  message: string;
  html?: string; // conteúdo rico (HTML) — comentários com imagem/vídeo inline
  author: string; // id do usuário
  created_at: string; // ISO
  tipo?: "log"; // entrada de log automática (mudança de status/responsável/etc.)
};

/** Configuração de recorrência de uma tarefa. */
export type RecConfig = {
  ativa: boolean;
  freq: "diaria" | "semanal" | "mensal";
  diaSemana?: number; // 0..6 (domingo..sábado), p/ semanal
  diaMes?: number; // 1..31, p/ mensal
  prazoDias: number; // vencimento = ocorrência + prazoDias
  modo: "novo" | "reagendar"; // novo = cria nova tarefa (com histórico); reagendar = mesma tarefa (sem)
  proxima?: string; // YYYY-MM-DD — próxima ocorrência
};

export type Task = {
  id: string;
  titulo: string;
  cliente?: string; // legado (sem uso nas telas)
  gestor: string; // team member id (responsável)
  status: TaskStatus;
  prio: Prioridade;
  tipo?: string; // tipo de tarefa (ex: Otimização, Criativo, Financeiro…)
  categoria?: string; // espaço/categoria (ex: "operacional")
  parentId?: string; // tarefa-pai (subtarefa)
  criada: string; // dd/mm/yyyy
  criadaHora?: string; // hh:mm
  atualizada?: string; // dd/mm/yyyy — data da última atualização
  atualizadaHora?: string; // hh:mm
  venc: string; // dd/mm/yyyy
  vencHora?: string; // hh:mm
  desc?: string; // descrição (HTML rico)
  comentarios?: Comentario[];
  rec?: RecConfig; // recorrência; ausente = tarefa comum
};

export type ClientStatus = "ativo" | "pausado" | "inativo";

export type Client = {
  id: string;
  nome: string;
  seg: string; // segmento/nicho
  gestor: string; // responsável (team id)
  status: ClientStatus;
  cor: string;
  logo?: string;
};

/** Grupo interno (Configurações → Grupos): agrupa pessoas por setor e define quem vê. */
export type GrupoInterno = {
  id: string;
  nome: string;
  descricao?: string;
  setores: string[]; // ids/rótulos de setor (Operacional, Recrutamento)
  visivelCargos: string[]; // cargos que podem ver (Administrador implícito)
  logo?: string; // logo próprio (data-URL); vazio → usa o logo da empresa
};

/** Anexo de um candidato (currículo em PDF, etc). */
export type Anexo = {
  id: string;
  nome: string;
  url: string;
  mime?: string;
  tamanho?: number; // bytes
  criadoEm?: string; // ISO
  autor?: string; // id de quem anexou
};

/** Unidade (loja/filial) — os botões do hub da página pública "Trabalhe conosco". */
export type Unidade = {
  id: string;
  slug: string; // URL pública: /vagas/<slug>
  cidade: string; // ex.: "Florianópolis"
  nome: string; // ex.: "Campeche" (bairro/nome da unidade)
  ativa: boolean; // inativa some do hub (a URL continua abrindo, com aviso de "sem vagas")
  criada?: string; // ISO
};

export type Turno = "" | "Diurno" | "Noturno";

/** Vaga aberta — sempre vinculada a uma unidade. */
export type Vaga = {
  id: string;
  unidadeId: string;
  titulo: string; // ex.: "Auxiliar de Cozinha"
  turno?: Turno;
  descricao?: string;
  ativa: boolean; // pausada some da página pública
  criada?: string; // ISO
};

/** Configuração da página pública de vagas (link na bio). */
export type LinkBioConfig = {
  titulo: string; // "Trabalhe na Ju Budelon"
  subtitulo: string; // "Estamos contratando AGORA!"
  tagline: string;
  instagram: string; // handle sem @
  /** ID do Pixel do Facebook (Meta). Vazio = sem pixel. PageView em todas as páginas; Lead no /obrigado. */
  pixelId?: string;
};

/** Candidato (Recrutamento → Banco de Talentos). */
export type Talento = {
  id: string;
  nome: string;
  status: string; // novo / banco de talentos / qualificado / reunião agendada / desqualificado / contratado / antigos
  vaga?: string; // título da vaga (texto, p/ exibição e filtro)
  vagaId?: string; // vínculo com a vaga cadastrada
  unidadeId?: string; // vínculo com a unidade
  turno?: Turno;
  origem?: "linkbio" | "manual";
  fone?: string; // WhatsApp (só dígitos, com DDI)
  qualidade?: string; // Aguardando Análise / Ruim / Bom / Ótimo
  criada?: string; // ISO
  comentarios?: Comentario[];
  anexos?: Anexo[];
};

export type Sector = {
  id: string;
  label: string;
  children: { label: string; page: ScreenPage }[];
};

export type ScreenPage = "listaview" | "recrutamento-talentos" | "recrutamento-vagas" | "config";

/** Nível de acesso de um cargo a uma tela do menu. */
export type NivelAcesso = "nenhum" | "ver" | "editar";

export type Workspace = { nome: string; logo: string | null };
