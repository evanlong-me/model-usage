/**
 * Auto-discovery for data sources.
 *
 * To add a new source, create a file in this directory (e.g., `src/sources/mytool.ts`)
 * that exports an object matching the Source interface:
 *
 *   {
 *     name: 'mytool',
 *     isAvailable(): boolean,
 *     readSessions(): Promise<UsageResult>,
 *     getProjects(): Promise<ProjectsResult>
 *   }
 *
 * Sources are auto-detected from the filesystem — no configuration needed.
 */
import fs from 'fs';
import path from 'path';
import { debug } from '../util';
import type { Source, SourceInfo } from '../types';

let _sources: SourceInfo[] | null = null;

/** Discover all source files in this directory. Cached after first call. */
export function discoverSources(): SourceInfo[] {
  if (_sources) return _sources;

  const sourcesDir = __dirname;
  let files: string[];
  try {
    files = fs.readdirSync(sourcesDir);
  } catch (err) {
    debug(`discoverSources: readdir error:`, (err as Error).message);
    _sources = [];
    return _sources;
  }

  _sources = [];

  for (const file of files) {
    if (!file.endsWith('.js')) continue; // compiled JS
    if (file === 'index.js' || file === 'common.js') continue;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(path.join(sourcesDir, file)) as Record<string, unknown>;

      if (
        typeof mod.isAvailable === 'function' &&
        typeof mod.readSessions === 'function' &&
        typeof mod.getProjects === 'function'
      ) {
        const name = (typeof mod.name === 'string' ? mod.name : path.basename(file, '.js')) as string;
        let available = false;
        try {
          available = (mod.isAvailable as () => boolean)();
        } catch {
          /* leave as false */
        }

        _sources.push({ name, source: mod as unknown as Source, available });
      }
    } catch (err) {
      debug(`Failed to load source ${file}:`, (err as Error).message);
    }
  }

  return _sources;
}

/** Get only available sources (those with existing data). */
export function getAvailableSources(): { name: string; source: Source }[] {
  return discoverSources()
    .filter((s) => s.available)
    .map(({ name, source }) => ({ name, source }));
}

/** Get specific sources by name. */
export function getSourcesByNames(names: string[]): SourceInfo[] {
  const all = discoverSources();
  const nameSet = new Set(names.map((n) => n.trim().toLowerCase()));
  return all.filter((s) => nameSet.has(s.name.toLowerCase()));
}
