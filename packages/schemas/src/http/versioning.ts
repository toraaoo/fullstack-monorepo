export const API_MEDIA_TYPE = "application/json"

export const API_VERSION_PARAM = "v"

export const API_VERSION_HEADER = "x-api-version"

export function acceptForVersion(version: string): string {
  return `${API_MEDIA_TYPE};${API_VERSION_PARAM}=${version}`
}
