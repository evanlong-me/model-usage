/**
 * pi (Earendil) source adapter.
 *
 * Data: ~/.pi/agent/sessions/<encoded-project>/<session>.jsonl
 *
 * Each file starts with a session header line:
 *   { type: "session", cwd: "/path/to/project", timestamp: "..." }
 *
 * Subsequent message lines:
 *   { type: "message", message: { role, model, usage: {
 *       input, output, cacheRead, cacheWrite, reasoning, totalTokens,
 *       cost: { input, output, cacheRead, cacheWrite, total } } } }
 */
const path = require('path');
const fs = require('fs-extra');
const { cwdToProjectName, finalizeTotals, createTotals, createMessage, accumulateTotals } = require('./common');

const SESSIONS_DIR = path.join(process.env.HOME, '.pi', 'agent', 'sessions');

const meta = {
  name: 'pi',
  isAvailable() {
    return fs.pathExistsSync(SESSIONS_DIR);
  }
};

async function readSessions() {
  const messages = [];
  const totals = createTotals();

  if (!await fs.pathExists(SESSIONS_DIR)) {
    return { messages, totals: finalizeTotals(totals) };
  }

  const projectDirs = await fs.readdir(SESSIONS_DIR);

  for (const dir of projectDirs) {
    const dirPath = path.join(SESSIONS_DIR, dir);
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const filePath = path.join(dirPath, file);

        let projectName = null;
        let sessionTimestamp = null;

        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              // Session header: extract project name
              if (data.type === 'session') {
                projectName = data.cwd ? cwdToProjectName(data.cwd) : null;
                sessionTimestamp = data.timestamp || null;
                continue;
              }

              // Only process assistant messages with usage
              if (data.type !== 'message') continue;
              const msg = data.message;
              if (!msg || !msg.usage) continue;

              const usage = msg.usage;

              // Pi has pre-computed costs — use them directly
              const cost = (usage.cost && typeof usage.cost.total === 'number')
                ? usage.cost.total : 0;

              const message = createMessage({
                timestamp: data.timestamp || sessionTimestamp,
                project: projectName,
                role: msg.role,
                inputTokens: usage.input,
                outputTokens: usage.output,
                cacheWriteTokens: usage.cacheWrite,
                cacheReadTokens: usage.cacheRead,
                model: msg.model,
                cost
              });

              messages.push(message);
              accumulateTotals(totals, message);
            } catch (_) { /* skip */ }
          }
        } catch (_) { /* skip */ }
      }
    } catch (_) { /* skip */ }
  }

  return { messages, totals: finalizeTotals(totals) };
}

async function getProjects() {
  const projects = [];
  const messageCount = {};

  if (!await fs.pathExists(SESSIONS_DIR)) {
    return { projects, messageCount };
  }

  const projectDirs = await fs.readdir(SESSIONS_DIR);

  for (const dir of projectDirs) {
    const dirPath = path.join(SESSIONS_DIR, dir);
    let projectName = null;

    try {
      const files = await fs.readdir(dirPath);

      // Find project name from first session header
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        try {
          const content = await fs.readFile(path.join(dirPath, file), 'utf8');
          const firstLine = content.trim().split('\n')[0];
          const data = JSON.parse(firstLine);
          if (data.type === 'session' && data.cwd) {
            projectName = cwdToProjectName(data.cwd);
            break;
          }
        } catch (_) { continue; }
      }

      if (!projectName) continue;

      // Count messages with usage
      let count = 0;
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        try {
          const content = await fs.readFile(path.join(dirPath, file), 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message && data.message.usage) count++;
            } catch (_) { continue; }
          }
        } catch (_) { continue; }
      }

      if (!projects.includes(projectName)) {
        projects.push(projectName);
        messageCount[projectName] = count;
      } else {
        messageCount[projectName] += count;
      }
    } catch (_) { continue; }
  }

  return { projects: projects.sort(), messageCount };
}

module.exports = { ...meta, readSessions, getProjects };
