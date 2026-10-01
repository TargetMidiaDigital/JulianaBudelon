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
  pedidoId?: string; // ordem de serviço que gerou a tarefa (Operacional → Ordem de Serviço)
  produtoId?: string; // produção: produto fabricado (Estoque)
  quantidade?: number; // produção: unidades; ao concluir, soma no estoque da Fábrica
  local?: string; // expedição/recebimento: unidade (id de LOCAIS_ESTOQUE)
  criada: string; // dd/mm/yyyy
  criadaHora?: string; // hh:mm
  atualizada?: string; // dd/mm/yyyy — data da última atualização
  atualizadaHora?: string; // hh:mm
  venc: string; // dd/mm/yyyy
  vencHora?: string; // hh:mm
  desc?: string; // descrição (HTML rico)
  comentarios?: Comentario[];
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
  descricao?: string; // resumo do cargo / rotina (uso interno; base da análise por IA)
  requisitos?: string; // obrigatórios, um por linha
  diferenciais?: string; // desejáveis, um por linha
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

/** Classificação da IA — mesmos rótulos da "Qualidade" (sem o "Aguardando Análise"). */
export type ClassificacaoIA = "Ótimo" | "Bom" | "Ruim";

/** Resultado da análise do currículo por IA (resumo + classificação candidato × vaga). */
export type AnaliseIA = {
  resumo: string; // 3–5 frases sobre o candidato
  experiencia: string[]; // experiências relevantes (cargo · empresa · período)
  formacao: string[]; // formação e cursos
  pontosFortes: string[];
  alertas: string[]; // pontos de atenção (lacunas de tempo, troca frequente, distância…)
  nota: number; // 0–100, aderência à vaga
  classificacao: ClassificacaoIA;
  justificativa: string; // por que essa nota/classificação
  lacunas: string[]; // requisitos da vaga não atendidos / não comprovados
  vagaId?: string; // vaga usada na comparação (se mudar, a análise está desatualizada)
  vagaTitulo?: string;
  modelo?: string;
  em?: string; // ISO
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
  qualidade?: string; // Aguardando Análise / Ruim / Bom / Ótimo — a IA grava ao analisar; sem análise fica "Aguardando Análise"; a equipe pode trocar
  criada?: string; // ISO
  comentarios?: Comentario[];
  anexos?: Anexo[];
  analise?: AnaliseIA; // análise do currículo por IA (servidor)
  analiseErro?: string; // última falha da análise (ex.: formato não suportado)
};

/** Produto do estoque (Operacional → Estoque). */
export type Produto = {
  id: string;
  nome: string;
  categoria: string; // uma das CATEGORIAS_ESTOQUE (lib/estoque.ts)
  /** Quantidade por local (id de LOCAIS_ESTOQUE → inteiro ≥ 0). Local ausente = 0. */
  quantidades: Record<string, number>;
  /** Log de alterações (tipo "log"): quem mudou o quê, quando. Autor "sistema" = automação. */
  historico?: Comentario[];
  criada?: string; // ISO
  atualizada?: string; // ISO — última alteração (nome, categoria ou quantidade)
};

export type PedidoStatus = "aberta" | "em andamento" | "concluida" | "validada";

/** Ordem de serviço (Operacional → Ordem de Serviço): o que produzir para cada unidade. */
export type Pedido = {
  id: string;
  titulo: string;
  status: PedidoStatus;
  criadoPor: string; // id do usuário
  criada?: string; // ISO
  atualizada?: string; // ISO
  entrega?: string; // dd/mm/yyyy — data desejada de entrega/produção
  /** { produtoId: { localId: quantidade } } — só produtos/locais com quantidade > 0. */
  itens: Record<string, Record<string, number>>;
  historico?: Comentario[]; // log de alterações (quem, o quê, quando)
};

export type Sector = {
  id: string;
  label: string;
  children: { label: string; page: ScreenPage }[];
};

export type ScreenPage = "indicadores" | "listaview" | "pedidos" | "expedicao" | "unidades" | "estoque" | "recrutamento-talentos" | "recrutamento-vagas" | "recrutamento-agente" | "config";

/** Nível de acesso de um cargo a uma tela do menu. */
export type NivelAcesso = "nenhum" | "ver" | "editar";

export type Workspace = { nome: string; logo: string | null };
