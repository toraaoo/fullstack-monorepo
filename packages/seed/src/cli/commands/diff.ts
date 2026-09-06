import { defineCommand } from "citty"
import {
  type CommonArgs,
  commonArgs,
  toSeedOptions,
  warnMissingTiers,
  withConfig,
} from "#src/cli/options"
import { formatDiff } from "#src/cli/render/diff"
import { seed } from "#src/engine/index"

export default defineCommand({
  meta: {
    name: "diff",
    description: "Show what applying the fixtures would change, then roll back",
  },
  args: commonArgs,
  async run({ args }) {
    const common = args as CommonArgs

    await withConfig(common, async (config) => {
      const result = await seed(config, {
        ...toSeedOptions(common),
        mode: "diff",
      })

      warnMissingTiers(result.missingTiers)

      console.log(formatDiff(result))
    })
  },
})
