/**
 * pi (Earendil) source adapter.
 *
 * Data: ~/.pi/agent/sessions/<encoded-project>/<session>.jsonl
 *
 * Session header line: { type: "session", cwd: "...", timestamp: "..." }
 * Message lines:       { type: "message", message: { role, model, usage: {
 *                         input, output, cacheRead, cacheWrite, reasoning, totalTokens,
 *                         cost: { input, output, cacheRead, cacheWrite, total } } } }
 *
 * pi pre-computes costs — we use usage.cost.total directly.
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
  hasUsage,
} from './common';
import type { Source, Message, UsageResult, ProjectsResult, Totals } from '../types';

const SESSIONS_DIR = path.join(process.env.HOME!, '.pi', 'agent', 'sessions');

export const name = 'pi';

export function isAvailable(): boolean {
  return fs.pathExistsSync(SESSIONS_DIR);
}

interface PiLineContext {
  projectName: string | null;
  sessionTimestamp: string | null;
  totals: Totals;
}

export async function readSessions(): Promise<UsageResult> {
  const allMessages: Message[] = [];
  const totals = createTotals();

  if (!(await fs.pathExists(SESSIONS_DIR))) {
    return { messages: allMessages, totals: finalizeTotals(totals) };
  }

  const projectDirs = await fs.readdir(SESSIONS_DIR);

  for (const dir of projectDirs) {
    const dirPath = path.join(SESSIONS_DIR, dir);
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) continue;
    } catch (err) {
      console.error(`pi: cannot stat ${dirPath}:`, (err as Error).message);
      continue;
    }

    const ctx: PiLineContext = { projectName: null, sessionTimestamp: null, totals };

    const { messages: dirMessages } = await readJsonlDir(dirPath, processLine, ctx as unknown as Record<string, unknown>);
    allMessages.push(...dirMessages);
  }

  return { messages: allMessages, totals: finalizeTotals(totals) };
}

function processLine(data: Record<string, unknown>, ctx: Record<string, unknown>): Message | null {
  // Session header: extract project name and timestamp
  if (data.type === 'session') {
    const sd = data as { cwd?: string; timestamp?: string };
    ctx.projectName = sd.cwd ? cwdToProjectName(sd.cwd) : null;
    ctx.sessionTimestamp = sd.timestamp || null;
    return null;
  }

  if (data.type !== 'message') return null;
  const msg = data.message as Record<string, unknown> | undefined;
  if (!msg || !msg.usage) return null;

  const usage = msg.usage as {
    input?: number;
    output?: number;
    cacheWrite?: number;
    cacheRead?: number;
    cost?: { total?: number };
  };

  const cost = usage.cost && typeof usage.cost.total === 'number' ? usage.cost.total : 0;

  return createMessage({
    timestamp: (data.timestamp as string) || (ctx.sessionTimestamp as string),
    project: ctx.projectName as string | null,
    role: msg.role as string | null,
    inputTokens: usage.input,
    outputTokens: usage.output,
    cacheWriteTokens: usage.cacheWrite,
    cacheReadTokens: usage.cacheRead,
    model: msg.model as string | null,
    cost,
  });
}

export async function getProjects(): Promise<ProjectsResult> {
  const projects: string[] = [];
  const messageCount: Record<string, number> = {};

  if (!(await fs.pathExists(SESSIONS_DIR))) {
    return { projects, messageCount };
  }

  const projectDirs = await fs.readdir(SESSIONS_DIR);

  for (const dir of projectDirs) {
    const dirPath = path.join(SESSIONS_DIR, dir);
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) continue;
    } catch (err) {
      console.error(`pi: cannot stat ${dirPath}:`, (err as Error).message);
      continue;
    }

    const projectName = await findProjectName(dirPath);
    if (!projectName) continue;

    // Count messages with usage
    let count = 0;
    try {
      const { messages } = await readJsonlDir(dirPath, (data) => {
        if (data.type === 'message' && hasUsage(data)) return createMessage({});
        return null;
      });
      count = messages.length;
    } catch {
      console.error(`Failed to count messages in ${dirPath}`);
    }

    if (count > 0) {
      if (!projects.includes(projectName)) {
        projects.push(projectName);
      }
      messageCount[projectName] = (messageCount[projectName] || 0) + count;
    }
  }

  return { projects: projects.sort(), messageCount };
}

const source: Source = { name, isAvailable, readSessions, getProjects };
export default source;
