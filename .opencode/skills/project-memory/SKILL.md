---
name: project-memory
description: >-
  Save or update a project-specific memory. Use when learning a non-obvious fact
  about this project, recording an in-flight decision, capturing bug repro
  context that should survive across sessions, or when the user explicitly says
  "remember this", "note this for next time", "save this", or similar. Do NOT
  use for general programming knowledge, library docs, or anything reproducible
  by reading a few files — that belongs in the Obsidian wiki, not project
  memory.
---

# Project Memory

Project memory is a per-repo store of facts that are only meaningful inside this codebase: in-flight decisions, undocumented invariants, bug repro context, "looks broken but is intentional" gotchas. Each project's memories live at `<project>/.opencode/memory/`.

When a `<project-memory>` block is present in the system prompt, the project has existing memories. Use them as background context. The block includes the absolute `dir` path — read individual memory files with `Read` on `<dir>/<slug>.md` when an index entry looks relevant.

## Save when

- You discover a non-obvious project fact (env quirk, undocumented invariant, "looks broken but is intentional").
- An active decision is made and the rationale will matter later.
- A bug is being investigated across sessions and the repro context is non-trivial.
- The user explicitly says "remember", "note this", "save this for next time".

## Do NOT save

- General programming or framework knowledge — that belongs in the Obsidian wiki.
- Anything reproducible from the code in under 30 seconds of reading.
- Secrets, tokens, customer data, or full file contents.
- Chat summaries or one-off task results.
- Information already in this project's CLAUDE.md / AGENTS.md.

When unsure: don't save. False memories are worse than missing ones.

## How to save

1. Resolve the memory dir from the `<project-memory>` block's `dir` attribute. If no block is present (no memories yet), the dir is `<project-root>/.opencode/memory/` — create it via `Write` on the first file.
2. Pick a kebab-case slug. First check existing entries — prefer updating a near-duplicate over creating a new file.
3. `Write` the memory file at `<dir>/<slug>.md` using the schema below.
4. In the same turn, update `<dir>/MEMORY.md`: add or replace the line for this slug.

### Memory file schema

```markdown
---
name: <kebab-case-slug>
description: One-line, self-contained hook. Becomes the MEMORY.md index entry.
created: YYYY-MM-DD
tags: [optional, list]
expires: YYYY-MM-DD   # optional pruning hint, not auto-enforced
---

## Context
Why this matters / when it applies.

## Finding / Decision
The thing worth remembering.

## Pointers
- file paths with line numbers
- PR / issue / commit refs
```

### MEMORY.md format

```markdown
# Project Memory

- `<slug>` — <description from frontmatter>
- `<slug>` — <description from frontmatter>
```

The `description` in each entry must match the `description` field of the file's frontmatter. Keep it self-contained — the index hook is what future sessions see without reading the full file.

## Updating an existing memory

1. `Read` the existing file.
2. `Edit` the body (and `description` if it changed).
3. If `description` changed, update the matching line in `MEMORY.md`.

## Removing a memory

Delete the file (via Bash `rm`) and remove its line from `MEMORY.md` in the same turn.
