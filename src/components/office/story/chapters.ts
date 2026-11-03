import type { AgentId } from "@/lib/office/schema";

// Roteiro do Modo História: a doutrina do LIFESYSTEM (ciclo GTD, segundo
// cérebro e o pacto com os agentes) contada pela tripulação, em cenas curtas.
// Cada fala pode acionar um "adereço" — uma mini-interface animada no palco —
// e o passo (`at`) diz em que ponto da animação o adereço deve estar.
// O texto descreve o sistema como ele é: agentes propõem, Jonny decide.

export type Speaker = AgentId | "sistema";
export type PropKind =
  | "crew"
  | "cycle"
  | "capture"
  | "clarify"
  | "keys"
  | "project"
  | "areas"
  | "review"
  | "today"
  | "pact";

export type Beat = { who: Speaker; line: string; prop: PropKind; at?: number };
export type Chapter = {
  id: string;
  number: number;
  title: string;
  tagline: string;
  badge: string;
  /** Anfitrião do capítulo: ao terminar, a estação focaliza este agente. */
  host: AgentId;
  beats: Beat[];
  cta?: { label: string; href: string };
};

export const chapters: Chapter[] = [
  {
    id: "prologo",
    host: "hermes",
    number: 0,
    title: "A estação",
    tagline: "Quem está a bordo e para que serve tudo isso.",
    badge: "Tripulante",
    beats: [
      { who: "hermes", prop: "crew", at: 0, line: "Bem-vindo à Estação Jonny. Eu sou Hermes, o coordenador. Minha função é simples: tirar peso da sua cabeça." },
      { who: "hermes", prop: "crew", at: 1, line: "Cada tripulante cuida de uma área da sua vida. Vega, das finanças. Sirius, dos projetos. Órion, do corpo. Astro, da mente. Cosmo, do conteúdo. Antares, do comercial." },
      { who: "hermes", prop: "cycle", at: 0, line: "Por baixo de tudo gira um ciclo de cinco passos: capturar, esclarecer, organizar, refletir e agir." },
      { who: "hermes", prop: "cycle", at: 5, line: "Ele não termina. Cada volta deixa sua cabeça mais leve e o próximo passo mais claro. Vamos ver cada parte." },
    ],
  },
  {
    id: "capturar",
    host: "cosmo",
    number: 1,
    title: "Tire da cabeça",
    tagline: "Capturar: tudo entra por uma porta só.",
    badge: "Cabeça leve",
    cta: { label: "Abrir a Caixa de entrada", href: "/inbox" },
    beats: [
      { who: "cosmo", prop: "capture", at: 0, line: "Ideias aparecem na hora errada: no meio do set, no banho, numa conversa no bar." },
      { who: "cosmo", prop: "capture", at: 1, line: "A regra é não decidir nada agora. Só capturar. Uma frase basta: Ctrl K ou o botão Capturar, de qualquer tela." },
      { who: "hermes", prop: "capture", at: 2, line: "Tudo cai na Caixa de entrada. Uma porta só, para você nunca se perguntar onde anotou aquilo." },
      { who: "hermes", prop: "capture", at: 3, line: "A cabeça serve para ter ideias, não para guardá-las. Capturou, esqueceu, segue o dia." },
    ],
  },
  {
    id: "esclarecer",
    host: "sirius",
    number: 2,
    title: "Esclarecer",
    tagline: "Um item por vez: o que é isso e o que pede?",
    badge: "Decisor",
    cta: { label: "Esclarecer agora", href: "/inbox" },
    beats: [
      { who: "sirius", prop: "clarify", at: 0, line: "Agora cada captura passa por uma pergunta: isso exige alguma ação?" },
      { who: "sirius", prop: "clarify", at: 1, line: "Se não exige: vai para o lixo, vira nota de referência ou fica para algum dia, no backlog sem prazo." },
      { who: "sirius", prop: "clarify", at: 2, line: "Se exige e leva menos de dois minutos, faça agora. Se é de outra pessoa, delegue e marque como aguardando." },
      { who: "sirius", prop: "clarify", at: 3, line: "Se é um passo só, vira tarefa. Se precisa de vários, vira projeto." },
      { who: "sirius", prop: "keys", at: 0, line: "Na Caixa de entrada cada decisão tem uma tecla, de 1 a 7. Dá para zerar a fila sem tirar a mão do teclado." },
    ],
  },
  {
    id: "organizar",
    host: "sirius",
    number: 3,
    title: "Organizar",
    tagline: "Cada coisa no seu lugar: projetos, áreas e referência.",
    badge: "Arquiteto",
    cta: { label: "Ver projetos", href: "/projetos" },
    beats: [
      { who: "sirius", prop: "project", at: 0, line: "Projeto é qualquer resultado que pede mais de um passo. Lançar o evento. Fechar a parceria." },
      { who: "sirius", prop: "project", at: 1, line: "Todo projeto vivo precisa de uma próxima ação concreta. Sem ela, ele está parado e eu aviso." },
      { who: "vega", prop: "areas", at: 0, line: "Áreas são diferentes: não terminam. Finanças, corpo, mente, trabalho. Você cuida delas, não as conclui." },
      { who: "orion", prop: "areas", at: 1, line: "Os projetos orbitam as áreas. Assim você sabe se está cuidando de tudo ou só apagando incêndio." },
      { who: "astro", prop: "areas", at: 2, line: "E o que é só referência vira nota. Destile a essência e use quando precisar: é o seu segundo cérebro." },
    ],
  },
  {
    id: "refletir",
    host: "astro",
    number: 4,
    title: "Refletir",
    tagline: "Toda segunda, a revisão que mantém o sistema confiável.",
    badge: "Navegador",
    cta: { label: "Fazer a revisão", href: "/revisao" },
    beats: [
      { who: "astro", prop: "review", at: 0, line: "Um sistema só funciona se você confia nele. A confiança vem da revisão semanal, toda segunda." },
      { who: "astro", prop: "review", at: 3, line: "Esvaziar a caixa, olhar a agenda, revisar projetos e o que está aguardando, conferir o backlog." },
      { who: "astro", prop: "review", at: 7, line: "No fim, você escolhe o que importa na semana. Sete passos guiados, sem precisar lembrar a ordem." },
    ],
  },
  {
    id: "agir",
    host: "sirius",
    number: 5,
    title: "Agir",
    tagline: "Hoje: no máximo três prioridades, e foco em uma.",
    badge: "Executor",
    cta: { label: "Abrir Hoje", href: "/hoje" },
    beats: [
      { who: "sirius", prop: "today", at: 0, line: "Com tudo esclarecido e organizado, agir fica leve. Mas a lista sempre vai ser maior que o dia." },
      { who: "sirius", prop: "today", at: 1, line: "Por isso Hoje mostra até três prioridades. O resto espera sem culpa: está registrado e não vai se perder." },
      { who: "hermes", prop: "today", at: 2, line: "Escolha uma e entre no Foco: uma tarefa na tela, um cronômetro, nada mais disputando sua atenção." },
    ],
  },
  {
    id: "pacto",
    host: "orion",
    number: 6,
    title: "O pacto",
    tagline: "Os agentes propõem. Você decide.",
    badge: "Comandante",
    beats: [
      { who: "hermes", prop: "pact", at: 0, line: "Uma última coisa, talvez a mais importante: nenhum de nós muda sua vida sozinho." },
      { who: "orion", prop: "pact", at: 1, line: "Quando eu quero registrar um treino ou criar uma tarefa, eu escrevo uma proposta com tudo o que vai mudar." },
      { who: "antares", prop: "pact", at: 2, line: "Ela só vale depois que você aprova na tela. Uma resposta genérica no chat não conta." },
      { who: "hermes", prop: "pact", at: 3, line: "E tudo que foi feito deixa um recibo. Se algo não tem recibo, não aconteceu. Bem-vindo ao comando, Jonny." },
    ],
  },
];

export const chapterById = Object.fromEntries(chapters.map((c) => [c.id, c])) as Record<string, Chapter>;
