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
