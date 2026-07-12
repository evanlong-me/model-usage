import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import Table from 'cli-table3';
import { getUsage, getProjects as getUsageProjects } from './usage';
import { applyFilters } from './filters';
import { sortMessages } from './sorter';
import {
  aggregateMessagesByProjectAndDate,
  aggregateMessagesByDate,
} from './aggregator';
import { checkForUpdates } from './update-checker';
import { showGitHubStarPrompt } from './github-prompt';
import {
  fetchModelPricing,
  getModelPricing,
  getAvailableModels,
  LITELLM_PRICING_URL,
} from './pricing';
import type { CliOptions, DisplayMessage } from './types';

export async function showUsage(options: CliOptions, sourceNames: string[] | null): Promise<void> {
  await checkForUpdates();

  try {
    const { messages } = await getUsage({ sourceNames });

    let filteredMessages = applyFilters(messages, {
      timeFilter: options.time,
      projectFilter: options.project,
      modelFilter: options.model,
    });

    let finalMessages: DisplayMessage[];
    if (options.detailed) {
      // Show individual messages (wrap in DisplayMessage shape)
      finalMessages = filteredMessages.map((m) => ({
        ...m,
        messageCount: 1,
        model: m.model || '',
      }));
    } else if (options.byDate) {
      finalMessages = aggregateMessagesByDate(filteredMessages);
    } else {
      finalMessages = aggregateMessagesByProjectAndDate(filteredMessages);
    }

    if (options.sort) {
      finalMessages = sortMessages(finalMessages, options.sort, options.order);
    }

    printFilterInfo(options, finalMessages.length, filteredMessages.length, messages.length);
    renderTable(finalMessages, options);
    await showGitHubStarPrompt();
  } catch (error) {
    if ((error as { name?: string }).name === 'DetailedError') {
      console.log((error as Error).message);
    } else {
      console.error(chalk.red('❌ Error fetching usage data:'), (error as Error).message);
    }
  }
}

function printFilterInfo(
  options: CliOptions,
  resultCount: number,
  filteredCount: number,
  totalCount: number,
): void {
  if (!options.time && !options.project && !options.model &&
      (options.sort === 'time' || !options.sort) &&
      (options.order === 'asc' || !options.order)) {
    return;
  }

  console.log(chalk.cyan('🔍 Options applied:'));
  if (options.time) console.log(chalk.gray(`  Time: ${options.time}`));
  if (options.project) {
    const display = options.autoDetectedProject
      ? `${options.project} ${chalk.dim('(auto-detected)')}`
      : options.project;
    console.log(chalk.gray(`  Project: ${display}`));
  }
  if (options.model) console.log(chalk.gray(`  Model: ${options.model}`));
  if (options.sort || options.order) {
    const sortBy = options.sort || 'time';
    const sortOrder = options.order || 'asc';
    const icon = sortOrder === 'asc' ? '↑' : '↓';
    console.log(chalk.gray(`  Sort: ${sortBy} ${icon}`));
  }
  if (options.time || options.project || options.model) {
    if (options.detailed) {
      console.log(chalk.gray(`  Results: ${resultCount} messages (from ${totalCount} total)`));
    } else {
      console.log(chalk.gray(`  Results: ${resultCount} entries (${filteredCount} msgs from ${totalCount} total)`));
    }
  }
  console.log('');
}

function renderTable(messages: DisplayMessage[], options: CliOptions): void {
  if (messages.length === 0) {
    console.log(chalk.yellow('📭 No messages found matching the specified filters.'));

    if (options.time || options.project || options.model) {
      console.log(chalk.gray('\nTry adjusting your filters:'));
      console.log(chalk.gray('  • Use broader time ranges (e.g., 1m instead of 7d)'));
      console.log(chalk.gray('  • Check project name spelling'));
      console.log(chalk.gray('  • Check model name spelling (try partial match, e.g. "sonnet")'));
      console.log(chalk.gray('  • Use --list-projects to see available projects'));
      console.log(chalk.gray('  • Use -lm to see available models'));
    }
    return;
  }

  const showProjectColumn = !options.byDate;
  const head: Array<string | { content: string; hAlign: string }> = [chalk.white('Time')];
  if (showProjectColumn) head.push(chalk.white('Project'));
  head.push(
    { content: chalk.white('Messages'), hAlign: 'right' },
    { content: chalk.white('Input'), hAlign: 'right' },
    { content: chalk.white('Output'), hAlign: 'right' },
    { content: chalk.white('Cache Create'), hAlign: 'right' },
    { content: chalk.white('Cache Read'), hAlign: 'right' },
    chalk.white('Model'),
    { content: chalk.white('Total'), hAlign: 'right' },
    { content: chalk.white('Cost (USD)'), hAlign: 'right' },
  );

  const table = new Table({
    head,
    style: { head: [], border: ['gray'] },
  });

  let totalInput = 0, totalOutput = 0, totalCacheCreate = 0, totalCacheRead = 0,
      totalCost = 0, grandTotal = 0, totalMessages = 0;

  for (const msg of messages) {
    const timeFormatted = formatTimestamp(msg.timestamp, options.detailed);
    const tokensTotal =
      msg.inputTokens + msg.outputTokens + msg.cacheWriteTokens + msg.cacheReadTokens;
    const count = options.detailed ? 1 : msg.messageCount;

    totalInput += msg.inputTokens;
    totalOutput += msg.outputTokens;
    totalCacheCreate += msg.cacheWriteTokens;
    totalCacheRead += msg.cacheReadTokens;
    totalCost += msg.cost || 0;
    grandTotal += tokensTotal;
    totalMessages += count;

    const costStr = '$' + (msg.cost || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    const row: Array<string | { content: string; hAlign: string }> = [chalk.gray(timeFormatted)];
    if (showProjectColumn) row.push(chalk.yellow(msg.project || ''));
    row.push(
      { content: chalk.white(count.toLocaleString()), hAlign: 'right' },
      { content: chalk.yellow(msg.inputTokens.toLocaleString()), hAlign: 'right' },
      { content: chalk.yellow(msg.outputTokens.toLocaleString()), hAlign: 'right' },
      { content: chalk.yellow(msg.cacheWriteTokens.toLocaleString()), hAlign: 'right' },
      { content: chalk.yellow(msg.cacheReadTokens.toLocaleString()), hAlign: 'right' },
      chalk.white(msg.model || ''),
      { content: chalk.green(tokensTotal.toLocaleString()), hAlign: 'right' },
      { content: chalk.green(costStr), hAlign: 'right' },
    );
    table.push(row);
  }

  // Total row
  const totalCostStr = '$' + totalCost.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const totalRow: Array<string | { content: string; hAlign: string }> = [chalk.bold.cyan('TOTAL')];
  if (showProjectColumn) totalRow.push(chalk.bold.cyan(''));
  totalRow.push(
    { content: chalk.bold.green(totalMessages.toLocaleString()), hAlign: 'right' },
    { content: chalk.bold.green(totalInput.toLocaleString()), hAlign: 'right' },
    { content: chalk.bold.green(totalOutput.toLocaleString()), hAlign: 'right' },
    { content: chalk.bold.green(totalCacheCreate.toLocaleString()), hAlign: 'right' },
    { content: chalk.bold.green(totalCacheRead.toLocaleString()), hAlign: 'right' },
    chalk.bold.cyan(''),
    { content: chalk.bold.green(grandTotal.toLocaleString()), hAlign: 'right' },
    { content: chalk.bold.green(totalCostStr), hAlign: 'right' },
  );
  table.push(totalRow);

  console.log(table.toString());
}

function formatTimestamp(ts: string | null, detailed?: boolean): string {
  if (!ts) return '';
  const date = new Date(ts);
  return detailed ? date.toLocaleString() : date.toLocaleDateString();
}

// ─── Projects ────────────────────────────────────────────────────

export async function showProjects(sourceNames: string[] | null): Promise<void> {
  await checkForUpdates();

  const spinner = createSpinner('Fetching project list...').start();
  try {
    const { projects, messageCount } = await getUsageProjects({ sourceNames });
    spinner.stop();

    if (projects.length > 0) {
      console.log(chalk.cyan('📁 Available projects:'));
      for (const project of projects) {
        const count = messageCount[project] || 0;
        console.log(chalk.yellow(`  • ${project}`) + chalk.gray(` (${count} messages)`));
      }
      await showGitHubStarPrompt();
    } else {
      console.log(chalk.yellow('No projects found.'));
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Error fetching projects:'), (error as Error).message);
  }
}

// ─── Models ──────────────────────────────────────────────────────

export async function showModels(): Promise<void> {
  await checkForUpdates();

  const spinner = createSpinner('Fetching model pricing data...').start();
  try {
    const pricingData = await fetchModelPricing();
    const models = getAvailableModels(pricingData);
    spinner.stop();

    if (models.length > 0) {
      console.log(chalk.cyan('🤖 Available models with pricing:'));
      console.log(chalk.gray(`Data source: ${LITELLM_PRICING_URL}`));
      console.log('');

      const table = new Table({
        head: [
          chalk.white('Model'),
          { content: chalk.white('Input (USD/1M)'), hAlign: 'right' },
          { content: chalk.white('Output (USD/1M)'), hAlign: 'right' },
          { content: chalk.white('Cache Create (USD/1M)'), hAlign: 'right' },
          { content: chalk.white('Cache Read (USD/1M)'), hAlign: 'right' },
        ],
        style: { head: [], border: ['gray'] },
      });

      for (const modelName of models) {
        const mp = getModelPricing(modelName, pricingData);
        if (!mp) continue;

        table.push([
          chalk.yellow(modelName),
          { content: chalk.green(mp.input_cost_per_token ? `$${(mp.input_cost_per_token * 1_000_000).toFixed(2)}` : 'N/A'), hAlign: 'right' },
          { content: chalk.green(mp.output_cost_per_token ? `$${(mp.output_cost_per_token * 1_000_000).toFixed(2)}` : 'N/A'), hAlign: 'right' },
          { content: chalk.cyan(mp.cache_creation_input_token_cost ? `$${(mp.cache_creation_input_token_cost * 1_000_000).toFixed(2)}` : 'N/A'), hAlign: 'right' },
          { content: chalk.cyan(mp.cache_read_input_token_cost ? `$${(mp.cache_read_input_token_cost * 1_000_000).toFixed(2)}` : 'N/A'), hAlign: 'right' },
        ]);
      }

      console.log(table.toString());
      await showGitHubStarPrompt();
    } else {
      console.log(chalk.yellow('No models found.'));
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Error fetching models:'), (error as Error).message);
  }
}
