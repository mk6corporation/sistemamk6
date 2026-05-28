// Template fixo da jornada MK6 — 90 dias / 15 steps
// Aplicado sob demanda ao cliente via botão "Aplicar MK6 Journey"

export type MK6Tipo = "call_gestor" | "call_cs" | "call_ambos" | "marco";

export interface MK6StepTemplate {
  ordem: number;
  codigo: string;
  fase: string;
  semana: number | null;
  dia_inicio: number;
  dia_fim: number;
  titulo: string;
  subtitulo?: string;
  descricao: string;
  tipo: MK6Tipo;
  responsavel: string;
  mk6_responsabilidade: string;
  cliente_responsabilidade: string;
  tem_trava: boolean;
  trava_descricao?: string;
  /** Itens curtos e diretos da Ação MK6 — viram checkboxes no card de "Step atual". */
  acao_mk6_itens: string[];
}

export const MK6_JOURNEY: MK6StepTemplate[] = [
  // ===== FASE 1: ARRANQUE =====
  {
    ordem: 1, codigo: "f1_onboarding", fase: "Fase 1 — Arranque", semana: 1,
    dia_inicio: 1, dia_fim: 2,
    titulo: "Onboarding — Boas-vindas e expectativas",
    subtitulo: "Só Gestor · ~20 min",
    descricao: "Recebe o cliente, alinha expectativas, metas e calendário. Tom de confiança — começa a construir a relação que vai sustentar a renovação lá na frente.",
    tipo: "call_gestor", responsavel: "Gestor",
    mk6_responsabilidade: "Calendário dos 90 dias alinhado e metas iniciais combinadas.",
    cliente_responsabilidade: "Separar e enviar todos os acessos (BM, conta de anúncio, página, WhatsApp) antes do planejamento.",
    tem_trava: true,
    trava_descricao: "Sem os acessos entregues, o planejamento não roda e a campanha não sobe.",
    acao_mk6_itens: [
      "Realizar call de boas-vindas",
      "Entregar calendário dos 90 dias",
      "Combinar metas iniciais",
    ],
  },
  {
    ordem: 2, codigo: "f1_planejamento", fase: "Fase 1 — Arranque", semana: 1,
    dia_inicio: 2, dia_fim: 3,
    titulo: "Planejamento — Plano e captura de ofertas",
    subtitulo: "Gestor + CS",
    descricao: "Apresentação do plano e do time. CS entra aqui. O gestor confirma os acessos e levanta as ofertas que serão trabalhadas.",
    tipo: "call_ambos", responsavel: "Gestor + CS",
    mk6_responsabilidade: "Plano apresentado, ofertas priorizadas e planilha-CRM entregue com passo a passo de registro.",
    cliente_responsabilidade: "Validar ofertas, confirmar condições/preços para a campanha e começar a registrar leads no CRM.",
    tem_trava: true,
    trava_descricao: "Sem as ofertas validadas, não há o que anunciar — a campanha não sobe.",
    acao_mk6_itens: [
      "Apresentar plano e time",
      "Priorizar ofertas com o cliente",
      "Entregar planilha-CRM com passo a passo",
    ],
  },
  {
    ordem: 3, codigo: "f1_treinamento", fase: "Fase 1 — Arranque", semana: 1,
    dia_inicio: 4, dia_fim: 5,
    titulo: "Treinamento comercial (teoria)",
    subtitulo: "CS",
    descricao: "A base: rapport, SPIN Selling e abordagem por ligação. Em paralelo, o gestor sobe as campanhas — os leads começam a chegar.",
    tipo: "call_cs", responsavel: "CS",
    mk6_responsabilidade: "Campanha no ar (leads chegando) + roteiro de abertura/qualificação entregue.",
    cliente_responsabilidade: "Aplicar abertura/rapport em atendimentos reais e trazer os registros para o roleplay.",
    tem_trava: true,
    trava_descricao: "Sem atendimentos aplicados, não há roleplay — o cliente fica parado.",
    acao_mk6_itens: [
      "Subir campanhas (leads chegando)",
      "Entregar roteiro de abertura e qualificação",
    ],
  },

  // ===== FASE 2: EXECUÇÃO =====
  {
    ordem: 4, codigo: "f2_roleplay1", fase: "Fase 2 — Execução", semana: 2,
    dia_inicio: 8, dia_fim: 14,
    titulo: "Acompanhamento — Roleplay #1",
    subtitulo: "Pôr a teoria em jogo · CS",
    descricao: "CS faz papel de cliente, depois invertem. Foco em abertura, rapport e qualificação por SPIN sobre atendimentos reais.",
    tipo: "call_cs", responsavel: "CS",
    mk6_responsabilidade: "Roteiro de qualificação refinado a partir do roleplay + ajustes apontados por escrito.",
    cliente_responsabilidade: "Conduzir 5 atendimentos com o roteiro e separar 2 conversas difíceis para análise.",
    tem_trava: true,
    trava_descricao: "Sem conversas reais separadas, a demonstração de ligação perde o sentido.",
    acao_mk6_itens: [
      "Conduzir roleplay com o cliente",
      "Entregar roteiro de qualificação refinado",
      "Enviar ajustes por escrito",
    ],
  },
  {
    ordem: 5, codigo: "f2_metricas1", fase: "Fase 2 — Execução", semana: 3,
    dia_inicio: 15, dia_fim: 21,
    titulo: "Métricas #1 — Primeira leitura real de resultados",
    subtitulo: "Gestor",
    descricao: "Com ~2 semanas de campanha, dados maduros: CPL, o que foi feito e próximos passos. Primeira otimização de verdade.",
    tipo: "call_gestor", responsavel: "Gestor",
    mk6_responsabilidade: "Conta otimizada + briefing de criativos enviado + meta de CPL definida.",
    cliente_responsabilidade: "Devolver feedback sobre qualidade dos leads e manter o CRM atualizado.",
    tem_trava: false,
    acao_mk6_itens: [
      "Otimizar conta (matar/escalar conjuntos)",
      "Enviar briefing de criativos ao designer",
      "Definir meta de CPL",
    ],
  },
  {
    ordem: 6, codigo: "f2_demo", fase: "Fase 2 — Execução", semana: 4,
    dia_inicio: 22, dia_fim: 28,
    titulo: "Demonstração — Ligação ao vivo",
    subtitulo: "Ligamos pelos leads do cliente · CS · call única",
    descricao: "Ligamos para os leads dele ao vivo enquanto ele assiste. Quebra a resistência cedo, dando um modelo real para copiar.",
    tipo: "call_cs", responsavel: "CS",
    mk6_responsabilidade: "Demonstração ao vivo feita + modelo de ligação (estrutura e gravação/anotações).",
    cliente_responsabilidade: "Fazer 5 ligações sozinho no mesmo padrão e anotar onde travou.",
    tem_trava: true,
    trava_descricao: "Sem as ligações feitas, não há prática para analisar — a evolução comercial empaca.",
    acao_mk6_itens: [
      "Ligar ao vivo para os leads do cliente",
      "Entregar o modelo de ligação (estrutura + gravação)",
    ],
  },
  {
    ordem: 7, codigo: "f2_metricas2", fase: "Fase 2 — Execução", semana: 5,
    dia_inicio: 29, dia_fim: 35,
    titulo: "Métricas #2 — Otimização e tendência",
    subtitulo: "Gestor",
    descricao: "Tendência de CPL, resultado dos testes de criativo e expansão do que funciona.",
    tipo: "call_gestor", responsavel: "Gestor",
    mk6_responsabilidade: "Conjunto vencedor escalado + variações de criativo no ar.",
    cliente_responsabilidade: "Reportar vendas geradas pelos leads para fechar o cálculo de retorno até aqui.",
    tem_trava: false,
    acao_mk6_itens: [
      "Escalar conjunto vencedor",
      "Subir variações de criativo",
    ],
  },
  {
    ordem: 8, codigo: "f2_whats1", fase: "Fase 2 — Execução", semana: 6,
    dia_inicio: 36, dia_fim: 42,
    titulo: "Análise de WhatsApp #1 — Qualificação na prática",
    subtitulo: "CS",
    descricao: "Revisão das conversas reais juntos. Foco em qualificação SPIN e abertura — corrigir o que está esfriando o lead.",
    tipo: "call_cs", responsavel: "CS",
    mk6_responsabilidade: "Conversas anotadas com correções e modelos de abordagem prontos para reuso.",
    cliente_responsabilidade: "Reescrever 3 abordagens fracas e aplicar nos próximos leads.",
    tem_trava: true,
    trava_descricao: "Sem abordagens corrigidas em uso, não dá para subir para objeção e fechamento.",
    acao_mk6_itens: [
      "Revisar conversas reais junto com o cliente",
      "Entregar conversas anotadas + modelos de abordagem",
    ],
  },
  {
    ordem: 9, codigo: "f2_marco_replan", fase: "Fase 2 — Execução", semana: 7,
    dia_inicio: 43, dia_fim: 47,
    titulo: "Marco — Replanejamento de meio de projeto",
    subtitulo: "Gestor · call à parte",
    descricao: "Balanço dos 45 dias × metas, recalibragem do plano e reforço da direção para a reta final. Reacende a proximidade e planta a semente da continuidade.",
    tipo: "marco", responsavel: "Gestor",
    mk6_responsabilidade: "Plano revisado dos dias 45–90, com metas ajustadas e prioridades repactuadas por escrito.",
    cliente_responsabilidade: "Trazer percepções dos primeiros 45 dias e reconfirmar o compromisso comercial.",
    tem_trava: false,
    acao_mk6_itens: [
      "Conduzir call dedicada de replanejamento",
      "Entregar plano revisado dos dias 45–90 por escrito",
    ],
  },

  // ===== FASE 3: PROVA & CONTINUIDADE =====
  {
    ordem: 10, codigo: "f3_whats2", fase: "Fase 3 — Prova & Continuidade", semana: 8,
    dia_inicio: 50, dia_fim: 56,
    titulo: "WhatsApp #2 + Roleplay — Objeção e fechamento",
    subtitulo: "CS",
    descricao: "A parte mais difícil. Revisão com foco em contorno de objeção e fechamento, seguida de roleplay com os cenários reais que travaram.",
    tipo: "call_cs", responsavel: "CS",
    mk6_responsabilidade: "Playbook de objeções do nicho + respostas-modelo prontas.",
    cliente_responsabilidade: "Aplicar 2 técnicas de contorno e trazer o resultado de cada tentativa de fechamento.",
    tem_trava: true,
    trava_descricao: "Sem tentativas registradas, não há base para trabalhar relacionamento e recompra.",
    acao_mk6_itens: [
      "Revisar conversas com foco em objeção/fechamento",
      "Conduzir roleplay com cenários reais",
      "Entregar playbook de objeções + respostas-modelo",
    ],
  },
  {
    ordem: 11, codigo: "f3_metricas3", fase: "Fase 3 — Prova & Continuidade", semana: 9,
    dia_inicio: 57, dia_fim: 63,
    titulo: "Métricas #3 — Escala das campanhas vencedoras",
    subtitulo: "Gestor",
    descricao: "Escala de orçamento e públicos no que provou resultado, com CPL estabilizado.",
    tipo: "call_gestor", responsavel: "Gestor",
    mk6_responsabilidade: "Volume de leads sustentado para alimentar a prática comercial até o dia 90.",
    cliente_responsabilidade: "Manter ritmo de atendimento e CRM em dia — o número de vendas vai para o balanço.",
    tem_trava: false,
    acao_mk6_itens: [
      "Escalar orçamento e públicos vencedores",
      "Sustentar volume de leads até o dia 90",
    ],
  },
  {
    ordem: 12, codigo: "f3_relacionamento", fase: "Fase 3 — Prova & Continuidade", semana: 10,
    dia_inicio: 64, dia_fim: 70,
    titulo: "Relacionamento, follow-up e recompra",
    subtitulo: "CS",
    descricao: "Cadência de follow-up, reativação de leads frios e abertura para recompra e indicação.",
    tipo: "call_cs", responsavel: "CS",
    mk6_responsabilidade: "Régua de follow-up e scripts de reativação entregues, prontos para usar.",
    cliente_responsabilidade: "Rodar a régua com leads parados dos últimos 30 dias e registrar respostas.",
    tem_trava: true,
    trava_descricao: "Sem a régua rodando, o balanço final não mostra o potencial de recompra.",
    acao_mk6_itens: [
      "Entregar régua de follow-up pronta para usar",
      "Entregar scripts de reativação",
    ],
  },
  {
    ordem: 13, codigo: "f3_metricas4", fase: "Fase 3 — Prova & Continuidade", semana: 11,
    dia_inicio: 71, dia_fim: 77,
    titulo: "Métricas #4 — Ajuste fino e montagem do balanço",
    subtitulo: "Gestor",
    descricao: "Últimos ajustes de campanha e consolidação dos números para o fechamento.",
    tipo: "call_gestor", responsavel: "Gestor",
    mk6_responsabilidade: "Números de tráfego consolidados e prévia do balanço montada.",
    cliente_responsabilidade: "Fechar os dados de vendas no CRM para o balanço sair fiel à realidade.",
    tem_trava: false,
    acao_mk6_itens: [
      "Consolidar números de tráfego",
      "Montar prévia do balanço dos 90 dias",
    ],
  },
  {
    ordem: 14, codigo: "f3_prova_evolucao", fase: "Fase 3 — Prova & Continuidade", semana: 12,
    dia_inicio: 78, dia_fim: 84,
    titulo: "Prova de evolução — Rotina vencedora e antes × depois",
    subtitulo: "CS",
    descricao: "Roleplay final do ciclo completo e leitura do antes × depois (tempo de resposta, taxa de resposta, conversão).",
    tipo: "call_cs", responsavel: "CS",
    mk6_responsabilidade: "Comparativo de evolução comercial (antes × depois) montado e validado.",
    cliente_responsabilidade: "Rodar uma semana inteira no padrão com CRM atualizado — prova viva do balanço.",
    tem_trava: true,
    trava_descricao: "Sem a semana documentada, o balanço de encerramento perde força — e a renovação, o melhor argumento.",
    acao_mk6_itens: [
      "Conduzir roleplay final do ciclo completo",
      "Montar e validar comparativo antes × depois",
    ],
  },
  {
    ordem: 15, codigo: "f3_marco_renovacao", fase: "Fase 3 — Prova & Continuidade", semana: 13,
    dia_inicio: 85, dia_fim: 90,
    titulo: "Marco — Renovação: Balanço, projeção e próximo ciclo",
    subtitulo: "Gestor + CS",
    descricao: "Balanço completo dos 90 dias (tráfego e comercial lado a lado). A continuação é apresentada como o momento de escalar o que já funciona.",
    tipo: "marco", responsavel: "Gestor + CS",
    mk6_responsabilidade: "Relatório consolidado dos 90 dias + plano de crescimento e proposta de renovação.",
    cliente_responsabilidade: "Avaliar os números na mesa e decidir a continuidade do projeto com a MK6.",
    tem_trava: false,
    acao_mk6_itens: [
      "Apresentar balanço consolidado dos 90 dias",
      "Entregar plano de crescimento + proposta de renovação",
    ],
  },
];

export function tipoLabel(tipo: MK6Tipo): string {
  switch (tipo) {
    case "call_gestor": return "Call · Gestor";
    case "call_cs": return "Call · CS";
    case "call_ambos": return "Call · Gestor + CS";
    case "marco": return "Marco";
  }
}

export function tipoColor(tipo: MK6Tipo): string {
  switch (tipo) {
    case "call_gestor": return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30";
    case "call_cs": return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "call_ambos": return "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30";
    case "marco": return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
  }
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days - 1); // dia 1 = data de início
  return d.toISOString().slice(0, 10);
}

/** Itens da Ação MK6 transformados em `[{texto, concluido:false}]` para persistir no step do cliente. */
export function acaoItensFromTemplate(template: MK6StepTemplate): Array<{ texto: string; concluido: boolean }> {
  return template.acao_mk6_itens.map((texto) => ({ texto, concluido: false }));
}
