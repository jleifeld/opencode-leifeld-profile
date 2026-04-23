---
description: Extract, review, and save reusable learnings from the current session
agent: learning-extractor
subtask: true
---

Run the project learning capture workflow.

Follow this sequence strictly:

1. Call `learning_export_session` first.
2. Read `.opencode/learnings/INDEX.md`.
3. Read the exported markdown file returned by the tool.
4. Extract `0-5` reusable, project-specific learnings.
5. If nothing meaningful is found, say so plainly and stop without writing files.
6. Review one candidate at a time and wait for the user after each candidate.
7. Handle replies exactly like this:
   - `y` -> accept
   - `e` -> ask what to change, revise the same candidate, and present it again
   - `n` -> reject
   - `m <slug>` -> merge into `.opencode/learnings/items/<slug>.md`
8. Save accepted learnings under `.opencode/learnings/items/`.
9. Regenerate `.opencode/learnings/INDEX.md` from all files in `.opencode/learnings/items/`.
10. Never modify `.opencode/learnings/.stats.json`.
11. Never write outside `.opencode/learnings/`.

Use this exact review format:

```text
-----------------------------------------------
Candidate [N/M]: <Title>
Category: <category>   Tags: [a, b, c]

Problem:   <1-3 sentences>
Cause:     <1-3 sentences>
Solution:  <concrete fix>
-----------------------------------------------
[y] accept   [e] edit   [n] reject   [m <slug>] merge
```
