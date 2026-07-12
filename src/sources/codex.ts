/**
 * Codex CLI source adapter.
 *
 * Data: ~/.codex/sessions/ (rollouts, JSONL)
 *       ~/.codex/history.jsonl (consolidated history)
 *
 * Two event patterns:
 *   1. token_count events with CUMULATIVE running totals → compute delta
 *   2. message events with direct usage (newer versions)
 */
import path from 'path';
import fs from 'fs-extra';
import { cwdToProjectName } from '../util';
import { createTotals, finalizeTotals, createMessage, accumulateTotals } from './common';
import type { Source, Message, UsageResult, ProjectsResult, Totals } from '../types';

const SESSIONS_DIR = path.join(process.env.HOME!, '.codex', 'sessions');
const HISTORY_FILE = path.join(process.env.HOME!, '.codex', 'history.jsonl');

export const name = 'codex';

export function isAvailable(): boolean {
  return fs.pathExistsSync(SESSIONS_DIR) || fs.pathExistsSync(HISTORY_FILE);
}

export async function readSessions(): Promise<UsageResult> {
  const messages: Message[] = [];
  const totals = createTotals();

  if (await fs.pathExists(SESSIONS_DIR)) {
    await processTree(SESSIONS_DIR, messages, totals);
  }
  if (await fs.pathExists(HISTORY_FILE)) {
    await processFile(HISTORY_FILE, messages, totals);
  }

  return { messages, totals: finalizeTotals(totals) };
}

async function processTree(dirPath: string, messages: Message[], totals: Totals): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await processTree(fullPath, messages, totals);
        } else if (entry.endsWith('.jsonl')) {
          await processFile(fullPath, messages, totals);
        }
      } catch (err) {
        console.error(`codex: stat error ${fullPath}:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.error(`codex: readdir error ${dirPath}:`, (err as Error).message);
  }
}

interface PrevTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  reasoningTokens: number;
}

async function processFile(filePath: string, messages: Message[], totals: Totals): Promise<void> {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    console.error(`codex: read error ${filePath}:`, (err as Error).message);
    return;
  }

  const lines = content.trim().split('\n').filter((l) => l.trim());
  let projectName: string | null = null;
  let currentModel: string | null = null;
  let prevTotals: PrevTotals | null = null;

  for (const line of lines) {
    const data = JSON.parse(line) as Record<string, unknown>;

    if (!projectName && data.cwd) {
      projectName = cwdToProjectName(data.cwd as string);
    }
    if (data.message && (data.message as Record<string, unknown>).model) {
      currentModel = (data.message as Record<string, unknown>).model as string;
    }

    // Pattern 1: token_count events (cumulative, compute delta)
    if (data.type === 'token_count' && data.info) {
      const info = data.info as Record<string, unknown>;
      const usage = info.total_token_usage as Record<string, number> | undefined;
      if (!usage) continue;

      if (prevTotals) {
        const inputD = Math.max(0, (usage.input_tokens || 0) - prevTotals.inputTokens);
        const outputD = Math.max(0, (usage.output_tokens || 0) - prevTotals.outputTokens);
        const cacheReadD = Math.max(0, (usage.cached_input_tokens || 0) - prevTotals.cacheReadTokens);
        const reasoningD = Math.max(0, (usage.reasoning_output_tokens || 0) - prevTotals.reasoningTokens);

        const msg = createMessage({
          timestamp: data.timestamp as string,
          project: projectName,
          role: 'assistant',
          inputTokens: inputD,
          outputTokens: outputD + reasoningD,
          cacheReadTokens: cacheReadD,
          model: currentModel,
        });
        messages.push(msg);
        accumulateTotals(totals, msg);
      }

      prevTotals = {
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheReadTokens: usage.cached_input_tokens || 0,
        reasoningTokens: usage.reasoning_output_tokens || 0,
      };
    }

    // Pattern 2: message events with direct usage
    if (data.message && (data.message as Record<string, unknown>).usage) {
      const msg = data.message as Record<string, unknown>;
      const usage = msg.usage as Record<string, number>;

      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;

      if (inputTokens > 0 || outputTokens > 0) {
        const message = createMessage({
          timestamp: data.timestamp as string,
          project: projectName,
          role: (msg.role as string) || 'assistant',
          inputTokens,
          outputTokens,
          cacheWriteTokens: usage.cache_creation_input_tokens,
          cacheReadTokens: usage.cache_read_input_tokens,
          model: (msg.model as string) || currentModel,
        });
        messages.push(message);
        accumulateTotals(totals, message);
      }
    }
  }
}

export async function getProjects(): Promise<ProjectsResult> {
  const projects: string[] = [];
  const messageCount: Record<string, number> = {};

  async function scanFile(fp: string): Promise<void> {
    let content: string;
    try {
      content = await fs.readFile(fp, 'utf8');
    } catch (err) {
      console.error(`codex: read error ${fp}:`, (err as Error).message);
      return;
    }

    const lines = content.trim().split('\n').filter((l) => l.trim());
    let pn: string | null = null;
    let count = 0;

    for (const line of lines) {
      const data = JSON.parse(line) as Record<string, unknown>;
      if (!pn && data.cwd) pn = cwdToProjectName(data.cwd as string);
      if (
        data.type === 'token_count' ||
        (data.message && (data.message as Record<string, unknown>).usage)
      ) {
        count++;
      }
    }

    if (pn && count > 0) {
      if (!projects.includes(pn)) projects.push(pn);
      messageCount[pn] = (messageCount[pn] || 0) + count;
    }
  }

  if (await fs.pathExists(SESSIONS_DIR)) {
    async function walk(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          try {
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
              await walk(fullPath);
            } else if (entry.endsWith('.jsonl')) {
              await scanFile(fullPath);
            }
          } catch (err) {
            console.error(`codex: stat error ${fullPath}:`, (err as Error).message);
          }
        }
      } catch (err) {
        console.error(`codex: readdir error ${dir}:`, (err as Error).message);
      }
    }
    await walk(SESSIONS_DIR);
  }

  if (await fs.pathExists(HISTORY_FILE)) {
    await scanFile(HISTORY_FILE);
  }

  return { projects: projects.sort(), messageCount };
}

const source: Source = { name, isAvailable, readSessions, getProjects };
export default source;
