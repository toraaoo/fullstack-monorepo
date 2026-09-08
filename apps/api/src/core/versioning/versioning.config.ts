import { type VersioningOptions, VersioningType } from "@nestjs/common"
import { acceptHeaderOf, negotiateApiVersion } from "./accept-version"
import { API_VERSIONS, LATEST_API_VERSION } from "./versioning.constants"

export const versioningConfig: VersioningOptions = {
  type: VersioningType.CUSTOM,
  defaultVersion: [...API_VERSIONS],
  extractor: (request) =>
    negotiateApiVersion(acceptHeaderOf(request)) ?? LATEST_API_VERSION,
}
