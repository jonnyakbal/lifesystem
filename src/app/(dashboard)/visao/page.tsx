'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Target, Save, Clock, Star, Rocket, Eye, Edit3, CheckCircle2, FolderKanban, TrendingUp, BrainCircuit, Layers, Compass, ArrowUpRight, BookOpen } from 'lucide-react';
import { cn, escapeHtml, sanitizeHtml } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PilaresContent } from '@/components/pilares-content';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';
import { apiFetch, showError } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

interface VisionDocument {
  id: string;
  section: string;
  title: string;
  content: string;
}

interface Project {
  id: string;
  name: string;
  status: 'active' | 'development' | 'paused' | 'idea';
  createdAt: string;
  updatedAt?: string;
}

const defaultSections = [
  { id: 'identity', title: 'Identidade', icon: Star, description: 'Quem quero ser', prompt: 'Que valores quero viver? Como quero agir, cuidar de mim e contribuir para o mundo?' },
  { id: 'vision_5y', title: 'Visão 5 Anos', icon: Target, description: 'Onde quero estar', prompt: 'Imagine sua vida daqui a cinco anos. Como são seus dias, seus relacionamentos e seu trabalho?' },
  { id: 'timeline', title: 'Linha do Tempo', icon: Clock, description: 'Marcos por ano', prompt: 'Quais marcos dão forma a essa visão? Organize os próximos passos por ano.' },
  { id: 'dream', title: 'Sonho Grande', icon: Rocket, description: 'O que me move', prompt: 'Qual sonho ainda parece distante, mas merece espaço no seu plano?' },
  { id: 'custom', title: 'Metodologia', icon: BrainCircuit, description: 'Como quero caminhar', prompt: 'Quais práticas e princípios ajudam você a transformar intenção em ação?' },
];

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

function renderMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  return sanitizeHtml(escaped
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-primary/30 pl-3 italic text-muted-foreground">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n{2,}/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>'));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function VisaoWorkspace() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') === 'pilares' ? 'pilares' : 'plano';
  const [documents, setDocuments] = useState<VisionDocument[]>([]);
  const [activeSection, setActiveSection] = useState('identity');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visionError, setVisionError] = useState('');
  const [projectsError, setProjectsError] = useState('');
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => { loadDocuments(); loadProjects(); }, []);

  useEffect(() => {
    const doc = documents.find(d => d.section === activeSection);
    queueMicrotask(() => {
      setContent(doc?.content || '');
      setPreviewMode(false);
    });
  }, [activeSection, documents]);

  async function loadDocuments() {
    setVisionError('');
    try { setDocuments(await apiFetch<VisionDocument[]>('/api/vision')); }
    catch (error) { setVisionError(showError(error)); }
    finally { setIsLoading(false); }
  }

  async function loadProjects() {
    setProjectsError('');
    try { setProjects(await apiFetch<Project[]>('/api/projects')); }
    catch (error) { setProjectsError(showError(error)); }
    finally { setProjectsLoading(false); }
  }

  async function handleSave() {
    if (isSaving || isLoading || visionError) return;
    setIsSaving(true);
    try {
    await apiFetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: activeSection,
        title: defaultSections.find(s => s.id === activeSection)?.title,
        content,
      }),
    });
    await loadDocuments();
    toast.success('Visão salva!');
    } catch (error) { toast.error(showError(error)); }
    finally { setIsSaving(false); }
  }

  const completedSections = defaultSections.filter(section => documents.some(d => d.section === section.id && d.content?.trim())).length;
  const completionPercent = Math.round((completedSections / defaultSections.length) * 100);

  const currentSection = defaultSections.find(s => s.id === activeSection) || defaultSections[0];
  const ActiveIcon = currentSection.icon;

  return (
    <motion.div
      className="work-page work-vision p-4 lg:p-8"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      {/* Unified with Pilares (item 9) — one menu entry, two tabs */}
      <motion.nav aria-label="Áreas da visão" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border bg-card/50 p-1 sm:w-fit" variants={fade}>
        <Link
          href="/visao"
          aria-current={tab === 'plano' ? 'page' : undefined}
          className={cn('flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors',
            tab === 'plano' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          <Compass className="h-3.5 w-3.5" /> Plano de Voo
        </Link>
        <Link
          href="/visao?tab=pilares"
          aria-current={tab === 'pilares' ? 'page' : undefined}
          className={cn('flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors',
            tab === 'pilares' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          <Layers className="h-3.5 w-3.5" /> Pilares
        </Link>
      </motion.nav>

      {tab === 'pilares' ? (
        <PilaresContent />
      ) : (
      <>
      <WorkspaceHeading eyebrow="Cultivar · direção" title="Plano de Voo" description="Dê palavras à vida que você quer construir. Uma direção clara ajuda a escolher os próximos passos, sem exigir todas as respostas agora." actions={<><Link href="/indicadores" className="work-action-link"><Target className="h-4 w-4" /> Minhas metas</Link><Link href="/diario" className="work-action-link"><BookOpen className="h-4 w-4" /> Diário</Link></>}><div className="work-metrics"><WorkspaceMetric label="Seções preenchidas" value={isLoading || visionError ? '—' : `${completedSections}/${defaultSections.length}`} tone="primary" detail={`${completionPercent}% do plano escrito`} /><WorkspaceMetric label="Projetos ativos" value={projectsLoading || projectsError ? '—' : projects.filter(p => p.status === 'active').length} /><WorkspaceMetric label="Horizonte da visão" value={new Date().getFullYear() + 5} detail="Um destino para orientar o presente" /></div></WorkspaceHeading>

      {visionError && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-critical/30 bg-critical/5 p-4"><p className="text-sm">Não foi possível abrir o plano. {visionError}</p><Button variant="outline" className="min-h-11" onClick={() => { setIsLoading(true); void loadDocuments(); }}>Tentar novamente</Button></div>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(190px,1fr)_minmax(0,3fr)]">
        {/* Section Tabs */}
        <motion.div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0" variants={fade}>
          {defaultSections.map((section) => {
            const doc = documents.find(d => d.section === section.id);
            const hasContent = Boolean(doc?.content?.trim().length);
            return (
              <button
                key={section.id}
                aria-pressed={activeSection === section.id}
                disabled={isSaving}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex min-h-14 w-[180px] shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-full',
                  activeSection === section.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground border-transparent'
                )}
              >
                <section.icon className="h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{section.title}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
                {hasContent && (
                  <CheckCircle2 className="h-4 w-4 text-money shrink-0" />
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Editor */}
        <motion.div className="min-w-0" variants={fade}>
          <Card className="overflow-hidden rounded-2xl">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ActiveIcon className="h-5 w-5 text-primary" />
                <CardTitle className="font-display text-2xl font-medium">{currentSection.title}</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
                  <Button
                    variant={!previewMode ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-11 px-3 text-xs"
                    aria-pressed={!previewMode}
                    onClick={() => setPreviewMode(false)}
                  >
                    <Edit3 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button
                    variant={previewMode ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-11 px-3 text-xs"
                    aria-pressed={previewMode}
                    onClick={() => setPreviewMode(true)}
                  >
                    <Eye className="mr-1 h-3 w-3" /> Visualizar
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {wordCount(content)} palavras
                </div>
                <Button onClick={handleSave} disabled={isSaving || isLoading || !!visionError} size="sm" className="min-h-11">
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-5 border-l-2 border-primary/30 pl-3 text-sm leading-relaxed text-muted-foreground">{currentSection.prompt}</p>
              {isLoading ? <div className="min-h-[360px] space-y-4" aria-label="Carregando plano"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div> : <>
              {previewMode ? (
                <div
                  className="min-h-[360px] rounded-xl border bg-background/50 p-4 prose-mkt text-base leading-relaxed sm:min-h-[420px]"
                  dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${renderMarkdown(content || '_Nada escrito ainda..._')}</p>` }}
                />
              ) : (
                <Textarea
                  value={content}
                  aria-label={`Escrever ${currentSection.title}`}
                  disabled={isSaving || !!visionError}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Comece com uma ideia. Este plano pode crescer com você."
                  className="min-h-[360px] resize-y border-0 bg-transparent p-1 focus-visible:ring-1 font-sans text-base leading-relaxed sm:min-h-[420px]"
                  rows={16}
                />
              )}
              </>}
              <p className="mt-4 border-t pt-3 text-[11px] text-muted-foreground">Você pode usar Markdown para títulos, listas e destaques.</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Timeline Visualization */}
      <motion.div className="mt-8" variants={fade}>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(190px,1fr)_minmax(0,3fr)]">
          {/* Stats Overview */}
          <motion.div className="space-y-4" variants={fade}>
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Visão Geral
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de Projetos</span>
                    <Badge variant="secondary">{projects.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Ativos</span>
                    <Badge variant="secondary" className="bg-money/10 text-money">
                      {projects.filter(p => p.status === 'active').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Em Desenvolvimento</span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {projects.filter(p => p.status === 'development').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Pausados</span>
                    <Badge variant="secondary" className="bg-critical/10 text-critical">
                      {projects.filter(p => p.status === 'paused').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Ideias</span>
                    <Badge variant="secondary" className="bg-muted-foreground/10 text-muted-foreground">
                      {projects.filter(p => p.status === 'idea').length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Timeline */}
          <motion.div className="min-w-0" variants={fade}>
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Projetos que dão forma à visão
                </CardTitle>
              </CardHeader>
              <CardContent>
                {projectsLoading ? <Skeleton className="h-24 w-full" /> : projectsError ? <div role="alert" className="py-4"><p className="text-sm text-muted-foreground">Não foi possível abrir os projetos.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void loadProjects()}>Tentar novamente</Button></div> : projects.length === 0 ? (
                  <div className="py-8 text-muted-foreground">
                    <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-center text-sm">Seu plano ganha forma em projetos.</p>
                    <div className="mt-4 flex justify-center"><Link href="/projetos" className="work-action-link">Explorar projetos <ArrowUpRight className="h-4 w-4" /></Link></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projects.map((project, index) => {
                      const statusConfig = {
                        active: { label: 'Ativo', color: 'bg-money', textColor: 'text-money', borderColor: 'border-money/30' },
                        development: { label: 'Desenvolvimento', color: 'bg-primary', textColor: 'text-primary', borderColor: 'border-primary/30' },
                        paused: { label: 'Pausado', color: 'bg-critical', textColor: 'text-critical', borderColor: 'border-critical/30' },
                        idea: { label: 'Ideia', color: 'bg-muted-foreground', textColor: 'text-muted-foreground', borderColor: 'border-muted-foreground/30' },
                      }[project.status];

                      const startDate = new Date(project.createdAt);
                      const endDate = project.status === 'active' || project.status === 'development' 
                        ? null 
                        : project.updatedAt ? new Date(project.updatedAt) : null;

                      return (
                        <motion.div
                          key={project.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            'flex items-center gap-3 p-4 rounded-xl border',
                            statusConfig.borderColor
                          )}
                        >
                          <div className={cn('w-2 h-2 rounded-full', statusConfig.color)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-medium text-sm break-words">{project.name}</p>
                              <Badge variant="secondary" className={cn('text-xs', statusConfig.textColor)}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{startDate.toLocaleDateString('pt-BR')}</span>
                              <span>→</span>
                              <span>{endDate ? endDate.toLocaleDateString('pt-BR') : 'em progresso'}</span>
                            </div>
                          </div>
                          <Link href={`/projetos?open=${encodeURIComponent(project.id)}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-muted-foreground hover:text-primary" aria-label={`Ver projeto ${project.name}`}><ArrowUpRight className="h-4 w-4" /></Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
      </>
      )}
    </motion.div>
  );
}

export default function VisaoPage() {
  return <Suspense fallback={<div className="p-4 lg:p-8"><Skeleton className="h-48 w-full rounded-3xl" /></div>}><VisaoWorkspace /></Suspense>;
}
