import chalk from 'chalk';
import { fetchJson } from './util';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { name, version } = require('../package.json') as { name: string; version: string };
const NPM_REGISTRY_URL = `https://registry.npmjs.org/${name}`;

interface RegistryResponse {
  'dist-tags': { latest: string };
}

export async function checkForUpdates(): Promise<void> {
  try {
    const data = await fetchJson<RegistryResponse>(NPM_REGISTRY_URL);
    const latestVersion = data['dist-tags'].latest;

    if (version !== latestVersion) {
      console.log(chalk.yellow(`⚠  New version available! Run: ${chalk.bgYellow.black.bold(` npm install -g ${name} `)}`));
      console.log('');
    }
  } catch {
    // Silently ignore — don't block usage display for a version check failure
  }
}
