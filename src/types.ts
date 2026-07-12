// ─── Message types ───────────────────────────────────────────────

export interface Message {
  timestamp: string | null;
  project: string;
  role: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  model: string | null;
  cost: number;
}

/** Aggregation map entry (internal, has mutable sets) */
export interface AggregationEntry {
  timestamp: string | null;
  project: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  model: string | null;
  cost: number;
  messageCount: number;
  models: Set<string>;
  projects?: Set<string>;
}

/** Final display message (after aggregation, sets resolved to strings) */
export interface DisplayMessage {
  timestamp: string | null;
  project: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  model: string;
  cost: number;
  messageCount: number;
  projectCount?: number;
}

// ─── Totals ──────────────────────────────────────────────────────

export interface Totals {
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  models: Set<string>;
}

export interface FinalizedTotals {
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  distinctModels: string[];
}

export interface UsageResult {
  messages: Message[];
  totals: FinalizedTotals;
}

export interface ProjectsResult {
  projects: string[];
  messageCount: Record<string, number>;
}

// ─── Source adapter interface ────────────────────────────────────

export interface Source {
  name: string;
  isAvailable(): boolean;
  readSessions(): Promise<UsageResult>;
  getProjects(): Promise<ProjectsResult>;
}

export interface SourceInfo {
  name: string;
  source: Source;
  available: boolean;
  messageCount?: number;
}

// ─── Pricing ─────────────────────────────────────────────────────

export interface ModelPricing {
  input_cost_per_token: number;
  output_cost_per_token: number;
  cache_creation_input_token_cost: number;
  cache_read_input_token_cost: number;
}

/** LiteLLM raw pricing data keyed by model name */
export type PricingMap = Map<string, ModelPricing>;

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

// ─── Filters ─────────────────────────────────────────────────────

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface FilterOptions {
  timeFilter?: string;
  projectFilter?: string;
  modelFilter?: string;
}

// ─── Sorting ─────────────────────────────────────────────────────

export type SortField = 'cost' | 'time' | 'tokens' | 'project';
export type SortOrder = 'asc' | 'desc';

// ─── CLI options ─────────────────────────────────────────────────

export interface CliOptions {
  time?: string;
  project?: string;
  model?: string;
  sort: SortField;
  order: SortOrder;
  detailed?: boolean;
  byDate?: boolean;
  allProjects?: boolean;
  projects?: boolean;
  models?: boolean;
  disableGithubPrompt?: boolean;
  enableGithubPrompt?: boolean;
  sources?: string;
  autoDetectedProject?: boolean;
}

// ─── Source processing context ───────────────────────────────────

export interface ProcessLineContext {
  projectName?: string | null;
  totals: Totals;
  [key: string]: unknown;
}

export type ProcessLineFn = (
  data: Record<string, unknown>,
  ctx: ProcessLineContext
) => Message | null | undefined;
