import { I18nContext } from "nestjs-i18n"
import { vi } from "vitest"

type TranslateArgs = Record<string, unknown> | undefined

function interpolate(template: string, args: TranslateArgs): string {
  if (!args) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in args ? String(args[name]) : match
  )
}

export function stubI18n(catalogue: Record<string, string>): void {
  vi.spyOn(I18nContext, "current").mockReturnValue({
    lang: "en",
    t: (key: string, options?: { args?: TranslateArgs }) =>
      key in catalogue ? interpolate(catalogue[key], options?.args) : key,
  } as unknown as I18nContext)
}

export function stubNoI18n(): void {
  vi.spyOn(I18nContext, "current").mockReturnValue(undefined)
}
