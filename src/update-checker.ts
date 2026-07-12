import chalk from 'chalk';
import { fetchJson } from './util';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { name, version } = require('../package.json') as { name: string; version: string };
const NPM_REGISTRY_URL = `https://registry.npmjs.org/${name}`;

interface RegistryResponse {
  'dist-tags': { latest: string };
}

/** Compare two semver strings. Returns >0 if a > b, <0 if a < b, 0 if equal. */
function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkForUpdates(): Promise<void> {
  try {
    const data = await fetchJson<RegistryResponse>(NPM_REGISTRY_URL);
    const latestVersion = data['dist-tags'].latest;

    if (semverCompare(latestVersion, version) > 0) {
      console.log(
        chalk.yellow(
          `⚠  Update available: ${chalk.dim(version)} → ${chalk.green(latestVersion)}`,
        ),
      );
      console.log(
        chalk.yellow(`   Run: ${chalk.bgYellow.black.bold(` npm install -g ${name} `)}`),
      );
      console.log('');
    }
  } catch (err) {
    // Show a visible warning instead of silently swallowing errors
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.dim(`⚠  Update check failed: ${message}`));
  }
}
