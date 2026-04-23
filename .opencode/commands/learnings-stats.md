---
description: Show learning usage stats
agent: build
---

Read the learning stats and learning index below, then produce a read-only report.

## Stats

!`cat .opencode/learnings/.stats.json 2>/dev/null || echo '{}'`

## Index

@.opencode/learnings/INDEX.md

Output:

1. A markdown table with the top 5 most-used learnings.
2. A markdown table with unused learnings that are present in the index but missing from stats or have `hits: 0`.
3. A one-line total summary with indexed learnings and tracked learnings.

Do not modify any files.
