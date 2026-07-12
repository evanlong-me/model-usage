/**
 * Gemini CLI source adapter.
 *
 * Data: ~/.gemini/tmp/<project_hash>/chats/session-<ts>-<id>.json  (old, JSON)
 *       ~/.gemini/tmp/<project_hash>/chats/session-<ts>-<id>.jsonl (new, JSONL)
 *
 * Token fields: input, output, cached (cache read), thoughts, tool, total
 * Uses shortened project hash as identifier (cannot reverse to path).
 */
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { createTotals, finalizeTotals, createMessage, accumulateTotals } from './common';
import type { Source, Message, UsageResult, ProjectsResult } from '../types';

const TMP_DIR = path.join(process.env.HOME!, '.gemini', 'tmp');

export const name = 'gemini';

export function isAvailable(): boolean {
  return fs.pathExistsSync(TMP_DIR);
}

interface GeminiTokens {
  input?: number;
  output?: number;
  cached?: number;
  thoughts?: number;
  tool?: number;
  total?: number;
}

export async function readSessions(): Promise<UsageResult> {
  const messages: Message[] = [];
  const totals = createTotals();

  if (!(await fs.pathExists(TMP_DIR))) {
    return { messages, totals: finalizeTotals(totals) };
  }

  const entries = await fs.readdir(TMP_DIR);

  for (const entry of entries) {
    const projectDir = path.join(TMP_DIR, entry);

    try {
      const stat = await fs.stat(projectDir);
      if (!stat.isDirectory()) continue;
    } catch (err) {
      console.error(`gemini: cannot stat ${projectDir}:`, (err as Error).message);
      continue;
    }

    const chatsDir = path.join(projectDir, 'chats');
    if (!(await fs.pathExists(chatsDir))) continue;

    const projectName = `gemini:${entry.substring(0, 8)}`;

    try {
      const files = await fs.readdir(chatsDir);

      for (const file of files) {
        if (file === 'logs.json') continue;
        if (!file.endsWith('.json') && !file.endsWith('.jsonl')) continue;

        const filePath = path.join(chatsDir, file);
        try {
          if (file.endsWith('.jsonl')) {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.trim().split('\n').filter(l => l.trim());
            for (const line of lines) {
              const data = JSON.parse(line) as Record<string, unknown>;
              const msg = extractMessage(data, projectName, null);
              if (msg) {
                messages.push(msg);
                accumulateTotals(totals, msg);
              }
            }
          } else {
            const data = await fs.readJson(filePath) as {
              startTime?: string;
              messages?: Array<Record<string, unknown>>;
            };
            for (const entryMsg of data.messages || []) {
              const msg = extractMessage(entryMsg, projectName, data.startTime || null);
              if (msg) {
                messages.push(msg);
                accumulateTotals(totals, msg);
              }
            }
          }
        } catch (err) {
          console.error(`gemini: file error ${filePath}:`, (err as Error).message);
        }
      }
    } catch (err) {
      console.error(`gemini: readdir error ${chatsDir}:`, (err as Error).message);
    }
  }

  return { messages, totals: finalizeTotals(totals) };
}

function extractMessage(
  data: Record<string, unknown>,
  projectName: string,
  fallbackTimestamp: string | null,
): Message | null {
  const tokens = data.tokens as GeminiTokens | undefined;
  if (!tokens) return null;

  const input = tokens.input || 0;
  const output = tokens.output || 0;
  const cached = tokens.cached || 0;
  if (input === 0 && output === 0 && cached === 0) return null;

  return createMessage({
    timestamp: (data.timestamp as string) || fallbackTimestamp,
    project: projectName,
    role: data.type as string | null,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cached,
    model: data.model as string | null,
  });
}

export async function getProjects(): Promise<ProjectsResult> {
  const projects: string[] = [];
  const messageCount: Record<string, number> = {};

  if (!(await fs.pathExists(TMP_DIR))) {
    return { projects, messageCount };
  }

  const entries = await fs.readdir(TMP_DIR);

  for (const entry of entries) {
    const projectDir = path.join(TMP_DIR, entry);

    try {
      const stat = await fs.stat(projectDir);
      if (!stat.isDirectory()) continue;
    } catch (err) {
      console.error(`gemini: cannot stat ${projectDir}:`, (err as Error).message);
      continue;
    }

    const chatsDir = path.join(projectDir, 'chats');
    if (!(await fs.pathExists(chatsDir))) continue;

    const projectName = `gemini:${entry.substring(0, 8)}`;

    try {
      const files = await fs.readdir(chatsDir);
      let count = 0;

      for (const file of files) {
        if (file === 'logs.json') continue;
        if (!file.endsWith('.json') && !file.endsWith('.jsonl')) continue;

        try {
          count += await countTokensInFile(path.join(chatsDir, file));
        } catch (err) {
          console.error(`gemini: file error ${path.join(chatsDir, file)}:`, (err as Error).message);
        }
      }

      if (count > 0) {
        projects.push(projectName);
        messageCount[projectName] = count;
      }
    } catch (err) {
      console.error(`gemini: readdir error ${chatsDir}:`, (err as Error).message);
    }
  }

  return { projects: projects.sort(), messageCount };
}

async function countTokensInFile(filePath: string): Promise<number> {
  if (filePath.endsWith('.jsonl')) {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    let count = 0;
    for (const line of lines) {
      const data = JSON.parse(line) as Record<string, unknown>;
      if (data.tokens) count++;
    }
    return count;
  } else {
    const data = await fs.readJson(filePath) as {
      messages?: Array<Record<string, unknown>>;
    };
    return (data.messages || []).filter(m => m.tokens).length;
  }
}

const source: Source = { name, isAvailable, readSessions, getProjects };
export default source;
