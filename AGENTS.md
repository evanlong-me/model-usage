# Model Usage

Zero-config CLI for analyzing AI model usage & costs across all local TUI tools — pi, Claude Code, Codex, Gemini CLI, OpenCode, and more.

## Project Structure

```
├── bin/cli.js              # CLI entry point
├── lib/
│   ├── aggregator.js       # Aggregate messages by project/date
│   ├── filters.js          # Time and project filtering
│   ├── sorter.js           # Sorting by cost/time/tokens/project
│   ├── usage.js            # Read usage data (auto-detect + config)
│   ├── pricing.js          # Fetch model pricing from LiteLLM
│   ├── project-detector.js # Auto-detect current project
│   ├── update-checker.js   # Check for npm updates
│   ├── github-prompt.js    # GitHub star prompt
│   ├── source-selector.js  # Interactive TUI source picker
│   └── sources/            # Auto-discovered source adapters
│       ├── index.js        # Auto-discovery (no manual imports needed)
│       ├── common.js       # Shared utilities for all sources
│       ├── pi.js           # pi sessions
│       ├── claude.js       # Claude Code sessions
│       ├── codex.js        # Codex CLI sessions
│       ├── gemini.js       # Gemini CLI sessions
│       └── opencode.js     # OpenCode sessions (SQLite)
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
mu -s cost -o desc     # Sort by cost descending
mu -s time -o asc      # Sort by time ascending (default)

# View modes
mu -d                  # Detailed view (individual messages)
mu --by-date           # Aggregate by date only (combines all projects)

# Lists
mu -lp                 # List projects
mu -lm                 # List models with pricing

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

## Adding a New Source

Create `lib/sources/newtool.js` exporting:

```js
module.exports = {
  name: 'newtool',
  isAvailable() { /* sync check if data exists */ },
  readSessions() { /* return { messages, totals } */ },
  getProjects() { /* return { projects, messageCount } */ }
};
```

No other files need changes — auto-discovery picks it up automatically.

## Development

```bash
npm install            # Install dependencies
node bin/cli.js        # Run locally
```

## Release Process

```bash
npm version patch      # Bump version (creates tag)
git push && git push --tags  # Trigger CI publish
```

CI triggers on `v*` tags and publishes to npm with Trusted Publishing.

## Pricing

Model pricing is fetched dynamically from LiteLLM's pricing data. Sources with pre-computed costs (pi, OpenCode) use those directly; others (Claude Code, Codex, Gemini CLI) calculate via LiteLLM.
