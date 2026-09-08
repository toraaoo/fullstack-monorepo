import { API_MEDIA_TYPE, API_VERSION_PARAM } from "@workspace/schemas/http"
import { isApiVersion, LATEST_API_VERSION } from "./versioning.constants"

type AcceptEntry = {
  mediaType: string
  version?: string
  quality: number
}

function parseParam(param: string): [string, string] | null {
  const separator = param.indexOf("=")

  if (separator === -1) {
    return null
  }

  const name = param.slice(0, separator).trim().toLowerCase()
  const value = param
    .slice(separator + 1)
    .trim()
    .replace(/^"(.*)"$/, "$1")

  return name && value ? [name, value] : null
}

function parseEntry(value: string): AcceptEntry | null {
  const [range, ...params] = value.split(";")
  const mediaType = range?.trim().toLowerCase()

  if (!mediaType) {
    return null
  }

  const entry: AcceptEntry = { mediaType, quality: 1 }

  for (const param of params) {
    const parsed = parseParam(param)

    if (!parsed) {
      continue
    }

    const [name, raw] = parsed

    if (name === API_VERSION_PARAM) {
      entry.version = raw
      continue
    }

    if (name === "q") {
      const quality = Number.parseFloat(raw)

      if (Number.isFinite(quality)) {
        entry.quality = quality
      }
    }
  }

  return entry
}

function carriesJson(mediaType: string): boolean {
  return (
    mediaType === "*/*" ||
    mediaType === "application/*" ||
    mediaType === API_MEDIA_TYPE ||
    mediaType.endsWith("+json")
  )
}

export function requestedApiVersions(header: string | undefined): string[] {
  if (!header) {
    return []
  }

  const versions = header
    .split(",")
    .map(parseEntry)
    .filter((entry): entry is AcceptEntry => entry !== null)
    .filter(
      (entry) =>
        entry.version !== undefined &&
        entry.quality > 0 &&
        carriesJson(entry.mediaType)
    )
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.version as string)

  return [...new Set(versions)]
}

export function negotiateApiVersion(header: string | undefined): string | null {
  const requested = requestedApiVersions(header)

  if (requested.length === 0) {
    return LATEST_API_VERSION
  }

  return requested.find(isApiVersion) ?? null
}

export function acceptHeaderOf(request: unknown): string | undefined {
  if (typeof request !== "object" || request === null) {
    return undefined
  }

  const headers = (request as { headers?: Record<string, unknown> }).headers
  const accept = headers?.accept

  if (Array.isArray(accept)) {
    return accept.join(",")
  }

  return typeof accept === "string" ? accept : undefined
}
