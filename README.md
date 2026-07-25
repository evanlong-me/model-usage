# Model Usage

Zero-config CLI for analyzing AI model usage & costs across all local TUI tools — pi, Claude Code, Codex, Gemini CLI, OpenCode, Grok CLI, and more.

## ✨ Features

- 🪄 **Zero Configuration** - Auto-detects data from pi, Claude Code, Codex, Gemini CLI, OpenCode, Grok CLI
- 🔒 **100% Local & Secure** - No API keys required, reads local data only
- ⚡ **Quick Analysis** - View all usage with a single `mu` command
- 💰 **Cost Tracking** - Accurate cost calculation (pre-computed or LiteLLM pricing)
- 🎛️ **Interactive Source Selection** - TUI checkbox to pick which tools to query
- 🎯 **Smart Project Detection** - Auto-detects current project in project directories
- 📊 **Multiple View Modes** - Daily aggregated, per-message detailed, or by-date
- 🔍 **Smart Filtering** - Filter by time ranges, project names, and models
- 📈 **Flexible Sorting** - Sort by cost, time, tokens, or project name
- 🧩 **Extensible** - Add new TUI tool support in one file

## 🚀 Quick Start

```bash
# Install globally
npm install -g model-usage

# Run — auto-detects all your TUI tools automatically
mu
```

That's it. No configuration needed. On first run, you'll see an interactive checkbox to select which TUI tools to include, then your usage stats appear.

### Other Installation Methods

```bash
# One-time usage
npx model-usage

# Local project install
npm install model-usage
npx model-usage
```

## 🛠️ Supported TUI Tools (auto-detected)

| Tool | Data Source | Known Models |
|------|------------|-------------|
| **pi** | `~/.pi/agent/sessions/` | deepseek-v4-pro, etc. |
| **Claude Code** | `~/.claude/projects/` | claude-sonnet-4-5, etc. |
| **Codex CLI** | `~/.codex/sessions/` | gpt-5, etc. |
| **Gemini CLI** | `~/.gemini/tmp/<hash>/chats/` | gemini-3-pro-preview, etc. |
| **OpenCode** | `~/.local/share/opencode/opencode.db` | deepseek-v4-pro, etc. |
| **Grok CLI** | `~/.grok/grok.db` | grok-4.3, etc. |

All six are detected automatically — no config files needed.

## 📋 Usage

### Source Selection

Control which TUI tools to query:

```bash
mu                        # Interactive checkbox to pick sources (in TTY)
mu --sources pi,opencode  # Only query pi and OpenCode
mu --sources all          # Query all available sources (skip prompt)
```

In non-interactive environments (piped, cron, etc.), all sources are auto-selected without prompting.

### Basic Commands

```bash
mu                        # All usage for auto-detected project (interactive source picker in TTY)
mu -a, --all-projects     # All projects across all selected sources
mu -v, --version          # Version
mu -h, --help             # Help

mu -P, --projects         # List all projects
mu -M, --models           # List all models with LiteLLM pricing
```

### 🔍 Filtering

```bash
# Time filters — relative (rolling window relative to "now")
mu -t 7d                  # Last 7 days
mu -t 2h                  # Last 2 hours

# Time filters — calendar (whole days, week starts Monday)
mu -t today               # Today only
mu -t yesterday           # Yesterday only
mu -t thisweek            # Monday of this week through Sunday
mu -t lastweek            # Previous Monday–Sunday
mu -t thismonth           # Current calendar month
mu -t lastmonth           # Previous calendar month
mu -t thisyear            # Current calendar year
mu -t lastyear            # Previous calendar year

mu -t 2024-07-01T14:30,2024-07-01T16:45  # Date range (ISO 8601)

# Project & model filters (partial matching supported)
mu -p myproject           # Projects containing "myproject"
mu -m sonnet              # Models containing "sonnet"
mu -m gpt-4               # Models containing "gpt-4"

# Combine
mu -t 7d -m sonnet -p myproject
```

### 📈 Sorting

```bash
mu -k cost -o desc        # Highest cost first
mu -k tokens -o desc      # Most tokens first
mu -k project -o asc      # Alphabetical by project
mu -k time -o desc        # Newest first
```

### 📊 View Modes

```bash
mu                        # Aggregated by project + date (default)
mu -d                     # Detailed: individual messages
mu --by-date              # By date only, all projects combined
```

### ⭐ Config

```bash
mu --disable-github-prompt  # Hide GitHub star prompt permanently
mu --enable-github-prompt   # Show it again
```

## 📊 Sample Output

```
🔍 Options applied:
  Project: my-website (auto-detected)
  Sort: cost ↓

┌──────────┬─────────────┬──────────┬────────┬────────┬──────────────┬────────────┬─────────────────┬──────────┬────────────┐
│ Time     │ Project     │ Messages │ Input  │ Output │ Cache Create │ Cache Read │ Model           │ Total    │ Cost (USD) │
├──────────┼─────────────┼──────────┼────────┼────────┼──────────────┼────────────┼─────────────────┼──────────┼────────────┤
│ 7/1/2026 │ my-website  │       15 │  1,200 │    400 │            0 │     20,000 │ gpt-4.1         │   21,600 │      $0.09 │
├──────────┼─────────────┼──────────┼────────┼────────┼──────────────┼────────────┼─────────────────┼──────────┼────────────┤
│ 6/30/2026│ my-website  │       20 │    800 │    300 │            0 │     15,000 │ gpt-4.1         │   16,100 │      $0.06 │
├──────────┼─────────────┼──────────┼────────┼────────┼──────────────┼────────────┼─────────────────┼──────────┼────────────┤
│ TOTAL    │             │       35 │  2,000 │    700 │            0 │     35,000 │                 │   37,700 │      $0.15 │
└──────────┴─────────────┴──────────┴────────┴────────┴──────────────┴────────────┴─────────────────┴──────────┴────────────┘
```

## 🛠️ Requirements

- **Node.js** >= 22.0.0 (uses built-in `node:sqlite`)
- At least one supported TUI tool with conversation history

## 🔒 Privacy & Security

- **100% Local** — reads only from your local disk
- **Minimal Network** — only fetches model pricing from LiteLLM (cached 1h)
- **No API Keys** — no authentication required
- **Privacy First** — your data never leaves your machine

## 🧩 Extending

To add support for a new TUI tool, create `src/sources/mytool.ts`:

```ts
export const name = 'mytool';

export function isAvailable(): boolean { /* sync check */ }

export async function readSessions(): Promise<UsageResult> {
  // return { messages, totals }
}

export async function getProjects(): Promise<ProjectsResult> {
  // return { projects, messageCount }
}
```

No other files need changes — auto-discovery picks it up. See `src/sources/common.ts` for shared utilities.

## 📄 License

MIT

## 🔗 Links

- [NPM](https://www.npmjs.com/package/model-usage)
- [GitHub](https://github.com/evanlong-me/model-usage)
- [Issues](https://github.com/evanlong-me/model-usage/issues)
