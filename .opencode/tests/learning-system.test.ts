import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { LearningSystem } from "../plugins/learning-system"

function createToolContext(directory: string) {
  return {
    sessionID: "session-123",
    messageID: "message-123",
    agent: "learning-extractor",
    directory,
    worktree: directory,
    abort: new AbortController().signal,
    metadata() {},
    ask() {
      return undefined as never
    },
  } as any
}

function createMessage(role: "user" | "assistant", parts: any[]) {
  return {
    info: {
      id: `${role}-${Math.random().toString(36).slice(2, 8)}`,
      role,
      time: {
        created: Date.now(),
      },
    },
    parts,
  }
}

function createClient(
  messages: any[] | Record<string, any[]>,
  sessions: any[] = [],
  titles: Record<string, string> = {},
) {
  return {
    session: {
      async list(input: any) {
        if (!input?.query?.directory) {
          return {
            data: undefined,
            error: { name: "BadRequestError" },
          }
        }

        return {
          data: sessions,
          error: undefined,
        }
      },
      async get(input: any) {
        const sessionID = input?.path?.id

        if (!input?.query?.directory || !sessionID || sessionID === "current") {
          return {
            data: undefined,
            error: { name: "NotFoundError" },
          }
        }

        return {
          data: {
            title: titles[sessionID] ?? "Learning Test Session",
          },
          error: undefined,
        }
      },
      async messages(input: any) {
        const sessionID = input?.path?.id

        if (!input?.query?.directory || !sessionID || sessionID === "current") {
          return {
            data: undefined,
            error: { name: "NotFoundError" },
          }
        }

        return {
          data: Array.isArray(messages) ? messages : (messages[sessionID] ?? []),
          error: undefined,
        }
      },
    },
  }
}

async function createPlugin(
  directory: string,
  messages: any[] | Record<string, any[]> = [],
  sessions: any[] = [],
  titles: Record<string, string> = {},
) {
  return LearningSystem({
    client: createClient(messages, sessions, titles),
    directory,
    worktree: directory,
    project: {} as any,
    experimental_workspace: { register() {} },
    serverUrl: new URL("http://localhost"),
    $: {} as any,
  } as any)
}

describe("LearningSystem plugin", () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "learning-system-"))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it("exports the current session to markdown and filters unsupported parts", async () => {
    const longOutput = `Authorization: Bearer secret-token\n${"x".repeat(1400)}`

    const messages = [
      createMessage("user", [{ type: "text", text: "Please debug pnpm setup" }]),
      createMessage("assistant", [
        { type: "text", text: "I found the root cause." },
        {
          type: "tool",
          tool: "read",
          state: {
            status: "completed",
            input: { filePath: "package.json" },
            output: longOutput,
            title: "Read file",
            metadata: {},
            time: { start: Date.now(), end: Date.now() },
          },
        },
        {
          type: "subtask",
          agent: "explore",
          description: "Inspect files",
          prompt: "Inspect files",
          command: "/inspect-files",
        },
        { type: "reasoning", text: "internal reasoning should not be exported" },
      ]),
    ]

    const plugin = await createPlugin(tempDir, messages)
    const context = createToolContext(tempDir)
    const result = await plugin.tool!.learning_export_session.execute({}, context)

    expect(result).toContain(".opencode/learnings/exports/")

    const match = result.match(/Saved session export to (.+) \(\d+ messages\)/)
    expect(match).not.toBeNull()

    const exportPath = path.join(tempDir, match![1])
    const content = await readFile(exportPath, "utf-8")

    expect(content).toContain("# Session Export")
    expect(content).toContain("## User")
    expect(content).toContain("## Assistant")
    expect(content).toContain("### Tool: read")
    expect(content).toContain("### Subtask: explore")
    expect(content).toContain("Authorization: [redacted]")
    expect(content).toContain("[output truncated]")
    expect(content).not.toContain("internal reasoning should not be exported")
  })

  it("bootstraps the learning index and exports the parent session for current child sessions", async () => {
    const messages = {
      "parent-session": [
        createMessage("user", [{ type: "text", text: "Please save the useful fix." }]),
        createMessage("assistant", [{ type: "text", text: "The root cause was the broken cache key." }]),
      ],
      "child-session": [
        createMessage("user", [{ type: "text", text: "Run the project learning capture workflow." }]),
      ],
    }
    const sessions = [
      {
        id: "parent-session",
        time: { created: 1, updated: 1 },
      },
      {
        id: "child-session",
        parentID: "parent-session",
        time: { created: 2, updated: 2 },
      },
    ]

    const plugin = await createPlugin(tempDir, messages, sessions, {
      "parent-session": "Useful Debug Session",
      "child-session": "Learn Command Session",
    })
    const context = createToolContext(tempDir)
    context.sessionID = "current"

    const result = await plugin.tool!.learning_export_session.execute({}, context)
    const indexPath = path.join(tempDir, ".opencode/learnings/INDEX.md")
    const indexContent = await readFile(indexPath, "utf-8")
    const match = result.match(/Saved session export to (.+) \(\d+ messages\)/)
    const exportPath = path.join(tempDir, match![1])
    const exportContent = await readFile(exportPath, "utf-8")

    expect(result).toContain("parent-session")
    expect(indexContent).toContain("# Project Learnings Index")
    expect(indexContent).toContain("Run `/learn` after solving a non-obvious problem")
    expect(exportContent).toContain("Useful Debug Session")
    expect(exportContent).toContain("broken cache key")
    expect(exportContent).not.toContain("Run the project learning capture workflow.")
  })

  it("increments stats for reads inside learnings items", async () => {
    const plugin = await createPlugin(tempDir)
    const itemsDir = path.join(tempDir, ".opencode/learnings/items")
    const itemPath = path.join(itemsDir, "tooling-corepack-before-pnpm.md")

    await mkdir(itemsDir, { recursive: true })
    await writeFile(itemPath, "# test\n", "utf-8")

    await plugin["tool.execute.after"]!(
      {
        tool: "read",
        sessionID: "session-123",
        callID: "call-123",
        args: { filePath: itemPath },
      } as any,
      {
        title: "Read file",
        output: "# test",
        metadata: {},
      } as any,
    )

    const statsPath = path.join(tempDir, ".opencode/learnings/.stats.json")
    const stats = JSON.parse(await readFile(statsPath, "utf-8"))

    expect(stats["tooling-corepack-before-pnpm"].hits).toBe(1)
    expect(stats["tooling-corepack-before-pnpm"].first_used).toBeTruthy()
    expect(stats["tooling-corepack-before-pnpm"].last_used).toBeTruthy()
  })

  it("ignores reads outside learnings items", async () => {
    const plugin = await createPlugin(tempDir)
    const learningsDir = path.join(tempDir, ".opencode/learnings")
    const exportsDir = path.join(learningsDir, "exports")
    const indexPath = path.join(learningsDir, "INDEX.md")
    const exportPath = path.join(exportsDir, "2026-04-23_session-123.md")

    await mkdir(exportsDir, { recursive: true })
    await writeFile(indexPath, "# index\n", "utf-8")
    await writeFile(exportPath, "# export\n", "utf-8")

    await plugin["tool.execute.after"]!(
      {
        tool: "read",
        sessionID: "session-123",
        callID: "call-1",
        args: { filePath: indexPath },
      } as any,
      { title: "Read file", output: "# index", metadata: {} } as any,
    )

    await plugin["tool.execute.after"]!(
      {
        tool: "read",
        sessionID: "session-123",
        callID: "call-2",
        args: { filePath: exportPath },
      } as any,
      { title: "Read file", output: "# export", metadata: {} } as any,
    )

    const statsPath = path.join(tempDir, ".opencode/learnings/.stats.json")
    expect(existsSync(statsPath)).toBe(false)
  })
})
