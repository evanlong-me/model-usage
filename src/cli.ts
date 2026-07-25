#!/usr/bin/env node

import { Command, Help } from 'commander';
import { discoverSources } from './sources';
import { selectSources, getSourcePreviews } from './source-selector';
import { getProjectAwareOptions } from './project-detector';
import { showUsage, showProjects, showModels } from './display';
import { disableGitHubPrompt, enableGitHubPrompt } from './github-prompt';
import { checkForUpdates } from './update-checker';
import type { CliOptions } from './types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('model-usage')
  .version(version, '-v, --version', 'display version number')
  .description('A CLI tool for viewing AI model usage statistics')
  .option('-t, --time <filter>', timeFilterHelp())
  .option('-p, --project <name>', 'Project name filter (partial matching supported)')
  .option('-m, --model <name>', 'Model name filter — partial matching supported (e.g. "gpt-4", "sonnet")')
  .option('-k, --sort <field>', 'Sort by field (cost, time, tokens, project)', 'time')
  .option('-o, --order <direction>', 'Sort order (asc, desc)', 'asc')
  .option('-d, --detailed', 'Show individual messages instead of daily aggregates')
  .option('-b, --by-date', 'Aggregate by date only (combine all projects per day)')
  .option('-a, --all-projects', 'Show all projects (skip auto-detection)')
  .option('-P, --projects', 'List all projects')
  .option('-M, --models', 'List all models with pricing')
  .option('--disable-github-prompt', 'Permanently disable the GitHub star prompt')
  .option('--enable-github-prompt', 'Re-enable the GitHub star prompt')
  .option('-s, --sources <list>', 'TUI sources: comma-separated names, "all", or omit for interactive selection')
  .configureHelp({ formatHelp })
  .action(async (options: CliOptions) => {
    if (options.disableGithubPrompt) {
      await disableGitHubPrompt();
    } else if (options.enableGithubPrompt) {
      await enableGitHubPrompt();
    } else {
      if (options.projects) {
        const [, sourceNames] = await Promise.all([
          checkForUpdates(),
          resolveSourceNames(options),
        ]);
        await showProjects(sourceNames);
      } else if (options.models) {
        await Promise.all([checkForUpdates(), showModels()]);
      } else {
        const [, sourceNames] = await Promise.all([
          checkForUpdates(),
          resolveSourceNames(options),
        ]);
        const projectAware = await getProjectAwareOptions(options);
        await showUsage(projectAware, sourceNames);
      }
    }
  });

// No args → show usage by default
if (process.argv.slice(2).length === 0) {
  (async () => {
    const [, sourceNames] = await Promise.all([
      checkForUpdates(),
      resolveSourceNames({ sort: 'time', order: 'asc' }),
    ]);
    const options: CliOptions = { sort: 'time', order: 'asc' };
    const projectAware = await getProjectAwareOptions(options);
    await showUsage(projectAware, sourceNames);
  })();
} else {
  program.parse(process.argv);
}

// ─── Helpers ─────────────────────────────────────────────────────

async function resolveSourceNames(options: CliOptions): Promise<string[] | null> {
  const allSources = discoverSources();

  if (options.sources !== undefined) {
    if (options.sources === 'all') return null;
    return options.sources.split(',').map((s) => s.trim()).filter(Boolean);
  }

  if (!process.stdout.isTTY) return null;

  const availableSources = allSources.filter((s) => s.available);
  if (availableSources.length <= 1) return null;

  const previews = await getSourcePreviews(availableSources);
  const sourceInfos = allSources.map((s) => {
    const preview = previews.find((p) => p.name === s.name);
    return { ...s, messageCount: preview ? preview.messageCount : 0 };
  });

  return selectSources(sourceInfos, { isTTY: process.stdout.isTTY });
}

// ─── Custom help formatting ──────────────────────────────────────

function timeFilterHelp(): string {
  return [
    'Examples:',
    '  Relative: 30min, 2h, 7d, 1m, 1y',
    '  Calendar: today, yesterday, thisweek, lastweek,',
    '            thismonth, lastmonth, thisyear, lastyear',
    '  ISO8601: 2025-01-30T16:30:15 (supports h/m/s precision)',
    '  Ranges: 2025-01-30T16,2025-01-30T18 (hour)',
    '          2025-01-30T16:30,2025-01-30T18:45 (minute)',
    '          2025-01-30T16:30:15,2025-01-30T18:45:30 (second)',
  ].join('\n                           ');
}

function formatHelp(cmd: Command, helper: Help): string {
  const groups: Record<string, string[]> = {
    Filtering: ['time', 'project', 'model', 'sources', 'all-projects'],
    'View modes': ['detailed', 'by-date'],
    Sorting: ['sort', 'order'],
    Lists: ['projects', 'models'],
    Config: ['disable-github-prompt', 'enable-github-prompt'],
    Other: ['help', 'version'],
  };

  const groupOf = (name: string): string => {
    for (const [g, names] of Object.entries(groups)) {
      if (names.includes(name)) return g;
    }
    return 'Other';
  };

  const visibleOptions = helper.visibleOptions(cmd);
  const helpWidth = (helper as unknown as { helpWidth: number }).helpWidth || 80;
  const termWidth = Math.max(...visibleOptions.map((o) => helper.optionTerm(o).length));
  const itemIndent = 2;
  const itemSep = 2;

  const formatItem = (term: string, description: string): string => {
    const padded = term.padEnd(termWidth + itemSep);
    if (!description) return padded.trimEnd();
    return helper.wrap(padded + description, helpWidth - itemIndent, termWidth + itemSep);
  };

  const indentLines = (text: string): string =>
    text.split('\n').map((l) => ' '.repeat(itemIndent) + l).join('\n');

  const output = [`Usage: ${helper.commandUsage(cmd)}`, ''];
  const desc = helper.commandDescription(cmd);
  if (desc) output.push(desc, '');

  const grouped: Record<string, ReturnType<typeof helper.visibleOptions>> = {};
  for (const opt of visibleOptions) {
    const long = opt.long ? opt.long.replace(/^--/, '') : '';
    const g = groupOf(long);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(opt);
  }

  for (const g of Object.keys(groups)) {
    if (!grouped[g] || grouped[g].length === 0) continue;
    output.push(`${g}:`);
    const lines = grouped[g]
      .map((o) => formatItem(helper.optionTerm(o), helper.optionDescription(o)))
      .join('\n');
    output.push(indentLines(lines), '');
  }

  return output.join('\n');
}
