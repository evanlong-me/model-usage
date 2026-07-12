import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { fetchJson } from './util';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { name, version } = require('../package.json') as { name: string; version: string };
const NPM_REGISTRY_URL = `https://registry.npmjs.org/${name}`;

interface RegistryResponse {
  'dist-tags': { latest: string };
}

export async function checkForUpdates(): Promise<void> {
  const spinner = createSpinner('Checking for updates...').start();

  try {
    const data = await fetchJson<RegistryResponse>(NPM_REGISTRY_URL);
    const latestVersion = data['dist-tags'].latest;

    if (version !== latestVersion) {
      spinner.warn({
        text: `New version available! Run: ${chalk.bgYellow.black.bold(` npm install -g ${name} `)}`,
      });
      console.log('');
    } else {
      spinner.success({ text: `You're using the latest version (${version})` });
    }
  } catch {
    spinner.stop();
  }
}
