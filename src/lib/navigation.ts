import { Home, Inbox, NotebookText, CalendarCheck, Wand2, Target, FolderKanban, CheckSquare, FileText, BarChart3, Award, Wallet, BookOpen, ScrollText, Bot, Layers, History } from 'lucide-react';

export const navigation = [
  { label: 'Seu dia', items: [
    { title: 'Visão geral', href: '/', icon: Home, description: 'O que importa, em um só lugar.' },
    { title: 'Hoje', href: '/hoje', icon: CalendarCheck, description: 'Menos ruído. Mais espaço para o que importa hoje.' },
    { title: 'Caixa de entrada', href: '/inbox', icon: Inbox, description: 'Tire da cabeça. Organize no seu tempo.' },
  ] },
  { label: 'Construir', items: [
    { title: 'Tarefas', href: '/tarefas', icon: CheckSquare, description: 'Transforme intenção em próximos passos.' },
    { title: 'Projetos', href: '/projetos', icon: FolderKanban, description: 'Dê forma às ideias que merecem acontecer.' },
    { title: 'Planejar', href: '/planejar', icon: Wand2, description: 'Abra espaço para uma semana com intenção.' },
    { title: 'Conteúdo', href: '/conteudo', icon: FileText, description: 'Da primeira ideia ao mundo.' },
    { title: 'Editais', href: '/editais', icon: Award, description: 'Encontre oportunidades. Acompanhe cada etapa.' },
  ] },
  { label: 'Cultivar', items: [
    { title: 'Notas', href: '/notas', icon: NotebookText, description: 'Um lugar para pensar, conectar e criar.' },
    { title: 'Metas', href: '/indicadores', icon: BarChart3, description: 'Veja o progresso que se constrói aos poucos.' },
    { title: 'Financeiro', href: '/financeiro', icon: Wallet, description: 'Clareza para decidir os próximos passos.' },
    { title: 'Diário', href: '/diario', icon: BookOpen, description: 'Um momento para perceber o seu caminho.' },
    { title: 'Visão', href: '/visao', icon: Target, description: 'Lembre do que move você.' },
  ] },
  { label: 'Explorar', items: [
    { title: 'Pilares', href: '/pilares', icon: Layers, description: 'As áreas que sustentam o seu universo.' },
    { title: 'Revisão', href: '/revisao', icon: History, description: 'Reconheça o progresso. Ajuste a direção.' },
    { title: 'Diário de bordo', href: '/diario-bordo', icon: ScrollText, description: 'Decisões e aprendizados que ficam.' },
    { title: 'Hermes', href: '/hermes', icon: Bot, description: 'Seu assistente, conectado ao seu contexto.' },
  ] },
];

export function getPageContext(pathname: string) {
  return navigation.flatMap(group => group.items.map(item => ({ ...item, section: group.label })))
    .find(item => item.href === pathname);
}
