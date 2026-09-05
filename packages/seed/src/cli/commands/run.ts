import { defineCommand } from "citty"
import { seed } from "../../engine/index.js"
import {
  type CommonArgs,
  commonArgs,
  toSeedOptions,
  warnMissingTiers,
  withConfig,
} from "../options.js"
import { formatSummary } from "../render/summary.js"

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
