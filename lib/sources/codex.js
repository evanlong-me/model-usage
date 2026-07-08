/**
 * Codex CLI source adapter.
 *
 * Data: ~/.codex/sessions/ (rollouts, JSONL)
 *       ~/.codex/history.jsonl (consolidated history)
 *
 * Two event patterns:
 *   1. token_count events with CUMULATIVE running totals:
 *      { type: "token_count", info: { total_token_usage: {
 *        input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens }}}
 *      → Compute delta between consecutive events for per-turn usage.
 *   2. message events with direct usage (newer versions):
 *      { message: { model, usage: { input_tokens, output_tokens, ... } } }
 */
const path = require('path');
const fs = require('fs-extra');
const {
  cwdToProjectName, finalizeTotals, createTotals, createMessage, accumulateTotals
} = require('./common');

const SESSIONS_DIR = path.join(process.env.HOME, '.codex', 'sessions');
const HISTORY_FILE = path.join(process.env.HOME, '.codex', 'history.jsonl');

const meta = {
  name: 'codex',
  isAvailable() {
    return fs.pathExistsSync(SESSIONS_DIR) || fs.pathExistsSync(HISTORY_FILE);
  }
};

async function readSessions() {
  const messages = [];
  const totals = createTotals();

  // Process all JSONL files across the sessions directory tree
  if (await fs.pathExists(SESSIONS_DIR)) {
    await processDirectory(SESSIONS_DIR, messages, totals);
  }

  // Also process the consolidated history file
  if (await fs.pathExists(HISTORY_FILE)) {
    await processFile(HISTORY_FILE, messages, totals);
  }

  return { messages, totals: finalizeTotals(totals) };
}

async function processDirectory(dirPath, messages, totals) {
  try {
    const entries = await fs.readdir(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await processDirectory(fullPath, messages, totals);
        } else if (entry.endsWith('.jsonl')) {
          await processFile(fullPath, messages, totals);
        }
      } catch (_) { /* skip */ }
    }
  } catch (_) { /* skip */ }
}

async function processFile(filePath, messages, totals) {
  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (_) { return; }

  const lines = content.trim().split('\n').filter(line => line.trim());

  let projectName = null;
  let currentModel = null;
  let prevTotals = null; // For computing deltas between token_count events

  for (const line of lines) {
    try {
      const data = JSON.parse(line);

      // Extract project name and track model
      if (!projectName && data.cwd) {
        projectName = cwdToProjectName(data.cwd);
      }
      if (data.message && data.message.model) {
        currentModel = data.message.model;
      }

      // --- Pattern 1: token_count events (cumulative, need deltas) ---
      if (data.type === 'token_count' && data.info && data.info.total_token_usage) {
        const usage = data.info.total_token_usage;

        if (prevTotals) {
          // Compute delta from previous cumulative totals
          const inputD = Math.max(0, (usage.input_tokens || 0) - prevTotals.inputTokens);
          const outputD = Math.max(0, (usage.output_tokens || 0) - prevTotals.outputTokens);
          const cacheReadD = Math.max(0, (usage.cached_input_tokens || 0) - prevTotals.cacheReadTokens);
          const reasoningD = Math.max(0, (usage.reasoning_output_tokens || 0) - prevTotals.reasoningTokens);

          const msg = createMessage({
            timestamp: data.timestamp,
            project: projectName,
            role: 'assistant',
            inputTokens: inputD,
            outputTokens: outputD + reasoningD,
            cacheWriteTokens: 0,
            cacheReadTokens: cacheReadD,
            model: currentModel,
            cost: 0
          });

          messages.push(msg);
          accumulateTotals(totals, msg);
        }

        prevTotals = {
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cacheReadTokens: usage.cached_input_tokens || 0,
          reasoningTokens: usage.reasoning_output_tokens || 0
        };
      }

      // --- Pattern 2: message events with direct usage ---
      if (data.message && data.message.usage) {
        const msg = data.message;
        const usage = msg.usage;

        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;

        // Only emit if there's real usage (avoid double-counting with token_count)
        if (inputTokens > 0 || outputTokens > 0) {
          const message = createMessage({
            timestamp: data.timestamp,
            project: projectName,
            role: msg.role || 'assistant',
            inputTokens,
            outputTokens,
            cacheWriteTokens: usage.cache_creation_input_tokens || 0,
            cacheReadTokens: usage.cache_read_input_tokens || 0,
            model: msg.model || currentModel,
            cost: 0
          });

          messages.push(message);
          accumulateTotals(totals, message);
        }
      }
    } catch (_) { /* skip */ }
  }
}

async function getProjects() {
  const projects = [];
  const messageCount = {};

  async function scanFile(filePath) {
    let content;
    try { content = await fs.readFile(filePath, 'utf8'); } catch (_) { return; }

    const lines = content.trim().split('\n').filter(line => line.trim());
    let projectName = null;
    let count = 0;

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (!projectName && data.cwd) {
          projectName = cwdToProjectName(data.cwd);
        }
        if (data.type === 'token_count' || (data.message && data.message.usage)) {
          count++;
        }
      } catch (_) { /* skip */ }
    }

    if (projectName && count > 0) {
      if (!projects.includes(projectName)) projects.push(projectName);
      messageCount[projectName] = (messageCount[projectName] || 0) + count;
    }
  }

  // Scan sessions directory tree
  if (await fs.pathExists(SESSIONS_DIR)) {
    async function walk(dir) {
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
          } catch (_) { /* skip */ }
        }
      } catch (_) { /* skip */ }
    }
    await walk(SESSIONS_DIR);
  }

  // Scan consolidated history
  if (await fs.pathExists(HISTORY_FILE)) {
    await scanFile(HISTORY_FILE);
  }

  return { projects: projects.sort(), messageCount };
}

module.exports = { ...meta, readSessions, getProjects };
