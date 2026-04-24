# Leifeld OpenCode Profile

Personal OpenCode profile for cautious, codebase-first software engineering. It combines strict operating instructions, documentation lookup through Context7, GitHub and browser MCP access, context-pruning support, and a small project-learning system.

## What This Profile Optimizes For

- Investigate before editing: search and read the relevant code first, then make the smallest correct change.
- Prefer verifiable work: define success criteria, run targeted checks, and avoid claiming completion without validation.
- Keep changes surgical: do not refactor unrelated code or modify unrelated worktree changes.
- Use current documentation for library/framework questions through Context7.
- Preserve reusable project knowledge through explicit, user-approved learnings.
- Manage context actively with Dynamic Context Pruning and the `/context` command.

## Main Files

| Path | Purpose |
| --- | --- |
| `opencode.jsonc` | Main OpenCode profile config: models, instructions, permissions, plugins, and MCP servers. |
| `AGENTS.md` | Core agent behavior rules loaded into every session. |
| `tui.jsonc` | Placeholder for an isolated TUI profile. |
| `.opencode/commands/` | Custom slash-command prompts. |
| `.opencode/agents/` | Custom subagent definitions. |
| `.opencode/skills/` | Reusable skill instructions, currently Context7 documentation lookup. |
| `.opencode/plugins/` | Custom OpenCode plugin code for context analysis and learnings. |
| `.opencode/tests/` | Bun tests for profile contracts and plugin behavior. |
| `.opencode/learnings/` | Project learning index, accepted learning items, usage stats, and ignored session exports. |
| `.xdg/opencode/` | Minimal XDG-style OpenCode config used for isolated profile bootstrapping. |

## Active OpenCode Config

`opencode.jsonc` sets:

- Primary model: `openai/gpt-5.5-fast`.
- Small model: `openai/gpt-5.4-mini`.
- Always-loaded instructions: `AGENTS.md` and `.opencode/learnings/INDEX.md`.
- Allowed structural search commands: `ast-grep`, `sg`, and their `npx @ast-grep/cli` equivalents.
- Dynamic Context Pruning plugin: `@tarquinen/opencode-dcp@latest`.
- MCP servers: GitHub, Playwright, and Context7.

Required environment variables:

| Variable | Used By | Notes |
| --- | --- | --- |
| `GITHUB_PAT_TOKEN` | GitHub MCP | Sent as a bearer token to `https://api.githubcopilot.com/mcp`. |
| `CONTEXT7_API_KEY` | Context7 MCP and docs workflow | Optional for basic use, useful for higher limits. |

## Agent Rules

`AGENTS.md` is the behavioral center of the profile. The most important rules are:

- Ask when ambiguity matters instead of guessing.
- Prefer simple, minimal implementations over speculative abstractions.
- Touch only files required by the task.
- Use `todowrite` for non-trivial multi-step work.
- Use `grep`/`rg` for exact strings and `ast-grep`/`sg` for syntax-aware searches.
- For library, framework, SDK, API, CLI, or cloud-service questions, resolve and fetch current docs with `ctx7` before answering.
- Suggest `/learn` after solving a new non-obvious problem.

## Custom Commands

| Command | Purpose |
| --- | --- |
| `/context` | Calls the `context_usage` tool and summarizes token usage by source. |
| `/learn` | Exports the current session, proposes up to five reusable learnings, and saves only user-approved items. |
| `/learnings-stats` | Reads learning usage stats and reports the most-used and unused learning items. |

## Custom Tools And Plugins

### Context Usage

`.opencode/plugins/context-usage.ts` exposes `context_usage`, which inspects the current session messages and estimates token usage by category:

- system prompts
- user messages
- assistant messages
- tool outputs
- reasoning traces

It resolves tokenizers through `.opencode/plugins/tokenizer-registry.mjs`, using `js-tiktoken` for OpenAI-style models and Hugging Face tokenizers for common non-OpenAI providers. If tokenizer dependencies are missing, install the vendor dependencies:

```bash
npm install js-tiktoken@latest @huggingface/transformers@^3.3.3 --prefix .opencode/plugins/vendor
```

### Learning System

`.opencode/plugins/learning-system.ts` exposes `learning_export_session` and tracks reads of accepted learning items.

The learning workflow is intentionally explicit:

1. `/learn` exports the effective session to `.opencode/learnings/exports/`.
2. The hidden `learning-extractor` subagent reads the export and proposes durable, project-specific learnings.
3. The user approves, edits, rejects, or merges each candidate.
4. Approved learnings are saved under `.opencode/learnings/items/`.
5. `.opencode/learnings/INDEX.md` is regenerated from accepted items.
6. Reads of files under `.opencode/learnings/items/` update `.opencode/learnings/.stats.json`.

Generated exports and stats are ignored by git; accepted learning items are intended to be committed.

## Documentation Lookup

The `find-docs` skill and `AGENTS.md` both require Context7 for current library documentation. The required workflow is:

```bash
npx ctx7@latest library <name> "<user question>"
npx ctx7@latest docs /org/project "<user question>"
```

Do not skip the library-resolution step unless the user already provided a Context7 library ID such as `/vercel/next.js`.

## Testing

Tests are configured with Bun in `bunfig.toml`:

```bash
bun test
```

Current test coverage checks:

- Learning exports include text, tool output, subtasks, and reasoning while redacting common secrets.
- `/learn` exports the parent session when invoked from a child command session.
- Learning item reads increment `.stats.json`.
- Reads outside `.opencode/learnings/items/` are ignored for stats.
- Static contracts keep the learning index, `/learn` command, and subagent safety boundaries wired correctly.

## Dependency Notes

The profile has small local dependency manifests in `.opencode/`, `.xdg/opencode/`, and `.opencode/plugins/vendor/`. Their `node_modules` directories are local runtime state and are ignored by nested `.gitignore` files.

Useful install commands:

```bash
npm install --prefix .opencode
npm install --prefix .xdg/opencode
npm install --prefix .opencode/plugins/vendor
```

## Git Hygiene

The root `.gitignore` keeps the learning system practical:

- `.opencode/learnings/exports/` is ignored because exports are session artifacts.
- `.opencode/learnings/.stats.json` is ignored because stats are local usage telemetry.
- `.opencode/learnings/INDEX.md` and future `.opencode/learnings/items/*.md` files remain trackable.

Before committing profile changes, run:

```bash
bun test
git status --short
```

## Maintenance Checklist

- Keep `AGENTS.md`, `opencode.jsonc`, and tests aligned when changing behavior.
- Add or update tests for plugin behavior and command contracts.
- Do not manually edit `.opencode/learnings/.stats.json`.
- Regenerate `.opencode/learnings/INDEX.md` through `/learn` when adding accepted learning items.
- Keep vendor tokenizer dependencies installed if `/context` reports missing tokenizer packages.
