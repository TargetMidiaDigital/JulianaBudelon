/**
 * Agentes de IA — constantes compartilhadas entre servidor e navegador (sem segredo aqui).
 * Mesmo desenho do CRM do Cachorrão HD (types/agente.ts): uma linha por agente na tabela
 * `agente_ia`, identificada por `slug`. Neste sistema só existe o agente de RECRUTAMENTO.
 */

export const AGENTE_RECRUTAMENTO = "recrutamento";

/** Motores de leitura de PDF do OpenRouter (plugin file-parser). */
export const PDF_ENGINES: { value: string; label: string; custo: string }[] = [
  { value: "native", label: "Nativo do modelo", custo: "Sem custo extra — cobra como texto normal. Exige um modelo que leia arquivo (ex.: Gemini 2.5 Flash)." },
  { value: "mistral-ocr", label: "OCR da Mistral", custo: "US$ 2 por 1.000 páginas. Melhor com currículo escaneado ou foto de papel." },
  { value: "cloudflare-ai", label: "Cloudflare", custo: "Grátis. Só funciona bem com PDF de texto real; escaneado volta vazio." },
];
export const PDF_ENGINE_PADRAO = "native";

/** Modelos sugeridos. Todos multimodais: o currículo chega como PDF, mas também como foto do papel. */
export const MODELOS_RECRUTAMENTO: { id: string; label: string }[] = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (recomendado — lê PDF e imagem nativo)" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (mais barato)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (mais criterioso, mais caro)" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
];
export const MODELO_RECRUTAMENTO_PADRAO = "google/gemini-2.5-flash";

/** Interruptores da aba Ferramentas. Chave ausente = ligado. */
export const FERRAMENTAS_RECRUTAMENTO: { key: string; nome: string; descricao: string }[] = [
  {
    key: "notificar_curriculo",
    nome: "Avisar novo currículo no grupo de WhatsApp",
    descricao: "A cada candidatura recebida pela página de vagas, avisa os grupos cadastrados em Configurações → WhatsApp com o nome, a vaga, a unidade e o link do candidato. O arquivo do currículo não vai na mensagem — abre pelo painel, que tem login.",
  },
  {
    key: "analisar_curriculo",
    nome: "Analisar currículo ao receber candidatura",
    descricao: "Quando chega uma candidatura pela página de vagas, a IA lê o currículo e grava o resumo e a nota de aderência à vaga no candidato. Desligado, a análise só roda pelo botão \"Analisar com IA\" no candidato. Atenção: o conteúdo do currículo é enviado ao OpenRouter.",
  },
];

/**
 * Instruções padrão do agente (a parte que a equipe pode editar em Configurações → Agente IA
 * → Prompt). O FORMATO da resposta (JSON com resumo, nota etc.) é fixo no código e vai
 * anexado a estas instruções — editar o texto aqui não quebra a leitura do resultado.
 */
export const PROMPT_RECRUTAMENTO_PADRAO = [
  "Você é a assistente de recrutamento da Ju Budelon, uma rede de cafeteria e confeitaria artesanal da Grande Florianópolis (SC), com unidades e cozinha de produção própria. Você faz a triagem inicial de currículos para vagas operacionais e administrativas (cozinha/confeitaria, atendimento de cafeteria, limpeza, expedição, administrativo/financeiro, RH, marketing, liderança de produção e supervisão de loja).",
  "",
  "Sua tarefa: ler o currículo do candidato e compará-lo com a vaga informada.",
  "",
  "Regras:",
  "- Escreva sempre em português do Brasil, direto e sem floreios. É para a equipe de RH ler em 30 segundos.",
  "- Baseie-se SOMENTE no que está no currículo. Não invente experiência, formação ou dados. Se algo não estiver no currículo, trate como \"não informado\" e liste em lacunas quando for requisito.",
  "- Para vagas operacionais (cozinha, atendimento, limpeza, expedição), valorize experiência prática na função ou em função parecida (restaurante, padaria, lanchonete, supermercado, hotelaria), disponibilidade de horário e estabilidade nos empregos. Formação superior não é requisito nessas vagas e não deve puxar a nota para cima nem para baixo.",
  "- Para vagas administrativas e de análise, valorize experiência na área, ferramentas citadas e formação compatível.",
  "- Nota: 0 a 100. Ótimo = 75 a 100 (atende os requisitos obrigatórios e tem experiência direta), Bom = 50 a 74 (atende parcialmente ou tem experiência correlata), Ruim = 0 a 49 (não atende os requisitos ou não há como avaliar).",
  "- Se o arquivo não for um currículo, estiver ilegível ou vazio, dê nota baixa, classificação Ruim e explique isso em alertas e justificativa.",
  "- Um candidato que se inscreveu para uma vaga mas tem perfil claro para OUTRA vaga da rede: diga isso na justificativa (ex.: \"perfil forte para Atendente de Cafeteria\").",
  "- No resumo não repita idade, gênero, estado civil, religião nem aparência: a nota é sobre experiência e requisitos, nunca sobre a pessoa.",
].join("\n");

/** O que a tela de configuração recebe (sem o token). */
export type AgenteConfigPublica = {
  configurado: boolean; // tem token
  modelo: string;
  engine: string;
  prompt: string; // vazio = padrão
  ferramentas: Record<string, boolean>;
};
