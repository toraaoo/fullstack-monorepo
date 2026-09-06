import { defineCommand } from "citty"
import {
  type CommonArgs,
  commonArgs,
  toSeedOptions,
  warnMissingTiers,
  withConfig,
} from "#src/cli/options"
import { formatSummary } from "#src/cli/render/summary"
import { seed } from "#src/engine/index"

export default defineCommand({
  meta: {
    name: "run",
    description: "Apply the fixtures, inserting or updating rows",
  },
  args: commonArgs,
  async run({ args }) {
    const common = args as CommonArgs

    await withConfig(common, async (config) => {
      const result = await seed(config, toSeedOptions(common))

      warnMissingTiers(result.missingTiers)

      if (result.results.length === 0) {
        console.log(`no fixtures for ${result.tiers.join(", ")}`)
        return
      }

      const report = formatSummary(result, common.verbose === true)

      console.log(common.quiet ? (report.split("\n").pop() as string) : report)
    })
  },
})
