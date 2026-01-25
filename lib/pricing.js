/**
 * Pricing module for fetching model prices from LiteLLM
 */

const https = require('https');
const chalk = require('chalk');
const { createSpinner } = require('nanospinner');

/**
 * URL for LiteLLM's model pricing and context window data
 */
const LITELLM_PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

/**
 * Cache for pricing data to avoid repeated API calls
 */
let cachedPricing = null;
let cacheTimestamp = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Fetch data from URL using native HTTPS module
 * @param {string} url - URL to fetch
 * @returns {Promise<Object>} Parsed JSON data
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });
    
    request.on('error', (error) => {
      reject(new Error(`Network request failed: ${error.message}`));
    });
    
    // Set timeout
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Check if cached data is still valid
 * @returns {boolean} True if cache is valid
 */
function isCacheValid() {
  return cachedPricing && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION);
}

/**
 * Fetch model pricing data from LiteLLM
 * @param {boolean} useCache - Whether to use cached data if available
 * @returns {Promise<Map<string, Object>>} Map of model names to pricing data
 */
async function fetchModelPricing(useCache = true) {
  // Return cached data if valid and requested
  if (useCache && isCacheValid()) {
    return cachedPricing;
  }
  
  const spinner = createSpinner('Fetching latest model pricing from LiteLLM...').start();
  
  try {
    const data = await fetchJson(LITELLM_PRICING_URL);
    const pricing = new Map();
    
    // Process the pricing data
    for (const [modelName, modelData] of Object.entries(data)) {
      if (typeof modelData === 'object' && modelData !== null) {
        // Validate that the model has pricing information
        if (modelData.input_cost_per_token !== undefined || 
            modelData.output_cost_per_token !== undefined) {
          pricing.set(modelName, {
            input_cost_per_token: modelData.input_cost_per_token || 0,
            output_cost_per_token: modelData.output_cost_per_token || 0,
            cache_creation_input_token_cost: modelData.cache_creation_input_token_cost || 0,
            cache_read_input_token_cost: modelData.cache_read_input_token_cost || 0
          });
        }
      }
    }
    
    // Cache the data
    cachedPricing = pricing;
    cacheTimestamp = Date.now();
    
    spinner.success({ text: `Loaded pricing for ${pricing.size} models` });
    return pricing;
    
  } catch (error) {
    spinner.error({ text: `Failed to fetch pricing from LiteLLM: ${error.message}` });
    console.log(chalk.yellow('⚠️  Cost calculations will show $0.00 until pricing data is available'));

    // Return empty map - costs will be 0
    const emptyMap = new Map();
    cachedPricing = emptyMap;
    cacheTimestamp = Date.now();

    return emptyMap;
  }
}

/**
 * Get pricing for a specific model with fuzzy matching
 * @param {string} modelName - Model name to search for
 * @param {Map<string, Object>} pricingData - Pricing data map
 * @returns {Object|null} Pricing data or null if not found
 */
function getModelPricing(modelName, pricingData) {
  if (!modelName || !pricingData) {
    return null;
  }
  
  // Try exact match first
  const exactMatch = pricingData.get(modelName);
  if (exactMatch) {
    return exactMatch;
  }
  
  // Try with common prefixes
  const variations = [
    modelName,
    `anthropic/${modelName}`,
    `claude-3-5-${modelName}`,
    `claude-3-${modelName}`,
    `claude-${modelName}`
  ];
  
  for (const variant of variations) {
    const match = pricingData.get(variant);
    if (match) {
      return match;
    }
  }
  
  // Try partial matching (case insensitive)
  const lowerModelName = modelName.toLowerCase();
  for (const [key, value] of pricingData) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes(lowerModelName) || lowerModelName.includes(lowerKey)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Calculate cost based on token usage and pricing data
 * @param {Object} tokens - Token usage data
 * @param {number} tokens.inputTokens - Input tokens
 * @param {number} tokens.outputTokens - Output tokens  
 * @param {number} tokens.cacheWriteTokens - Cache creation tokens
 * @param {number} tokens.cacheReadTokens - Cache read tokens
 * @param {Object} pricing - Pricing data
 * @returns {number} Total cost in USD
 */
function calculateCost(tokens, pricing) {
  if (!pricing) {
    return 0;
  }
  
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

/**
 * Get all available models from pricing data
 * @param {Map<string, Object>} pricingData - Pricing data map
 * @returns {Array<string>} Array of model names
 */
function getAvailableModels(pricingData) {
  if (!pricingData) {
    return [];
  }
  
  return Array.from(pricingData.keys()).sort();
}

/**
 * Clear pricing cache
 */
function clearCache() {
  cachedPricing = null;
  cacheTimestamp = null;
}

module.exports = {
  fetchModelPricing,
  getModelPricing,
  calculateCost,
  getAvailableModels,
  clearCache,
  LITELLM_PRICING_URL
};
