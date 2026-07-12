/**
 * Grok CLI source adapter.
 *
 * Data: ~/.grok/grok.db (SQLite)
 *
 * Grok stores sessions and usage in a SQLite database with pre-aggregated
 * token and cost data per API call. Each usage event becomes one "message" in mu.
 *
 * Key tables:
 *   workspaces: id, scope_key, canonical_path, git_root, display_name
 *   sessions: id, workspace_id, model, cwd_at_start, cwd_last, status,
 *             created_at, updated_at
 *   usage_events: session_id, message_seq, source, model, input_tokens,
 *                 output_tokens, total_tokens, cost_micros, created_at
 *
 * cost_micros is in micro-dollars (millionths of a dollar), e.g.
 * 1500 = $0.0015. Grok CLI pre-computes this — we use it directly.
 */
const path = require('path');
const fs = require('fs-extra');
const { DatabaseSync } = require('node:sqlite');
const {
  cwdToProjectName, finalizeTotals, createTotals, createMessage, accumulateTotals
} = require('./common');

const DB_PATH = path.join(process.env.HOME, '.grok', 'grok.db');

const meta = {
  name: 'grok',
  isAvailable() {
    return fs.pathExistsSync(DB_PATH);
  }
};

async function readSessions() {
  const messages = [];
  const totals = createTotals();

  if (!await fs.pathExists(DB_PATH)) {
    return { messages, totals: finalizeTotals(totals) };
  }

  let db;
  try {
    db = new DatabaseSync(DB_PATH, { readonly: true });

    // Query usage events joined with sessions and workspaces for project context.
    // Each usage_event becomes one message row in mu.
    const stmt = db.prepare(`
      SELECT
        ue.model,
        ue.input_tokens,
        ue.output_tokens,
        ue.total_tokens,
        ue.cost_micros,
        ue.created_at,
        s.cwd_at_start,
        w.canonical_path
      FROM usage_events ue
      JOIN sessions s ON s.id = ue.session_id
      JOIN workspaces w ON w.id = s.workspace_id
      WHERE ue.input_tokens > 0 OR ue.output_tokens > 0
      ORDER BY ue.created_at
    `);

    const rows = stmt.all();

    for (const row of rows) {
      // Prefer workspace path, fall back to session cwd
      const cwd = row.canonical_path || row.cwd_at_start;
      const projectName = cwd ? cwdToProjectName(cwd) : null;

      // Convert cost_micros (micro-dollars) to dollars
      const cost = (row.cost_micros || 0) / 1_000_000;

      const message = createMessage({
        timestamp: row.created_at,
        project: projectName,
        role: 'assistant',
        inputTokens: row.input_tokens || 0,
        outputTokens: row.output_tokens || 0,
        cacheWriteTokens: 0,  // Grok CLI doesn't track cache separately
        cacheReadTokens: 0,
        model: row.model || null,
        cost
      });

      messages.push(message);
      accumulateTotals(totals, message);
    }

    db.close();
  } catch (err) {
    if (db) {
      try { db.close(); } catch (_) { /* ignore */ }
    }
  }

  return { messages, totals: finalizeTotals(totals) };
}

async function getProjects() {
  const projects = [];
  const messageCount = {};

  if (!await fs.pathExists(DB_PATH)) {
    return { projects, messageCount };
  }

  let db;
  try {
    db = new DatabaseSync(DB_PATH, { readonly: true });

    const stmt = db.prepare(`
      SELECT
        COALESCE(w.canonical_path, s.cwd_at_start) AS cwd,
        COUNT(*) AS cnt
      FROM usage_events ue
      JOIN sessions s ON s.id = ue.session_id
      JOIN workspaces w ON w.id = s.workspace_id
      WHERE ue.input_tokens > 0 OR ue.output_tokens > 0
      GROUP BY cwd
      ORDER BY cwd
    `);

    const rows = stmt.all();

    for (const row of rows) {
      const projectName = row.cwd ? cwdToProjectName(row.cwd) : 'unknown';
      if (!projects.includes(projectName)) {
        projects.push(projectName);
      }
      messageCount[projectName] = (messageCount[projectName] || 0) + row.cnt;
    }

    db.close();
  } catch (_) {
    if (db) {
      try { db.close(); } catch (_) { /* ignore */ }
    }
  }

  return { projects: projects.sort(), messageCount };
}

module.exports = { ...meta, readSessions, getProjects };
