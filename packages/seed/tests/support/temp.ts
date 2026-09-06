import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { afterAll } from "vitest"

const ROOT = join(import.meta.dirname, "..", ".tmp")

const created: string[] = []

afterAll(async () => {
  await Promise.all(
    created
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

export type TreeInput = Record<string, string>

export async function tempTree(tree: TreeInput = {}): Promise<string> {
  await mkdir(ROOT, { recursive: true })

  const directory = await mkdtemp(join(ROOT, "case-"))

  created.push(directory)

  await writeTree(directory, tree)

  return directory
}

export async function writeTree(
  directory: string,
  tree: TreeInput
): Promise<void> {
  for (const [path, contents] of Object.entries(tree)) {
    const target = join(directory, path)

    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents, "utf8")
  }
}
