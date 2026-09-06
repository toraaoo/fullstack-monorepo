import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const LANG = join(__dirname, "../../../src/core/i18n/lang")

const FALLBACK = "en"

const REQUIRED_KEYS = [
  "app.welcome",
  "common.success",
  "common.bad_request",
  "common.unprocessable_entity",
  "common.unauthorized",
  "common.forbidden",
  "common.not_found",
  "common.conflict",
  "common.too_many_requests",
  "common.internal_error",
  "common.service_unavailable",
]

const locales = readdirSync(LANG, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const others = locales.filter((locale) => locale !== FALLBACK)

function filesIn(locale: string): string[] {
  return readdirSync(join(LANG, locale))
    .filter((name) => name.endsWith(".json"))
    .sort()
}

function flatten(value: unknown, prefix: string): Record<string, string> {
  if (typeof value === "string") {
    return { [prefix]: value }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }

  return Object.entries(value).reduce<Record<string, string>>(
    (flat, [name, nested]) =>
      Object.assign(flat, flatten(nested, prefix ? `${prefix}.${name}` : name)),
    {}
  )
}

function catalogue(locale: string): Record<string, string> {
  return filesIn(locale).reduce<Record<string, string>>((all, file) => {
    const contents = readFileSync(join(LANG, locale, file), "utf8")

    return Object.assign(all, flatten(JSON.parse(contents), file.slice(0, -5)))
  }, {})
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

const catalogues = Object.fromEntries(
  locales.map((locale) => [locale, catalogue(locale)])
)

describe("the locale set", () => {
  it("includes the fallback language", () => {
    expect(locales).toContain(FALLBACK)
  })

  it("has more than one locale to keep in step", () => {
    expect(others.length).toBeGreaterThan(0)
  })
})

describe("catalogue files", () => {
  it.each(others)("%s has the same files as en", (locale) => {
    expect(filesIn(locale)).toEqual(filesIn(FALLBACK))
  })
})

describe("no translation drift", () => {
  it.each(others)("%s translates every key en defines", (locale) => {
    const missing = Object.keys(catalogues[FALLBACK]).filter(
      (key) => !(key in catalogues[locale])
    )

    expect(missing).toEqual([])
  })

  it.each(others)("%s defines no key en is missing", (locale) => {
    const extra = Object.keys(catalogues[locale]).filter(
      (key) => !(key in catalogues[FALLBACK])
    )

    expect(extra).toEqual([])
  })

  it.each(others)("%s nests exactly as en does", (locale) => {
    expect(Object.keys(catalogues[locale]).sort()).toEqual(
      Object.keys(catalogues[FALLBACK]).sort()
    )
  })
})

describe("interpolation", () => {
  it.each(others)("%s uses the same placeholders as en", (locale) => {
    const mismatched = Object.keys(catalogues[FALLBACK])
      .filter(
        (key) =>
          key in catalogues[locale] &&
          placeholders(catalogues[FALLBACK][key]).join() !==
            placeholders(catalogues[locale][key]).join()
      )
      .map((key) => ({
        key,
        en: placeholders(catalogues[FALLBACK][key]),
        [locale]: placeholders(catalogues[locale][key]),
      }))

    expect(mismatched).toEqual([])
  })
})

describe("messages the code reaches for", () => {
  it.each(locales)("%s defines every key the API resolves", (locale) => {
    const missing = REQUIRED_KEYS.filter((key) => !(key in catalogues[locale]))

    expect(missing).toEqual([])
  })

  it.each(locales)("%s leaves no message blank", (locale) => {
    const blank = Object.entries(catalogues[locale])
      .filter(([, message]) => message.trim() === "")
      .map(([key]) => key)

    expect(blank).toEqual([])
  })
})
