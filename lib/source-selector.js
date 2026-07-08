/**
 * Interactive TUI source selector.
 *
 * When running in a TTY, presents a checkbox list of detected TUI data sources.
 * All available sources are pre-selected. The user can toggle individual sources
 * and confirm to proceed. In non-TTY environments, auto-selects all.
 */
const { checkbox, Separator } = require('@inquirer/prompts');
const chalk = require('chalk');

/**
 * Present an interactive source selection UI.
 *
 * @param {Array<{name: string, available: boolean, messageCount?: number}>} sources
 *        All discovered sources with their availability status.
 * @param {object} options
 * @param {boolean} options.isTTY - whether stdout is a terminal
 * @param {boolean} options.skipInteractive - force skip interactive mode
 * @returns {Promise<string[]>} Selected source names
 */
async function selectSources(allSources, options = {}) {
  const available = allSources.filter(s => s.available);
  const unavailable = allSources.filter(s => !s.available);

  // No sources at all
  if (available.length === 0) {
    if (unavailable.length === 0) {
      console.log(chalk.yellow('📭 No TUI data sources detected.'));
    } else {
      console.log(chalk.yellow('📭 No TUI data sources with local data found.'));
    }
    return [];
  }

  // Non-interactive mode: auto-select all available
  if (options.skipInteractive || !options.isTTY) {
    return available.map(s => s.name);
  }

  // Interactive mode: show checkbox UI
  const choices = [
    ...available.map(s => ({
      name: `${s.name}  ${chalk.gray(`(${s.messageCount || '?'} msgs)`)}`,
      value: s.name,
      checked: true
    })),
    new Separator(chalk.gray('─'.repeat(40))),
    ...unavailable.map(s => ({
      name: `${chalk.dim(s.name)}  ${chalk.dim('(not found)')}`,
      value: s.name,
      checked: false,
      disabled: true
    }))
  ];

  // If no unavailable sources, don't show the separator
  if (unavailable.length === 0) {
    choices.splice(available.length); // Remove separator and unavailable
  }

  console.log(chalk.cyan('🔍 Detected TUI data sources:'));
  console.log(chalk.gray('  Use Space to toggle, Enter to confirm\n'));

  try {
    const selected = await checkbox({
      message: 'Select sources to query:',
      choices,
      pageSize: 10
    });

    return selected;
  } catch (_) {
    // User cancelled (Ctrl+C) — return empty
    return [];
  }
}

/**
 * Get a quick preview of message counts per source (for the selector UI).
 * This is a lightweight scan, not the full data read.
 */
async function getSourcePreviews(sources) {
  const previews = [];
  for (const { name, source } of sources) {
    try {
      const { messageCount } = await source.getProjects();
      const total = Object.values(messageCount).reduce((a, b) => a + b, 0);
      previews.push({ name, messageCount: total });
    } catch (_) {
      previews.push({ name, messageCount: 0 });
    }
  }
  return previews;
}

module.exports = { selectSources, getSourcePreviews };
