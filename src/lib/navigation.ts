import { Home, Inbox, NotebookText, CalendarCheck, Wand2, Target, FolderKanban, CheckSquare, FileText, BarChart3, Award, Wallet, BookOpen, ScrollText, Bot, History, Rss, Sunrise, Sparkles, HeartPulse, Compass, Palette, Database } from 'lucide-react';

// Navegação pelo ciclo GTD: agir → capturar → organizar → cuidar das áreas → refletir.
// Grupos "pinned" ficam sempre visíveis; os demais abrem sob demanda.
export const navigation = [
  { label: 'Agora', icon: Sunrise, pinned: true, prompt: 'Um passo de cada vez.', items: [
    { title: 'Visão geral', href: '/', icon: Home, description: 'O ciclo inteiro, em um só lugar.' },
    { title: 'Hoje', href: '/hoje', icon: CalendarCheck, description: 'Só o que importa hoje.' },
  ] },
  { label: 'Capturar', icon: Inbox, pinned: true, prompt: 'Tire da cabeça. Decida depois.', items: [
    { title: 'Caixa de entrada', href: '/inbox', icon: Inbox, description: 'Esclareça um item por vez até zerar.' },
  ] },
  { label: 'Organizar', icon: Sparkles, pinned: true, prompt: 'Cada coisa no seu lugar.', items: [
    { title: 'Tarefas', href: '/tarefas', icon: CheckSquare, description: 'Próximas ações, aguardando e backlog.' },
    { title: 'Projetos', href: '/projetos', icon: FolderKanban, description: 'Resultados com mais de um passo.' },
    { title: 'Planejar', href: '/planejar', icon: Wand2, description: 'Blocos de tempo para a semana.' },
    { title: 'Notas', href: '/notas', icon: NotebookText, description: 'Referência e ideias para destilar.' },
  ] },
  { label: 'Áreas', icon: Target, prompt: 'Responsabilidades que não terminam.', items: [
    { title: 'Profissional', href: '/profissional', icon: FolderKanban, description: 'Contexto, oportunidades e entregas sob sua revisão.' },
    { title: 'Corpo & saúde', href: '/corpo', icon: HeartPulse, description: 'Registre o que viveu. Revise sem preencher lacunas.' },
    { title: 'Financeiro', href: '/financeiro', icon: Wallet, description: 'Clareza para decidir os próximos passos.' },
    { title: 'Conteúdo', href: '/conteudo', icon: FileText, description: 'Da primeira ideia ao mundo.' },
    { title: 'Editais', href: '/editais', icon: Award, description: 'Encontre oportunidades. Acompanhe cada etapa.' },
  ] },
  { label: 'Refletir', icon: History, prompt: 'Revisar o caminho ajuda a escolher o próximo.', items: [
    { title: 'Revisão', href: '/revisao', icon: History, description: 'Toda segunda: esvaziar, revisar, escolher.' },
    { title: 'Visão', href: '/visao', icon: Target, description: 'Seus pilares e o que move você.' },
    { title: 'Metas', href: '/indicadores', icon: BarChart3, description: 'Veja o progresso que se constrói aos poucos.' },
    { title: 'Diário', href: '/diario', icon: BookOpen, description: 'Um momento para perceber o seu caminho.' },
    { title: 'Diário de bordo', href: '/diario-bordo', icon: ScrollText, description: 'Decisões e aprendizados que ficam.' },
  ] },
  { label: 'Sistema', icon: Compass, prompt: 'Ferramentas por trás do seu espaço.', items: [
    { title: 'Hermes', href: '/hermes', icon: Bot, description: 'Seu assistente, conectado ao seu contexto.' },
    { title: 'Escritório', href: '/escritorio', icon: Bot, description: 'Seu time, suas fontes e o trabalho em andamento.' },
    { title: 'Fontes', href: '/content-hub', icon: Rss, description: 'RSS, sites, newsletters — tudo num só lugar.' },
    { title: 'Design', href: '/design', icon: Palette, description: 'Marca, cores, componentes e padrões do sistema.' },
    { title: 'Banco de dados', href: '/dados', icon: Database, description: 'Onde seus dados estão guardados.' },
  ] },
];

export function getPageContext(pathname: string) {
  return navigation.flatMap(group => group.items.map(item => ({ ...item, section: group.label, prompt: group.prompt })))
    .find(item => item.href === pathname);
}

/** Two useful next steps per screen. The first is the suggested continuation. */
const continuations: Record<string, [string, string]> = {
  '/hoje': ['/tarefas', '/diario'],
  '/inbox': ['/revisao', '/tarefas'],
  '/tarefas': ['/planejar', '/projetos'],
  '/planejar': ['/hoje', '/inbox'],
  '/projetos': ['/tarefas', '/profissional'],
  '/profissional': ['/projetos', '/tarefas'],
  '/conteudo': ['/content-hub', '/projetos'],
  '/content-hub': ['/conteudo', '/projetos'],
  '/notas': ['/content-hub', '/visao'],
  '/indicadores': ['/visao', '/diario'],
  '/corpo': ['/hoje', '/indicadores'],
  '/financeiro': ['/planejar', '/indicadores'],
  '/diario': ['/hoje', '/visao'],
  '/editais': ['/projetos', '/profissional'],
  '/diario-bordo': ['/projetos', '/revisao'],
  '/revisao': ['/planejar', '/inbox'],
  '/hermes': ['/diario-bordo', '/revisao'],
};

export function getContinuations(pathname: string, hiddenModules: readonly string[] = []) {
  const destinations = new Map(navigation.flatMap(group => group.items).map(item => [item.href, item]));
  return (continuations[pathname] ?? [])
    .filter(href => !hiddenModules.includes(href))
    .map(href => destinations.get(href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}
