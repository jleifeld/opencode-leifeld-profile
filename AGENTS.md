# OpenCode Rules

**Tradeoff:** bias toward caution over speed for non-trivial work. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs early.**

- State assumptions explicitly before implementation when they matter.
- If requirements are ambiguous or multiple interpretations exist, ask instead of guessing.
- Prefer the built-in `question` tool over silent assumptions.
- If a simpler approach exists, say so and push back on unnecessary complexity.
- If something is unclear, stop, name the uncertainty, and clarify first.

## 2. Simplicity First

**Write the minimum code and config that solves the actual request.**

- No speculative features, abstractions, or configurability beyond the request.
- No single-use abstractions unless they clearly reduce complexity.
- No defensive handling for scenarios that cannot realistically happen.
- If the solution feels overbuilt, simplify it before handing it off.

Ask: **Would a strong senior engineer call this overcomplicated?** If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only fallout from your own edits.**

- Do not refactor unrelated code while making the requested change.
- Do not rewrite adjacent comments, formatting, or structure unless required.
- Match the existing style and patterns unless the user asks for a change.
- If you notice unrelated issues or dead code, mention them instead of fixing them opportunistically.
- Remove imports, variables, or helpers that your own changes made unused.

Every changed line should trace back to the user's request.

## 4. Goal-Driven Execution

**Turn requests into verifiable goals and avoid unverified claims.**

- For non-trivial work, make a short plan and track it with `todowrite`.
- Define how each step will be verified before calling it done.
- Prefer checks that prove the requested outcome, not vague confidence.
- Do not claim a fix is complete until the relevant validation actually passed.

Example plan shape:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria reduce churn, rewrites, and post-hoc clarification.

## 5. Browser Work

- For browser automation or UI investigation, do not use Playwright directly in the parent session; load `browser-subagent` and delegate to `browser-operator`.
