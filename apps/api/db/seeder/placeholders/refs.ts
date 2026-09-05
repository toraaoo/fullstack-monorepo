import { fail } from "../errors"
import type { PlaceholderContext, ResolvedValue } from "../types"

export async function ref(
  argument: string | undefined,
  context: PlaceholderContext
): Promise<ResolvedValue> {
  const parts = (argument ?? "").split(".")

  if (parts.length !== 3) {
    fail(
      `ref needs table.key.column, e.g. {{ref:example_categories.tools.id}}, got "${argument}"`
    )
  }

  const [table, key, column] = parts.map((part) => part.trim())

  return {
    value: await context.lookupRef(table, key, column),
    deterministic: true,
  }
}
