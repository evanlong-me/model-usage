<!--
Thanks for contributing! A good PR here is small, focused, and verified locally.
Delete this comment and fill in the sections below.
-->

## What & why

<!-- What does this PR change, and what problem does it solve? Link the issue if one exists: Closes #123 -->

## How

<!-- Brief description of the approach. Flag any design decisions you're unsure about — happy to discuss them in review. -->

## Verification

<!-- How you tested it. At minimum: -->

- [ ] `npm run build` passes
- [ ] Verified the change by running `node dist/cli.js` with the affected flags
- [ ] Docs updated if behavior changed (README.md, AGENTS.md, and the help text in `src/cli.ts` stay in sync)

<!--
Adding a new data source? You only need one new file in src/sources/ — auto-discovery
picks it up. See "Adding a New Source" in AGENTS.md, and remember to update the
supported-tools lists in README.md, AGENTS.md, and src/usage.ts.
-->
