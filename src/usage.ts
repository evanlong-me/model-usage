import chalk from 'chalk';
import { getAvailableSources, getSourcesByNames } from './sources';
import { fetchModelPricing, getModelPricing, calculateCost } from './pricing';
import { createTotals, accumulateTotals, finalizeTotals } from './sources/common';
import type { Message, UsageResult, ProjectsResult, Source } from './types';

// ─── Help text ───────────────────────────────────────────────────

const NO_DATA_MESSAGE = [
  '',
  `${chalk.red('❌ No model usage data found!')}`,
  '',
  `${chalk.yellow('📋 Supported TUI tools are auto-detected — no configuration needed:')}`,
  '',
  `${chalk.green('  • pi')}            ${chalk.gray('(~/.pi/agent/sessions/)')}`,
  `${chalk.green('  • Claude Code')}   ${chalk.gray('(~/.claude/projects/)')}`,
  `${chalk.green('  • Codex CLI')}     ${chalk.gray('(~/.codex/sessions/ + history.jsonl)')}`,
  `${chalk.green('  • Gemini CLI')}    ${chalk.gray('(~/.gemini/tmp/)')}`,
  `${chalk.green('  • OpenCode')}      ${chalk.gray('(~/.local/share/opencode/opencode.db)')}`,
  `${chalk.green('  • Grok CLI')}      ${chalk.gray('(~/.grok/grok.db)')}`,
  '',
  `${chalk.yellow('💡 Need help?')}`,
  `   • Docs: ${chalk.blue('https://github.com/evanlong-me/model-usage')}`,
  '',
].join('\n');

// ─── Source resolution ───────────────────────────────────────────

function resolveSources(names: string[] | null): { name: string; source: Source }[] {
  if (names === null) return getAvailableSources();
  if (names.length === 0) return [];
  return getSourcesByNames(names)
    .filter((s) => s.available)
    .map(({ name, source }) => ({ name, source }));
}

// ─── Main API ────────────────────────────────────────────────────

export interface GetUsageOptions {
  sourceNames?: string[] | null;
}

export async function getUsage(options: GetUsageOptions = {}): Promise<UsageResult> {
  const result = await autoDetect(options.sourceNames ?? null);
  if (!result) {
    const err = new Error(NO_DATA_MESSAGE);
    err.name = 'DetailedError';
    throw err;
  }
  return result;
}

export async function getProjects(options: GetUsageOptions = {}): Promise<ProjectsResult> {
  return (await autoDetectProjects(options.sourceNames ?? null)) ?? { projects: [], messageCount: {} };
}

// ─── Auto-detection (parallel) ───────────────────────────────────

async function autoDetect(sourceNames: string[] | null): Promise<UsageResult | null> {
  const sources = resolveSources(sourceNames);

  // Read all sources in parallel
  const results = await Promise.allSettled(
    sources.map(({ source }) => source.readSessions()),
  );

  // Merge results
  const allMessages: Message[] = [];
  const combinedTotals = createTotals();

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') continue;

    const { messages, totals } = r.value;
    allMessages.push(...messages);
    combinedTotals.messageCount += totals.messageCount;
    combinedTotals.inputTokens += totals.inputTokens;
    combinedTotals.outputTokens += totals.outputTokens;
    combinedTotals.cacheWriteTokens += totals.cacheWriteTokens;
    combinedTotals.cacheReadTokens += totals.cacheReadTokens;
    for (const m of totals.distinctModels) combinedTotals.models.add(m);
  }

  if (allMessages.length === 0) return null;

  await applyPricing(allMessages);

  return {
    messages: allMessages,
    totals: finalizeTotals(combinedTotals),
  };
}

async function autoDetectProjects(sourceNames: string[] | null): Promise<ProjectsResult | null> {
  const sources = resolveSources(sourceNames);

  const results = await Promise.allSettled(
    sources.map(({ source }) => source.getProjects()),
  );

  const allProjects: string[] = [];
  const allMessageCount: Record<string, number> = {};

  for (const r of results) {
    if (r.status === 'rejected') continue;
    for (const p of r.value.projects) {
      if (!allProjects.includes(p)) allProjects.push(p);
      allMessageCount[p] = (allMessageCount[p] || 0) + (r.value.messageCount[p] || 0);
    }
  }

  if (allProjects.length === 0) return null;
  return { projects: allProjects.sort(), messageCount: allMessageCount };
}

// ─── Pricing (applied to sources without pre-computed cost) ──────

async function applyPricing(messages: Message[]): Promise<void> {
  let pricingData: Awaited<ReturnType<typeof fetchModelPricing>> | null = null;

  for (const msg of messages) {
    if (msg.cost !== 0) continue;
    if (!msg.model) continue;

    pricingData ??= await fetchModelPricing().catch(() => null);
    if (!pricingData) return;

    const mp = getModelPricing(msg.model, pricingData);
    if (mp) {
      msg.cost = calculateCost(
        {
          inputTokens: msg.inputTokens,
          outputTokens: msg.outputTokens,
          cacheWriteTokens: msg.cacheWriteTokens,
          cacheReadTokens: msg.cacheReadTokens,
        },
        mp,
      );
    }
  }
}
