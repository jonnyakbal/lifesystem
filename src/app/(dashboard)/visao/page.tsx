'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Target, Save, Clock, Star, Rocket, Eye, Edit3, CheckCircle2, FolderKanban, TrendingUp, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

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
  { id: 'identity', title: 'Identidade', icon: Star, description: 'Quem quero ser' },
  { id: 'vision_5y', title: 'Visão 5 Anos', icon: Target, description: 'Onde quero estar em 2031' },
  { id: 'timeline', title: 'Linha do Tempo', icon: Clock, description: 'Marcos por ano' },
  { id: 'dream', title: 'Sonho Grande', icon: Rocket, description: 'O que parece louco mas é real' },
  { id: 'custom', title: 'Metodologia', icon: BrainCircuit, description: 'Por trás do LIFESYSTEM' },
];

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

function renderMarkdown(text: string): string {
  return text
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
    .replace(/\n/g, '<br/>');
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function VisaoPage() {
  const [documents, setDocuments] = useState<VisionDocument[]>([]);
  const [activeSection, setActiveSection] = useState('identity');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => { loadDocuments(); loadProjects(); }, []);

  useEffect(() => {
    const doc = documents.find(d => d.section === activeSection);
    setContent(doc?.content || '');
    setPreviewMode(false);
  }, [activeSection, documents]);

  async function loadDocuments() {
    const res = await fetch('/api/vision');
    const data = await res.json();
    setDocuments(data);
  }

  async function loadProjects() {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data);
  }

  async function handleSave() {
    setIsSaving(true);
    await fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: activeSection,
        title: defaultSections.find(s => s.id === activeSection)?.title,
        content,
      }),
    });
    setIsSaving(false);
    loadDocuments();
    toast.success('Visão salva!');
  }

  const completedSections = documents.filter(d => d.content && d.content.trim().length > 0).length;
  const completionPercent = Math.round((completedSections / defaultSections.length) * 100);

  const ActiveIcon = defaultSections.find(s => s.id === activeSection)?.icon || Target;

  return (
    <motion.div
      className="p-8"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      <motion.div className="mb-8 flex items-center justify-between" variants={fade}>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Plano de Voo</h1>
          <p className="text-muted-foreground">Sua visão de longo prazo e direção</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3 text-money" />
            {completedSections}/{defaultSections.length} preenchidos
          </Badge>
          <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-money rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${completionPercent}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Section Tabs */}
        <motion.div className="space-y-2" variants={fade}>
          {defaultSections.map((section) => {
            const doc = documents.find(d => d.section === section.id);
            const hasContent = Boolean(doc?.content?.trim().length);
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all',
                  activeSection === section.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                )}
              >
                <section.icon className="h-5 w-5" />
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
        <motion.div className="lg:col-span-3" variants={fade}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ActiveIcon className="h-5 w-5 text-primary" />
                <CardTitle>
                  {defaultSections.find(s => s.id === activeSection)?.title}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
                  <Button
                    variant={!previewMode ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setPreviewMode(false)}
                  >
                    <Edit3 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button
                    variant={previewMode ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setPreviewMode(true)}
                  >
                    <Eye className="mr-1 h-3 w-3" /> Preview
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {wordCount(content)} palavras
                </div>
                <Button onClick={handleSave} disabled={isSaving} size="sm">
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {previewMode ? (
                <div
                  className="min-h-[400px] rounded-md border bg-background p-4 prose-mkt text-sm"
                  dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${renderMarkdown(content || '_Nada escrito ainda..._')}</p>` }}
                />
              ) : (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escreva sua visão aqui... (suporta Markdown)"
                  className="min-h-[400px] resize-none border-0 bg-transparent p-0 focus-visible:ring-0 font-mono text-sm"
                  rows={16}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Timeline Visualization */}
      <motion.div className="mt-8" variants={fade}>
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Stats Overview */}
          <motion.div className="space-y-4" variants={fade}>
            <Card>
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
          <motion.div className="lg:col-span-3" variants={fade}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Linha do Tempo dos Projetos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum projeto encontrado</p>
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
                            'flex items-center gap-4 p-3 rounded-lg border',
                            statusConfig.borderColor
                          )}
                        >
                          <div className={cn('w-2 h-2 rounded-full', statusConfig.color)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">{project.name}</p>
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
                          <div className={cn('w-24 h-1.5 rounded-full bg-muted overflow-hidden')}>
                            <motion.div
                              className={cn('h-full rounded-full', statusConfig.color)}
                              initial={{ width: 0 }}
                              animate={{ width: project.status === 'active' ? '100%' : project.status === 'development' ? '60%' : project.status === 'paused' ? '30%' : '10%' }}
                              transition={{ duration: 0.7, ease: 'easeOut', delay: index * 0.1 }}
                            />
                          </div>
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
    </motion.div>
  );
}
