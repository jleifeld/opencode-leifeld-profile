import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { $ } from "bun"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { ProjectMemoryPlugin } from "../plugins/project-memory.ts"

type Hooks = Awaited<ReturnType<typeof ProjectMemoryPlugin>>

async function loadPlugin(root: string): Promise<Hooks> {
  return ProjectMemoryPlugin(
    {
      // Cast because we only exercise directory, worktree, and $ in this plugin.
      client: {} as any,
      project: {} as any,
      directory: root,
      worktree: root,
      experimental_workspace: { register: () => {} } as any,
      serverUrl: new URL("http://localhost"),
      $,
    },
  )
}

async function fireWrite(hooks: Hooks, filePath: string) {
  await hooks["tool.execute.after"]?.(
    { tool: "write", sessionID: "test", callID: "c1", args: { file_path: filePath } },
    { title: "", output: "", metadata: {} },
  )
}

const memoryFile = (name: string, description: string, body = "body") =>
  `---\nname: ${name}\ndescription: ${description}\ncreated: 2026-05-05\n---\n\n${body}\n`

describe("project-memory rebuild", () => {
  let root: string
  let memoryDir: string
  let indexPath: string

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "project-memory-"))
    memoryDir = path.join(root, ".opencode", "memory")
    indexPath = path.join(memoryDir, "MEMORY.md")
    await mkdir(memoryDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it("creates MEMORY.md when a memory file is written", async () => {
    const aPath = path.join(memoryDir, "alpha.md")
    await writeFile(aPath, memoryFile("alpha", "first memory hook"))

    const hooks = await loadPlugin(root)
    await fireWrite(hooks, aPath)

    const index = await readFile(indexPath, "utf8")
    expect(index).toContain("# Project Memory")
    expect(index).toContain("`alpha` — first memory hook")
  })

  it("sorts entries by name and reflects multiple files", async () => {
    await writeFile(path.join(memoryDir, "zebra.md"), memoryFile("zebra", "z hook"))
    await writeFile(path.join(memoryDir, "apple.md"), memoryFile("apple", "a hook"))

    const hooks = await loadPlugin(root)
    await fireWrite(hooks, path.join(memoryDir, "apple.md"))

    const index = await readFile(indexPath, "utf8")
    const appleIdx = index.indexOf("`apple`")
    const zebraIdx = index.indexOf("`zebra`")
    expect(appleIdx).toBeGreaterThan(-1)
    expect(zebraIdx).toBeGreaterThan(appleIdx)
  })

  it("flags malformed frontmatter in a Skipped section", async () => {
    await writeFile(path.join(memoryDir, "good.md"), memoryFile("good", "valid"))
    await writeFile(path.join(memoryDir, "no-frontmatter.md"), "no frontmatter here\n")
    await writeFile(
      path.join(memoryDir, "missing-desc.md"),
      `---\nname: missing-desc\ncreated: 2026-05-05\n---\n\nbody\n`,
    )

    const hooks = await loadPlugin(root)
    await fireWrite(hooks, path.join(memoryDir, "good.md"))

    const index = await readFile(indexPath, "utf8")
    expect(index).toContain("`good` — valid")
    expect(index).toContain("## Skipped (malformed frontmatter)")
    expect(index).toContain("`missing-desc.md` — missing required field: description")
    expect(index).toContain("`no-frontmatter.md`")
  })

  it("removes orphaned entries on the next rebuild", async () => {
    const aPath = path.join(memoryDir, "alpha.md")
    const bPath = path.join(memoryDir, "beta.md")
    await writeFile(aPath, memoryFile("alpha", "a hook"))
    await writeFile(bPath, memoryFile("beta", "b hook"))

    const hooks = await loadPlugin(root)
    await fireWrite(hooks, aPath)

    let index = await readFile(indexPath, "utf8")
    expect(index).toContain("`alpha`")
    expect(index).toContain("`beta`")

    await rm(aPath)
    await fireWrite(hooks, bPath)

    index = await readFile(indexPath, "utf8")
    expect(index).not.toContain("`alpha`")
    expect(index).toContain("`beta`")
  })

  it("ignores writes outside the memory dir", async () => {
    const outside = path.join(root, "src", "foo.md")
    await mkdir(path.dirname(outside), { recursive: true })
    await writeFile(outside, "# unrelated\n")

    const hooks = await loadPlugin(root)
    await fireWrite(hooks, outside)

    await expect(readFile(indexPath, "utf8")).rejects.toThrow()
  })

  it("ignores writes to MEMORY.md itself (no feedback loop)", async () => {
    await writeFile(indexPath, "# stale content\n")

    const hooks = await loadPlugin(root)
    await fireWrite(hooks, indexPath)

    const index = await readFile(indexPath, "utf8")
    expect(index).toBe("# stale content\n")
  })

  it("skips non-write tool calls", async () => {
    await writeFile(path.join(memoryDir, "alpha.md"), memoryFile("alpha", "a hook"))

    const hooks = await loadPlugin(root)
    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID: "test", callID: "c1", args: { file_path: path.join(memoryDir, "alpha.md") } },
      { title: "", output: "", metadata: {} },
    )

    await expect(readFile(indexPath, "utf8")).rejects.toThrow()
  })

  it("system prompt injection includes the rebuilt index", async () => {
    await writeFile(path.join(memoryDir, "alpha.md"), memoryFile("alpha", "a hook"))

    const hooks = await loadPlugin(root)
    await fireWrite(hooks, path.join(memoryDir, "alpha.md"))

    const output: { system: string[] } = { system: [] }
    await hooks["experimental.chat.system.transform"]?.({ model: {} as any }, output)

    expect(output.system.length).toBe(1)
    expect(output.system[0]).toContain("<project-memory")
    expect(output.system[0]).toContain("`alpha` — a hook")
  })
})
