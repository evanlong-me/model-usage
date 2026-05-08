/**
 * Project detector module for Claude Code usage data
 */

const fs = require('fs-extra');
const os = require('os');
const path = require('path');

function cwdToProjectName(cwd) {
  if (!cwd) return null;
  const normalized = path.resolve(cwd);
  if (normalized === path.resolve(os.homedir())) return '~';
  return path.basename(normalized);
}

async function isProjectDirectory(currentDir) {
  const indicators = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.git',
    '.gitignore',
    'README.md',
    'README.rst',
    'Cargo.toml',
    'go.mod',
    'requirements.txt',
    'pyproject.toml',
    'Gemfile',
    'composer.json',
    'pom.xml',
    'build.gradle',
    'Makefile',
    'CMakeLists.txt'
  ];

  for (const indicator of indicators) {
    if (await fs.pathExists(path.join(currentDir, indicator))) {
      return true;
    }
  }
  return false;
}

async function getProjectAwareOptions(options, currentDir = process.cwd()) {
  if (options.all) {
    const { all, ...cleanOptions } = options;
    return cleanOptions;
  }

  if (options.project) {
    return options;
  }

  if (await isProjectDirectory(currentDir)) {
    const detectedProject = cwdToProjectName(currentDir);
    if (detectedProject) {
      return {
        ...options,
        project: detectedProject,
        autoDetectedProject: true
      };
    }
  }

  return options;
}

module.exports = {
  cwdToProjectName,
  getProjectAwareOptions
};
