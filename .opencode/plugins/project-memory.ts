import type { Plugin } from "@opencode-ai/plugin"
import fs from "fs/promises"
import path from "path"

const MEMORY_DIRNAME = ".opencode/memory"
const INDEX_FILENAME = "MEMORY.md"

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

  return {
    async "experimental.chat.system.transform"(_input, output) {
      const block = await buildMemoryBlock()
      if (block) output.system.push(block)
    },
    async "experimental.session.compacting"(_input, output) {
      const block = await buildMemoryBlock()
      if (block) output.context.push(block)
    },
  }
}
