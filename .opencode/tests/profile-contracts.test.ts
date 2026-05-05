import { describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const projectRoot = path.resolve(import.meta.dir, "../..")

async function readProjectFile(relativePath: string) {
  return readFile(path.join(projectRoot, relativePath), "utf-8")
}

describe("profile static contracts", () => {
  it("loads the main agent instructions", async () => {
    const content = await readProjectFile("opencode.jsonc")

    expect(content).toContain("AGENTS.md")
  })

  it("does not load the removed learning index", async () => {
    const content = await readProjectFile("opencode.jsonc")

    expect(content).not.toContain(".opencode/learnings")
  })

  it("does not expose learning commands or agents", async () => {
    const commands = await readdir(path.join(projectRoot, ".opencode/commands"))

    expect(commands).not.toContain("learn.md")
    expect(commands).not.toContain("learnings-stats.md")
    expect(existsSync(path.join(projectRoot, ".opencode/agents/learning-extractor.md"))).toBe(false)
  })

  it("does not load npm plugins", async () => {
    const content = await readProjectFile("opencode.jsonc")

    expect(content).not.toContain('"plugin"')
  })
})
