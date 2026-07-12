/**
 * OpenCode source adapter.
 *
 * Data: ~/.local/share/opencode/opencode.db (SQLite)
 *
 * Each session = one message row. OpenCode pre-computes cost.
 * Model is stored as JSON in session.model column.
 */
import path from 'path';
import fs from 'fs-extra';
import { DatabaseSync } from 'node:sqlite';
import { cwdToProjectName, debug } from '../util';
import { createTotals, finalizeTotals, createMessage, accumulateTotals } from './common';
import type { Source, Message, UsageResult, ProjectsResult } from '../types';

const DB_PATH = path.join(process.env.HOME!, '.local', 'share', 'opencode', 'opencode.db');

export const name = 'opencode';

export function isAvailable(): boolean {
  return fs.pathExistsSync(DB_PATH);
}

function parseModel(modelJson: string | null): string | null {
  if (!modelJson) return null;
  try {
    return (JSON.parse(modelJson) as { id?: string }).id || null;
  } catch {
    return null;
  }
}

interface SessionRow {
  directory: string | null;
  model: string | null;
  tokens_input: number;
  tokens_output: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  tokens_reasoning: number;
  cost: number;
  time_created: string;
}

export async function readSessions(): Promise<UsageResult> {
  const messages: Message[] = [];
  const totals = createTotals();

  if (!(await fs.pathExists(DB_PATH))) {
    return { messages, totals: finalizeTotals(totals) };
  }

  try {
    using db = new DatabaseSync(DB_PATH, { readOnly: true });

    const rows = db
      .prepare(
        `SELECT s.directory, s.model,
                s.tokens_input, s.tokens_output,
                s.tokens_cache_read, s.tokens_cache_write,
                s.tokens_reasoning, s.cost, s.time_created
         FROM session s
         WHERE s.tokens_input > 0 OR s.tokens_output > 0
         ORDER BY s.time_created`,
      )
      .all() as unknown as SessionRow[];

    for (const row of rows) {
      const model = parseModel(row.model);
      const projectName = row.directory ? cwdToProjectName(row.directory) : null;
      const outputTokens = (row.tokens_output || 0) + (row.tokens_reasoning || 0);

      const message = createMessage({
        timestamp: row.time_created,
        project: projectName,
        role: 'assistant',
        inputTokens: row.tokens_input || 0,
        outputTokens,
        cacheWriteTokens: row.tokens_cache_write || 0,
        cacheReadTokens: row.tokens_cache_read || 0,
        model,
        cost: row.cost || 0,
      });

      messages.push(message);
      accumulateTotals(totals, message);
    }
  } catch (err) {
    debug('OpenCode readSessions error:', (err as Error).message);
  }

  return { messages, totals: finalizeTotals(totals) };
}

interface ProjectRow {
  directory: string | null;
  cnt: number;
}

export async function getProjects(): Promise<ProjectsResult> {
  const projects: string[] = [];
  const messageCount: Record<string, number> = {};

  if (!(await fs.pathExists(DB_PATH))) {
    return { projects, messageCount };
  }

  try {
    using db = new DatabaseSync(DB_PATH, { readOnly: true });

    const rows = db
      .prepare(
        `SELECT s.directory, COUNT(*) as cnt
         FROM session s
         WHERE s.tokens_input > 0 OR s.tokens_output > 0
         GROUP BY s.directory ORDER BY s.directory`,
      )
      .all() as unknown as ProjectRow[];

    for (const row of rows) {
      const projectName = (row.directory ? cwdToProjectName(row.directory) : null) ?? 'unknown';
      if (!projects.includes(projectName)) projects.push(projectName);
      messageCount[projectName] = (messageCount[projectName] || 0) + row.cnt;
    }
  } catch (err) {
    debug('OpenCode getProjects error:', (err as Error).message);
  }

  return { projects: projects.sort(), messageCount };
}

const source: Source = { name, isAvailable, readSessions, getProjects };
export default source;
