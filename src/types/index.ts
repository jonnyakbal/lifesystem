export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Captures (INBOX)
export type CaptureType = 'text' | 'link' | 'image' | 'audio';
export type CaptureStatus = 'inbox' | 'classified' | 'noted' | 'organized';
export type CaptureTargetType = 'note' | 'task' | 'content' | 'event' | 'edital' | 'project' | 'pillar' | 'financial' | 'journal' | 'reference';

export interface Capture extends BaseEntity {
  content: string;
  type: CaptureType;
  title?: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  audioUrl?: string;
  transcription?: string;
  aiSuggestion?: AiClassification;
  status: CaptureStatus;
  targetType?: CaptureTargetType;
  targetId?: string;
  coverUrl?: string;
  coverColor?: string;
  category?: string;
  linkedCaptureIds?: string[];
}

// Pillars
export interface Pillar extends BaseEntity {
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  currentStatus: string;
  target: string;
}

export interface PillarAction extends BaseEntity {
  pillarId: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  dueDate?: string;
  sortOrder: number;
}

// Projects
// Was a fixed union; now a loose alias since project stages are configurable
// (see StageConfig below) — kept as a named type so existing imports don't churn.
export type ProjectStatus = string;

export interface Project extends BaseEntity {
  name: string;
  description: string;
  status: ProjectStatus;
  tags: string[];
  needs: string;
  links: ProjectLink[];
  tasksCount: number;
  tasksDone: number;
  coverUrl?: string;
  coverColor?: string;
}

export interface ProjectLink {
  label: string;
  url: string;
}

// Tasks
export type TaskPriority = 'urgent' | 'important' | 'normal';
// Was a fixed union; now a loose alias since task stages are configurable
// (see StageConfig below) — kept as a named type so existing imports don't churn.
export type TaskStatus = string;

export interface TaskChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  projectId?: string;
  pillarId?: string;
  dueDate?: string;
  completedAt?: string;
  parentId?: string;
  sortOrder: number;
  tags: string[];
  checklist: TaskChecklistItem[];
  recurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly';
}

// Content
export type ContentChannel = 'blog' | 'youtube' | 'instagram' | 'tiktok';
export type ContentStage = 'idea' | 'draft' | 'review' | 'scheduled' | 'published' | 'archived';
export type ContentStatus = 'draft' | 'published' | 'archived';

export interface ContentChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ContentMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export interface Content extends BaseEntity {
  title: string;
  body: string;
  channel: ContentChannel;
  stage: ContentStage;
  category: string;
  format: string;
  tags: string[];
  status: ContentStatus;
  pinned: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  publishedUrl?: string;
  responsible?: string;
  editorialLine?: string;
  checklist?: ContentChecklistItem[];
  metrics?: ContentMetrics;
  linkedTaskIds: string[];
  linkedProjectIds: string[];
  collectionId?: string;
}

export interface WikiCollection extends BaseEntity {
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface ContentCategory extends BaseEntity {
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

// Configurable stages — replaces the old fixed-union status/stage columns
// for tasks and projects, and is what Editais uses from day one. One
// StageConfig document per scope, ordered array = column order.
export type StageScope = 'tasks' | 'projects' | 'editais';

export interface StageTrigger {
  action: 'create_reminder_task' | 'create_project';
}

export interface StageDef {
  id: string;
  label: string;
  color: string;
  dot: string;
  isTerminal?: boolean;
  trigger?: StageTrigger;
}

export interface StageConfig extends BaseEntity {
  scope: StageScope;
  stages: StageDef[];
}

// Editais Culturais — grants/opportunities Jonny pursues recurringly.
export interface Edital extends BaseEntity {
  title: string;
  orgao?: string;
  description?: string;
  valor?: number;
  prazoInscricao?: string;
  link?: string;
  pillarId?: string;
  stage: string;
  notes?: string;
}

// Cockpit da automação de Editais — o contexto e as regras que alimentam a
// IA. Fica em dado editável em vez de fixo no prompt, para o Jonny ajustar
// o próprio perfil e os pré-requisitos sem depender de deploy.
export interface EditalSettings extends BaseEntity {
  perfil: string;
  preRequisitos: string;
  palavrasChave: string[];
  fontes: string[];
  notaMinima: number;
  modelo?: string;
}

// Indicators
export type IndicatorType = 'count' | 'boolean' | 'scale' | 'currency' | 'percentage';
export type IndicatorFrequency = 'daily' | 'weekly' | 'monthly';

export interface Indicator extends BaseEntity {
  pillarId: string;
  name: string;
  description?: string;
  type: IndicatorType;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  frequency: IndicatorFrequency;
  history?: number[];
}

export interface IndicatorRecord extends BaseEntity {
  indicatorId: string;
  value: number;
  note?: string;
  recordedAt: string;
}

// Financial
export type FinancialType = 'income' | 'expense_fixed' | 'expense_variable';

export interface FinancialEntry extends BaseEntity {
  type: FinancialType;
  category: string;
  description?: string;
  amount: number;
  date: string;
  recurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  accountId?: string;
  cardId?: string;
  payee?: string;
  tags?: string[];
  status?: 'pending' | 'paid' | 'overdue';
  dueDate?: string;
  paidDate?: string;
}

export interface Budget extends BaseEntity {
  category: string;
  type: 'expense_fixed' | 'expense_variable';
  monthlyLimit: number;
  spent: number;
  month: string; // YYYY-MM
}

export interface FinancialGoal extends BaseEntity {
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon: string;
  color: string;
  status: 'active' | 'completed' | 'paused';
}

export interface Saving extends BaseEntity {
  name: string;
  targetAmount?: number;
  currentAmount: number;
}

// ─── Accounts (Controle de Caixa) ────────────────────────────────────────────
export type AccountType = 'checking' | 'savings' | 'digital' | 'cash' | 'investment' | 'pj';

export interface Account extends BaseEntity {
  name: string;
  type: AccountType;
  bank?: string;
  agency?: string;
  accountNumber?: string;
  balance: number;
  color: string;
  icon: string;
  isActive: boolean;
  isDefault: boolean;
}

// ─── Cards (Cartões) ─────────────────────────────────────────────────────────
export type CardType = 'credit' | 'debit' | 'multiple';

export interface Card extends BaseEntity {
  name: string;
  type: CardType;
  lastDigits: string;
  brand: string;
  limit?: number;
  used?: number;
  closingDay?: number;
  dueDay?: number;
  color: string;
  accountId?: string;
  isActive: boolean;
}

// ─── Bills (Faturas) ──────────────────────────────────────────────────────────
export type BillStatus = 'open' | 'paid' | 'overdue' | 'partial' | 'closed';

export interface BillItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  installments?: { current: number; total: number };
}

export interface Bill extends BaseEntity {
  cardId: string;
  month: string; // YYYY-MM
  amount: number;
  paidAmount: number;
  status: BillStatus;
  dueDate: string;
  closeDate: string;
  description?: string;
  items: BillItem[];
}

// ─── Payees (Credores/Fornecedores) ──────────────────────────────────────────
export type PayeeType = 'person' | 'company' | 'government' | 'other';

export interface Payee extends BaseEntity {
  name: string;
  type: PayeeType;
  document?: string;
  email?: string;
  phone?: string;
  category?: string;
  notes?: string;
  color: string;
  icon: string;
}

// ─── Financial Categories (Categorias) ────────────────────────────────────────
export type CategoryType = 'income' | 'expense_fixed' | 'expense_variable';

export interface FinancialCategory extends BaseEntity {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  parentId?: string;
  isActive: boolean;
  sortOrder: number;
}

// Journal
export interface JournalEntry extends BaseEntity {
  content: string;
  pillarChecks: Record<string, number>;
  gratitude?: string;
  mood?: 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
  aiSummary?: string;
  entryDate: string;
}

// Vision (Plano de Voo)
export type VisionSection = 'identity' | 'vision_5y' | 'timeline' | 'dream' | 'custom';

export interface VisionDocument extends BaseEntity {
  section: VisionSection;
  title: string;
  content?: string;
  sortOrder: number;
}

// AI
export interface AiClassification {
  type: 'task' | 'note' | 'reference' | 'financial' | 'journal' | 'project';
  priority?: TaskPriority;
  title: string;
  description?: string;
  project?: string;
  pillar?: string;
  dueDate?: string;
  confidence: number;
  alternatives?: { type: string; title: string }[];
}

// Diário de Bordo — living technical/product logbook (distinct from the
// personal Journal above: this one tracks system evolution, not the day).
export type LogEntryCategory = 'stack' | 'infra' | 'deploy' | 'seguranca' | 'testes' | 'produto' | 'roadmap' | 'geral';

export interface LogEntry extends BaseEntity {
  title: string;
  body: string; // rich text HTML, same convention as Content.body
  category: LogEntryCategory;
  date: string; // YYYY-MM-DD — "as of" date, may differ from createdAt for backfilled entries
}

// ─── Content Hub (Central de Fontes) ────────────────────────────────────────
export type ContentSourceType = 'rss' | 'website' | 'youtube_channel' | 'youtube_playlist' | 'newsletter' | 'manual';

export interface ContentSource extends BaseEntity {
  name: string;
  type: ContentSourceType;
  url: string;
  description?: string;
  icon?: string;
  color?: string;
  tags?: string[];
  isActive: boolean;
  lastFetchedAt?: string;
  fetchStatus: 'idle' | 'fetching' | 'success' | 'error';
  error?: string;
  itemCount: number;
  nextFetchAt?: string;
  crawlInterval?: string;
}

export type ContentItemStatus = 'unread' | 'reading' | 'read' | 'archived';
export type ContentItemImportance = 'low' | 'normal' | 'high';
export type ActionType = 'capture' | 'task' | 'note' | 'content' | 'dismiss';

export interface ContentItem extends BaseEntity {
  sourceId: string;
  title: string;
  url: string;
  author?: string;
  content: string;
  excerpt?: string;
  imageUrl?: string;
  publishedAt?: string;
  fetchedAt: string;
  summary?: string;
  tags?: string[];
  category?: string;
  status: ContentItemStatus;
  importance: ContentItemImportance;
  aiInsights?: {
    summary?: string;
    actionSuggestion?: ActionType;
    actionTitle?: string;
    relatedPillar?: string;
    relatedProject?: string;
  };
  linkedCaptureId?: string;
  linkedTaskId?: string;
}

// User Settings
export interface UserSettings extends BaseEntity {
  theme: 'dark' | 'light' | 'system';
  language: string;
  aiEnabled: boolean;
  aiModel: string;
  notificationEmail: boolean;
  notificationPush: boolean;
}
