import { Home, Inbox, NotebookText, CalendarCheck, Wand2, Target, FolderKanban, CheckSquare, FileText, BarChart3, Award, Wallet, BookOpen, ScrollText, Bot, History, Rss, Sunrise, Sparkles, HeartPulse, Compass } from 'lucide-react';

export const navigation = [
  { label: 'Seu dia', icon: Sunrise, prompt: 'Um passo de cada vez.', items: [
    { title: 'Visão geral', href: '/', icon: Home, description: 'O que importa, em um só lugar.' },
    { title: 'Hoje', href: '/hoje', icon: CalendarCheck, description: 'Menos ruído. Mais espaço para o que importa hoje.' },
    { title: 'Caixa de entrada', href: '/inbox', icon: Inbox, description: 'Tire da cabeça. Organize no seu tempo.' },
  ] },
  { label: 'Construir', icon: Sparkles, prompt: 'Ideias ganham forma quando encontram espaço.', items: [
    { title: 'Profissional', href: '/profissional', icon: FolderKanban, description: 'Contexto, oportunidades e entregas sob sua revisão.' },
    { title: 'Tarefas', href: '/tarefas', icon: CheckSquare, description: 'Transforme intenção em próximos passos.' },
    { title: 'Projetos', href: '/projetos', icon: FolderKanban, description: 'Dê forma às ideias que merecem acontecer.' },
    { title: 'Planejar', href: '/planejar', icon: Wand2, description: 'Abra espaço para uma semana com intenção.' },
    { title: 'Conteúdo', href: '/conteudo', icon: FileText, description: 'Da primeira ideia ao mundo.' },
    { title: 'Fontes', href: '/content-hub', icon: Rss, description: 'RSS, sites, newsletters — tudo num só lugar.' },
    { title: 'Editais', href: '/editais', icon: Award, description: 'Encontre oportunidades. Acompanhe cada etapa.' },
  ] },
  { label: 'Cultivar', icon: HeartPulse, prompt: 'Clareza também é uma forma de cuidado.', items: [
    { title: 'Corpo & saúde', href: '/corpo', icon: HeartPulse, description: 'Registre o que viveu. Revise sem preencher lacunas.' },
    { title: 'Notas', href: '/notas', icon: NotebookText, description: 'Um lugar para pensar, conectar e criar.' },
    { title: 'Metas', href: '/indicadores', icon: BarChart3, description: 'Veja o progresso que se constrói aos poucos.' },
    { title: 'Financeiro', href: '/financeiro', icon: Wallet, description: 'Clareza para decidir os próximos passos.' },
    { title: 'Diário', href: '/diario', icon: BookOpen, description: 'Um momento para perceber o seu caminho.' },
    { title: 'Visão', href: '/visao', icon: Target, description: 'Lembre do que move você.' },
  ] },
  { label: 'Explorar', icon: Compass, prompt: 'Revisar o caminho ajuda a escolher o próximo.', items: [
    { title: 'Revisão', href: '/revisao', icon: History, description: 'Reconheça o progresso. Ajuste a direção.' },
    { title: 'Diário de bordo', href: '/diario-bordo', icon: ScrollText, description: 'Decisões e aprendizados que ficam.' },
    { title: 'Hermes', href: '/hermes', icon: Bot, description: 'Seu assistente, conectado ao seu contexto.' },
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
