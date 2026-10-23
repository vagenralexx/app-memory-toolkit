export const questions = [
  { key: 'purpose', label: 'Qual problema o app resolve e qual resultado deve entregar?', required: true },
  { key: 'audience', label: 'Quem vai usar o app?', required: true },
  { key: 'platforms', label: 'Onde deve funcionar: web, desktop, mobile, extensão ou combinação?', required: true },
  { key: 'mvp', label: 'Quais funcionalidades são indispensáveis no MVP?', required: true },
  { key: 'journeys', label: 'Qual é o principal fluxo do usuário, do início ao resultado?' },
  { key: 'outOfScope', label: 'O que deve ficar fora da primeira versão?' },
  { key: 'data', label: 'Quais dados serão armazenados? Há dados sensíveis ou uso offline?' },
  { key: 'dataModel', label: 'Quais entidades, relacionamentos, volumes e regras de retenção dos dados?' },
  { key: 'dataOperations', label: 'Como serão migrações, sincronização, seeds sem segredos, backup e recuperação?' },
  { key: 'projectRules', label: 'Quais regras de desenvolvimento, validação e organização de pastas são obrigatórias?' },
  { key: 'auth', label: 'Haverá login, perfis e permissões?' },
  { key: 'integrations', label: 'Quais serviços, APIs ou equipamentos serão integrados?' },
  { key: 'stack', label: 'Existe alguma preferência ou restrição de tecnologia/hospedagem?' },
  { key: 'ui', label: 'Há referências visuais, requisitos de acessibilidade e temas?' },
  { key: 'constraints', label: 'Quais limites de orçamento, prazo, licenciamento e distribuição?' },
  { key: 'acceptance', label: 'Como vamos verificar que o MVP está pronto?' }
];

export function validateAnswers(answers, mode = 'new') {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('Respostas devem ser um objeto JSON.');
  for (const [key, value] of Object.entries(answers)) {
    if (!questions.some(question => question.key === key)) throw new Error(`Pergunta desconhecida: ${key}`);
    if (typeof value !== 'string' || value.length > 12_000) throw new Error(`Resposta inválida: ${key}`);
  }
  if (mode === 'new') for (const question of questions.filter(item => item.required)) {
    if (!answers[question.key]?.trim()) throw new Error(`Resposta obrigatória: ${question.key}`);
  }
  return answers;
}
