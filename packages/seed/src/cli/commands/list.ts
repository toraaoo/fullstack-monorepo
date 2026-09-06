import { defineCommand } from "citty"
import {
  type CommonArgs,
  commonArgs,
  toSeedOptions,
  warnMissingTiers,
  withConfig,
} from "#src/cli/options"
import { formatList } from "#src/cli/render/list"
import { planSeed } from "#src/engine/index"

export default defineCommand({
  meta: {
    name: "list",
    description: "Show the fixtures that would run, in resolved order",
  },
  args: commonArgs,
  async run({ args }) {
    const common = args as CommonArgs

    await withConfig(common, async (config) => {
      const result = await planSeed(config, toSeedOptions(common))

      warnMissingTiers(result.missingTiers)

      console.log(formatList(result))
    })
  },
})
