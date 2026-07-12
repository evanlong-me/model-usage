import { createSpinner } from 'nanospinner';
import chalk from 'chalk';
import { fetchJson } from './util';
import type { ModelPricing, PricingMap, TokenCounts } from './types';

export const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

let cachedPricing: PricingMap | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

function isCacheValid(): boolean {
  return !!(cachedPricing && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION);
}

/** Fetch model pricing data from LiteLLM. Results are cached in memory for 1 hour. */
export async function fetchModelPricing(useCache = true): Promise<PricingMap> {
  if (useCache && isCacheValid()) {
    return cachedPricing!;
  }

  const spinner = createSpinner('Fetching latest model pricing from LiteLLM...').start();

  try {
    const data = await fetchJson<Record<string, Record<string, unknown>>>(LITELLM_PRICING_URL);
    const pricing: PricingMap = new Map();

    for (const [modelName, modelData] of Object.entries(data)) {
      if (typeof modelData === 'object' && modelData !== null) {
        if (
          modelData.input_cost_per_token !== undefined ||
          modelData.output_cost_per_token !== undefined
        ) {
          pricing.set(modelName, {
            input_cost_per_token: (modelData.input_cost_per_token as number) || 0,
            output_cost_per_token: (modelData.output_cost_per_token as number) || 0,
            cache_creation_input_token_cost:
              (modelData.cache_creation_input_token_cost as number) || 0,
            cache_read_input_token_cost:
              (modelData.cache_read_input_token_cost as number) || 0,
          });
        }
      }
    }

    cachedPricing = pricing;
    cacheTimestamp = Date.now();
    spinner.success({ text: `Loaded pricing for ${pricing.size} models` });
    return pricing;
  } catch (error) {
    spinner.error({ text: `Failed to fetch pricing from LiteLLM: ${(error as Error).message}` });
    console.log(chalk.yellow('⚠️  Cost calculations will show $0.00 until pricing data is available'));

    const emptyMap: PricingMap = new Map();
    cachedPricing = emptyMap;
    cacheTimestamp = Date.now();
    return emptyMap;
  }
}

/** Get pricing for a specific model with fuzzy matching. */
export function getModelPricing(
  modelName: string | null,
  pricingData: PricingMap | null,
): ModelPricing | null {
  if (!modelName || !pricingData) return null;

  const exactMatch = pricingData.get(modelName);
  if (exactMatch) return exactMatch;

  const variations = [
    modelName,
    `anthropic/${modelName}`,
    `claude-3-5-${modelName}`,
    `claude-3-${modelName}`,
    `claude-${modelName}`,
  ];

  for (const variant of variations) {
    const match = pricingData.get(variant);
    if (match) return match;
  }

  const lowerModelName = modelName.toLowerCase();
  for (const [key, value] of pricingData) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes(lowerModelName) || lowerModelName.includes(lowerKey)) {
      return value;
    }
  }

  return null;
}

/** Calculate cost from token counts and pricing. */
export function calculateCost(tokens: TokenCounts, pricing: ModelPricing | null): number {
  if (!pricing) return 0;

  let cost = 0;
  if (tokens.inputTokens && pricing.input_cost_per_token) {
    cost += tokens.inputTokens * pricing.input_cost_per_token;
  }
  if (tokens.outputTokens && pricing.output_cost_per_token) {
    cost += tokens.outputTokens * pricing.output_cost_per_token;
  }
  if (tokens.cacheWriteTokens && pricing.cache_creation_input_token_cost) {
    cost += tokens.cacheWriteTokens * pricing.cache_creation_input_token_cost;
  }
  if (tokens.cacheReadTokens && pricing.cache_read_input_token_cost) {
    cost += tokens.cacheReadTokens * pricing.cache_read_input_token_cost;
  }
  return cost;
}

/** Get sorted list of all available model names. */
export function getAvailableModels(pricingData: PricingMap | null): string[] {
  if (!pricingData) return [];
  return Array.from(pricingData.keys()).sort();
}
