/**
 * Claude Code source adapter.
 *
 * Data: ~/.claude/projects/<encoded-path>/<session-id>.jsonl
 *       ~/.claude/projects/<encoded-path>/sessions/<session-id>.jsonl (newer)
 *
 * Assistant messages have cwd on every event and usage with standard fields:
 *   input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
 */
import path from 'path';
import fs from 'fs-extra';
import { cwdToProjectName } from '../util';
import {
  createTotals,
  finalizeTotals,
  createMessage,
  accumulateTotals,
  readJsonlDir,
  findProjectName,
  countMessagesInDir,
} from './common';
import type { Source, Message, UsageResult, ProjectsResult, Totals } from '../types';

const PROJECTS_DIR = path.join(process.env.HOME!, '.claude', 'projects');

export const name = 'claude';

export function isAvailable(): boolean {
  return fs.pathExistsSync(PROJECTS_DIR);
}

interface ClaudeContext {
  projectName: string | null;
  totals: Totals;
}

export async function readSessions(): Promise<UsageResult> {
  const allMessages: Message[] = [];
  const totals = createTotals();

  if (!(await fs.pathExists(PROJECTS_DIR))) {
    return { messages: allMessages, totals: finalizeTotals(totals) };
  }

  const projectDirs = await fs.readdir(PROJECTS_DIR);

  for (const dir of projectDirs) {
    const dirPath = path.join(PROJECTS_DIR, dir);
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) continue;
    } catch (err) {
      console.error(`claude: cannot stat ${dirPath}:`, (err as Error).message);
      continue;
    }

    // Support both flat and sessions/ subdirectory layouts
    const sessionsDir = path.join(dirPath, 'sessions');
    const fileDir = (await fs.pathExists(sessionsDir)) ? sessionsDir : dirPath;

    const ctx: ClaudeContext = { projectName: null, totals };

    const { messages } = await readJsonlDir(fileDir, processLine, ctx as unknown as Record<string, unknown>);
    allMessages.push(...messages);
  }

  return { messages: allMessages, totals: finalizeTotals(totals) };
}

function processLine(data: Record<string, unknown>, ctx: Record<string, unknown>): Message | null {
  // Claude Code puts cwd on every event
  if (!ctx.projectName && data.cwd) {
    ctx.projectName = cwdToProjectName(data.cwd as string);
  }

  if (data.type !== 'assistant' && data.type !== 'message') return null;
  const msg = data.message as Record<string, unknown> | undefined;
  if (!msg || !msg.usage) return null;

  const usage = msg.usage as {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  return createMessage({
    timestamp: data.timestamp as string,
    project: ctx.projectName as string | null,
    role: (msg.role as string) || 'assistant',
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheWriteTokens: usage.cache_creation_input_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
    model: msg.model as string | null,
    cost: 0, // calculated by pricing layer
  });
}

export async function getProjects(): Promise<ProjectsResult> {
  const projects: string[] = [];
  const messageCount: Record<string, number> = {};

  if (!(await fs.pathExists(PROJECTS_DIR))) {
    return { projects, messageCount };
  }

  const projectDirs = await fs.readdir(PROJECTS_DIR);

  for (const dir of projectDirs) {
    const dirPath = path.join(PROJECTS_DIR, dir);
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) continue;
    } catch (err) {
      console.error(`claude: cannot stat ${dirPath}:`, (err as Error).message);
      continue;
    }

    const sessionsDir = path.join(dirPath, 'sessions');
    const fileDir = (await fs.pathExists(sessionsDir)) ? sessionsDir : dirPath;

    const projectName = await findProjectName(fileDir);
    if (!projectName) continue;

    const count = await countMessagesInDir(fileDir);
    if (count > 0) {
      if (!projects.includes(projectName)) projects.push(projectName);
      messageCount[projectName] = (messageCount[projectName] || 0) + count;
    }
  }

  return { projects: projects.sort(), messageCount };
}

const source: Source = { name, isAvailable, readSessions, getProjects };
export default source;
