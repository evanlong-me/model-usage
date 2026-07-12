import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

const DEFAULT_REPO_URL = 'https://github.com/evanlong-me/model-usage';
const CONFIG_PATH = path.join(process.env.HOME!, '.model-usage-config.json');

interface UserConfig {
  showGitHubPrompt: boolean;
}

async function loadConfig(): Promise<UserConfig> {
  try {
    if (await fs.pathExists(CONFIG_PATH)) {
      return (await fs.readJson(CONFIG_PATH)) as UserConfig;
    }
  } catch {
    /* ignore */
  }
  return { showGitHubPrompt: true };
}

async function saveConfig(config: UserConfig): Promise<void> {
  try {
    await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
  } catch {
    /* ignore */
  }
}

export async function showGitHubStarPrompt(repoUrl = DEFAULT_REPO_URL): Promise<void> {
  const config = await loadConfig();
  if (!config.showGitHubPrompt) return;

  console.log('');
  console.log(chalk.gray('📊 Found this tool helpful?'));
  console.log(chalk.cyan('⭐ Star us on GitHub: ') + chalk.blue.underline(repoUrl));
  console.log('');
  console.log(
    chalk.dim('   (To disable this prompt: ') +
    chalk.bgYellow.black(' mu --disable-github-prompt ') +
    chalk.dim(', or run ') +
    chalk.bgYellow.black(' mu -h ') +
    chalk.dim(' for all options)'),
  );
}

export async function disableGitHubPrompt(): Promise<void> {
  const config = await loadConfig();
  config.showGitHubPrompt = false;
  await saveConfig(config);
  console.log(chalk.green('✅ GitHub star prompt has been disabled permanently.'));
  console.log(
    chalk.gray('   You can re-enable it by running: ') +
    chalk.bgYellow.black(' mu --enable-github-prompt '),
  );
}

export async function enableGitHubPrompt(): Promise<void> {
  const config = await loadConfig();
  config.showGitHubPrompt = true;
  await saveConfig(config);
  console.log(chalk.green('✅ GitHub star prompt has been enabled.'));
}
