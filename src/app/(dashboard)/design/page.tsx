'use client';

import { useState } from 'react';
import {
  AlertTriangle, ArrowRight, Bot, Calendar, CalendarClock, Check, ChevronRight, Circle, Clock, Flag, FolderKanban,
  Inbox, Layers, Plus, Search, Sparkles, Target, Trash2, Undo2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ds/chip';
import { EmptyState } from '@/components/ds/empty-state';
import { ScreenHeader } from '@/components/ds/screen-header';
import { TaskRow } from '@/components/ds/task-row';
import { BrandBook } from './brand-book';

// Living design system: every sample below is the real component or token
// the app uses (or will use once approved), so this page cannot drift from
// the product. Sample data is fictional and nothing here calls an API.

const sections = [
  ['identidade', 'Identidade'], ['principios', 'Princípios'], ['marca', 'Voz na interface'], ['cores', 'Cores na interface'], ['tipografia', 'Escala tipográfica'],
  ['medidas', 'Medidas'], ['icones', 'Ícones'], ['ilustracao', 'Ilustração'], ['componentes', 'Componentes'],
  ['tarefa', 'Linha de tarefa'], ['padroes', 'Padrões de tela'], ['acesso', 'Toque e acessibilidade'],
  ['decisoes', 'Decisões para aprovar'],
] as const;

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-24 border-b py-10 last:border-0">
      <h2 id={`${id}-t`} className="font-display text-2xl tracking-tight">{title}</h2>
      {intro && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function DoDont({ good, bad }: { good: string; bad: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <p className="rounded-xl border border-money/30 bg-money/5 p-3 text-sm"><Check className="mr-1 inline h-4 w-4 text-money" />{good}</p>
      <p className="rounded-xl border border-critical/30 bg-critical/5 p-3 text-sm"><X className="mr-1 inline h-4 w-4 text-critical" />{bad}</p>
    </div>
  );
}

const colors = [
  ['--color-primary', 'Ação (hoje)', 'Botões principais, links, foco, seleção. Decisão 1 define se vira o violeta da marca.'],
  ['--color-stellar', 'Agentes e marca', 'Hermes, Órion, Sirius, propostas de agentes, assinatura astral.'],
  ['--color-money', 'Sucesso / dinheiro', 'Concluído, salvo, recebido. Nunca usado para enfeite.'],
  ['--color-qty', 'Informação', 'Quantidades, dados neutros, gráficos.'],
  ['--color-critical', 'Perigo / atraso', 'Atrasado, urgente, excluir, erro real.'],
  ['--color-foreground', 'Texto', 'Texto principal.'],
  ['--color-muted-foreground', 'Texto secundário', 'Metadados, ajuda, legendas.'],
  ['--color-card', 'Superfície', 'Cartões e painéis.'],
  ['--color-border', 'Borda', 'Separação discreta.'],
] as const;

const typeScale = [
  ['text-4xl font-display', '36 px · Fraunces', 'Título de tela', 'Tarefas'],
  ['text-2xl font-display', '24 px · Fraunces', 'Título de seção', 'Esta semana'],
  ['text-xl font-semibold', '20 px · Inter', 'Destaque / número', '7 tarefas'],
  ['text-base', '16 px · Inter', 'Texto e títulos de tarefa', 'Revisar proposta comercial'],
  ['text-sm', '14 px · Inter', 'Texto de apoio, botões', 'Organize o próximo passo.'],
  ['text-xs', '12 px · Inter', 'Metadados, chips (mínimo absoluto)', 'Prazo amanhã · Arco Labs'],
] as const;

export default function DesignPage() {
  const [done, setDone] = useState(false);
  const [deleted, setDeleted] = useState(false);
  return (
    <main className="work-page mx-auto max-w-[1200px] px-4 pb-28 pt-6 lg:px-8">
      <ScreenHeader eyebrow="Marca · design" title="Design do LifeSystem" context="Identidade Órbita e o sistema que a leva para cada tela. Cada exemplo é o componente real; as escolhas marcadas como decisão aguardam sua aprovação." />

      <nav aria-label="Seções do design" className="sticky top-2 z-10 -mx-1 mb-2 flex gap-1 overflow-x-auto rounded-xl border bg-background/90 p-1 backdrop-blur">
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">{label}</a>
        ))}
      </nav>

      <div id="identidade" className="scroll-mt-24"><BrandBook /></div>

      <Section id="principios" title="Princípios" intro="Astral discreto, operação clara. Seis regras que decidem os casos não previstos.">
        <ol className="grid gap-3 sm:grid-cols-2">
          {[
            ['Operação antes de enfeite', 'Telas de trabalho são densas e calmas. A identidade astral aparece na abertura, nos agentes e nos estados vazios — nunca por cima de dados.'],
            ['Uma cor de ação', 'Tudo que é clicável e principal usa a mesma cor. Cores de status têm significado fixo em todo o sistema.'],
            ['Abrir não é concluir', 'O título abre o registro. Concluir é um botão próprio, com nome visível, e sempre tem desfazer.'],
            ['Celular primeiro', 'Alvos de 44 px, nada que dependa de passar o mouse ou arrastar; o desktop só adiciona densidade.'],
            ['Texto acompanha a cor', 'Nenhum estado é comunicado só por cor ou ícone: sempre há uma palavra.'],
            ['Diga o que aconteceu', 'Salvou, falhou, está vazio: cada estado explica o resultado e oferece o próximo passo.'],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-primary">0{i + 1}</p>
              <p className="mt-1 text-base font-semibold">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="marca" title="Voz na interface" intro="A voz da marca aplicada a botões, avisos e erros.">
        <div className="space-y-2">
          <DoDont good="“Tarefa concluída. Desfazer”" bad="“Status atualizado para done com sucesso!”" />
          <DoDont good="“Prazo”, “etapa”, “prioridade urgente”" bad="“dueDate”, “stage”, “urgent” (nomes técnicos na tela)" />
          <DoDont good="“Não foi possível salvar. Tente de novo.” + botão" bad="“Erro 500” ou mensagem sem saída" />
        </div>
      </Section>

      <Section id="cores" title="Cores na interface" intro="Cada cor tem um significado. Alterne o tema (ícone de sol/lua na barra lateral) para ver as duas versões — os nomes e significados não mudam.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {colors.map(([v, name, use]) => (
            <div key={v} className="flex gap-3 rounded-2xl border bg-card p-3">
              <span className="h-12 w-12 shrink-0 rounded-xl border" style={{ background: `var(${v})` }} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-muted-foreground">{use}</p>
                <code className="text-xs text-muted-foreground">{v}</code>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold">Significado fixo nos registros</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip tone="danger" icon={<Flag className="h-3 w-3" />}>Urgente</Chip>
          <Chip tone="action" icon={<Flag className="h-3 w-3" />}>Importante</Chip>
          <Chip>Normal</Chip>
          <Chip tone="danger" icon={<Clock className="h-3 w-3" />}>Atrasada</Chip>
          <Chip tone="warning" icon={<CalendarClock className="h-3 w-3" />}>Vence hoje</Chip>
          <Chip tone="success" icon={<Check className="h-3 w-3" />}>Concluída</Chip>
          <Chip tone="agent" icon={<Bot className="h-3 w-3" />}>Proposta do Sirius</Chip>
          <Chip tone="info">Previsto</Chip>
        </div>
      </Section>

      <Section id="tipografia" title="Escala tipográfica" intro="Fraunces para títulos de tela e seção; Inter para todo o resto; JetBrains Mono só para números tabulares e código. Seis tamanhos — nada abaixo de 12 px.">
        <div className="divide-y rounded-2xl border bg-card">
          {typeScale.map(([cls, spec, use, sample]) => (
            <div key={spec} className="grid gap-1 p-4 sm:grid-cols-[180px_1fr] sm:items-baseline">
              <div><p className="text-xs font-semibold">{spec}</p><p className="text-xs text-muted-foreground">{use}</p></div>
              <p className={cls}>{sample}</p>
            </div>
          ))}
        </div>
        <div className="mt-4"><DoDont good="Metadado em 12 px com cor secundária" bad="Textos de 8–11 px (hoje existem 17 tamanhos, de 8 a 42 px)" /></div>
      </Section>

      <Section id="medidas" title="Medidas" intro="Espaços em múltiplos de 4. Três arredondamentos e o círculo — hoje há 16 valores diferentes.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold">Espaçamento</p>
            <div className="space-y-2">
              {[4, 8, 12, 16, 24, 32, 48].map(n => (
                <div key={n} className="flex items-center gap-3"><span className="w-12 text-xs text-muted-foreground">{n} px</span><span className="h-3 rounded bg-primary/70" style={{ width: n * 3 }} /></div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Arredondamento</p>
            <div className="flex flex-wrap gap-4">
              {[['6 px', 'Chips internos, campos pequenos', 6], ['10 px', 'Botões, campos, itens', 10], ['16 px', 'Cartões e painéis', 16], ['Círculo', 'Chips, avatares, botão flutuante', 999]].map(([n, use, r]) => (
                <div key={String(n)} className="w-32 text-center">
                  <div className="mx-auto h-16 w-24 border-2 border-primary/60 bg-primary/10" style={{ borderRadius: Number(r) }} />
                  <p className="mt-1 text-xs font-semibold">{n}</p><p className="text-xs text-muted-foreground">{use}</p>
                </div>
              ))}
            </div>
            <p className="mb-2 mt-6 text-sm font-semibold">Profundidade</p>
            <div className="flex flex-wrap gap-4">
              <div className="w-32 rounded-2xl border bg-card p-3 text-xs">Plano: borda</div>
              <div className="w-32 rounded-2xl border bg-card p-3 text-xs shadow-md">Cartão</div>
              <div className="w-32 rounded-2xl border bg-popover p-3 text-xs shadow-2xl">Menu / diálogo</div>
            </div>
          </div>
        </div>
      </Section>

      <Section id="icones" title="Ícones" intro="Um só conjunto (Lucide), traço 2, em 16 px junto de texto e 20 px sozinho. Ícone sozinho sempre tem nome acessível.">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[[Inbox, 'Caixa de entrada'], [Target, 'Foco / metas'], [Calendar, 'Prazo'], [Flag, 'Prioridade'], [FolderKanban, 'Projeto'], [Layers, 'Quadro'], [Bot, 'Agente'], [Sparkles, 'Copiloto / IA'], [Undo2, 'Desfazer'], [Trash2, 'Excluir'], [Search, 'Buscar'], [Plus, 'Criar']].map(([Icon, label]) => {
            const I = Icon as typeof Inbox;
            return <div key={String(label)} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center"><I className="h-5 w-5" /><span className="text-xs text-muted-foreground">{String(label)}</span></div>;
          })}
        </div>
      </Section>

      <Section id="ilustracao" title="Ilustração" intro="Órbitas finas e pontos de luz. Aparecem em aberturas, estados vazios e no Escritório — nunca atrás de listas ou formulários.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative h-48 overflow-hidden rounded-2xl border bg-card">
            <svg viewBox="0 0 400 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <ellipse cx="300" cy="100" rx="160" ry="70" fill="none" stroke="var(--color-stellar)" strokeOpacity=".35" />
              <ellipse cx="300" cy="100" rx="100" ry="42" fill="none" stroke="var(--color-primary)" strokeOpacity=".35" />
              <circle cx="190" cy="78" r="4" fill="var(--color-primary)" />
              <circle cx="380" cy="132" r="3" fill="var(--color-stellar)" />
            </svg>
            <div className="relative p-5"><p className="text-xs uppercase tracking-wider text-primary">Abertura</p><p className="font-display text-2xl">Seu dia em órbita</p></div>
          </div>
          <EmptyState icon={<Sparkles className="h-6 w-6" />} title="Nada para hoje" action={<Button size="sm"><Plus className="h-4 w-4" />Planejar o dia</Button>}>Um espaço livre. Escolha o que merece sua atenção.</EmptyState>
        </div>
      </Section>

      <Section id="componentes" title="Componentes" intro="Botões: um principal por área; o resto é contorno ou discreto. Altura mínima 40 px (44 px no toque).">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button><Plus className="h-4 w-4" />Principal</Button>
            <Button variant="outline">Secundário</Button>
            <Button variant="ghost">Discreto</Button>
            <Button variant="destructive"><Trash2 className="h-4 w-4" />Excluir</Button>
            <Button variant="link">Link</Button>
            <Button size="icon" variant="outline" aria-label="Buscar"><Search className="h-4 w-4" /></Button>
            <Button disabled>Indisponível</Button>
          </div>
          <div className="grid max-w-xl gap-3">
            <label className="text-sm font-medium" htmlFor="ds-input">Título da tarefa</label>
            <Input id="ds-input" placeholder="O que precisa ser feito?" />
            <p className="text-xs text-muted-foreground">Ajuda curta abaixo do campo; erro em vermelho com o motivo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip tone="action" icon={<Calendar className="h-3 w-3" />}>Amanhã</Chip>
            <Chip icon={<FolderKanban className="h-3 w-3" />}>Arco Labs</Chip>
            <Chip icon={<Target className="h-3 w-3" />}>Carreira</Chip>
          </div>
        </div>
      </Section>

      <Section id="tarefa" title="Linha de tarefa" intro="A mesma linha em Hoje, Lista, Semana e painéis do dia. Título abre; “Concluir” é botão próprio; detalhes viram chips; editar campos acontece no painel da tarefa.">
        <div className="max-w-2xl space-y-2">
          <TaskRow title="Revisar proposta comercial do cliente" accent="danger" meta={<><Chip tone="danger" icon={<Clock className="h-3 w-3" />}>Atrasada · 5 out</Chip><Chip tone="danger" icon={<Flag className="h-3 w-3" />}>Urgente</Chip><Chip icon={<FolderKanban className="h-3 w-3" />}>Arco Labs</Chip></>} />
          <TaskRow title="Preparar apresentação trimestral" done={done} onToggle={() => setDone(v => !v)} meta={<><Chip tone="action" icon={<Calendar className="h-3 w-3" />}>Sexta</Chip><Chip icon={<Target className="h-3 w-3" />}>Carreira</Chip></>} />
          <TaskRow title="Responder e-mails pendentes" meta={<Chip icon={<Calendar className="h-3 w-3" />}>Hoje</Chip>} />
        </div>
        <div className="mt-4"><DoDont good="Chips de leitura; campos editáveis no painel" bad="Seletores de etapa e prioridade dentro de cada cartão (Quadro atual)" /></div>
      </Section>

      <Section id="padroes" title="Padrões de tela" intro="Cabeçalho compacto, uma linha de controles, conteúdo. Confirmação com desfazer em vez de pergunta sempre que a ação é reversível.">
        <div className="rounded-2xl border bg-card p-4">
          <ScreenHeader title="Tarefas" context="7 em aberto · 1 atrasada" action={<Button><Plus className="h-4 w-4" />Nova tarefa</Button>}>
            <div className="flex min-h-10 flex-1 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground"><Search className="h-4 w-4" />Buscar tarefas</div>
            <Button variant="outline">Filtros</Button>
            <div className="flex rounded-lg border p-0.5 text-sm">{['Lista', 'Quadro', 'Semana', 'Mais'].map((v, i) => <span key={v} className={`rounded-md px-3 py-2 ${i === 0 ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{v}</span>)}</div>
          </ScreenHeader>
          <p className="text-xs text-muted-foreground">Exemplo: 1 faixa de controles em vez das 4 de hoje (contadores, Em aberto/Concluídas, busca+filtros+7 visões, “Mais opções”).</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-semibold">Ação reversível: desfazer</p>
            {deleted
              ? <div role="status" className="mt-3 flex items-center justify-between rounded-xl border bg-muted/50 p-3 text-sm">Tarefa arquivada.<Button size="sm" variant="ghost" onClick={() => setDeleted(false)}><Undo2 className="h-4 w-4" />Desfazer</Button></div>
              : <Button className="mt-3" variant="outline" onClick={() => setDeleted(true)}>Arquivar exemplo</Button>}
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-semibold">Ação irreversível: confirmar</p>
            <p className="mt-1 text-xs text-muted-foreground">Excluir de vez, enviar para fora, apagar evento do Google: diálogo com o efeito descrito e o botão nomeado pela ação (“Excluir tarefa”), nunca “OK”.</p>
          </div>
          <EmptyState tone="error" icon={<AlertTriangle className="h-6 w-6 text-critical" />} title="Não foi possível carregar" action={<Button size="sm" variant="outline">Tentar de novo</Button>}>Seus dados estão salvos; a leitura falhou.</EmptyState>
          <div className="space-y-2 rounded-2xl border bg-card p-4" aria-label="Carregando">
            <p className="text-sm font-semibold">Carregando</p>
            {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}
          </div>
        </div>
      </Section>

      <Section id="acesso" title="Toque e acessibilidade">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {['Alvos de toque de no mínimo 44 × 44 px.', 'Foco visível em tudo (contorno na cor de ação).', 'Contraste AA nos dois temas; texto secundário incluso.', 'Movimento curto (150–250 ms) e só para comunicar mudança; desligado com “reduzir movimento”.', 'Arrastar sempre tem alternativa por botão ou menu.', 'Ícone sozinho sempre com nome acessível.'].map(t => (
            <li key={t} className="flex gap-2 rounded-xl border bg-card p-3"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t}</li>
          ))}
        </ul>
      </Section>

      <Section id="decisoes" title="Decisões para aprovar" intro="Responda no chat com a letra de cada uma (ex.: 1A, 2A, 3B). Depois disso, consolido o sistema e reestilizo começando por Tarefas.">
        <div className="space-y-6">
          <Decision n={1} title="Cor de ação em todo o sistema"
            a={{ label: 'A — Nebulosa violeta (identidade aprovada)', note: 'O violeta do L vira a cor de todas as ações, em todas as telas. Ciano passa a significar movimento/progresso e o dourado marca conquistas. Recomendado: é o que a marca Órbita define.', sample: <Button className="bg-[#8B5CF6] text-white hover:bg-[#7C3AED]">Nova tarefa</Button> }}
            b={{ label: 'B — Ciano (como o resto do app hoje)', note: 'Mantém o ciano como ação e o violeta só para agentes; Tarefas deixa de ser violeta.', sample: <Button>Nova tarefa</Button> }} />
          <Decision n={2} title="Cartão do Quadro"
            a={{ label: 'A — Cartão compacto', note: 'Título, “Concluir” e chips. Etapa e prioridade mudam no painel ou arrastando. Recomendado.', sample: <TaskRow title="Atualizar portfólio" meta={<><Chip icon={<Calendar className="h-3 w-3" />}>12 out</Chip><Chip>Normal</Chip></>} /> }}
            b={{ label: 'B — Cartão com seletores (como hoje)', note: 'Edita etapa e prioridade direto no cartão; ocupa o dobro da altura.', sample: <div className="rounded-xl border bg-card p-3 text-sm"><p className="font-medium">Atualizar portfólio</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span className="rounded-lg border p-2">Etapa: A fazer ▾</span><span className="rounded-lg border p-2">Prioridade: Normal ▾</span></div></div> }} />
          <Decision n={3} title="Cabeçalho das telas de trabalho"
            a={{ label: 'A — Compacto', note: 'Título, contexto, ação principal e uma faixa de controles. Recomendado para Tarefas, Planejar, Financeiro.', sample: <div className="rounded-xl border p-3"><p className="font-display text-2xl">Tarefas</p><p className="text-xs text-muted-foreground">7 em aberto · 1 atrasada</p></div> }}
            b={{ label: 'B — Editorial (como hoje)', note: 'Título grande com frase e órbitas; mais respiro, menos conteúdo na primeira tela.', sample: <div className="rounded-xl border p-5"><p className="text-xs uppercase tracking-wider text-primary">Seu espaço de execução</p><p className="font-display text-4xl">Tarefas</p><p className="text-sm text-muted-foreground">Organize o próximo passo.</p></div> }} />
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><ArrowRight className="h-4 w-4" />Nada nesta página altera dados ou telas existentes até a aprovação.</p>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Circle className="h-3 w-3" />Referências: docs/design-system/inventario.md</p>
      </Section>
    </main>
  );
}

function Decision({ n, title, a, b }: { n: number; title: string; a: { label: string; note: string; sample: React.ReactNode }; b: { label: string; note: string; sample: React.ReactNode } }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-sm font-semibold">{n}. {title}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {[a, b].map(o => (
          <div key={o.label} className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold">{o.label}</p>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">{o.note}</p>
            {o.sample}
          </div>
        ))}
      </div>
    </div>
  );
}
