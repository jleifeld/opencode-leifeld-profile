import { describe, expect, it } from "bun:test"
import { readFile } from "node:fs/promises"
import path from "node:path"

const projectRoot = path.resolve(import.meta.dir, "../..")

async function readProjectFile(relativePath: string) {
  return readFile(path.join(projectRoot, relativePath), "utf-8")
}

describe("learning system static contracts", () => {
  it("loads the learning index via opencode.jsonc instructions", async () => {
    const content = await readProjectFile("opencode.jsonc")
    expect(content).toContain('".opencode/learnings/INDEX.md"')
  })

  it("adds the learning retrieval policy to AGENTS.md", async () => {
    const content = await readProjectFile("AGENTS.md")
    expect(content).toContain("## Project Learnings")
    expect(content).toContain(".opencode/learnings/items/")
    expect(content).toContain(".opencode/learnings/exports/")
  })

  it("defines the /learn command contract", async () => {
    const content = await readProjectFile(".opencode/commands/learn.md")
    expect(content).toContain("learning_export_session")
    expect(content).toContain("Never modify `.opencode/learnings/.stats.json`")
    expect(content).toContain("[y] accept")
  })

  it("defines the learning-extractor safety boundaries", async () => {
    const content = await readProjectFile(".opencode/agents/learning-extractor.md")
    expect(content).toContain("mode: subagent")
    expect(content).toContain('".opencode/learnings/**": allow')
    expect(content).toContain("Never edit source code")
  })
})
