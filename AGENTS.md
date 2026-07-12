# Model Usage

Zero-config CLI for analyzing AI model usage & costs across all local TUI tools — pi, Claude Code, Codex, Gemini CLI, OpenCode, and more.

## Project Structure

```
├── src/
│   ├── cli.ts               # CLI entry point (Commander setup)
│   ├── display.ts            # Output formatting (tables, models, projects)
│   ├── usage.ts              # Read usage data (auto-detect + config)
│   ├── aggregator.ts         # Aggregate messages by project/date
│   ├── filters.ts            # Time and project filtering
│   ├── sorter.ts             # Sorting by cost/time/tokens/project
│   ├── pricing.ts            # Fetch model pricing from LiteLLM
│   ├── project-detector.ts   # Auto-detect current project
│   ├── update-checker.ts     # Check for npm updates
│   ├── github-prompt.ts      # GitHub star prompt
│   ├── source-selector.ts    # Interactive TUI source picker
│   ├── util.ts               # Shared utilities
│   ├── types.ts              # TypeScript type definitions
│   └── sources/              # Auto-discovered source adapters
│       ├── index.ts          # Auto-discovery (no manual imports needed)
│       ├── common.ts         # Shared utilities for all sources
│       ├── pi.ts             # pi sessions
│       ├── claude.ts         # Claude Code sessions
│       ├── codex.ts          # Codex CLI sessions
│       ├── gemini.ts         # Gemini CLI sessions
│       ├── opencode.ts       # OpenCode sessions (SQLite)
│       └── grok.ts           # Grok CLI sessions (SQLite)
├── dist/                     # Compiled output (gitignored)
├── tsconfig.json
└── package.json
```

## Key Commands

```bash
# Default (interactive source selection if TTY, else all sources)
mu                     # Show today's usage (auto-detect project)

# Source selection
mu --sources pi,opencode  # Only query specific TUI tools
mu --sources all          # Query all sources (skip selection)
mu                        # Interactive checkbox UI to pick sources

# Filtering
mu -t 7d               # Last 7 days
mu -t 2h               # Last 2 hours
mu -p <project>        # Filter by project
mu -m <model>          # Filter by model (partial match: "sonnet", "gpt-4")

# Sorting
mu -k cost -o desc     # Sort by cost descending
mu -k time -o asc      # Sort by time ascending (default)

# View modes
mu -d                  # Detailed view (individual messages)
mu -b                  # Aggregate by date only (combines all projects)

# Lists
mu -P                  # List projects
mu -M                  # List models with pricing

# Combined
mu -m sonnet -t 7d     # Last 7 days, sonnet models only
mu -m haiku -p myproject --by-date  # Per-day, haiku only, specific project
```

## Supported TUI Tools (auto-detected)

| Tool | Data Source | Format |
|------|------------|--------|
| pi | `~/.pi/agent/sessions/` | JSONL |
| Claude Code | `~/.claude/projects/` | JSONL |
| Codex CLI | `~/.codex/sessions/` | JSONL |
| Gemini CLI | `~/.gemini/tmp/<hash>/chats/` | JSON / JSONL |
| OpenCode | `~/.local/share/opencode/opencode.db` | SQLite |
| Grok CLI | `~/.grok/grok.db` | SQLite |

## Adding a New Source

Create `src/sources/newtool.ts` with named exports:

```ts
export const name = 'newtool';

export function isAvailable(): boolean {
  // sync check if data exists
}

export async function readSessions(): Promise<UsageResult> {
  // return { messages, totals }
}

export async function getProjects(): Promise<ProjectsResult> {
  // return { projects, messageCount }
}
```

Use shared utilities from `./common.ts`:

```ts
import {
  createTotals, finalizeTotals, createMessage, accumulateTotals,
  readJsonlDir, readJsonlTree, findProjectName, countMessagesInDir,
} from './common';
```

No other files need changes — auto-discovery picks it up automatically.

## Development

```bash
npm install            # Install dependencies
npm run build          # Compile TypeScript → dist/
node dist/cli.js       # Run locally

# Or compile + run in one step:
npx tsc && node dist/cli.js
```

## Release Process

```bash
npm version patch      # Bump version (creates tag)
git push && git push --tags  # Trigger CI publish
```

CI triggers on `v*` tags, runs `npm ci && npm run build`, and publishes to npm with Trusted Publishing. `prepublishOnly` also runs build automatically.

## Debugging

Set `DEBUG=mu` to see suppressed errors from source adapters:

```bash
DEBUG=mu node dist/cli.js
```

## Pricing

Model pricing is fetched dynamically from LiteLLM's pricing data. Sources with pre-computed costs (pi, OpenCode, Grok) use those directly; others (Claude Code, Codex, Gemini CLI) calculate via LiteLLM.
