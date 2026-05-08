#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();
const chalk = require('chalk');
const { createSpinner } = require('nanospinner');
const Table = require('cli-table3');
const usage = require('../lib/usage');
const filters = require('../lib/filters');
const sorter = require('../lib/sorter');
const aggregator = require('../lib/aggregator');
const projectDetector = require('../lib/project-detector');
const pricing = require('../lib/pricing');
const updateChecker = require('../lib/update-checker');
const { showGitHubStarPrompt, disableGitHubPrompt, enableGitHubPrompt } = require('../lib/github-prompt');
const { version } = require('../package.json');

program
  .name('claude-code-usage')
  .version(version, '-v, --version', 'display version number')
  .description('A CLI tool for viewing Claude Code usage statistics')
  .option('-t, --time <filter>', 'Examples:\n                           Relative: 30min, 2h, 7d, 1m, 1y\n                           ISO8601: 2025-01-30T16:30:15 (supports h/m/s precision)\n                           Ranges: 2025-01-30T16,2025-01-30T18 (hour)\n                                   2025-01-30T16:30,2025-01-30T18:45 (minute)\n                                   2025-01-30T16:30:15,2025-01-30T18:45:30 (second)')
  .option('-p, --project <name>', 'Project name filter (partial matching supported)')
  .option('-s, --sort <field>', 'Sort by field (cost, time, tokens, project)', 'time')
  .option('-o, --order <direction>', 'Sort order (asc, desc)', 'asc')
  .option('-d, --detailed', 'Show detailed view with individual messages (default: aggregated by day)')
  .option('--by-date', 'Aggregate by date only, combining all projects per day')
  .option('-a, --all', 'Show all projects (default: auto-detect current project if in project directory)')
  .option('-lp, --list-projects', 'List all available projects')
  .option('-lm, --list-models', 'List all available models with pricing')
  .option('--disable-github-prompt', 'Permanently disable the GitHub star prompt')
  .option('--enable-github-prompt', 'Re-enable the GitHub star prompt')
  .configureHelp({
    formatHelp(cmd, helper) {
      const groups = {
        Filtering: ['time', 'project', 'all'],
        'View modes': ['detailed', 'by-date'],
        Sorting: ['sort', 'order'],
        Lists: ['list-projects', 'list-models'],
        Config: ['disable-github-prompt', 'enable-github-prompt'],
        Other: ['help', 'version']
      };
      const groupOf = name => {
        for (const [g, names] of Object.entries(groups)) {
          if (names.includes(name)) return g;
        }
        return 'Other';
      };

      const visibleOptions = helper.visibleOptions(cmd);
      const helpWidth = helper.helpWidth || 80;
      const termWidth = Math.max(...visibleOptions.map(o => helper.optionTerm(o).length));
      const itemIndent = 2;
      const itemSep = 2;

      const formatItem = (term, description) => {
        const padded = term.padEnd(termWidth + itemSep);
        if (!description) return padded.trimEnd();
        return helper.wrap(padded + description, helpWidth - itemIndent, termWidth + itemSep);
      };
      const indentLines = text =>
        text.split('\n').map(l => ' '.repeat(itemIndent) + l).join('\n');

      let output = [`Usage: ${helper.commandUsage(cmd)}`, ''];
      const desc = helper.commandDescription(cmd);
      if (desc) output.push(desc, '');

      const grouped = {};
      visibleOptions.forEach(opt => {
        const long = opt.long ? opt.long.replace(/^--/, '') : '';
        const g = groupOf(long);
        (grouped[g] = grouped[g] || []).push(opt);
      });

      Object.keys(groups).forEach(g => {
        if (!grouped[g] || grouped[g].length === 0) return;
        output.push(`${g}:`);
        const lines = grouped[g]
          .map(o => formatItem(helper.optionTerm(o), helper.optionDescription(o)))
          .join('\n');
        output.push(indentLines(lines), '');
      });

      return output.join('\n');
    }
  })
  .action(async (options) => {
    if (options.disableGithubPrompt) {
      await disableGitHubPrompt();
    } else if (options.enableGithubPrompt) {
      await enableGitHubPrompt();
    } else if (options.listProjects) {
      await showProjects();
    } else if (options.listModels) {
      await showModels();
    } else {
      // Apply project auto-detection
      const projectAwareOptions = await projectDetector.getProjectAwareOptions(options);
      await showUsage(projectAwareOptions);
    }
  });



// If no options provided, show usage by default
if (process.argv.slice(2).length === 0) {
  (async () => {
    const options = await projectDetector.getProjectAwareOptions({ sort: 'time', order: 'asc' });
    await showUsage(options);
  })();
} else {
  program.parse(process.argv);
}

async function showUsage(options) {
  // Check for updates
  await updateChecker.checkForUpdates();
  
  try {
    const { messages } = await usage.getUsage();
    
    // Apply filters
    let filteredMessages = filters.applyFilters(messages, {
      timeFilter: options.time,
      projectFilter: options.project
    });
    
    // Decide whether to aggregate or show detailed view
    let finalMessages;
    if (options.detailed) {
      // Show detailed view with individual messages
      finalMessages = filteredMessages;
    } else if (options.byDate) {
      // Aggregate by date only (all projects combined per day)
      finalMessages = aggregator.aggregateMessagesByDate(filteredMessages);
    } else {
      // Default: aggregate messages by project and date
      finalMessages = aggregator.aggregateMessagesByProjectAndDate(filteredMessages);
    }
    
    // Apply sorting if specified
    if (options.sort) {
      finalMessages = sorter.sortMessages(finalMessages, options.sort, options.order);
    }
    
    // Show filter and sort info if applied
    if (options.time || options.project || (options.sort && options.sort !== 'time') || (options.order && options.order !== 'asc')) {
      console.log(chalk.cyan('🔍 Options applied:'));
      if (options.time) {
        console.log(chalk.gray(`  Time: ${options.time}`));
      }
      if (options.project) {
        const projectDisplay = options.autoDetectedProject 
          ? `${options.project} ${chalk.dim('(auto-detected)')}`
          : options.project;
        console.log(chalk.gray(`  Project: ${projectDisplay}`));
      }
      if (options.sort || options.order) {
        const sortBy = options.sort || 'time';
        const sortOrder = options.order || 'asc';
        const sortIcon = sortOrder === 'asc' ? '↑' : '↓';
        console.log(chalk.gray(`  Sort: ${sortBy} ${sortIcon}`));
      }
      
      if (options.time || options.project) {
        if (options.detailed) {
          console.log(chalk.gray(`  Results: ${finalMessages.length} messages (from ${messages.length} total)`));
        } else {
          console.log(chalk.gray(`  Results: ${finalMessages.length} aggregated entries (${filteredMessages.length} messages from ${messages.length} total)`));
        }
      }
      console.log('');
    }

    // Display aggregated messages
    if (finalMessages.length > 0) {
      const showProjectColumn = !options.byDate;
      const head = [chalk.white('Time')];
      if (showProjectColumn) head.push(chalk.white('Project'));
      head.push(
        chalk.white('Messages'),
        chalk.white('Input'),
        chalk.white('Output'),
        chalk.white('Cache Create'),
        chalk.white('Cache Read'),
        chalk.white('Model'),
        chalk.white('Total'),
        chalk.white('Cost (USD)')
      );
      const table = new Table({
        head,
        style: {
          head: [],
          border: ['gray']
        }
      });

      // Calculate totals
      let totalInput = 0;
      let totalOutput = 0;
      let totalCacheCreate = 0;
      let totalCacheRead = 0;
      let totalCost = 0;
      let grandTotal = 0;
      let totalMessages = 0;

      finalMessages.forEach(msg => {
        // Format timestamp based on detailed vs aggregated view
        let timeFormatted = '';
        if (msg.timestamp) {
          const date = new Date(msg.timestamp);
          if (options.detailed) {
            // Detailed view: show full timestamp
            timeFormatted = date.toLocaleString();
          } else {
            // Aggregated view: show date only
            timeFormatted = date.toLocaleDateString();
          }
        }

        // Calculate total tokens for this message
        const msgInput = msg.inputTokens || 0;
        const msgOutput = msg.outputTokens || 0;
        const msgCacheCreate = msg.cacheWriteTokens || 0;
        const msgCacheRead = msg.cacheReadTokens || 0;
        const totalTokens = msgInput + msgOutput + msgCacheCreate + msgCacheRead;

        // Get message count based on view mode
        const projectMsgCount = options.detailed ? 1 : (msg.messageCount || 1);

        // Add to totals
        totalInput += msgInput;
        totalOutput += msgOutput;
        totalCacheCreate += msgCacheCreate;
        totalCacheRead += msgCacheRead;
        totalCost += (msg.cost || 0);
        grandTotal += totalTokens;
        totalMessages += projectMsgCount;

        // Format cost as currency (rounded to 2 decimal places with thousands separator)
        const costFormatted = '$' + (msg.cost || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

        const row = [chalk.gray(timeFormatted)];
        if (showProjectColumn) row.push(chalk.yellow(msg.project || ''));
        row.push(
          { content: chalk.white(projectMsgCount.toLocaleString()), hAlign: 'right' },
          { content: chalk.yellow(msgInput.toLocaleString()), hAlign: 'right' },
          { content: chalk.yellow(msgOutput.toLocaleString()), hAlign: 'right' },
          { content: chalk.yellow(msgCacheCreate.toLocaleString()), hAlign: 'right' },
          { content: chalk.yellow(msgCacheRead.toLocaleString()), hAlign: 'right' },
          chalk.white(msg.model || ''),
          { content: chalk.green(totalTokens.toLocaleString()), hAlign: 'right' },
          { content: chalk.green(costFormatted), hAlign: 'right' }
        );
        table.push(row);
      });

      // Add total row
      const totalCostFormatted = '$' + totalCost.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      
      const totalRow = [chalk.bold.cyan('TOTAL')];
      if (showProjectColumn) totalRow.push(chalk.bold.cyan(''));
      totalRow.push(
        { content: chalk.bold.green(totalMessages.toLocaleString()), hAlign: 'right' },
        { content: chalk.bold.green(totalInput.toLocaleString()), hAlign: 'right' },
        { content: chalk.bold.green(totalOutput.toLocaleString()), hAlign: 'right' },
        { content: chalk.bold.green(totalCacheCreate.toLocaleString()), hAlign: 'right' },
        { content: chalk.bold.green(totalCacheRead.toLocaleString()), hAlign: 'right' },
        chalk.bold.cyan(''),
        { content: chalk.bold.green(grandTotal.toLocaleString()), hAlign: 'right' },
        { content: chalk.bold.green(totalCostFormatted), hAlign: 'right' }
      );
      table.push(totalRow);

      console.log(table.toString());
      
      // Add GitHub star prompt
      await showGitHubStarPrompt();
    } else {
      console.log(chalk.yellow('📭 No messages found matching the specified filters.'));
      
      if (options.time || options.project) {
        console.log(chalk.gray('\nTry adjusting your filters:'));
        console.log(chalk.gray('  • Use broader time ranges (e.g., 1m instead of 7d)'));
        console.log(chalk.gray('  • Check project name spelling'));
        console.log(chalk.gray('  • Use --list-projects to see available projects'));
      }
    }

  } catch (error) {
    if (error.name === 'DetailedError') {
      console.log(error.message);
    } else {
      console.error(chalk.red('❌ Error fetching usage data:'), error.message);
    }
  }
}

async function showProjects() {
  // Check for updates
  await updateChecker.checkForUpdates();
  
  const spinner = createSpinner('Fetching project list...').start();
  try {
    const { projects, messageCount } = await usage.getProjects();
    spinner.stop();
    
    if (projects.length > 0) {
      console.log(chalk.cyan('📁 Available projects:'));
      projects.forEach(project => {
        const count = messageCount[project] || 0;
        console.log(chalk.yellow(`  • ${project}`) + chalk.gray(` (${count} messages)`));
      });
      
      // Add GitHub star prompt
      await showGitHubStarPrompt();
    } else {
      console.log(chalk.yellow('No projects found.'));
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Error fetching projects:'), error.message);
  }
}

async function showModels() {
  // Check for updates
  await updateChecker.checkForUpdates();
  
  const spinner = createSpinner('Fetching model pricing data...').start();
  try {
    const pricingData = await pricing.fetchModelPricing();
    const models = pricing.getAvailableModels(pricingData);
    spinner.stop();
    
    if (models.length > 0) {
      console.log(chalk.cyan('🤖 Available models with pricing:'));
      console.log(chalk.gray(`Data source: ${pricing.LITELLM_PRICING_URL}`));
      console.log('');
      
      const table = new Table({
        head: [
          chalk.white('Model'),
          chalk.white('Input (USD per 1M tokens)'),
          chalk.white('Output (USD per 1M tokens)'),
          chalk.white('Cache Create (USD per 1M)'),
          chalk.white('Cache Read (USD per 1M)')
        ],
        style: {
          head: [],
          border: ['gray']
        }
      });
      
      // Filter to show only Claude models
      const claudeModels = models.filter(model => 
        model.toLowerCase().includes('claude')
      );
      
      claudeModels.forEach(modelName => {
        const modelPricing = pricing.getModelPricing(modelName, pricingData);
        if (modelPricing) {
          const inputCost = modelPricing.input_cost_per_token ? 
            `$${(modelPricing.input_cost_per_token * 1000000).toFixed(2)}` : 'N/A';
          const outputCost = modelPricing.output_cost_per_token ? 
            `$${(modelPricing.output_cost_per_token * 1000000).toFixed(2)}` : 'N/A';
          const cacheCost = modelPricing.cache_creation_input_token_cost ? 
            `$${(modelPricing.cache_creation_input_token_cost * 1000000).toFixed(2)}` : 'N/A';
          const cacheReadCost = modelPricing.cache_read_input_token_cost ? 
            `$${(modelPricing.cache_read_input_token_cost * 1000000).toFixed(2)}` : 'N/A';
            
          table.push([
            chalk.yellow(modelName),
            chalk.green(inputCost),
            chalk.green(outputCost),
            chalk.cyan(cacheCost),
            chalk.cyan(cacheReadCost)
          ]);
        }
      });
      
      console.log(table.toString());
      
      if (claudeModels.length < models.length) {
        console.log(chalk.gray(`\nShowing ${claudeModels.length} Claude models out of ${models.length} total models.`));
        console.log(chalk.gray('Use --list-all-models to see all available models.'));
      }
      
      // Add GitHub star prompt
      await showGitHubStarPrompt();
    } else {
      console.log(chalk.yellow('No models found.'));
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Error fetching models:'), error.message);
  }
}
