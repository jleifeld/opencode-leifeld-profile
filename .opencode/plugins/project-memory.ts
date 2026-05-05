import type { Plugin } from "@opencode-ai/plugin"
import fs from "fs/promises"
import path from "path"
import YAML from "yaml"

const MEMORY_DIRNAME = ".opencode/memory"
const INDEX_FILENAME = "MEMORY.md"

type MemoryEntry = {
  file: string
  name: string
  description: string
}

type MalformedEntry = {
  file: string
  reason: string
}

export const ProjectMemoryPlugin: Plugin = async ({ directory, worktree, $ }) => {
  let cachedRoot: string | undefined

  const resolveProjectRoot = async (): Promise<string> => {
    if (cachedRoot) return cachedRoot
    const fallback = worktree || directory
    try {
      const result = await $`git -C ${directory} rev-parse --show-toplevel`.nothrow().quiet()
      if (result.exitCode === 0) {
        const root = result.stdout.toString().trim()
        if (root) {
          cachedRoot = root
          return root
        }
      }
    } catch {
      // ignore — fall back below
    }
    cachedRoot = fallback
    return fallback
  }

  const buildMemoryBlock = async (): Promise<string | null> => {
    const root = await resolveProjectRoot()
    const memoryDir = path.join(root, MEMORY_DIRNAME)
    const indexPath = path.join(memoryDir, INDEX_FILENAME)
    let index: string
    try {
      index = await fs.readFile(indexPath, "utf8")
    } catch {
      return null
    }
    const trimmed = index.trim()
    if (!trimmed) return null
    return [
      `<project-memory project="${path.basename(root)}" root="${root}" dir="${memoryDir}">`,
      trimmed,
      ``,
      `To read a memory, use Read on ${memoryDir}/<slug>.md.`,
      `To save or update one, follow the project-memory skill.`,
      `</project-memory>`,
    ].join("\n")
  }

  const isInsideMemoryDir = (absPath: string, memoryDir: string): boolean => {
    if (absPath === memoryDir) return false
    return (absPath + path.sep).startsWith(memoryDir + path.sep)
  }

  const parseFrontmatter = async (
    filePath: string,
  ): Promise<{ entry?: MemoryEntry; reason?: string }> => {
    let raw: string
    try {
      raw = await fs.readFile(filePath, "utf8")
    } catch (err: any) {
      return { reason: `read failed: ${err?.code ?? err?.message ?? "unknown"}` }
    }

    if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
      return { reason: "missing frontmatter block" }
    }
    const closing = raw.indexOf("\n---", 4)
    if (closing < 0) {
      return { reason: "unterminated frontmatter block" }
    }
    const yamlBody = raw.slice(raw.indexOf("\n") + 1, closing)

    let parsed: any
    try {
      parsed = YAML.parse(yamlBody)
    } catch (err: any) {
      return { reason: `YAML parse error: ${err?.message ?? "unknown"}` }
    }
    if (!parsed || typeof parsed !== "object") {
      return { reason: "frontmatter is not a mapping" }
    }
    const name = typeof parsed.name === "string" ? parsed.name.trim() : ""
    const description = typeof parsed.description === "string" ? parsed.description.trim() : ""
    if (!name) return { reason: "missing required field: name" }
    if (!description) return { reason: "missing required field: description" }

    return {
      entry: {
        file: path.basename(filePath),
        name,
        description: description.replace(/\s+/g, " "),
      },
    }
  }

  const renderIndex = (entries: MemoryEntry[], malformed: MalformedEntry[]): string => {
    const lines: string[] = ["# Project Memory", ""]
    if (entries.length === 0 && malformed.length === 0) {
      return lines.join("\n") + "\n"
    }
    for (const entry of entries) {
      lines.push(`- \`${entry.name}\` — ${entry.description}`)
    }
    if (malformed.length > 0) {
      if (entries.length > 0) lines.push("")
      lines.push("## Skipped (malformed frontmatter)")
      lines.push("")
      for (const bad of malformed) {
        lines.push(`- \`${bad.file}\` — ${bad.reason}`)
      }
    }
    return lines.join("\n") + "\n"
  }

  const rebuildIndex = async (memoryDir: string, indexPath: string): Promise<void> => {
    let files: string[]
    try {
      files = await fs.readdir(memoryDir)
    } catch {
      return
    }
    const candidates = files
      .filter((f) => f.endsWith(".md") && f !== INDEX_FILENAME)
      .map((f) => path.join(memoryDir, f))
      .sort()

    const entries: MemoryEntry[] = []
    const malformed: MalformedEntry[] = []
    for (const filePath of candidates) {
      const result = await parseFrontmatter(filePath)
      if (result.entry) entries.push(result.entry)
      else malformed.push({ file: path.basename(filePath), reason: result.reason ?? "unknown error" })
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    malformed.sort((a, b) => a.file.localeCompare(b.file))

    const rendered = renderIndex(entries, malformed)
    const tmpPath = indexPath + ".tmp"
    try {
      await fs.writeFile(tmpPath, rendered, "utf8")
      await fs.rename(tmpPath, indexPath)
    } catch (err) {
      console.error("[project-memory] failed to write MEMORY.md:", err)
      try {
        await fs.unlink(tmpPath)
      } catch {
        // ignore
      }
    }
  }

  return {
    async "experimental.chat.system.transform"(_input, output) {
      const block = await buildMemoryBlock()
      if (block) output.system.push(block)
    },
    async "experimental.session.compacting"(_input, output) {
      const block = await buildMemoryBlock()
      if (block) output.context.push(block)
    },
    async "tool.execute.after"(input, _output) {
      if (input.tool !== "write" && input.tool !== "edit") return
      const filePath = input.args?.file_path
      if (typeof filePath !== "string" || !filePath) return
      if (!filePath.endsWith(".md")) return

      const root = await resolveProjectRoot()
      const memoryDir = path.join(root, MEMORY_DIRNAME)
      const indexPath = path.join(memoryDir, INDEX_FILENAME)

      const abs = path.resolve(filePath)
      if (!isInsideMemoryDir(abs, memoryDir)) return
      if (abs === indexPath) return

      await rebuildIndex(memoryDir, indexPath)
    },
  }
}
