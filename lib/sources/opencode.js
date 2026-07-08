/**
 * OpenCode source adapter.
 *
 * Data: ~/.local/share/opencode/opencode.db (SQLite)
 *
 * OpenCode stores sessions in a SQLite database with pre-aggregated token
 * and cost data per session. Each session maps to one "message" in mu's format.
 *
 * Key tables:
 *   session: id, directory, model (JSON), time_created, tokens_input,
 *            tokens_output, tokens_cache_read, tokens_cache_write,
 *            tokens_reasoning, cost
 *   project: id, worktree, name
 */
const path = require('path');
const fs = require('fs-extra');
const { DatabaseSync } = require('node:sqlite');
const {
  cwdToProjectName, finalizeTotals, createTotals, createMessage, accumulateTotals
} = require('./common');

const DB_PATH = path.join(process.env.HOME, '.local', 'share', 'opencode', 'opencode.db');

const meta = {
  name: 'opencode',
  isAvailable() {
    return fs.pathExistsSync(DB_PATH);
  }
};

/**
 * Parse the model JSON stored in session.model column.
 * Returns the model id string (e.g., "deepseek-v4-pro").
 */
function parseModel(modelJson) {
  if (!modelJson) return null;
  try {
    const obj = typeof modelJson === 'string' ? JSON.parse(modelJson) : modelJson;
    return obj.id || null;
  } catch (_) {
    return null;
  }
}

async function readSessions() {
  const messages = [];
  const totals = createTotals();

  if (!await fs.pathExists(DB_PATH)) {
    return { messages, totals: finalizeTotals(totals) };
  }

  let db;
  try {
    db = new DatabaseSync(DB_PATH, { readonly: true });

    // Query sessions with pre-aggregated token and cost data.
    // Each session becomes one message row in mu.
    const stmt = db.prepare(`
      SELECT
        s.directory,
        s.model,
        s.tokens_input,
        s.tokens_output,
        s.tokens_cache_read,
        s.tokens_cache_write,
        s.tokens_reasoning,
        s.cost,
        s.time_created
      FROM session s
      WHERE s.tokens_input > 0 OR s.tokens_output > 0
      ORDER BY s.time_created
    `);

    const rows = stmt.all();

    for (const row of rows) {
      const model = parseModel(row.model);
      const projectName = row.directory ? cwdToProjectName(row.directory) : null;

      // Combine reasoning tokens into output (consistent with other sources)
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
        cost: row.cost || 0  // OpenCode pre-computes cost
      });

      messages.push(message);
      accumulateTotals(totals, message);
    }

    db.close();
  } catch (err) {
    if (db) {
      try { db.close(); } catch (_) { /* ignore */ }
    }
    // Return whatever we got so far
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
      SELECT s.directory, COUNT(*) as cnt
      FROM session s
      WHERE s.tokens_input > 0 OR s.tokens_output > 0
      GROUP BY s.directory
      ORDER BY s.directory
    `);

    const rows = stmt.all();

    for (const row of rows) {
      const projectName = row.directory ? cwdToProjectName(row.directory) : 'unknown';
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
