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
    name: "reset",
    description:
      "Truncate the tables these fixtures target, then apply them from scratch",
  },
  args: commonArgs,
  async run({ args }) {
    const common = args as CommonArgs

    await withConfig(common, async (config) => {
      const result = await seed(config, {
        ...toSeedOptions(common),
        mode: "reset",
      })

      warnMissingTiers(result.missingTiers)

      if (result.results.length === 0) {
        console.log(`no fixtures for ${result.tiers.join(", ")}`)
        return
      }

      console.log(formatSummary(result, common.verbose === true))
    })
  },
})
