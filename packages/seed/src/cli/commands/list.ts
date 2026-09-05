import { defineCommand } from "citty"
import { planSeed } from "../../engine/index.js"
import {
  type CommonArgs,
  commonArgs,
  toSeedOptions,
  warnMissingTiers,
  withConfig,
} from "../options.js"
import { formatList } from "../render/list.js"

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
