#!/usr/bin/env bun
import { defineCommand, runMain } from "citty"
import diff from "#src/cli/commands/diff"
import list from "#src/cli/commands/list"
import reset from "#src/cli/commands/reset"
import run from "#src/cli/commands/run"
import { SeedError } from "#src/errors"

const main = defineCommand({
  meta: {
    name: "seed",
    description:
      "Seed a database from TypeScript fixtures. Always applies the base tier; naming an environment also applies that tier.",
  },
  subCommands: { run, diff, reset, list },
})

runMain(main).catch((error: unknown) => {
  console.error(
    error instanceof SeedError ? `seed failed: ${error.message}` : error
  )

  process.exitCode = 1
})
