/**
 * Claude Code source adapter.
 *
 * Data: ~/.claude/projects/<encoded-path>/<session-id>.jsonl
 *       ~/.claude/projects/<encoded-path>/sessions/<session-id>.jsonl (newer)
 *
 * Every line has top-level `cwd` for project detection.
 * Assistant messages: message.usage with standard field names:
 *   input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
 */
const path = require('path');
const fs = require('fs-extra');
const {
  cwdToProjectName, finalizeTotals, createTotals, createMessage, accumulateTotals,
  findProjectName, countMessages
} = require('./common');

const PROJECTS_DIR = path.join(process.env.HOME, '.claude', 'projects');

const meta = {
  name: 'claude',
  isAvailable() {
    return fs.pathExistsSync(PROJECTS_DIR);
  }
};

async function readSessions() {
  const messages = [];
  const totals = createTotals();

  if (!await fs.pathExists(PROJECTS_DIR)) {
    return { messages, totals: finalizeTotals(totals) };
  }

  const projectDirs = await fs.readdir(PROJECTS_DIR);

  for (const dir of projectDirs) {
    const dirPath = path.join(PROJECTS_DIR, dir);
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) continue;

      // Support both flat and sessions/ subdirectory layouts
      const sessionsDir = path.join(dirPath, 'sessions');
      const fileDir = await fs.pathExists(sessionsDir) ? sessionsDir : dirPath;

      const files = await fs.readdir(fileDir);
      let projectName = null;

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const filePath = path.join(fileDir, file);

        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              // Claude Code puts cwd on every event
              if (!projectName && data.cwd) {
                projectName = cwdToProjectName(data.cwd);
              }

              // Only assistant/message events with usage
              if (data.type !== 'assistant' && data.type !== 'message') continue;
              const msg = data.message;
              if (!msg || !msg.usage) continue;

              const usage = msg.usage;

              // No pre-computed cost; pricing layer will calculate
              const message = createMessage({
                timestamp: data.timestamp,
                project: projectName,
                role: msg.role || 'assistant',
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
                cacheWriteTokens: usage.cache_creation_input_tokens,
                cacheReadTokens: usage.cache_read_input_tokens,
                model: msg.model,
                cost: 0
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

  if (!await fs.pathExists(PROJECTS_DIR)) {
    return { projects, messageCount };
  }

  const projectDirs = await fs.readdir(PROJECTS_DIR);

  for (const dir of projectDirs) {
    const dirPath = path.join(PROJECTS_DIR, dir);
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) continue;

      const sessionsDir = path.join(dirPath, 'sessions');
      const fileDir = await fs.pathExists(sessionsDir) ? sessionsDir : dirPath;

      const projectName = await findProjectName(fileDir);
      if (!projectName) continue;

      const count = await countMessages(fileDir);
      if (count > 0) {
        if (!projects.includes(projectName)) {
          projects.push(projectName);
        }
        messageCount[projectName] = (messageCount[projectName] || 0) + count;
      }
    } catch (_) { /* skip */ }
  }

  return { projects: projects.sort(), messageCount };
}

module.exports = { ...meta, readSessions, getProjects };
