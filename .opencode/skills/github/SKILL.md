---
name: github
description: |
  Interact with GitHub via the official `gh` CLI. Use this skill whenever the user asks about issues, pull requests, repos, releases, gists, runs/workflows, repo metadata, branches on a remote, or any github.com URL ("look at this PR", "check the issue", "list my open PRs", "what failed in CI", "create a draft PR", "comment on issue 123", "view this repo's releases"). Also use for fetching raw GitHub API data via `gh api`. Prefer this over web scraping or remote MCP servers — `gh` is the authoritative interface.

  Do NOT trigger for: local-only git operations (commit, branch, rebase) — those use `git` directly.
compatibility: Requires the `gh` CLI (https://cli.github.com) and an authenticated session (`gh auth login` or a `GH_TOKEN` / `GITHUB_TOKEN` env var with appropriate scopes).
allowed-tools: Bash(gh *)
---

# GitHub via `gh` CLI

The `gh` CLI is the canonical way to interact with GitHub from a terminal. It covers issues, PRs, releases, workflows, repos, gists, and the raw REST/GraphQL APIs.

Run `gh help` or `gh <command> --help` for full options.

## Hard Rules (token discipline)

`gh` output can be enormous — full job logs are routinely 50k+ tokens. Always filter at the source.

- **Never use `gh run view <id> --log`.** Use `gh run view <id> --log-failed` to get only the failed steps. If you genuinely need a successful step's log, scope it: `gh run view <id> --log --job <job-id> | head -200` — never let the unfiltered log enter context.
- **Always use `--json <fields> --jq '<expr>'` on list/view commands.** The default human-readable output is verbose and noisy. `gh pr list --json number,title,author,state` is one line per PR; the default is six.
- **Use `--paginate` deliberately.** It walks all pages and concatenates results — useful for `gh api`, dangerous for issue/PR lists in large repos. Add `--limit N` or filter with `--jq '.[:N]'`.
- **For rate limits, status, or auth checks**: tiny output, no filtering needed.

If a command's output is unexpectedly large, redirect to a temp file and grep it: `gh run view 123 --log > /tmp/run.log && grep -B2 -A10 -i 'error\|failed' /tmp/run.log`.

## Prerequisites

Check status first:

```bash
gh auth status
```

If not authenticated:

```bash
# Interactive (preferred for humans):
gh auth login

# Non-interactive (CI / scripted):
export GH_TOKEN=ghp_xxx          # or GITHUB_TOKEN
```

`gh` reads `GH_TOKEN` first, then `GITHUB_TOKEN`. Make sure the token has the scopes the user's task requires (`repo`, `workflow`, `read:org`, etc.).

## Quick Reference

| Need | Command |
|---|---|
| View an issue / PR | `gh issue view <n>` / `gh pr view <n>` |
| List issues / PRs | `gh issue list` / `gh pr list` (add `--state all`, `--author @me`, `--label bug`) |
| Create a PR | `gh pr create --title "..." --body "..." --base main` (add `--draft`, `--web`) |
| Check PR status / checks | `gh pr status` / `gh pr checks <n>` |
| Comment on issue / PR | `gh issue comment <n> --body "..."` / `gh pr comment <n> --body "..."` |
| View a repo | `gh repo view <owner>/<name>` |
| Clone a repo | `gh repo clone <owner>/<name>` |
| List releases | `gh release list` |
| View a workflow run | `gh run view <run-id>` (add `--log`, `--log-failed`) |
| Watch the latest run | `gh run watch` |
| Raw API call | `gh api repos/<owner>/<name>/...` |

## Workflow Patterns

### Reading a PR end-to-end

```bash
gh pr view 42 --json title,state,author,body,reviewDecision,statusCheckRollup
gh pr diff 42
gh pr checks 42
```

The `--json` flag returns structured output; combine with `--jq '<expr>'` to filter.

### Creating a PR from the current branch

```bash
gh pr create --title "Short summary" --body-file pr_body.md --base main --draft
```

Pass the body via `--body-file` for multi-line content, or via heredoc with `--body "$(cat <<'EOF' ... EOF)"`.

### Inspecting CI failures

```bash
gh run list --branch main --limit 5
gh run view <run-id> --log-failed
```

### Hitting the REST API directly

```bash
gh api repos/owner/name/pulls/42/comments
gh api -X POST repos/owner/name/issues/42/comments -f body="..."
gh api graphql -f query='query { viewer { login } }'
```

`gh api` handles auth, pagination (`--paginate`), and base URL automatically.

### Working from a github.com URL

`gh` accepts URLs in most commands:

```bash
gh pr view https://github.com/owner/name/pull/42
gh issue view https://github.com/owner/name/issues/123
```

## Output for Agents

- Use `--json <fields>` on most read commands to get machine-readable output.
- Use `--jq '<expr>'` to filter without piping through external `jq`.
- `gh api ... --paginate` walks all pages and concatenates JSON arrays.

```bash
gh pr list --json number,title,author --jq '.[] | select(.author.login=="someone")'
gh api repos/owner/name/issues --paginate --jq '.[].number'
```

## Authentication Scopes

If a command fails with `HTTP 403` or `Resource not accessible by integration`, the token is missing a scope. Common needs:

- `repo` — read/write code, issues, PRs (private + public)
- `workflow` — read/write Actions workflows
- `read:org` — list org members/teams
- `gist` — read/write gists
- `delete_repo` — destructive repo operations

Refresh with `gh auth refresh -s <scope>`.

## Tips

- **Quote strings with shell-special chars** (`$`, backticks, `!`) when passing `--body` inline; prefer `--body-file` for anything multi-line.
- **Default repo**: `gh` infers the repo from the current git remote. Override with `--repo owner/name` from anywhere.
- **Confirm before destructive ops**: `gh pr close`, `gh issue close`, `gh release delete`, `gh repo delete` mutate state — surface intent to the user before running.
- **Rate limits**: `gh api rate_limit` shows current quota.
- **Exit codes**: 0 = success, non-zero = error; check stderr for the message.

## Common Mistakes

- Forgetting `--state all` on `gh issue list` / `gh pr list` (defaults to `open` only).
- Pasting a body with backticks unquoted — use `--body-file`.
- Calling `gh api` without `--paginate` and missing results past the first 30/100.
- Running `gh` in a directory without a git remote — pass `--repo owner/name` explicitly.
