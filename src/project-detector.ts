import fs from 'fs-extra';
import path from 'path';
import { cwdToProjectName } from './util';
import type { CliOptions } from './types';

const PROJECT_INDICATORS = [
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.git', '.gitignore', 'README.md', 'README.rst',
  'Cargo.toml', 'go.mod', 'requirements.txt', 'pyproject.toml',
  'Gemfile', 'composer.json', 'pom.xml', 'build.gradle',
  'Makefile', 'CMakeLists.txt',
];

async function isProjectDirectory(dir: string): Promise<boolean> {
  for (const indicator of PROJECT_INDICATORS) {
    if (await fs.pathExists(path.join(dir, indicator))) return true;
  }
  return false;
}

export async function getProjectAwareOptions(
  options: CliOptions,
  currentDir = process.cwd(),
): Promise<CliOptions> {
  if (options.allProjects) {
    const { allProjects, ...clean } = options;
    return clean as CliOptions;
  }

  if (options.project) return options;

  if (await isProjectDirectory(currentDir)) {
    const detectedProject = cwdToProjectName(currentDir);
    if (detectedProject) {
      return { ...options, project: detectedProject, autoDetectedProject: true };
    }
  }

  return options;
}
