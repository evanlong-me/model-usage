# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 3.x     | Yes       |
| < 3.0   | No        |

## What this project does

`model-usage` is a **local-only** CLI. It reads usage/session data from paths on the developer's machine (for example Codex, Claude Code, pi session directories). It does not send usage data to a remote server and does not require API keys for core analysis.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Email: **mail@evanlong.me**

Include:

1. Description of the issue and impact
2. Steps to reproduce or a proof of concept
3. Affected version (`mu -v`) and environment

You should receive an acknowledgment within 72 hours. After a fix is available, we will credit reporters who want attribution.

## Scope notes

In scope: path handling, local file reads, dependency supply chain in published npm packages, accidental leakage of session contents through logs or error messages.

Out of scope: vulnerabilities in third-party TUI tools that `model-usage` only reads data from; social-engineering reports without a technical issue.
