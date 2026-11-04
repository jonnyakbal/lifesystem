// Fonte única dos atalhos: a paleta de comandos usa NAV_HOTKEYS para navegar
// e Configurações → Atalhos lista estes mesmos grupos. Ao criar um atalho em
// uma tela, registre-o aqui também.

/** Ctrl/⌘ + tecla leva a uma tela (sem Shift). */
export const NAV_HOTKEYS: Record<string, { href: string; label: string }> = {
  i: { href: '/inbox', label: 'Caixa de entrada' },
  g: { href: '/hoje', label: 'Hoje' },
  j: { href: '/projetos', label: 'Projetos' },
  d: { href: '/indicadores', label: 'Metas' },
  b: { href: '/diario-bordo', label: 'Diário de bordo' },
  e: { href: '/editais', label: 'Editais' },
};

export type Shortcut = { keys: string[]; label: string };

export function shortcutGroups(mod: string): { title: string; items: Shortcut[] }[] {
  return [
    { title: 'Em qualquer tela', items: [
      { keys: [mod, 'K'], label: 'Buscar e comandos' },
      ...Object.entries(NAV_HOTKEYS).map(([key, { label }]) => ({ keys: [mod, key.toUpperCase()], label })),
      { keys: [mod, 'Shift', 'H'], label: 'Hermes' },
    ] },
    { title: 'Caixa de entrada e Revisão', items: [
      { keys: ['1'], label: 'Descartar' }, { keys: ['2'], label: 'Guardar como nota' }, { keys: ['3'], label: 'Fazer agora' },
      { keys: ['4'], label: 'Virar tarefa' }, { keys: ['5'], label: 'Delegar' }, { keys: ['6'], label: 'Virar projeto' },
      { keys: ['7'], label: 'Outro destino' }, { keys: ['S'], label: 'Pular' },
    ] },
    { title: 'Revisão · tarefa atrasada selecionada', items: [
      { keys: ['A'], label: 'Amanhã' }, { keys: ['S'], label: '+7 dias' }, { keys: ['B'], label: 'Backlog' }, { keys: ['C'], label: 'Concluir' },
    ] },
    { title: 'Tarefas e Foco', items: [
      { keys: ['N'], label: 'Nova tarefa' }, { keys: ['Espaço'], label: 'Pausar o Foco' },
      { keys: ['P'], label: 'Próxima tarefa no Foco' }, { keys: ['C'], label: 'Concluir no Foco' }, { keys: ['I'], label: 'Capturar ideia no Foco' },
    ] },
    { title: 'Escritório', items: [
      { keys: ['1–7'], label: 'Escolher alguém da tripulação' },
      { keys: ['Espaço'], label: 'Avançar a fala no Modo História' }, { keys: ['←'], label: 'Fala anterior' }, { keys: ['Esc'], label: 'Sair da cena' },
    ] },
  ];
}

/** Tecla modificadora como o aparelho chama: ⌘ no Mac e iPhone, Ctrl no resto. */
export function modifierLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
}
