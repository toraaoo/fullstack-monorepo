import type { ResourceFactory } from "../core/types"
import { healthResource } from "./health"

export const resourceRegistry = {
  health: healthResource,
} satisfies Record<string, ResourceFactory<unknown>>

export type Resources = {
  [K in keyof typeof resourceRegistry]: ReturnType<(typeof resourceRegistry)[K]>
}
