import type { ScreenPage } from "./types";

/**
 * Treinamentos → Guias de processo. Conteúdo dos guias (como cada tela é usada no dia a dia).
 * Fica em dados, separado da tela, para atualizar o texto sem mexer em layout. Ao mudar uma
 * regra do sistema (status, quem valida, o que mexe no estoque), atualize o guia junto.
 */

/** Fluxograma em raias (estilo Miro): cada raia é quem faz; nós em colunas; setas entre nós. */
export type Raia = { id: string; rotulo: string; cor: string; linhas?: number };
export type No = { id: string; raia: string; col: number; linha?: number; texto: string; forma?: "inicio" | "fim" | "etapa" | "sistema" | "decisao" };
export type Seta = { de: string; para: string; rotulo?: string; tracejada?: boolean };
export type Diagrama = { tipo: "diagrama"; titulo?: string; raias: Raia[]; nos: No[]; setas: Seta[] };

export type Bloco =
  | Diagrama
  | { tipo: "fluxo"; titulo?: string; itens: { rotulo: string; texto: string }[] }
  | { tipo: "passos"; titulo: string; itens: string[] }
  | { tipo: "status"; titulo: string; itens: { rotulo: string; cor: string; texto: string }[] }
  | { tipo: "lista"; titulo: string; itens: { rotulo: string; texto: string }[] }
  | { tipo: "dica"; texto: string }
  | { tipo: "atencao"; texto: string };

export type Guia = {
  id: string;
  setor: string; // agrupamento no índice
  titulo: string;
  resumo: string;
  page?: ScreenPage; // tela do sistema (botão "Abrir a tela" e filtro por acesso)
  quem?: string; // quem usa
  blocos: Bloco[];
};

export const SETORES_TREINAMENTO = ["Visão geral", "Produção", "Lojas", "RH", "Administrativo"];

const COR = {
  verificar: "#9398A6", andamento: "#F76808", atrasada: "#E5484D", concluida: "#16A34A", validada: "#2563EB",
  aberta: "#9398A6", pago: "#0E8FB0", aberto: "#C98500", vencida: "#E5484D", breve: "#F76808",
};

const BASE: Guia[] = [
  // ───────────── Visão geral ─────────────
  {
    id: "fluxo-pedido",
    setor: "Visão geral",
    titulo: "Como um pedido percorre o sistema",
    resumo: "Da ordem de serviço até o produto na prateleira da loja: quem faz cada etapa e o que acontece no estoque.",
    page: "pedidos",
    quem: "Todos da operação",
    blocos: [
      {
        tipo: "fluxo",
        itens: [
          { rotulo: "Ordem de Serviço", texto: "Gerente ou Administrador monta o pedido: quanto de cada produto vai para cada loja e a data de entrega." },
          { rotulo: "Produção", texto: "O sistema cria uma tarefa por produto e unidade. A fábrica produz e informa o que realmente fez." },
          { rotulo: "Expedição", texto: "Uma tarefa por loja: separar os produtos, imprimir o romaneio e enviar." },
          { rotulo: "Unidades", texto: "Cada loja confere o que chegou e informa o que recebeu." },
          { rotulo: "Estoque", texto: "Atualizado sozinho: a produção soma na Fábrica; o recebimento tira da Fábrica e coloca na loja." },
        ],
      },
      {
        tipo: "status",
        titulo: "Status da ordem de serviço",
        itens: [
          { rotulo: "Aberta", cor: COR.aberta, texto: "Criada, nenhuma tarefa começou ainda." },
          { rotulo: "Em andamento", cor: COR.andamento, texto: "Pelo menos uma tarefa (produção, expedição ou loja) saiu de “A verificar”." },
          { rotulo: "Concluída", cor: COR.concluida, texto: "Todas as tarefas de todos os setores foram concluídas." },
          { rotulo: "Validada", cor: COR.validada, texto: "Gerente ou Administrador conferiu o relatório e fechou a ordem." },
        ],
      },
      { tipo: "dica", texto: "O status da ordem muda sozinho conforme as tarefas andam. Ninguém precisa atualizar a ordem à mão — só validar no final." },
      { tipo: "atencao", texto: "Pedidos só para a Fábrica (sem loja) geram apenas tarefa de produção: não há expedição nem recebimento." },
    ],
  },

  // ───────────── Produção ─────────────
  {
    id: "ordem-servico",
    setor: "Produção",
    titulo: "Ordem de Serviço: abrir e acompanhar",
    resumo: "Como montar o pedido das lojas, o que o sistema gera automaticamente e como fechar a ordem com o relatório.",
    page: "pedidos",
    quem: "Administrador e Gerente (os demais só visualizam)",
    blocos: [
      {
        tipo: "passos",
        titulo: "Criar uma ordem",
        itens: [
          "Em Produção → Ordem de Serviço, clique em “+ Nova ordem”.",
          "O título já vem preenchido com a data (ex.: “Pedido 24/10/2026”); troque se quiser.",
          "Escolha a data de Entrega — é obrigatória e vira o prazo de todas as tarefas.",
          "Na tabela de produtos, digite a quantidade de cada produto em cada unidade (Fábrica, Centro, Santa Mônica, Coqueiros, Areias, Roçado, Pagani). Use a busca para achar o produto.",
          "Confira o rodapé: ele mostra quantos produtos e unidades entram e quantas tarefas serão criadas.",
          "Salve. As tarefas de Produção, Expedição e Unidades aparecem na hora nas listas de cada setor.",
        ],
      },
      {
        tipo: "lista",
        titulo: "O que a lista mostra",
        itens: [
          { rotulo: "Colunas Produção / Expedição / Unidades", texto: "Quantas tarefas de cada setor já foram concluídas (ex.: 3/5)." },
          { rotulo: "Colunas das lojas", texto: "Total pedido para cada unidade." },
          { rotulo: "Botão ✓ na barra", texto: "Mostra ou esconde as ordens já validadas (ficam ocultas por padrão)." },
          { rotulo: "Ícone de link", texto: "Copia o link direto da ordem para mandar a alguém." },
        ],
      },
      {
        tipo: "passos",
        titulo: "Fechar a ordem",
        itens: [
          "Quando todas as tarefas forem concluídas, a ordem fica “Concluída” sozinha.",
          "Abra a ordem e clique em “Relatório”: ele compara o pedido com o produzido, o separado e o recebido, e destaca as diferenças.",
          "Conferido, mude o status para “Validada”. Se precisar, imprima ou salve o relatório em PDF (A4).",
        ],
      },
      { tipo: "atencao", texto: "Excluir uma ordem apaga também todas as tarefas dela. Use só para pedido lançado por engano." },
    ],
  },
  {
    id: "tarefas-producao",
    setor: "Produção",
    titulo: "Produção: tarefas e conferência",
    resumo: "As tarefas que chegam da ordem de serviço para a fábrica, como andar com elas e registrar o que foi produzido.",
    page: "listaview",
    quem: "Equipe de Produção",
    blocos: [
      { tipo: "lista", titulo: "Como a tarefa chega", itens: [
        { rotulo: "Uma tarefa por produto e unidade", texto: "Ex.: “Banoffinha - Centro: 10”. O prazo é a data de entrega da ordem." },
        { rotulo: "Vínculo com a ordem", texto: "Dentro da tarefa aparece a ordem de serviço de origem; clique para abrir." },
      ] },
      {
        tipo: "status",
        titulo: "Status da tarefa de produção",
        itens: [
          { rotulo: "A verificar", cor: COR.verificar, texto: "Chegou e ainda não começou." },
          { rotulo: "Em produção", cor: COR.andamento, texto: "Começou a ser feita. Use o botão › no cartão para avançar." },
          { rotulo: "Atrasada", cor: COR.atrasada, texto: "Colocado pelo sistema quando o prazo passa sem a tarefa ser concluída. Ninguém escolhe à mão." },
          { rotulo: "Concluída", cor: COR.concluida, texto: "Feita e conferida. O produzido soma no estoque da Fábrica." },
          { rotulo: "Validada", cor: COR.validada, texto: "Gerente ou Administrador conferiu. Some da visão padrão (botão ✓ mostra)." },
        ],
      },
      {
        tipo: "passos",
        titulo: "Concluir com a conferência",
        itens: [
          "Ao marcar “Concluída”, abre a conferência: para cada produto aparece o PEDIDO e um campo PRODUZIDO.",
          "Digite a quantidade que realmente foi feita (mesmo se for igual ao pedido). Todos os campos são obrigatórios.",
          "Confirme. O sistema soma o produzido no estoque da Fábrica e registra no histórico do produto e da tarefa.",
        ],
      },
      { tipo: "dica", texto: "Use o Quadro (colunas por status) para enxergar o dia e a Lista para filtrar por responsável, prazo ou status." },
      { tipo: "atencao", texto: "Reabrir uma tarefa concluída desfaz a entrada no estoque. Só reabra se a conferência estiver errada." },
    ],
  },
  {
    id: "tarefas-expedicao",
    setor: "Produção",
    titulo: "Expedição: separar e enviar",
    resumo: "Uma tarefa por loja em cada ordem: separar os produtos, imprimir o romaneio e registrar o que foi separado.",
    page: "expedicao",
    quem: "Equipe de Expedição",
    blocos: [
      { tipo: "lista", titulo: "Como a tarefa chega", itens: [
        { rotulo: "Uma tarefa por loja", texto: "Ex.: “Expedição - Centro - 24/10/2026”, com a lista de produtos e quantidades daquela loja." },
        { rotulo: "Fábrica não entra", texto: "O que fica na Fábrica não gera expedição." },
      ] },
      {
        tipo: "status",
        titulo: "Status da tarefa de expedição",
        itens: [
          { rotulo: "A verificar", cor: COR.verificar, texto: "A separar." },
          { rotulo: "Atrasada", cor: COR.atrasada, texto: "Passou da data de entrega sem concluir (automático)." },
          { rotulo: "Concluída", cor: COR.concluida, texto: "Separado e enviado, com a conferência preenchida." },
          { rotulo: "Validada", cor: COR.validada, texto: "Conferida pela gestão." },
        ],
      },
      {
        tipo: "passos",
        titulo: "Passo a passo",
        itens: [
          "Abra a tarefa da loja e clique em “Romaneio” para imprimir a lista (A4) que vai junto com a carga.",
          "Separe os produtos conferindo pelo romaneio.",
          "Marque “Concluída” e preencha o SEPARADO de cada produto na conferência.",
        ],
      },
      { tipo: "dica", texto: "A expedição não mexe no estoque: o produto só sai da Fábrica quando a loja confirma o recebimento." },
    ],
  },
  {
    id: "estoque",
    setor: "Produção",
    titulo: "Estoque: como está organizado",
    resumo: "Saldo de cada produto na Fábrica e em cada loja, o que movimenta os números e como tirar o relatório.",
    page: "estoque",
    quem: "Gestão (edita) · Produção, Expedição e Lojas (consultam)",
    blocos: [
      { tipo: "lista", titulo: "Organização", itens: [
        { rotulo: "Categorias", texto: "Os produtos ficam agrupados como na planilha de reposição: Frutas, Caseirinhos, Brownies, Copinhos, Bolos Gelados, Bolos de Potes, Congelados, Tortas Acrílico Fatia e Encomendas." },
        { rotulo: "Colunas por local", texto: "Fábrica, Centro, Santa Mônica, Coqueiros, Areias, Roçado e Pagani — o saldo de cada um." },
        { rotulo: "Detalhe do produto", texto: "Clique no produto para ver o histórico de todas as movimentações (quem, quando e por quê)." },
      ] },
      { tipo: "fluxo", titulo: "O que muda os números", itens: [
        { rotulo: "Produção concluída", texto: "Soma o produzido na Fábrica." },
        { rotulo: "Recebimento concluído", texto: "Tira da Fábrica e coloca na loja que recebeu." },
        { rotulo: "Ajuste manual", texto: "Quem tem permissão de edição pode corrigir o número na célula; fica no histórico." },
      ] },
      { tipo: "passos", titulo: "Relatório de estoque", itens: [
        "Clique em “Relatório” no topo da tela.",
        "Escolha uma, várias ou todas as unidades.",
        "Imprima ou salve em PDF (A4).",
      ] },
      { tipo: "atencao", texto: "O estoque é dado real da operação. Corrija à mão só com contagem física feita — o ajuste vale na hora para todos." },
    ],
  },

  // ───────────── Lojas ─────────────
  {
    id: "unidades",
    setor: "Lojas",
    titulo: "Unidades: conferir o recebimento",
    resumo: "Cada loja confirma o que chegou da fábrica. É essa confirmação que transfere o estoque.",
    page: "unidades",
    quem: "Líder (Loja)",
    blocos: [
      { tipo: "lista", titulo: "Como a tarefa chega", itens: [
        { rotulo: "Uma tarefa por loja", texto: "Ex.: “Recebimento - Coqueiros - 24/10/2026”, com os produtos e quantidades enviados." },
      ] },
      { tipo: "passos", titulo: "Passo a passo", itens: [
        "Quando a carga chegar, confira os produtos com o romaneio que veio junto.",
        "Abra a tarefa da sua loja e marque “Concluída”.",
        "Na conferência, digite o RECEBIDO de cada produto — o que de fato chegou, mesmo que diferente do enviado.",
        "Confirme. O recebido sai do estoque da Fábrica e entra no estoque da sua loja.",
      ] },
      { tipo: "dica", texto: "Diferença entre separado e recebido aparece no relatório da ordem — por isso digite o número real, não o do romaneio." },
    ],
  },

  // ───────────── RH ─────────────
  {
    id: "vagas",
    setor: "RH",
    titulo: "Vagas: criar e divulgar",
    resumo: "Cadastrar unidades e vagas, escrever a descrição e usar a página pública de candidatura (link na bio).",
    page: "recrutamento-vagas",
    quem: "Recursos Humanos",
    blocos: [
      { tipo: "passos", titulo: "Criar uma vaga", itens: [
        "Em RH → Vagas, escolha a unidade (ou crie com “+ Nova unidade”: cidade e bairro).",
        "Clique em “+ Nova vaga” e informe o cargo (ex.: Auxiliar de Cozinha/Confeitaria).",
        "Preencha Descrição (rotina e responsabilidades), Requisitos (um por linha) e Diferenciais (um por linha).",
        "Deixe a vaga aberta para ela aparecer na página pública. Feche quando não estiver mais contratando.",
      ] },
      { tipo: "lista", titulo: "Por que a descrição é tão importante", itens: [
        { rotulo: "Para o candidato", texto: "Antes de enviar o currículo ele lê “Sobre a vaga”. Sem descrição, vai direto ao formulário sem saber o que faz o cargo." },
        { rotulo: "Para o Agente de IA", texto: "A nota de cada candidato (0 a 100, Ótimo/Bom/Ruim) é calculada comparando o currículo com a descrição, os requisitos e os diferenciais. Sem esse texto, a IA não tem base para avaliar." },
        { rotulo: "Aviso na tela", texto: "Vaga sem descrição aparece em laranja: “Sem descrição — o candidato vai direto ao formulário e a IA fica sem base”." },
      ] },
      { tipo: "lista", titulo: "Página pública", itens: [
        { rotulo: "Link na bio", texto: "/vagas mostra um botão por unidade; cada unidade lista as vagas abertas. Use “Copiar link” ou “Copiar link da unidade”." },
        { rotulo: "Textos e Pixel", texto: "Título, subtítulo, rodapé, Instagram e Pixel do Facebook são editados no bloco “Página pública”." },
        { rotulo: "Candidatura", texto: "O candidato informa nome, WhatsApp e currículo. Entra no Banco de Talentos como “Novo”; se o WhatsApp já existir, atualiza o cadastro em vez de duplicar." },
      ] },
    ],
  },
  {
    id: "banco-talentos",
    setor: "RH",
    titulo: "Banco de Talentos: o Kanban do recrutamento",
    resumo: "Como os candidatos andam pelas colunas, do currículo recebido à contratação.",
    page: "recrutamento-talentos",
    quem: "Recursos Humanos",
    blocos: [
      {
        tipo: "status",
        titulo: "Colunas do quadro (na ordem do funil)",
        itens: [
          { rotulo: "Novo", cor: "#38BDF8", texto: "Acabou de se candidatar pela página pública (ou foi cadastrado à mão)." },
          { rotulo: "Banco de Talentos", cor: "#F8AE00", texto: "Perfil bom, mas sem vaga no momento — fica guardado para chamar depois." },
          { rotulo: "Qualificado", cor: "#16A34A", texto: "Passou na triagem; vale chamar para conversar." },
          { rotulo: "Reunião agendada", cor: "#3DB88B", texto: "Entrevista marcada." },
          { rotulo: "Em teste", cor: "#8B5CF6", texto: "Aprovado na entrevista; em período de teste antes da contratação." },
          { rotulo: "Contratado", cor: "#2563EB", texto: "Entrou na equipe." },
          { rotulo: "Desqualificado", cor: "#87909E", texto: "Não segue no processo. Fica oculto por padrão." },
          { rotulo: "Antigos", cor: "#78716C", texto: "Arquivo de candidatos antigos. Oculto por padrão." },
        ],
      },
      { tipo: "passos", titulo: "Triagem do dia a dia", itens: [
        "Abra a coluna Novo e clique no candidato.",
        "Leia o resumo e a nota da IA (Qualidade: Ótimo / Bom / Ruim). Abra o currículo anexado se precisar.",
        "Use o botão do WhatsApp: a conversa abre com a mensagem de primeiro contato já escrita com o nome e a vaga.",
        "Conforme o andamento, troque o Status no detalhe do candidato — o cartão muda de coluna.",
      ] },
      { tipo: "dica", texto: "Mudou a vaga do candidato? A análise antiga fica marcada como desatualizada — clique em “Reanalisar”." },
    ],
  },
  {
    id: "agente-ia",
    setor: "RH",
    titulo: "Agente IA: análise de currículo",
    resumo: "O que a IA faz com cada currículo e onde ajustar o comportamento dela.",
    page: "recrutamento-agente",
    quem: "Recursos Humanos / Administrador",
    blocos: [
      { tipo: "lista", titulo: "O que a IA entrega", itens: [
        { rotulo: "Resumo", texto: "3 a 5 frases sobre o candidato, experiências, formação, pontos fortes e alertas." },
        { rotulo: "Nota e classificação", texto: "0 a 100 e Ótimo / Bom / Ruim, comparando com a vaga, com justificativa e lacunas." },
        { rotulo: "Quando roda", texto: "Automaticamente na candidatura (se a ferramenta estiver ligada) ou no botão “Analisar com IA” do candidato." },
      ] },
      { tipo: "lista", titulo: "Abas da tela", itens: [
        { rotulo: "Prompt", texto: "As instruções que a IA segue. Pode ajustar o critério da empresa." },
        { rotulo: "LLM", texto: "Token do OpenRouter, modelo e leitor de PDF." },
        { rotulo: "Ferramentas", texto: "Liga/desliga a análise automática e escolhe os grupos de WhatsApp avisados a cada candidatura." },
      ] },
      { tipo: "atencao", texto: "A IA é apoio à triagem, não decisão final: sempre leia o currículo antes de desqualificar alguém." },
    ],
  },

  // ───────────── Administrativo ─────────────
  {
    id: "contas-cadastrar",
    setor: "Administrativo",
    titulo: "Contas a Pagar: cadastrar uma conta",
    resumo: "Lançar conta única ou parcelada, com empresa, plano de contas, forma de pagamento e comprovante.",
    page: "contas-pagar",
    quem: "Administrativo / Financeiro",
    blocos: [
      { tipo: "passos", titulo: "Nova conta", itens: [
        "Em Administrativo → Contas a Pagar, clique em “+ Nova conta”.",
        "Descrição: fornecedor + referência, em maiúsculas (ex.: “CELESC - FÁBRICA 09/2026”, “TORTELLI NF000024861”).",
        "Vencimento e Valor original (o valor do boleto, sem juros).",
        "Plano de contas e Empresa (CNPJ que paga). Se faltar, use “+ Novo plano de contas” / “+ Nova empresa” dentro da própria lista.",
        "Forma: Boleto, PIX, Débito automático, Cartão de crédito ou Transferência.",
        "Parcelas (mensais): informe o total. O sistema cria uma conta por mês, com “(PARCELA 1/6)”, “(PARCELA 2/6)”… no nome.",
        "Situação: “A pagar” para conta nova. Se já foi paga, escolha a situação de pago e informe valor e data do pagamento.",
        "Observação / código de barras: cole a linha digitável do boleto — vira o botão “copiar código” na lista.",
        "Anexe o boleto ou comprovante (PDF, JPG ou PNG até 20 MB) e clique em Salvar.",
      ] },
      { tipo: "dica", texto: "Na conta parcelada, o comprovante e o pagamento informados ficam só na 1ª parcela; as demais nascem “A pagar”." },
    ],
  },
  {
    id: "contas-status",
    setor: "Administrativo",
    titulo: "Contas a Pagar: pagar e alterar status",
    resumo: "Como dar baixa num pagamento, anexar o comprovante e ler os sinais da lista.",
    page: "contas-pagar",
    quem: "Administrativo / Financeiro",
    blocos: [
      {
        tipo: "status",
        titulo: "Situações",
        itens: [
          { rotulo: "A pagar", cor: COR.aberto, texto: "Em aberto. A lista mostra o prazo: “Vence hoje”, “Vence em 3d” ou “Vencida · 5d”." },
          { rotulo: "QR Code / PIX", cor: COR.aberto, texto: "Em aberto, a pagar por PIX." },
          { rotulo: "Pago", cor: COR.pago, texto: "Pago, ainda sem comprovante anexado." },
          { rotulo: "Pago c/ comprovante", cor: COR.pago, texto: "Pago e com comprovante no sistema." },
          { rotulo: "Pago no débito / no crédito", cor: COR.pago, texto: "Pago por débito automático ou cartão." },
        ],
      },
      { tipo: "passos", titulo: "Dar baixa num pagamento", itens: [
        "Na lista, clique na etiqueta de situação da conta e escolha a situação de pago — a data de hoje e o valor original entram sozinhos.",
        "Pagou com juros ou em outra data? Clique em Editar e ajuste “Valor pago (com juros)” e “Data de pagamento”.",
        "Clique no clipe para anexar o comprovante.",
      ] },
      { tipo: "lista", titulo: "Sinais da lista", itens: [
        { rotulo: "Bolinha vermelha no clipe", texto: "A conta não tem comprovante. Some quando você anexa." },
        { rotulo: "Borda vermelha na linha", texto: "Conta vencida e ainda não paga." },
        { rotulo: "“pago R$ …” em vermelho", texto: "Foi paga com valor acima do original (juros/multa)." },
        { rotulo: "Clipe com número", texto: "Quantos comprovantes há — clique para abrir ou anexar outro." },
      ] },
      { tipo: "lista", titulo: "Encontrar contas", itens: [
        { rotulo: "Mês", texto: "As setas ‹ › no topo trocam o mês de vencimento." },
        { rotulo: "Filtros", texto: "Busca (fornecedor, NF, código de barras), Todas / A pagar / Vencidas / Pagas, plano, empresas (várias), forma e intervalo de vencimento (“Hoje” mostra o que vence hoje)." },
        { rotulo: "Por plano de contas", texto: "O quadro à direita soma o filtro por plano; clique num plano para filtrar." },
      ] },
    ],
  },
  {
    id: "contas-dashboard",
    setor: "Administrativo",
    titulo: "Contas a Pagar: indicadores e dashboard",
    resumo: "O que cada número significa e como usar a visão do ano.",
    page: "contas-pagar",
    quem: "Administrativo / Gestão",
    blocos: [
      { tipo: "lista", titulo: "Cartões do topo (todas as contas, sem filtro)", itens: [
        { rotulo: "Vencidas", texto: "Soma do que passou do vencimento e não foi pago. Clique para ver a lista." },
        { rotulo: "Vencem amanhã", texto: "O que precisa ser pago no dia seguinte. Clique para ver a lista." },
        { rotulo: "Total em aberto", texto: "Tudo que ainda falta pagar, de qualquer mês." },
        { rotulo: "Pago no mês atual", texto: "Pagamentos com data de pagamento neste mês (com juros)." },
      ] },
      { tipo: "lista", titulo: "Resumo do filtro (aba Contas)", itens: [
        { rotulo: "Contas filtradas · Valor total · Pago · Em aberto", texto: "Mudam com os filtros — ex.: escolha uma empresa para ver quanto ela tem em aberto." },
      ] },
      { tipo: "lista", titulo: "Aba Dashboard (visão do ano)", itens: [
        { rotulo: "Total lançado / Pago / Em aberto / Vencido", texto: "Somas do ano escolhido, com o % já pago." },
        { rotulo: "Juros e multas pagos", texto: "Quanto foi pago acima do valor original — o custo de pagar atrasado." },
        { rotulo: "Despesas por mês", texto: "Barras por mês de vencimento: azul = pago, âmbar = em aberto." },
        { rotulo: "Maiores planos / Por empresa", texto: "Onde está o gasto, em ordem do maior." },
        { rotulo: "Vencidas há mais tempo / Próximos 30 dias", texto: "Prioridades: o que está atrasado e o que vem pela frente. Clique para abrir a conta." },
      ] },
      { tipo: "dica", texto: "Rotina sugerida: começar o dia pelos cartões Vencidas e Vencem amanhã, e no fim do mês conferir Juros e multas pagos." },
    ],
  },
];

// ───────────── Fluxogramas (um por guia; entram como 1º bloco e substituem a lista "fluxo") ─────────────
const R = {
  gestao: { id: "gestao", rotulo: "Gestão", cor: "#955C6B" },
  producao: { id: "producao", rotulo: "Produção", cor: "#A4466A" },
  expedicao: { id: "expedicao", rotulo: "Expedição", cor: "#0E8FB0" },
  loja: { id: "loja", rotulo: "Loja", cor: "#C98500" },
  sistema: { id: "sistema", rotulo: "Sistema", cor: "#5B6472" },
  setores: { id: "setores", rotulo: "Setores", cor: "#A4466A" },
  rh: { id: "rh", rotulo: "RH", cor: "#C2410C" },
  candidato: { id: "candidato", rotulo: "Candidato", cor: "#2563EB" },
  ia: { id: "ia", rotulo: "Agente IA", cor: "#7C3AED" },
  fin: { id: "fin", rotulo: "Financeiro", cor: "#1B7F4D" },
};
const linhas = (r: Raia, n: number): Raia => ({ ...r, linhas: n });
const enc = (pares: [string, string, string?][]): Seta[] => pares.map(([de, para, rotulo]) => ({ de, para, rotulo }));

const DIAGRAMAS: Record<string, Diagrama> = {
  "fluxo-pedido": {
    tipo: "diagrama", titulo: "O caminho do pedido",
    raias: [R.gestao, R.producao, R.expedicao, R.loja, R.sistema],
    nos: [
      { id: "a", raia: "gestao", col: 0, forma: "inicio", texto: "Cria a ordem de serviço" },
      { id: "b", raia: "sistema", col: 1, forma: "sistema", texto: "Gera as tarefas de cada setor" },
      { id: "c", raia: "producao", col: 2, texto: "Produz e informa o PRODUZIDO" },
      { id: "d", raia: "sistema", col: 3, forma: "sistema", texto: "Soma no estoque da Fábrica" },
      { id: "e", raia: "expedicao", col: 4, texto: "Separa, imprime o romaneio e envia" },
      { id: "f", raia: "loja", col: 5, texto: "Confere e informa o RECEBIDO" },
      { id: "g", raia: "sistema", col: 6, forma: "sistema", texto: "Tira da Fábrica e coloca na loja" },
      { id: "h", raia: "gestao", col: 7, texto: "Confere o relatório da ordem" },
      { id: "i", raia: "gestao", col: 8, forma: "fim", texto: "Valida a ordem" },
    ],
    setas: enc([["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"], ["f", "g"], ["g", "h"], ["h", "i"]]),
  },
  "ordem-servico": {
    tipo: "diagrama",
    raias: [R.gestao, R.sistema, R.setores],
    nos: [
      { id: "a", raia: "gestao", col: 0, forma: "inicio", texto: "+ Nova ordem" },
      { id: "b", raia: "gestao", col: 1, texto: "Entrega + quantidade por produto e loja" },
      { id: "c", raia: "sistema", col: 2, forma: "sistema", texto: "Cria tarefas de Produção, Expedição e Unidades" },
      { id: "d", raia: "setores", col: 3, texto: "Setores trabalham nas tarefas" },
      { id: "e", raia: "sistema", col: 4, forma: "sistema", texto: "Ordem vai para Em andamento → Concluída" },
      { id: "f", raia: "gestao", col: 5, texto: "Abre o Relatório" },
      { id: "g", raia: "gestao", col: 6, forma: "decisao", texto: "Pedido bate com o realizado?" },
      { id: "h", raia: "gestao", col: 7, forma: "fim", texto: "Validada" },
      { id: "i", raia: "setores", col: 7, texto: "Setor revisa a conferência" },
    ],
    setas: [...enc([["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"], ["f", "g"], ["g", "h", "Sim"], ["g", "i", "Não"]]), { de: "i", para: "f", rotulo: "corrigido", tracejada: true }],
  },
  "tarefas-producao": {
    tipo: "diagrama",
    raias: [R.sistema, R.producao, R.gestao],
    nos: [
      { id: "a", raia: "sistema", col: 0, forma: "inicio", texto: "Tarefa chega: produto × loja" },
      { id: "b", raia: "producao", col: 1, texto: "A verificar" },
      { id: "c", raia: "producao", col: 2, texto: "› Em produção" },
      { id: "x", raia: "sistema", col: 2, forma: "sistema", texto: "Prazo passou: vira Atrasada" },
      { id: "d", raia: "producao", col: 3, texto: "Marca Concluída" },
      { id: "e", raia: "producao", col: 4, texto: "Informa o PRODUZIDO de cada produto" },
      { id: "f", raia: "sistema", col: 5, forma: "sistema", texto: "Soma na Fábrica + histórico" },
      { id: "g", raia: "gestao", col: 6, forma: "fim", texto: "Gestão valida" },
    ],
    setas: [...enc([["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"], ["f", "g"]]), { de: "c", para: "x", rotulo: "se atrasar", tracejada: true }],
  },
  "tarefas-expedicao": {
    tipo: "diagrama",
    raias: [R.sistema, R.expedicao, R.loja],
    nos: [
      { id: "a", raia: "sistema", col: 0, forma: "inicio", texto: "Uma tarefa por loja (Fábrica não entra)" },
      { id: "b", raia: "expedicao", col: 1, texto: "Abre a tarefa e imprime o Romaneio" },
      { id: "c", raia: "expedicao", col: 2, texto: "Separa conferindo o romaneio" },
      { id: "d", raia: "expedicao", col: 3, texto: "Envia a carga com o romaneio" },
      { id: "e", raia: "expedicao", col: 4, texto: "Concluída + informa o SEPARADO" },
      { id: "g", raia: "sistema", col: 5, forma: "sistema", texto: "Estoque ainda não muda" },
      { id: "f", raia: "loja", col: 5, forma: "fim", texto: "Loja confere no recebimento" },
    ],
    setas: [...enc([["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"]]), { de: "e", para: "g", tracejada: true }],
  },
  unidades: {
    tipo: "diagrama",
    raias: [linhas(R.loja, 2), R.sistema, R.gestao],
    nos: [
      { id: "a", raia: "loja", col: 0, forma: "inicio", texto: "Carga chega com o romaneio" },
      { id: "b", raia: "loja", col: 1, texto: "Confere os produtos" },
      { id: "c", raia: "loja", col: 2, forma: "decisao", texto: "Chegou tudo certo?" },
      { id: "d", raia: "loja", col: 3, texto: "RECEBIDO = o que foi enviado" },
      { id: "e", raia: "loja", col: 3, linha: 1, texto: "RECEBIDO = o que chegou de fato" },
      { id: "f", raia: "loja", col: 4, texto: "Marca Concluída" },
      { id: "g", raia: "sistema", col: 5, forma: "sistema", texto: "Sai da Fábrica, entra na loja" },
      { id: "h", raia: "gestao", col: 6, forma: "fim", texto: "Diferenças no relatório da ordem" },
    ],
    setas: enc([["a", "b"], ["b", "c"], ["c", "d", "Sim"], ["c", "e", "Não"], ["d", "f"], ["e", "f"], ["f", "g"], ["g", "h"]]),
  },
  estoque: {
    tipo: "diagrama", titulo: "O que muda os números",
    raias: [R.producao, R.loja, R.gestao],
    nos: [
      { id: "a", raia: "producao", col: 0, forma: "inicio", texto: "Produção concluída" },
      { id: "d", raia: "producao", col: 1, forma: "sistema", texto: "+ Fábrica (produzido)" },
      { id: "b", raia: "loja", col: 0, forma: "inicio", texto: "Recebimento concluído" },
      { id: "e", raia: "loja", col: 1, forma: "sistema", texto: "− Fábrica / + loja (recebido)" },
      { id: "c", raia: "gestao", col: 0, forma: "inicio", texto: "Contagem física" },
      { id: "f", raia: "gestao", col: 1, texto: "Corrige o número na célula" },
      { id: "g", raia: "loja", col: 2, forma: "sistema", texto: "Novo saldo + histórico do produto" },
      { id: "h", raia: "gestao", col: 3, forma: "fim", texto: "Relatório por unidade (A4/PDF)" },
    ],
    setas: enc([["a", "d"], ["b", "e"], ["c", "f"], ["d", "g"], ["e", "g"], ["f", "g"], ["g", "h"]]),
  },
  vagas: {
    tipo: "diagrama",
    raias: [R.rh, R.candidato, linhas(R.sistema, 2), R.ia],
    nos: [
      { id: "a", raia: "rh", col: 0, forma: "inicio", texto: "Nova vaga na unidade" },
      { id: "b", raia: "rh", col: 1, texto: "Escreve descrição, requisitos e diferenciais" },
      { id: "c", raia: "rh", col: 2, texto: "Vaga aberta + link na bio" },
      { id: "d", raia: "candidato", col: 3, texto: "Lê “Sobre a vaga” e envia o currículo" },
      { id: "e", raia: "sistema", col: 4, forma: "decisao", texto: "WhatsApp já cadastrado?" },
      { id: "f", raia: "sistema", col: 5, forma: "sistema", texto: "Atualiza o cadastro (recandidatura)" },
      { id: "g", raia: "sistema", col: 5, linha: 1, forma: "sistema", texto: "Entra como Novo no Banco de Talentos" },
      { id: "h", raia: "ia", col: 6, forma: "sistema", texto: "Compara currículo × vaga e dá a nota" },
      { id: "i", raia: "rh", col: 7, forma: "fim", texto: "Triagem no Banco de Talentos" },
    ],
    setas: enc([["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f", "Sim"], ["e", "g", "Não"], ["f", "h"], ["g", "h"], ["h", "i"]]),
  },
  "banco-talentos": {
    tipo: "diagrama",
    raias: [linhas(R.rh, 3)],
    nos: [
      { id: "a", raia: "rh", col: 0, linha: 1, forma: "inicio", texto: "Novo" },
      { id: "b", raia: "rh", col: 1, linha: 1, texto: "Lê o resumo e a nota da IA" },
      { id: "c", raia: "rh", col: 2, linha: 1, forma: "decisao", texto: "O perfil serve?" },
      { id: "d", raia: "rh", col: 3, linha: 0, texto: "Qualificado" },
      { id: "e", raia: "rh", col: 3, linha: 1, texto: "Banco de Talentos (sem vaga agora)" },
      { id: "f", raia: "rh", col: 3, linha: 2, forma: "fim", texto: "Desqualificado" },
      { id: "g", raia: "rh", col: 4, linha: 0, texto: "WhatsApp com mensagem pronta" },
      { id: "h", raia: "rh", col: 5, linha: 0, texto: "Reunião agendada" },
      { id: "l", raia: "rh", col: 6, linha: 0, texto: "Em teste" },
      { id: "i", raia: "rh", col: 7, linha: 0, forma: "decisao", texto: "Aprovado?" },
      { id: "j", raia: "rh", col: 8, linha: 0, forma: "fim", texto: "Contratado" },
      { id: "k", raia: "rh", col: 8, linha: 1, forma: "fim", texto: "Desqualificado" },
    ],
    setas: [...enc([["a", "b"], ["b", "c"], ["c", "d", "Sim"], ["c", "e", "Depois"], ["c", "f", "Não"], ["d", "g"], ["g", "h"], ["h", "l"], ["l", "i"], ["i", "j", "Sim"], ["i", "k", "Não"]]), { de: "e", para: "d", rotulo: "abriu vaga", tracejada: true }],
  },
  "agente-ia": {
    tipo: "diagrama",
    raias: [R.candidato, R.sistema, R.rh, R.ia],
    nos: [
      { id: "a", raia: "candidato", col: 0, forma: "inicio", texto: "Envia o currículo" },
      { id: "b", raia: "sistema", col: 1, forma: "decisao", texto: "Análise automática ligada?" },
      { id: "d", raia: "rh", col: 2, texto: "Clica “Analisar com IA” no candidato" },
      { id: "c", raia: "ia", col: 3, forma: "sistema", texto: "Lê o currículo (PDF ou foto)" },
      { id: "e", raia: "ia", col: 4, forma: "sistema", texto: "Compara com descrição, requisitos e diferenciais" },
      { id: "f", raia: "ia", col: 5, forma: "sistema", texto: "Resumo + nota 0–100 + Ótimo/Bom/Ruim" },
      { id: "g", raia: "rh", col: 6, forma: "fim", texto: "RH decide a próxima etapa" },
    ],
    setas: enc([["a", "b"], ["b", "c", "Sim"], ["b", "d", "Não"], ["d", "c"], ["c", "e"], ["e", "f"], ["f", "g"]]),
  },
  "contas-cadastrar": {
    tipo: "diagrama",
    raias: [linhas(R.fin, 2), linhas(R.sistema, 2)],
    nos: [
      { id: "a", raia: "fin", col: 0, forma: "inicio", texto: "+ Nova conta" },
      { id: "b", raia: "fin", col: 1, texto: "Descrição, vencimento e valor" },
      { id: "c", raia: "fin", col: 2, texto: "Plano, empresa e forma" },
      { id: "d", raia: "fin", col: 3, forma: "decisao", texto: "Já está paga?" },
      { id: "e", raia: "fin", col: 4, texto: "Situação de pago + valor, data e comprovante" },
      { id: "f", raia: "fin", col: 4, linha: 1, texto: "Fica “A pagar” (anexe o boleto)" },
      { id: "g", raia: "fin", col: 5, forma: "decisao", texto: "Mais de 1 parcela?" },
      { id: "h", raia: "sistema", col: 6, forma: "sistema", texto: "Cria 1 conta por mês (PARCELA x/N)" },
      { id: "i", raia: "sistema", col: 6, linha: 1, forma: "sistema", texto: "Cria 1 conta" },
      { id: "j", raia: "sistema", col: 7, forma: "fim", texto: "Aparece na lista e nos cartões" },
    ],
    setas: enc([["a", "b"], ["b", "c"], ["c", "d"], ["d", "e", "Sim"], ["d", "f", "Não"], ["e", "g"], ["f", "g"], ["g", "h", "Sim"], ["g", "i", "Não"], ["h", "j"], ["i", "j"]]),
  },
  "contas-status": {
    tipo: "diagrama",
    raias: [linhas(R.sistema, 2), linhas(R.fin, 2)],
    nos: [
      { id: "a", raia: "sistema", col: 0, forma: "inicio", texto: "Conta “A pagar”" },
      { id: "b", raia: "sistema", col: 1, forma: "decisao", texto: "Passou do vencimento?" },
      { id: "c", raia: "sistema", col: 2, forma: "sistema", texto: "Vencida · Nd (borda vermelha)" },
      { id: "d", raia: "sistema", col: 2, linha: 1, forma: "sistema", texto: "Vence hoje / em Nd" },
      { id: "e", raia: "fin", col: 3, texto: "Paga o boleto ou PIX" },
      { id: "f", raia: "fin", col: 4, texto: "Troca a situação na etiqueta" },
      { id: "g", raia: "fin", col: 5, forma: "decisao", texto: "Juros ou outra data?" },
      { id: "h", raia: "fin", col: 6, linha: 1, texto: "Editar: valor pago e data" },
      { id: "i", raia: "fin", col: 7, texto: "Anexa o comprovante no clipe" },
      { id: "j", raia: "sistema", col: 8, forma: "fim", texto: "Bolinha vermelha some" },
    ],
    setas: enc([["a", "b"], ["b", "c", "Sim"], ["b", "d", "Não"], ["c", "e"], ["d", "e"], ["e", "f"], ["f", "g"], ["g", "h", "Sim"], ["g", "i", "Não"], ["h", "i"], ["i", "j"]]),
  },
  "contas-dashboard": {
    tipo: "diagrama", titulo: "Rotina sugerida",
    raias: [linhas(R.fin, 2)],
    nos: [
      { id: "a", raia: "fin", col: 0, forma: "inicio", texto: "Abre Contas a Pagar" },
      { id: "b", raia: "fin", col: 1, texto: "Olha Vencidas e Vencem amanhã" },
      { id: "c", raia: "fin", col: 2, forma: "decisao", texto: "Tem conta vencida?" },
      { id: "d", raia: "fin", col: 3, texto: "Clica no cartão e paga primeiro" },
      { id: "e", raia: "fin", col: 3, linha: 1, texto: "Confere o mês na lista" },
      { id: "f", raia: "fin", col: 4, texto: "Fim do mês: aba Dashboard" },
      { id: "g", raia: "fin", col: 5, forma: "fim", texto: "Juros pagos e maiores gastos" },
    ],
    setas: enc([["a", "b"], ["b", "c"], ["c", "d", "Sim"], ["c", "e", "Não"], ["d", "f"], ["e", "f"], ["f", "g"]]),
  },
};

/** Guias com o fluxograma na frente (no lugar da lista "fluxo", quando houver). */
export const GUIAS: Guia[] = BASE.map((g) => {
  const d = DIAGRAMAS[g.id];
  return d ? { ...g, blocos: [d, ...g.blocos.filter((b) => b.tipo !== "fluxo")] } : g;
});
