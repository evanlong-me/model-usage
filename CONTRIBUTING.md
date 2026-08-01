# Contributing to model-usage

Thanks for helping improve a zero-config CLI used across the local AI coding tool ecosystem (pi, Claude Code, Codex, Gemini CLI, OpenCode, Grok CLI).

## Quick start

```bash
git clone https://github.com/evanlong-me/model-usage.git
cd model-usage
npm install
npm run build
node dist/cli.js --help
```

Requires Node.js >= 22.

## Ways to contribute

- **Bug reports** — use the Bug report issue form; include OS, Node version, `mu -v`, and the source tool involved (Codex, Claude Code, etc.).
- **Feature requests** — use the Feature request form; explain the workflow and why existing flags are not enough.
- **Code** — small, focused PRs are easiest to review. One concern per PR.
- **New data sources** — add one file under `src/sources/`; auto-discovery picks it up. Keep README.md, AGENTS.md, and `src/usage.ts` supported-tool lists in sync.

## Pull request checklist

- [ ] `npm run build` passes
- [ ] Change verified with `node dist/cli.js` and the affected flags
- [ ] Docs updated if behavior changed (README.md, AGENTS.md, help text in `src/cli.ts`)
- [ ] No secrets, session files, or personal paths committed

## Review & release

Primary maintainer: [@evanlong-me](https://github.com/evanlong-me).

External PRs are welcome. Merged changes ship via npm (`model-usage`) and GitHub Packages after version bumps on `main`.

## Code of conduct

Be respectful and constructive. Harassment or bad-faith behavior will result in blocked interaction with the project.
