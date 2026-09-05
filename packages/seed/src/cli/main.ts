#!/usr/bin/env bun
import { defineCommand, runMain } from "citty"
import { SeedError } from "../errors.js"
import diff from "./commands/diff.js"
import list from "./commands/list.js"
import reset from "./commands/reset.js"
import run from "./commands/run.js"

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
