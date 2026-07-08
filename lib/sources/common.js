const fs = require('fs-extra');
const path = require('path');
const { cwdToProjectName } = require('../util');

/**
 * Shared utilities for all data sources.
 */

/**
 * Finalize totals object by converting models Set to array.
 */
function finalizeTotals(totals) {
  return {
    messageCount: totals.messageCount,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheWriteTokens: totals.cacheWriteTokens,
    cacheReadTokens: totals.cacheReadTokens,
    distinctModels: Array.from(totals.models)
  };
}

/**
 * Create a fresh totals accumulator.
 */
function createTotals() {
  return {
    messageCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    models: new Set()
  };
}

/**
 * Create a message detail object in the standard format.
 */
function createMessage({ timestamp, project, role, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens, model, cost }) {
  return {
    timestamp: timestamp ? new Date(timestamp).toISOString() : null,
    project: project || 'unknown',
    role: role || null,
    inputTokens: inputTokens || 0,
    outputTokens: outputTokens || 0,
    cacheWriteTokens: cacheWriteTokens || 0,
    cacheReadTokens: cacheReadTokens || 0,
    model: model || null,
    cost: cost || 0
  };
}

/**
 * Accumulate a message into the totals tracker.
 */
function accumulateTotals(totals, msg) {
  totals.messageCount++;
  totals.inputTokens += msg.inputTokens;
  totals.outputTokens += msg.outputTokens;
  totals.cacheWriteTokens += msg.cacheWriteTokens;
  totals.cacheReadTokens += msg.cacheReadTokens;
  if (msg.model) totals.models.add(msg.model);
}

/**
 * Read all JSONL files in a directory (non-recursive) and process each line.
 * Returns all messages found and updates totals.
 *
 * @param {string} dirPath - directory containing .jsonl files
 * @param {Function} processLine - (data, context) => message|null
 *        where context = { projectName, filePath, totals }
 * @param {object} initialContext - initial context passed to processLine
 * @returns {{ messages: Array, totals: Object }}
 */
async function readJsonlDir(dirPath, processLine, initialContext = {}) {
  const messages = [];
  const totals = createTotals();
  const context = { ...initialContext, totals };

  if (!await fs.pathExists(dirPath)) {
    return { messages, totals: finalizeTotals(totals) };
  }

  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = path.join(dirPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            const result = await processLine(data, { ...context, filePath });
            if (result) {
              messages.push(result);
              accumulateTotals(totals, result);
            }
          } catch (_) { /* skip malformed lines */ }
        }
      } catch (_) { /* skip unreadable files */ }
    }
  } catch (_) { /* skip unreadable directory */ }

  return { messages, totals: finalizeTotals(totals) };
}

/**
 * Read all JSONL files in a directory tree (recursive into subdirectories).
 */
async function readJsonlTree(dirPath, processLine, initialContext = {}) {
  const messages = [];
  const totals = createTotals();
  const context = { ...initialContext, totals };

  if (!await fs.pathExists(dirPath)) {
    return { messages, totals: finalizeTotals(totals) };
  }

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
            await processJsonlFile(fullPath);
          }
        } catch (_) { /* skip */ }
      }
    } catch (_) { /* skip */ }
  }

  async function processJsonlFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const result = await processLine(data, { ...context, filePath });
          if (result) {
            messages.push(result);
            accumulateTotals(totals, result);
          }
        } catch (_) { /* skip malformed lines */ }
      }
    } catch (_) { /* skip unreadable files */ }
  }

  await walk(dirPath);
  return { messages, totals: finalizeTotals(totals) };
}

/**
 * Find project name by scanning first lines of JSONL files for cwd.
 */
async function findProjectName(fileDir) {
  if (!await fs.pathExists(fileDir)) return null;
  try {
    const files = await fs.readdir(fileDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = path.join(fileDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.cwd) return cwdToProjectName(data.cwd);
          } catch (_) { continue; }
        }
      } catch (_) { continue; }
    }
  } catch (_) { /* skip */ }
  return null;
}

/**
 * Count messages with usage in a directory of JSONL files.
 */
async function countMessages(fileDir) {
  let count = 0;
  if (!await fs.pathExists(fileDir)) return count;
  try {
    const files = await fs.readdir(fileDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = path.join(fileDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            const msg = data.message;
            if (msg && msg.usage) count++;
          } catch (_) { continue; }
        }
      } catch (_) { continue; }
    }
  } catch (_) { /* skip */ }
  return count;
}

module.exports = {
  finalizeTotals,
  createTotals,
  createMessage,
  accumulateTotals,
  readJsonlDir,
  readJsonlTree,
  findProjectName,
  countMessages,
  cwdToProjectName
};
