/**
 * Gemini CLI source adapter.
 *
 * Data: ~/.gemini/tmp/<project_hash>/chats/session-<ts>-<id>.json  (old, JSON)
 *       ~/.gemini/tmp/<project_hash>/chats/session-<ts>-<id>.jsonl (new, JSONL)
 *
 * Old JSON format:
 *   { sessionId, projectHash, startTime, messages: [{ tokens, model, type, timestamp }] }
 *   tokens: { input, output, cached, thoughts, tool, total }
 *
 * NOTE: Gemini uses `projectHash` which cannot be reversed to the actual path.
 * We use a shortened hash as the project identifier.
 */
const path = require('path');
const fs = require('fs-extra');
const { finalizeTotals, createTotals, createMessage, accumulateTotals } = require('./common');

const TMP_DIR = path.join(process.env.HOME, '.gemini', 'tmp');

const meta = {
  name: 'gemini',
  isAvailable() {
    return fs.pathExistsSync(TMP_DIR);
  }
};

async function readSessions() {
  const messages = [];
  const totals = createTotals();

  if (!await fs.pathExists(TMP_DIR)) {
    return { messages, totals: finalizeTotals(totals) };
  }

  const entries = await fs.readdir(TMP_DIR);

  for (const entry of entries) {
    const projectDir = path.join(TMP_DIR, entry);

    // Skip non-directories (bin/, etc.)
    try {
      const stat = await fs.stat(projectDir);
      if (!stat.isDirectory()) continue;
    } catch (_) { continue; }

    const chatsDir = path.join(projectDir, 'chats');
    if (!await fs.pathExists(chatsDir)) continue;

    // Use shortened hash as project name
    const projectName = `gemini:${entry.substring(0, 8)}`;

    try {
      const files = await fs.readdir(chatsDir);

      for (const file of files) {
        if (file === 'logs.json') continue;
        if (!file.endsWith('.json') && !file.endsWith('.jsonl')) continue;

        const filePath = path.join(chatsDir, file);

        try {
          if (file.endsWith('.jsonl')) {
            // New JSONL format
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.trim());
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                const msg = extractMessage(data, projectName, null);
                if (msg) {
                  messages.push(msg);
                  accumulateTotals(totals, msg);
                }
              } catch (_) { /* skip */ }
            }
          } else {
            // Old JSON format: one file = one session
            const data = await fs.readJson(filePath);
            const sessionStart = data.startTime || null;

            for (const entryMsg of (data.messages || [])) {
              const msg = extractMessage(entryMsg, projectName, sessionStart);
              if (msg) {
                messages.push(msg);
                accumulateTotals(totals, msg);
              }
            }
          }
        } catch (_) { /* skip */ }
      }
    } catch (_) { /* skip */ }
  }

  return { messages, totals: finalizeTotals(totals) };
}

/**
 * Normalize a Gemini message (from either JSON or JSONL).
 */
function extractMessage(data, projectName, fallbackTimestamp) {
  const tokens = data.tokens;
  if (!tokens) return null;

  // Gemini token fields: input, output, cached (cache read), thoughts, tool, total
  // No separate cache write tracking; thoughts+tool are extras we include in output
  return createMessage({
    timestamp: data.timestamp || fallbackTimestamp,
    project: projectName,
    role: data.type,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    cacheWriteTokens: 0,
    cacheReadTokens: tokens.cached,
    model: data.model,
    cost: 0  // Calculated by pricing layer
  });
}

async function getProjects() {
  const projects = [];
  const messageCount = {};

  if (!await fs.pathExists(TMP_DIR)) {
    return { projects, messageCount };
  }

  const entries = await fs.readdir(TMP_DIR);

  for (const entry of entries) {
    const projectDir = path.join(TMP_DIR, entry);
    try {
      const stat = await fs.stat(projectDir);
      if (!stat.isDirectory()) continue;
    } catch (_) { continue; }

    const chatsDir = path.join(projectDir, 'chats');
    if (!await fs.pathExists(chatsDir)) continue;

    const projectName = `gemini:${entry.substring(0, 8)}`;

    try {
      const files = await fs.readdir(chatsDir);
      let count = 0;

      for (const file of files) {
        if (file === 'logs.json') continue;
        if (!file.endsWith('.json') && !file.endsWith('.jsonl')) continue;

        const filePath = path.join(chatsDir, file);
        try {
          if (file.endsWith('.jsonl')) {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.trim());
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.tokens) count++;
              } catch (_) { /* skip */ }
            }
          } else {
            const data = await fs.readJson(filePath);
            for (const msg of (data.messages || [])) {
              if (msg.tokens) count++;
            }
          }
        } catch (_) { /* skip */ }
      }

      if (count > 0) {
        projects.push(projectName);
        messageCount[projectName] = count;
      }
    } catch (_) { /* skip */ }
  }

  return { projects: projects.sort(), messageCount };
}

module.exports = { ...meta, readSessions, getProjects };
