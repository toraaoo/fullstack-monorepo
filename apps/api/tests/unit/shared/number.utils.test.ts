import { NumberUtils } from "@shared/utils/number.utils"
import { afterEach, describe, expect, it } from "vitest"

afterEach(() => {
  NumberUtils.useLocale("en-US")
  NumberUtils.useCurrency("$")
})

describe("abbreviate", () => {
  it.each([
    [0, "0.00"],
    [999, "999.00"],
    [1000, "1.00K"],
    [1500, "1.50K"],
    [1_000_000, "1.00M"],
    [2_500_000_000, "2.50B"],
    [1_000_000_000_000, "1.00T"],
  ])("turns %i into %s", (input, expected) => {
    expect(NumberUtils.abbreviate(input)).toBe(expected)
  })

  it("stops at trillions rather than inventing a larger unit", () => {
    expect(NumberUtils.abbreviate(1_500_000_000_000_000)).toBe("1500.00T")
  })

  it("honours the requested precision", () => {
    expect(NumberUtils.abbreviate(1500, 0)).toBe("2K")
  })
})

describe("clamp", () => {
  it.each([
    [5, 0, 10, 5],
    [-1, 0, 10, 0],
    [11, 0, 10, 10],
    [0, 0, 10, 0],
    [10, 0, 10, 10],
  ])("clamps %i between %i and %i", (value, min, max, expected) => {
    expect(NumberUtils.clamp(value, min, max)).toBe(expected)
  })
})

describe("currency", () => {
  it("prefixes the symbol and fixes the decimals", () => {
    expect(NumberUtils.currency(12.5)).toBe("$12.50")
  })

  it("takes an explicit symbol and precision", () => {
    expect(NumberUtils.currency(12.5, "€", 0)).toBe("€13")
  })
})

describe("fileSize", () => {
  it.each([
    [0, "0 Bytes"],
    [512, "512 Bytes"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [1_048_576, "1 MB"],
    [1_073_741_824, "1 GB"],
  ])("renders %i bytes as %s", (bytes, expected) => {
    expect(NumberUtils.fileSize(bytes)).toBe(expected)
  })

  it("trims trailing zeroes rather than padding", () => {
    expect(NumberUtils.fileSize(2048, 4)).toBe("2 KB")
  })
})

describe("format and forHumans", () => {
  it("groups thousands and fixes the decimals", () => {
    expect(NumberUtils.format(1234.5)).toBe("1,234.50")
  })

  it("takes a one-off locale", () => {
    expect(NumberUtils.format(1234.5, 2, "de-DE")).toBe("1.234,50")
  })

  it("groups without forcing decimals", () => {
    expect(NumberUtils.forHumans(1_234_567)).toBe("1,234,567")
  })

  it("spells out as a grouped decimal, not as words", () => {
    expect(NumberUtils.spell(1234)).toBe("1,234")
  })
})

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [101, "101st"],
    [111, "111th"],
  ])("suffixes %i as %s", (input, expected) => {
    expect(NumberUtils.ordinal(input)).toBe(expected)
  })
})

describe("pairs", () => {
  it("walks consecutive values", () => {
    expect(NumberUtils.pairs([1, 2, 3])).toEqual([
      [1, 2],
      [2, 3],
    ])
  })

  it.each([
    ["an empty array", []],
    ["a single value", [1]],
  ])("returns nothing for %s", (_label, input) => {
    expect(NumberUtils.pairs(input)).toEqual([])
  })
})

describe("percentage", () => {
  it("renders a share of a whole", () => {
    expect(NumberUtils.percentage(1, 3)).toBe("33.33%")
  })

  it("honours the requested precision", () => {
    expect(NumberUtils.percentage(1, 3, 0)).toBe("33%")
  })
})

describe("trim", () => {
  it("truncates rather than rounds", () => {
    expect(NumberUtils.trim(1.239)).toBe(1.23)
  })

  it("floors, so negatives move away from zero", () => {
    expect(NumberUtils.trim(-1.234)).toBe(-1.24)
  })

  it("honours the requested precision", () => {
    expect(NumberUtils.trim(1.2399, 3)).toBe(1.239)
  })
})

describe("configured defaults", () => {
  it("changes the locale every later call reads", () => {
    NumberUtils.useLocale("de-DE")

    expect(NumberUtils.forHumans(1234.5)).toBe("1.234,5")
  })

  it("changes the currency withCurrency reads", () => {
    NumberUtils.useCurrency("£")

    expect(NumberUtils.withCurrency(9.5)).toBe("£9.50")
  })

  it("still takes a one-off symbol over the configured one", () => {
    NumberUtils.useCurrency("£")

    expect(NumberUtils.withCurrency(9.5, "¥")).toBe("¥9.50")
  })

  it("formats for a one-off locale without changing the default", () => {
    expect(NumberUtils.withLocale(1234.5, "de-DE")).toBe("1.234,5")
    expect(NumberUtils.forHumans(1234.5)).toBe("1,234.5")
  })
})
