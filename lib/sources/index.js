/**
 * Auto-discovery for data sources.
 *
 * To add a new source, create a file in this directory (e.g., `lib/sources/mytool.js`)
 * that exports an object with:
 *
 *   {
 *     name: 'mytool',          // unique identifier
 *     isAvailable: () => bool,  // synchronous check if data exists
 *     readSessions: async () => { messages, totals },
 *     getProjects: async () => { projects, messageCount }
 *   }
 *
 * No other files need to be modified — the source is automatically discovered.
 */
const fs = require('fs');
const path = require('path');

let _sources = null;

/**
 * Discover all source files in this directory.
 * Returns ALL sources (both available and unavailable).
 */
function discoverSources() {
  if (_sources) return _sources;

  const sourcesDir = __dirname;
  const files = fs.readdirSync(sourcesDir);

  _sources = [];

  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    if (file === 'index.js' || file === 'common.js') continue;

    try {
      const mod = require(path.join(sourcesDir, file));
      if (mod.isAvailable && mod.readSessions && mod.getProjects) {
        const name = mod.name || path.basename(file, '.js');
        const available = (() => {
          try { return mod.isAvailable(); } catch (_) { return false; }
        })();

        _sources.push({ name, source: mod, available });
      }
    } catch (err) {
      // Silently skip sources that fail to load
    }
  }

  return _sources;
}

/**
 * Get only available sources (those with existing data).
 */
function getAvailableSources() {
  return discoverSources().filter(s => s.available);
}

/**
 * Get specific sources by name, maintaining discovery order.
 * @param {string[]} names
 */
function getSourcesByNames(names) {
  const all = discoverSources();
  const nameSet = new Set(names.map(n => n.trim().toLowerCase()));
  return all.filter(s => nameSet.has(s.name.toLowerCase()));
}

module.exports = { discoverSources, getAvailableSources, getSourcesByNames };
