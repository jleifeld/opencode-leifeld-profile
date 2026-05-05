# Leifeld OpenCode Profile

Personal OpenCode profile for cautious, codebase-first software engineering. It combines strict operating instructions, documentation lookup through Context7, GitHub access via the `gh` CLI, and a Playwright MCP server for browser work.

## What This Profile Optimizes For

- Investigate before editing: search and read the relevant code first, then make the smallest correct change.
- Prefer verifiable work: define success criteria, run targeted checks, and avoid claiming completion without validation.
- Keep changes surgical: do not refactor unrelated code or modify unrelated worktree changes.
- Use current documentation for library/framework questions through Context7.
- Inspect context usage with the `/context` command.

## Main Files

| Path | Purpose |
| --- | --- |
| `opencode.jsonc` | Main OpenCode profile config: models, instructions, permissions, plugins, and MCP servers. |
| `AGENTS.md` | Core agent behavior rules loaded into every session. |
| `.opencode/commands/` | Custom slash-command prompts. |
| `.opencode/agents/` | Custom subagent definitions (currently empty). |
| `.opencode/skills/` | Reusable skill instructions for documentation lookup and Tavily workflows. |
| `.opencode/memory/` | Project-specific memory entries managed by the `project-memory` plugin. |
| `.opencode/plugins/` | Custom OpenCode plugin code. |
| `.opencode/tests/` | Bun tests for profile contracts and plugin behavior. |
| `.xdg/opencode/` | Minimal XDG-style OpenCode config used for isolated profile bootstrapping. |

## Active OpenCode Config

`opencode.jsonc` sets:

- Primary model: `openai/gpt-5.5`.
- Small model: `openai/gpt-5.4-mini`.
- Always-loaded instructions: `AGENTS.md`.
- Allowed structural search commands: `ast-grep`, `sg`, and their `npx @ast-grep/cli` equivalents.
- Allowed read-only commands: common `git` inspection (`status`, `diff`, `log`, `show`, `branch`, `ls-files`), `rg`, `ls`, `find`, `cat`, `bun test`, `npx ctx7@latest`, `tvly`, and `gh`.
- MCP servers: Playwright (interactive browser automation).

GitHub interactions go through the `github` skill via the `gh` CLI. Authenticate once with `gh auth login` (or set `GH_TOKEN` / `GITHUB_TOKEN`); no separate MCP token is needed.

Documentation lookup goes through the `find-docs` skill via the `ctx7` CLI.

Required environment variables:

| Variable | Used By | Notes |
| --- | --- | --- |
| `CONTEXT7_API_KEY` | `ctx7` CLI / `find-docs` skill | Optional; raises rate limits. Alternatively run `ctx7 login` for OAuth. |

## Agent Rules

`AGENTS.md` is the behavioral center of the profile. The most important rules are:

- Ask when ambiguity matters instead of guessing.
- Prefer simple, minimal implementations over speculative abstractions.
- Touch only files required by the task.
- Use `todowrite` for non-trivial multi-step work.
- Prefer `ast-grep`/`sg` for source-code searches, and use `grep`/`rg` for plain text or when AST-Grep is a poor fit.
- For library, framework, SDK, API, CLI, or cloud-service questions, resolve and fetch current docs with `ctx7` before answering.

## Custom Commands

| Command | Purpose |
| --- | --- |
| `/context` | Calls the `context_usage` tool and summarizes token usage by source. |

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

## Dependency Notes

The profile has small local dependency manifests in `.opencode/`, `.xdg/opencode/`, and `.opencode/plugins/vendor/`. Their `node_modules` directories are local runtime state and are ignored by nested `.gitignore` files.

Useful install commands:

```bash
npm install --prefix .opencode
npm install --prefix .xdg/opencode
npm install --prefix .opencode/plugins/vendor
```

## Git Hygiene

Before committing profile changes, run:

```bash
bun test
git status --short
```

## Maintenance Checklist

- Keep `AGENTS.md`, `opencode.jsonc`, and tests aligned when changing behavior.
- Add or update tests for plugin behavior and command contracts.
- Keep vendor tokenizer dependencies installed if `/context` reports missing tokenizer packages.
