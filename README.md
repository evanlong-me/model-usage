# Model Usage

A lightweight CLI tool for analyzing AI model usage statistics and costs locally.

## ✨ Features

- 🔒 **100% Local & Secure** - No API keys required, reads local model usage data only
- ⚡ **Quick Analysis** - View all usage statistics with a single `mu` command
- 💰 **Cost Tracking** - Accurate cost calculation based on model pricing
- 📊 **Dual View Modes** - Switch between daily aggregated view and detailed message view
- 🎯 **Smart Project Detection** - Auto-detects current project when run in project directories
- 📋 **Clean Table Display** - Organized tabular output with token counts, costs, and project info
- 🔍 **Smart Filtering** - Filter by time ranges, project names, and models
- 📈 **Flexible Sorting** - Sort by cost, time, tokens, or project name
- 🔄 **Auto Update Check** - Automatically checks for new versions and notifies when updates are available
- 🚀 **Easy to Use** - Simple installation and intuitive commands

## 🚀 Quick Start

### Global Installation (Recommended)
```bash
npm install -g model-usage
mu  # View statistics instantly
```

### Alternative Installation Methods

```bash
# One-time usage (no installation required)
npx model-usage

# Local project installation
npm install model-usage
npx model-usage
```

## 📋 Usage

### Basic Commands

These are the basic commands you can use:

```bash
# View usage statistics (default command)
mu

# Display version information
mu -v

# Display help information
mu --help

# List all available projects
mu --list-projects
# or use the short form
mu -lp

# List all available models with pricing
mu --list-models
# or use the short form
mu -lm
```

### 🔍 Filtering Options

Filter your usage data by time range and project. 

**Note**: It's recommended to wrap time filters in quotes if they contain spaces.

#### ⏰ Time Filtering Formats

The tool supports various time filtering formats for maximum flexibility:

**Relative Time Filters** (no quotes needed):
- `5min`, `30min` - Last N minutes
- `2h`, `12h` - Last N hours  
- `7d`, `30d` - Last N days
- `1m`, `6m` - Last N months
- `1y`, `2y` - Last N years

**Date Range Filters**:
- `6-8` - Month range (June to August, current year)
- `july-august`, `jan-mar` - Named month ranges
- `2024-7-2024-8` - Cross-year month ranges
- `2024-07-01,2024-08-31` - Specific date ranges

**Precise DateTime Filters** (ISO 8601 format, **recommended**):
- `2024-07-30T16:00:00,2024-07-30T18:00:00` - Second precision
- `2024-07-30T16:00,2024-07-30T18:00` - Minute precision
- `2024-07-30T16,2024-07-30T18` - Hour precision

**Human-readable DateTime** (requires quotes):
- `"2024-07-30 16:00:00,2024-07-30 18:00:00"` - Second precision
- `"2024-07-30 16:00,2024-07-30 18:00"` - Minute precision

```bash
# Filter by relative time (no quotes needed)
mu -t 5min         # Last 5 minutes
mu -t 2h           # Last 2 hours
mu -t 7d           # Last 7 days
mu -t 1m           # Last 1 month
mu -t 1y           # Last 1 year

# Filter by month range (no quotes needed)
mu -t 6-8          # June to August (current year)
mu -t july-august  # July to August (current year)

# Filter by date and time (T-separator, no quotes needed)
mu -t 2024-07-01T14:30:15,2024-07-01T16:45:30  # With seconds
mu -t 2024-07-01T14:30,2024-07-01T16:45     # With minutes
mu -t 2024-07-01T14,2024-07-01T16         # With hours

# Filter by date and time (space separator, quotes needed)
mu -t "2024-07-01 14:30,2024-07-01 16:45"

# Filter by specific date range
mu -t 2024-07-01,2024-08-31
mu -t 2024-7-2024-8      # July 2024 to August 2024

# Filter by project (partial matching supported)
mu -p myproject    # Show only messages from projects containing "myproject"

# Filter by model (partial matching supported)
mu -m sonnet           # Show only messages from models containing "sonnet"
mu -m gpt-4             # Show only messages matching "gpt-4"
mu -m haiku-4-5        # Show only haiku-4-5 model messages

# Combine filters for precise results
mu -t 1m -p my-website       # Last month's my-website project data
mu -t 7d -m sonnet           # Last 7 days, sonnet models only
mu -m haiku -p myproject --by-date  # Per-day, haiku only, specific project
```

### 📈 Sorting Options

Sort your results by different criteria:

```bash
# Sort by cost (highest first)
mu -s cost -o desc

# Sort by cost (lowest first)
mu -s cost -o asc

# Sort by total tokens
mu -s tokens -o desc

# Sort by project name
mu -s project -o asc

# Sort by time (default: ascending, newest at bottom)
mu -s time -o asc

# Combine sorting with filtering
mu -p my-website -s cost -o desc  # my-website project sorted by cost
```

### 💡 Model Filtering

Filter usage by model name (supports partial matching):

```bash
# Filter by specific model
mu -m gpt-4.1

# Partial matching works too
mu -m gpt               # Matches gpt-4.1, gpt-4o, etc.
mu -m claude            # Matches claude-sonnet-4-6, claude-3-5-sonnet, etc.

# Combine with other filters
mu -m sonnet -t 7d     # Last 7 days, sonnet models only
mu -m haiku --by-date  # Per-day aggregation, haiku only
```

### 🎯 Project Auto-Detection

The tool automatically detects your current project and filters results accordingly:

```bash
# When run in a project directory, automatically filters to that project
cd my-project
mu                      # Shows only my-project usage

# Show all projects explicitly
mu --all                # Shows usage for all projects
mu -a

# Manual project filtering still works
mu -p specific-project  # Shows only specific-project usage
```

### 📊 View Modes

Switch between different viewing modes:

```bash
# Default: aggregated view (by project and date)
mu

# Detailed view: show individual messages
mu --detailed
mu -d

# Date-only view: aggregate all projects per day (no Project column)
mu --by-date
mu --by-date -t 7d

# Comparing views for specific projects
mu -p my-project        # Aggregated entry for my-project
mu -p my-project -d     # All individual my-project messages
```

### ⭐ GitHub Prompt Configuration

Manage the GitHub star prompt that appears after displaying results:

```bash
# Permanently disable the GitHub star prompt
mu --disable-github-prompt

# Re-enable the GitHub star prompt
mu --enable-github-prompt

# View all available options (including prompt settings)
mu -h
```

The tool will show a friendly prompt asking you to star the repository on GitHub after displaying usage statistics. You can:

- **Keep it enabled** (default) - Helps support the project
- **Disable it permanently** - The setting is saved and respected across all future runs
- **Re-enable it anytime** - If you change your mind

Your preference is stored in `~/.model-usage-config.json`.

### 🅰️ All Options Reference

Options are grouped by purpose:

#### Filtering

| Option | Description | Values | Default |
|--------|-------------|--------|---------|
| `-t, --time` | Time filter | `5min`, `2h`, `7d`, `1m`, `1y`, `6-8`, `july-august`, `2024-07-01T14:30,2024-07-01T16:45`, etc. | - |
| `-p, --project` | Project filter | Project name (partial matching) | auto-detect |
| `-m, --model` | Model filter | Model name (partial matching, e.g. "sonnet", "haiku") | - |
| `-a, --all` | Show all projects | - | `false` (auto-detect) |

#### View modes

| Option | Description | Values | Default |
|--------|-------------|--------|---------|
| `-d, --detailed` | Show individual messages | - | `false` (aggregated) |
| `--by-date` | Aggregate by date only, combining all projects per day | - | `false` |

#### Sorting

| Option | Description | Values | Default |
|--------|-------------|--------|---------|
| `-s, --sort` | Sort field | `cost`, `time`, `tokens`, `project` | `time` |
| `-o, --order` | Sort order | `asc`, `desc` | `asc` |

#### Lists

| Option | Description | Values | Default |
|--------|-------------|--------|---------|
| `-lp, --list-projects` | List all projects | - | - |
| `-lm, --list-models` | List all available models with pricing | - | - |

#### Config

| Option | Description | Values | Default |
|--------|-------------|--------|---------|
| `--disable-github-prompt` | Permanently disable the GitHub star prompt | - | - |
| `--enable-github-prompt` | Re-enable the GitHub star prompt | - | - |

## 📊 Sample Output

An example of what the output may look like:

```
🔍 Options applied:
  Project: my-website
  Sort: cost ↓
  Results: 3 aggregated entries (45 messages from 58 total)

┌─────────────┬─────────────┬──────────┬───────┬────────┬──────────────┬────────────┬──────────────────────────┬───────────┬───────────┐
│ Time        │ Project     │ Messages │ Input │ Output │ Cache Create │ Cache Read │ Model                    │ Total     │ Cost      │
├─────────────┼─────────────┼──────────┼───────┼────────┼──────────────┼────────────┼──────────────────────────┼───────────┼───────────┤
│ 6/29/2025   │ my-website  │ 15       │ 1,200 │ 400    │ 60,000       │ 20,000     │ gpt-4.1                  │ 81,600    │ $0.249000 │
├─────────────┼─────────────┼──────────┼───────┼────────┼──────────────┼────────────┼──────────────────────────┼───────────┼───────────┤
│ 6/28/2025   │ my-website  │ 20       │ 800   │ 300    │ 40,000       │ 15,000     │ gpt-4.1                  │ 56,100    │ $0.168500 │
├─────────────┼─────────────┼──────────┼───────┼────────┼──────────────┼────────────┼──────────────────────────┼───────────┼───────────┤
│ 6/27/2025   │ my-website  │ 10       │ 845   │ 428    │ 198,600      │ 652,976    │ gpt-4.1                  │ 852,849   │ $0.734798 │
├─────────────┼─────────────┼──────────┼───────┼────────┼──────────────┼────────────┼──────────────────────────┼───────────┼───────────┤
│ TOTAL       │             │ 45       │ 2,845 │ 1,128  │ 298,600      │ 687,976    │                          │ 990,549   │ $1.152298 │
└─────────────┴─────────────┴──────────┴───────┴────────┴──────────────┴────────────┴──────────────────────────┴───────────┴───────────┘
```

### 📁 Project List Output

```bash
mu --list-projects
# or use short form: mu -lp
```

```
📁 Available projects:
  • my-website (45 messages)
  • data-analysis (8 messages)
  • chatbot-app (5 messages)
```

## 🛠️ Requirements

- **Node.js** >= 14.0.0
- At least one AI model project with conversation history

## 📁 Data Sources

This tool reads model usage data from your local files:

- Default: `~/.model-usage.json` and `~/.model-usage/projects/`
- Configurable via `MODEL_USAGE_DATA_PATH` and `MODEL_USAGE_PROJECTS_PATH` env vars

## 🚨 Setup Instructions

First time using this tool? Make sure your AI tool saves conversation history locally:

```
❌ Model usage data not found!

📋 To fix this:

1. Ensure your AI tool saves conversation history locally

2. Configure data source path:
   export MODEL_USAGE_DATA_PATH=/path/to/your/data.json

3. Run this tool:
   mu
```

## 🔒 Privacy & Security

- **100% Local Data** - All model usage data read from your local files
- **Minimal Network Usage** - Only fetches model pricing from LiteLLM (cached for 1 hour)
- **No API Keys** - No authentication required
- **Privacy First** - Your usage data never leaves your machine

## 🤝 Contributing

Contributions welcome! Please submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🐛 Issues

Found a bug? [Create an issue](https://github.com/evanlong-me/model-usage/issues)

## 📚 Links

- [NPM Package](https://www.npmjs.com/package/model-usage)
- [GitHub Repository](https://github.com/evanlong-me/model-usage)
