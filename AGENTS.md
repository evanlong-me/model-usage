# Model Usage

A lightweight CLI tool for analyzing AI model usage statistics and costs locally.

## Project Structure

```
├── bin/cli.js          # CLI entry point
├── lib/
│   ├── aggregator.js   # Aggregate messages by project/date
│   ├── filters.js      # Time and project filtering
│   ├── sorter.js       # Sorting by cost/time/tokens/project
│   ├── usage.js        # Read usage data from ~/.model-usage/
│   ├── pricing.js      # Fetch model pricing from LiteLLM
│   ├── project-detector.js  # Auto-detect current project
│   ├── update-checker.js    # Check for npm updates
│   └── github-prompt.js     # GitHub star prompt
└── package.json
```

## Key Commands

```bash
# Default
mu                     # Show usage (auto-detect project)

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

## Data Source

Reads from configured model usage data directories containing `.jsonl` files with conversation history.

## Pricing

Model pricing is fetched dynamically from LiteLLM's pricing data. No hardcoded prices.
