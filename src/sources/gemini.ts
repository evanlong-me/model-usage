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
import { debug } from '../util';
import {
  createTotals,
  finalizeTotals,
  createMessage,
  accumulateTotals,
} from './common';
import type { Source, Message, UsageResult, ProjectsResult, Totals } from '../types';

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
    } catch {
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
            const lines = content.trim().split('\n').filter((l) => l.trim());
            for (const line of lines) {
              try {
                const data = JSON.parse(line) as Record<string, unknown>;
                const msg = extractMessage(data, projectName, null);
                if (msg) {
                  messages.push(msg);
                  accumulateTotals(totals, msg);
                }
              } catch {
                /* skip */
              }
            }
          } else {
            const data = (await fs.readJson(filePath)) as {
              startTime?: string;
              messages?: Array<Record<string, unknown>>;
            };
            const sessionStart = data.startTime || null;

            for (const entryMsg of data.messages || []) {
              const msg = extractMessage(entryMsg, projectName, sessionStart);
              if (msg) {
                messages.push(msg);
                accumulateTotals(totals, msg);
              }
            }
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip */
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

  return createMessage({
    timestamp: (data.timestamp as string) || fallbackTimestamp,
    project: projectName,
    role: data.type as string | null,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    cacheReadTokens: tokens.cached,
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
    } catch {
      continue;
    }

    const chatsDir = path.join(projectDir, 'chats');
    if (!(await fs.pathExists(chatsDir))) continue;

    const projectName = `gemini:${entry.substring(0, 8)}`;
    let count = 0;

    try {
      const files = await fs.readdir(chatsDir);

      for (const file of files) {
        if (file === 'logs.json') continue;
        if (!file.endsWith('.json') && !file.endsWith('.jsonl')) continue;

        const filePath = path.join(chatsDir, file);

        try {
          if (file.endsWith('.jsonl')) {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.trim().split('\n').filter((l) => l.trim());
            for (const line of lines) {
              try {
                const data = JSON.parse(line) as Record<string, unknown>;
                if (data.tokens) count++;
              } catch {
                /* skip */
              }
            }
          } else {
            const data = (await fs.readJson(filePath)) as {
              messages?: Array<Record<string, unknown>>;
            };
            for (const msg of data.messages || []) {
              if (msg.tokens) count++;
            }
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip */
    }

    if (count > 0) {
      projects.push(projectName);
      messageCount[projectName] = count;
    }
  }

  return { projects: projects.sort(), messageCount };
}

const source: Source = { name, isAvailable, readSessions, getProjects };
export default source;
