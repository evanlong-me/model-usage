const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const pricing = require('./pricing');
const { cwdToProjectName } = require('./util');

class DetailedError extends Error {
  constructor() {
    super();
    this.name = 'DetailedError';
    this.message = this.getDetailedMessage();
  }

  getDetailedMessage() {
    return `
${chalk.red('❌ Claude Code configuration not found!')}

${chalk.yellow('📋 To fix this, you need to install and run Claude Code first:')}

${chalk.green('1. Install Claude Code:')}
   • run: ${chalk.cyan('npm install -g @anthropic-ai/claude-code')}

${chalk.green('2. Authenticate Claude Code:')}
   • Run: ${chalk.cyan('claude')}
   • Follow the authentication prompts
   • Sign in with your Claude account

${chalk.green('3. Use Claude Code at least once:')}
   • Start a conversation: ${chalk.cyan('claude "Hello, world!"')}
   • Or run interactively: ${chalk.cyan('claude')}
   • This will create the ${chalk.cyan('~/.claude.json')} configuration file

${chalk.green('4. Then run this tool again:')}
   • ${chalk.cyan('npx claude-code-usage -u')}

${chalk.yellow('💡 Need help?')}
   • Claude Code docs: ${chalk.blue('https://docs.anthropic.com/en/docs/claude-code/settings')}
`;
  }
}

async function getUsage() {
  const configPath = path.join(process.env.HOME, '.claude.json');

  if (!await fs.pathExists(configPath)) {
    throw new DetailedError();
  }

  const config = await fs.readJson(configPath);
  const _projects = config.projects || {};
  
  // Fetch model pricing data from LiteLLM
  const pricingData = await pricing.fetchModelPricing();

  // Collect per-message details and accumulate totals
  const messages = [];
  const totals = {
    messageCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    models: new Set()
  };

  try {
    const projectsPath = path.join(process.env.HOME, '.claude', 'projects');
    if (await fs.pathExists(projectsPath)) {
      const projectDirs = await fs.readdir(projectsPath);

      for (const dir of projectDirs) {
        const dirPath = path.join(projectsPath, dir);
        let projectName = null;

        try {
          const files = await fs.readdir(dirPath);
          
          // Find project name from cwd field in any file
          for (const file of files) {
            if (file.endsWith('.jsonl')) {
              const filePath = path.join(dirPath, file);
              const content = await fs.readFile(filePath, 'utf8');
              const lines = content.trim().split('\n').filter(line => line.trim());

              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.cwd) {
                    projectName = cwdToProjectName(data.cwd);
                    break; // Found project name, stop searching
                  }
                } catch (_) {
                  // Skip invalid JSON lines
                  continue;
                }
              }
              
              // If found project name, stop processing other files
              if (projectName) {
                break;
              }
            }
          }
          
          // Skip this directory if no project name found (shouldn't happen for valid projects)
          if (!projectName) {
            continue;
          }

          // Now process all files for usage data
          for (const file of files) {
            if (file.endsWith('.jsonl')) {
              const filePath = path.join(dirPath, file);
              const content = await fs.readFile(filePath, 'utf8');
              const lines = content.trim().split('\n').filter(line => line.trim());

              // Second pass: process messages with usage data
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);

                  // Process messages with usage data
                  if (data.message && data.message.usage) {
                    const message = data.message;
                    const usage = message.usage;

                    // Extract token counts
                    const inputTokens = usage.input_tokens || 0;
                    const outputTokens = usage.output_tokens || 0;
                    const cacheWriteTokens = usage.cache_write_tokens || usage.cache_creation_input_tokens || 0;
                    const cacheReadTokens = usage.cache_read_tokens || usage.cache_read_input_tokens || 0;

                    // Get pricing for the current model
                    const modelPricing = pricing.getModelPricing(message.model, pricingData);

                    // Calculate cost using the pricing data
                    const cost = pricing.calculateCost({
                      inputTokens,
                      outputTokens,
                      cacheWriteTokens,
                      cacheReadTokens
                    }, modelPricing);

                    // Extract message details
                    const messageDetails = {
                      timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : null,
                      project: projectName,
                      role: message.role || null,
                      inputTokens,
                      outputTokens,
                      cacheWriteTokens,
                      cacheReadTokens,
                      model: message.model || null,
                      cost: cost
                    };

                    // Push to messages array
                    messages.push(messageDetails);

                    // Accumulate totals
                    totals.messageCount++;
                    totals.inputTokens += messageDetails.inputTokens;
                    totals.outputTokens += messageDetails.outputTokens;
                    totals.cacheWriteTokens += messageDetails.cacheWriteTokens;
                    totals.cacheReadTokens += messageDetails.cacheReadTokens;

                    // Track distinct models
                    if (messageDetails.model) {
                      totals.models.add(messageDetails.model);
                    }
                  }
                } catch (_) {
                  // Skip invalid JSON lines
                  continue;
                }
              }
            }
          }
        } catch (_) {
          // Skip directories we can't read
          continue;
        }
      }
    }
  } catch (_) {
    // Return empty data if we can't read projects
  }

  // Convert models Set to Array for serialization
  const finalTotals = {
    messageCount: totals.messageCount,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheWriteTokens: totals.cacheWriteTokens,
    cacheReadTokens: totals.cacheReadTokens,
    distinctModels: Array.from(totals.models)
  };

  return {
    messages,
    totals: finalTotals
  };
}

async function getProjects() {
  const configPath = path.join(process.env.HOME, '.claude.json');

  if (!await fs.pathExists(configPath)) {
    throw new DetailedError();
  }

  const projects = [];
  const messageCount = {};

  try {
    const projectsPath = path.join(process.env.HOME, '.claude', 'projects');
    if (await fs.pathExists(projectsPath)) {
      const projectDirs = await fs.readdir(projectsPath);

      for (const dir of projectDirs) {
        const dirPath = path.join(projectsPath, dir);
        let projectName = null;

        try {
          const files = await fs.readdir(dirPath);
          
          // Find project name from cwd field in any file
          for (const file of files) {
            if (file.endsWith('.jsonl')) {
              const filePath = path.join(dirPath, file);
              const content = await fs.readFile(filePath, 'utf8');
              const lines = content.trim().split('\n').filter(line => line.trim());

              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.cwd) {
                    projectName = cwdToProjectName(data.cwd);
                    break;
                  }
                } catch (_) {
                  continue;
                }
              }
              
              if (projectName) {
                break;
              }
            }
          }
          
          if (!projectName) {
            continue;
          }

          // Count messages for this project
          let count = 0;
          for (const file of files) {
            if (file.endsWith('.jsonl')) {
              const filePath = path.join(dirPath, file);
              const content = await fs.readFile(filePath, 'utf8');
              const lines = content.trim().split('\n').filter(line => line.trim());

              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.message && data.message.usage) {
                    count++;
                  }
                } catch (_) {
                  continue;
                }
              }
            }
          }

          if (!projects.includes(projectName)) {
            projects.push(projectName);
            messageCount[projectName] = count;
          }
        } catch (_) {
          continue;
        }
      }
    }
  } catch (_) {
    // Return empty data if we can't read projects
  }

  return { projects: projects.sort(), messageCount };
}

module.exports = { getUsage, getProjects };
