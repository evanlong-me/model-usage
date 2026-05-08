# Claude Code Usage

A lightweight CLI tool for analyzing Claude Code usage statistics and costs locally.

## Project Structure

```
├── bin/cli.js          # CLI entry point
├── lib/
│   ├── aggregator.js   # Aggregate messages by project/date
│   ├── filters.js      # Time and project filtering
│   ├── sorter.js       # Sorting by cost/time/tokens/project
│   ├── usage.js        # Read usage data from ~/.claude/
│   ├── pricing.js      # Fetch model pricing from LiteLLM
│   ├── project-detector.js  # Auto-detect current project
│   ├── update-checker.js    # Check for npm updates
│   └── github-prompt.js     # GitHub star prompt
└── package.json
```

## Key Commands

```bash
ccu                    # Show usage (auto-detect project)
ccu -t 7d              # Last 7 days
ccu -t 2h              # Last 2 hours
ccu -p <project>       # Filter by project
ccu -s cost -o desc    # Sort by cost descending
ccu -s time -o asc     # Sort by time ascending (default)
ccu -d                 # Detailed view (individual messages)
ccu --by-date          # Aggregate by date only (combines all projects)
ccu -lp                # List projects
ccu -lm                # List models with pricing
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

Reads from `~/.claude/projects/` directory containing `.jsonl` files with Claude Code conversation history.

## Pricing

Model pricing is fetched dynamically from LiteLLM's pricing data. No hardcoded prices.
