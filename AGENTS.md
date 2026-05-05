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

## 5. Search And Code Intelligence

**Choose the retrieval method based on the question instead of defaulting to one tool.**

- Use semantic or broad exploration only when the concept is unclear or naming is unknown.
- Prefer `ast-grep`/`sg` for source-code searches when the language is supported, even for known symbols, imports, and call sites.
- Use `grep`/`rg` for plain text, logs, errors, config keys, filenames, generated files, or when AST-Grep cannot express the search cleanly.
- Use LSP for definitions, references, symbols, and type-aware navigation when available.
- Use `ast-grep`/`sg` for structural code searches where syntax matters more than text, such as matching call shapes, JSX patterns, decorators, or import forms. If no local binary exists, use `npx -y -p @ast-grep/cli ast-grep`.
- Read only the files or line ranges needed to validate the current hypothesis.

## 6. Browser Work

- For browser automation or UI investigation, do not use Playwright directly in the parent session; load `browser-subagent` and delegate to `browser-operator`.

## 7. Project Memory

When the system prompt contains a `<project-memory>` block, project-specific memories exist for this repo. Treat them as background context. To save a new memory or update an existing one, follow the `project-memory` skill — never write memory files freehand.

<!-- context7 -->
Use the `ctx7` CLI to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Resolve library: `npx ctx7@latest library <name> "<user's question>"` — use the official library name with proper punctuation (e.g., "Next.js" not "nextjs", "Customer.io" not "customerio", "Three.js" not "threejs")
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question)
3. Fetch docs: `npx ctx7@latest docs <libraryId> "<user's question>"`
4. Answer using the fetched documentation

You MUST call `library` first to get a valid ID unless the user provides one directly in `/org/project` format. Use the user's full question as the query -- specific and detailed queries return better results than vague single words. Do not run more than 3 commands per question. Do not include sensitive information (API keys, passwords, credentials) in queries.

For version-specific docs, use `/org/project/version` from the `library` output (e.g., `/vercel/next.js/v14.3.0`).

If a command fails with a quota error, inform the user and suggest `npx ctx7@latest login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.
<!-- context7 -->
