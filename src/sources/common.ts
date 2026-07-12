/**
 * Shared utilities for all data sources.
 */
import fs from 'fs-extra';
import path from 'path';
import { cwdToProjectName } from '../util';
import type {
  Message,
  Totals,
  FinalizedTotals,
  ProcessLineFn,
  ProcessLineContext,
} from '../types';

// ─── Totals helpers ──────────────────────────────────────────────

export function createTotals(): Totals {
  return {
    messageCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    models: new Set(),
  };
}

export function finalizeTotals(totals: Totals): FinalizedTotals {
  return {
    messageCount: totals.messageCount,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheWriteTokens: totals.cacheWriteTokens,
    cacheReadTokens: totals.cacheReadTokens,
    distinctModels: Array.from(totals.models),
  };
}

// ─── Message helpers ─────────────────────────────────────────────

interface CreateMessageParams {
  timestamp?: string | null;
  project?: string | null;
  role?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  model?: string | null;
  cost?: number;
}

export function createMessage(params: CreateMessageParams): Message {
  return {
    timestamp: params.timestamp ? new Date(params.timestamp).toISOString() : null,
    project: params.project || 'unknown',
    role: params.role || null,
    inputTokens: params.inputTokens || 0,
    outputTokens: params.outputTokens || 0,
    cacheWriteTokens: params.cacheWriteTokens || 0,
    cacheReadTokens: params.cacheReadTokens || 0,
    model: params.model || null,
    cost: params.cost || 0,
  };
}

export function accumulateTotals(totals: Totals, msg: Message): void {
  totals.messageCount++;
  totals.inputTokens += msg.inputTokens;
  totals.outputTokens += msg.outputTokens;
  totals.cacheWriteTokens += msg.cacheWriteTokens;
  totals.cacheReadTokens += msg.cacheReadTokens;
  if (msg.model) totals.models.add(msg.model);
}

// ─── JSONL readers ───────────────────────────────────────────────

/**
 * Read all .jsonl files in a directory (non-recursive) and process each line.
 */
export async function readJsonlDir(
  dirPath: string,
  processLine: ProcessLineFn,
  initialContext: Record<string, unknown> = {},
): Promise<{ messages: Message[]; totals: FinalizedTotals }> {
  const messages: Message[] = [];
  const totals = createTotals();
  const ctx: ProcessLineContext = { ...initialContext, totals };

  if (!(await fs.pathExists(dirPath))) {
    return { messages, totals: finalizeTotals(totals) };
  }

  try {
    const files = await fs.readdir(dirPath);
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
    await Promise.all(
      jsonlFiles.map((file) =>
        processJsonlFile(path.join(dirPath, file), processLine, ctx, messages),
      ),
    );
  } catch (err) {
    console.error(`readJsonlDir error (${dirPath}):`, (err as Error).message);
  }

  return { messages, totals: finalizeTotals(totals) };
}

/**
 * Read all .jsonl files recursively in a directory tree.
 * Collects file paths first, then reads in parallel.
 */
export async function readJsonlTree(
  dirPath: string,
  processLine: ProcessLineFn,
  initialContext: Record<string, unknown> = {},
): Promise<{ messages: Message[]; totals: FinalizedTotals }> {
  const messages: Message[] = [];
  const totals = createTotals();
  const ctx: ProcessLineContext = { ...initialContext, totals };

  if (!(await fs.pathExists(dirPath))) {
    return { messages, totals: finalizeTotals(totals) };
  }

  const jsonlPaths: string[] = [];

  async function collect(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory()) {
            await collect(fullPath);
          } else if (entry.endsWith('.jsonl')) {
            jsonlPaths.push(fullPath);
          }
        } catch (err) {
          console.error(`readJsonlTree: stat error (${fullPath}):`, (err as Error).message);
        }
      }
    } catch (err) {
      console.error(`readJsonlTree: readdir error (${dir}):`, (err as Error).message);
    }
  }

  await collect(dirPath);

  await Promise.all(
    jsonlPaths.map((fp) => processJsonlFile(fp, processLine, ctx, messages)),
  );

  return { messages, totals: finalizeTotals(totals) };
}

/** Internal: read and process one JSONL file */
async function processJsonlFile(
  filePath: string,
  processLine: ProcessLineFn,
  ctx: ProcessLineContext,
  messages: Message[],
): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n').filter((l) => l.trim());
    ctx.filePath = filePath;
    for (const line of lines) {
      const data = JSON.parse(line) as Record<string, unknown>;
      const result = await processLine(data, ctx);
      if (result) {
        messages.push(result);
        accumulateTotals(ctx.totals, result);
      }
    }
  } catch (err) {
    console.error(`File read error (${filePath}):`, (err as Error).message);
  }
}

// ─── Scanning helpers ────────────────────────────────────────────

/** Find project name by scanning first lines of JSONL files for cwd */
export async function findProjectName(fileDir: string): Promise<string | null> {
  if (!(await fs.pathExists(fileDir))) return null;
  try {
    const files = await fs.readdir(fileDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = path.join(fileDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const firstLine = content.trim().split('\n')[0];
      if (!firstLine) continue;
      const data = JSON.parse(firstLine) as { cwd?: string };
      if (data.cwd) return cwdToProjectName(data.cwd);
    }
  } catch (err) {
    console.error(`findProjectName error (${fileDir}):`, (err as Error).message);
  }
  return null;
}

/** Check if a line contains a message with usage data */
export function hasUsage(data: Record<string, unknown>): boolean {
  if (!data.message || typeof data.message !== 'object') return false;
  const msg = data.message as Record<string, unknown>;
  return !!(msg.usage);
}

/**
 * Count messages with usage data in a directory of JSONL files.
 * Lightweight — only parses JSON, doesn't construct Message objects.
 */
export async function countMessagesInDir(dirPath: string): Promise<number> {
  if (!(await fs.pathExists(dirPath))) return 0;

  try {
    const files = await fs.readdir(dirPath);
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    const counts = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = path.join(dirPath, file);
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.trim().split('\n').filter((l) => l.trim());
          let c = 0;
          for (const line of lines) {
            const data = JSON.parse(line) as Record<string, unknown>;
            if (hasUsage(data)) c++;
          }
          return c;
        } catch (err) {
          console.error(`countMessagesInDir: read error ${filePath}:`, (err as Error).message);
          return 0;
        }
      }),
    );

    return counts.reduce((sum, c) => sum + c, 0);
  } catch (err) {
    console.error(`countMessagesInDir error (${dirPath}):`, (err as Error).message);
    return 0;
  }
}
