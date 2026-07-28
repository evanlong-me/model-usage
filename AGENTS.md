# Model Usage

Zero-config CLI for analyzing AI model usage & costs across all local TUI tools — pi, Claude Code, Codex, Gemini CLI, OpenCode, and more.

## Project Structure

```
├── src/
│   ├── cli.ts               # CLI entry point (Commander setup)
│   ├── display.ts            # Output formatting (tables, models, projects)
│   ├── usage.ts              # Read usage data (auto-detect all sources)
│   ├── aggregator.ts         # Aggregate messages by project/date
│   ├── filters.ts            # Time and project filtering
│   ├── sorter.ts             # Sorting by cost/time/tokens/project
│   ├── pricing.ts            # Fetch model pricing from LiteLLM
│   ├── project-detector.ts   # Auto-detect current project
│   ├── update-checker.ts     # Check for npm updates
│   ├── github-prompt.ts      # GitHub star prompt
│   ├── source-selector.ts    # Interactive TUI source picker
│   ├── util.ts               # Shared utilities (path, fetch)
│   ├── types.ts              # TypeScript type definitions
│   ├── cli-table3.d.ts       # Type declarations for cli-table3
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
mu                     # Show all usage for auto-detected project
mu -a                  # Show all projects (skip auto-detection)

# Source selection
mu -s pi,opencode      # Only query specific TUI tools (long form: --sources)
mu --sources all          # Query all sources (skip selection)
mu                        # Interactive checkbox UI to pick sources

# Filtering
mu -t 7d               # Last 7 days (rolling, relative to "now"); also 30min, 2h, 1m, 1y
mu -t today            # Calendar keywords: today, yesterday, thisweek, lastweek,
                       # thismonth, lastmonth, thisyear, lastyear (week starts Monday;
                       # hyphenated aliases like this-week work too)
mu -t 7-8              # Month range this year; july-august or 2025-7-2026-8 also work
mu -t 2026-07-25       # A single date — that whole calendar day
mu -p <project>        # Filter by project (partial match: "model", "obix")
mu -m <model>          # Filter by model (partial match: "sonnet", "gpt-5")

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
| Codex CLI | `~/.codex/sessions/`, `~/.codex/history.jsonl` | JSONL |
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

Releases are triggered by pushing a `v*` tag. The Agent decides the version bump.

### Version bump rules

Analyze the changes since the last tag and pick the appropriate bump:

| Bump | When to use |
|------|------------|
| **major** | Breaking CLI changes, removed options, renamed flags, dropped Node version support |
| **minor** | New feature, new source adapter, new CLI flag, significant internal refactor |
| **patch** | Bug fixes, dependency bumps, docs-only changes, minor perf improvements |

**Tie-breaking**: when in doubt, prefer the LOWER bump. A new source adapter is minor, not major. A TypeScript migration with zero CLI changes is minor (not major — users see no difference).

### Release steps (Agent executes)

```bash
# 1. Review changes, decide bump type
# 2. Bump version (creates commit + tag)
npm version <major|minor|patch>

# 3. Push code + tag → CI publishes to npm
git push --follow-tags
```

CI triggers on `v*` tags: upgrades npm to 11 (required for OIDC provenance),
runs `npm ci`, then `npm publish --provenance` (which triggers `prepublishOnly`
→ `npm run build` → `tsc`). GitHub Release is created automatically.

### Post-release

- Verify `npm view model-usage version` matches
- CI also creates a GitHub Release automatically

## Pricing

Model pricing is fetched dynamically from LiteLLM's pricing data. Sources with pre-computed costs (pi, OpenCode, Grok) use those directly; others (Claude Code, Codex, Gemini CLI) calculate via LiteLLM.

## Project Memory

- The codebase is fully migrated to TypeScript 7 with `erasableSyntaxOnly` enabled (no enums, namespaces, or parameter properties). SQLite connections (grok/opencode) are managed with the TS `using` keyword.
- When adding a new source adapter, keep the feature descriptions and supported-tools lists in README.md, AGENTS.md, and `src/usage.ts` in sync.
- In `src/sources/common.ts`, `processJsonlFile` must pass the shared `ctx` object by reference — spreading it into a copy silently drops mutations made by `processLine` (e.g. `ctx.projectName`), which once caused all pi/claude messages to show project `unknown`.
- package.json deliberately has no `main` field (CLI-only tool), and `files` is limited to `["dist"]` so devDependencies don't get packed into the npm tarball.
- Do not add `@types/chalk` — chalk 4 ships its own types.
- CI pins npm to 11 because npm 12 is engine-incompatible with Node 22.17.0; don't "fix" this by upgrading npm.
