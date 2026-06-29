const chalk = require('chalk');
const { createSpinner } = require('nanospinner');
const { name, version } = require('../package.json');
const { fetchJson } = require('./util');

const NPM_REGISTRY_URL = `https://registry.npmjs.org/${name}`;

async function fetchLatestVersion() {
  const json = await fetchJson(NPM_REGISTRY_URL);
  return json['dist-tags'].latest;
}

async function checkForUpdates() {
  const spinner = createSpinner('Checking for updates...').start();
  
  try {
    const latestVersion = await fetchLatestVersion();
    
    if (version !== latestVersion) {
      spinner.warn({ text: `New version available! Run: ${chalk.bgYellow.black.bold(` npm install -g ${name} `)}` });
      console.log('');
    } else {
      spinner.success({ text: `You're using the latest version (${version})` });
    }
  } catch (e) {
    spinner.stop();
    // Silently ignore errors - we don't want to interrupt the main functionality
  }
}

module.exports = { checkForUpdates };

