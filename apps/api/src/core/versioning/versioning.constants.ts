export {
  API_MEDIA_TYPE,
  API_VERSION_HEADER,
  API_VERSION_PARAM,
  acceptForVersion,
} from "@workspace/schemas/http"

export const API_VERSIONS = ["1"] as const

export type ApiVersion = (typeof API_VERSIONS)[number]

export const LATEST_API_VERSION: ApiVersion =
  API_VERSIONS[API_VERSIONS.length - 1]

export function isApiVersion(value: string): value is ApiVersion {
  return (API_VERSIONS as readonly string[]).includes(value)
}
