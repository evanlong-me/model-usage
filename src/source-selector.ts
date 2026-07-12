import { checkbox, Separator } from '@inquirer/prompts';
import chalk from 'chalk';
import type { SourceInfo } from './types';

interface SelectSourcesOptions {
  isTTY: boolean;
  skipInteractive?: boolean;
}

export async function selectSources(
  allSources: SourceInfo[],
  options: SelectSourcesOptions = { isTTY: false },
): Promise<string[]> {
  const available = allSources.filter((s) => s.available);
  const unavailable = allSources.filter((s) => !s.available);

  if (available.length === 0) {
    if (unavailable.length === 0) {
      console.log(chalk.yellow('📭 No TUI data sources detected.'));
    } else {
      console.log(chalk.yellow('📭 No TUI data sources with local data found.'));
    }
    return [];
  }

  if (options.skipInteractive || !options.isTTY) {
    return available.map((s) => s.name);
  }

  const choices: Array<{ name: string; value: string; checked?: boolean; disabled?: boolean } | Separator> = [
    ...available.map((s) => ({
      name: `${s.name}  ${chalk.gray(`(${s.messageCount || '?'} msgs)`)}`,
      value: s.name,
      checked: true,
    })),
  ];

  if (unavailable.length > 0) {
    choices.push(new Separator(chalk.gray('─'.repeat(40))));
    choices.push(
      ...unavailable.map((s) => ({
        name: `${chalk.dim(s.name)}  ${chalk.dim('(not found)')}`,
        value: s.name,
        checked: false,
        disabled: true,
      })),
    );
  }

  console.log(chalk.cyan('🔍 Detected TUI data sources:'));
  console.log(chalk.gray('  Use Space to toggle, Enter to confirm\n'));

  try {
    const selected = await checkbox({
      message: 'Select sources to query:',
      choices,
      pageSize: 10,
    });
    return selected;
  } catch {
    return [];
  }
}

/** Get a quick preview of message counts per source for the selector UI. */
export async function getSourcePreviews(
  sources: { name: string; source: { getProjects: () => Promise<{ messageCount: Record<string, number> }> } }[],
): Promise<{ name: string; messageCount: number }[]> {
  const previews: { name: string; messageCount: number }[] = [];
  for (const { name, source } of sources) {
    try {
      const { messageCount } = await source.getProjects();
      const total = Object.values(messageCount).reduce((a, b) => a + b, 0);
      previews.push({ name, messageCount: total });
    } catch {
      previews.push({ name, messageCount: 0 });
    }
  }
  return previews;
}
