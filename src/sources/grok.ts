/**
 * Grok CLI source adapter.
 *
 * Data: ~/.grok/grok.db (SQLite)
 *
 * Grok stores usage events with pre-computed cost (cost_micros in micro-dollars).
 * Each usage_event becomes one message in mu.
 */
import path from 'path';
import fs from 'fs-extra';
import { DatabaseSync } from 'node:sqlite';
import { cwdToProjectName } from '../util';
import { createTotals, finalizeTotals, createMessage, accumulateTotals } from './common';
import type { Source, Message, UsageResult, ProjectsResult } from '../types';

const DB_PATH = path.join(process.env.HOME!, '.grok', 'grok.db');

export const name = 'grok';

export function isAvailable(): boolean {
  return fs.pathExistsSync(DB_PATH);
}

interface UsageRow {
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_micros: number;
  created_at: string;
  cwd_at_start: string | null;
  canonical_path: string | null;
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
        `SELECT ue.model, ue.input_tokens, ue.output_tokens,
                ue.total_tokens, ue.cost_micros, ue.created_at,
                s.cwd_at_start, w.canonical_path
         FROM usage_events ue
         JOIN sessions s ON s.id = ue.session_id
         JOIN workspaces w ON w.id = s.workspace_id
         WHERE ue.input_tokens > 0 OR ue.output_tokens > 0
         ORDER BY ue.created_at`,
      )
      .all() as unknown as UsageRow[];

    for (const row of rows) {
      const cwd = row.canonical_path || row.cwd_at_start;
      const projectName = cwd ? cwdToProjectName(cwd) : null;

      const message = createMessage({
        timestamp: row.created_at,
        project: projectName,
        role: 'assistant',
        inputTokens: row.input_tokens || 0,
        outputTokens: row.output_tokens || 0,
        model: row.model || null,
        cost: (row.cost_micros || 0) / 1_000_000,
      });

      messages.push(message);
      accumulateTotals(totals, message);
    }
  } catch (err) {
    console.error('Grok readSessions error:', (err as Error).message);
  }

  return { messages, totals: finalizeTotals(totals) };
}

interface ProjectRow {
  cwd: string | null;
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
        `SELECT COALESCE(w.canonical_path, s.cwd_at_start) AS cwd, COUNT(*) AS cnt
         FROM usage_events ue
         JOIN sessions s ON s.id = ue.session_id
         JOIN workspaces w ON w.id = s.workspace_id
         WHERE ue.input_tokens > 0 OR ue.output_tokens > 0
         GROUP BY cwd ORDER BY cwd`,
      )
      .all() as unknown as ProjectRow[];

    for (const row of rows) {
      const projectName = (row.cwd ? cwdToProjectName(row.cwd) : null) ?? 'unknown';
      if (!projects.includes(projectName)) projects.push(projectName);
      messageCount[projectName] = (messageCount[projectName] || 0) + row.cnt;
    }
  } catch (err) {
    console.error('Grok getProjects error:', (err as Error).message);
  }

  return { projects: projects.sort(), messageCount };
}

const source: Source = { name, isAvailable, readSessions, getProjects };
export default source;
