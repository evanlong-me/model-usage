/**
 * GitHub star prompt utility module
 */

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

/**
 * Default GitHub repository URL
 */
const DEFAULT_REPOSITORY_URL = 'https://github.com/evanlong-me/model-usage';

/**
 * Config file path for storing user preferences
 */
const CONFIG_FILE_PATH = path.join(process.env.HOME, '.model-usage-config.json');

/**
 * Load user configuration
 * @returns {Object} User configuration object
 */
async function loadConfig() {
  try {
    if (await fs.pathExists(CONFIG_FILE_PATH)) {
      return await fs.readJson(CONFIG_FILE_PATH);
    }
  } catch (error) {
    // Ignore errors, return default config
  }
  return {
    showGitHubPrompt: true
  };
}

/**
 * Save user configuration
 * @param {Object} config - Configuration object to save
 */
async function saveConfig(config) {
  try {
    await fs.writeJson(CONFIG_FILE_PATH, config, { spaces: 2 });
  } catch (error) {
    // Ignore errors - don't interrupt the main functionality
  }
}

/**
 * Display GitHub star prompt
 * @param {string} repositoryUrl - GitHub repository URL
 */
async function showGitHubStarPrompt(repositoryUrl = DEFAULT_REPOSITORY_URL) {
  const config = await loadConfig();
  
  // If user has disabled the prompt, don't show it
  if (!config.showGitHubPrompt) {
    return;
  }
  
  console.log('');
  console.log(chalk.gray('📊 Found this tool helpful?'));
  console.log(chalk.cyan('⭐ Star us on GitHub: ') + chalk.blue.underline(repositoryUrl));
  console.log('');
  console.log(chalk.dim('   (To disable this prompt: ') + chalk.bgYellow.black(' mu --disable-github-prompt ') + chalk.dim(', or run ') + chalk.bgYellow.black(' mu -h ') + chalk.dim(' for all options)'));
}

/**
 * Disable GitHub star prompt permanently
 */
async function disableGitHubPrompt() {
  const config = await loadConfig();
  config.showGitHubPrompt = false;
  await saveConfig(config);
  console.log(chalk.green('✅ GitHub star prompt has been disabled permanently.'));
  console.log(chalk.gray('   You can re-enable it by running: ') + chalk.bgYellow.black(' mu --enable-github-prompt '));
}

/**
 * Enable GitHub star prompt
 */
async function enableGitHubPrompt() {
  const config = await loadConfig();
  config.showGitHubPrompt = true;
  await saveConfig(config);
  console.log(chalk.green('✅ GitHub star prompt has been enabled.'));
}

module.exports = {
  showGitHubStarPrompt,
  disableGitHubPrompt,
  enableGitHubPrompt
};
