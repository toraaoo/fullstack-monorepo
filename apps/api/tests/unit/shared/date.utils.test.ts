import { DateUtils } from "@shared/utils/date.utils"
import dayjs from "dayjs"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const NOW = "2026-03-15T12:34:56.000Z"

const at = (iso: string) => dayjs(iso)
const stamp = (date: dayjs.Dayjs) =>
  DateUtils.format(date, "YYYY-MM-DD HH:mm:ss")

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})

afterAll(() => {
  vi.useRealTimers()
})

describe("configuration", () => {
  it("reads the timezone from the environment", () => {
    expect(DateUtils.getConfiguredTimezone()).toBe("UTC")
  })
})

describe("anchors", () => {
  it("reports the current instant", () => {
    expect(DateUtils.now().toISOString()).toBe(NOW)
  })

  it.each([
    ["today", () => DateUtils.today(), "2026-03-15 00:00:00"],
    ["tomorrow", () => DateUtils.tomorrow(), "2026-03-16 00:00:00"],
    ["yesterday", () => DateUtils.yesterday(), "2026-03-14 00:00:00"],
  ])("%s starts the day", (_label, act, expected) => {
    expect(stamp(act())).toBe(expected)
  })
})

describe("parsing", () => {
  it("reads an instant and re-expresses it in the configured zone", () => {
    expect(DateUtils.parse("2026-01-02T03:04:05Z").toISOString()).toBe(
      "2026-01-02T03:04:05.000Z"
    )
  })

  it("reads a wall-clock string as local to the configured zone", () => {
    expect(DateUtils.parseInZone("2026-01-02 03:04:05").toISOString()).toBe(
      "2026-01-02T03:04:05.000Z"
    )
  })

  it("formats with the given pattern", () => {
    expect(DateUtils.format(at("2026-01-02T03:04:05Z"), "DD/MM/YYYY")).toBe(
      "02/01/2026"
    )
  })
})

describe("arithmetic", () => {
  const base = at("2026-03-15T12:00:00Z")

  it.each([
    ["addDays", () => DateUtils.addDays(base, 3), "2026-03-18 12:00:00"],
    ["subDays", () => DateUtils.subDays(base, 3), "2026-03-12 12:00:00"],
    ["addMonths", () => DateUtils.addMonths(base, 2), "2026-05-15 12:00:00"],
    ["subMonths", () => DateUtils.subMonths(base, 2), "2026-01-15 12:00:00"],
    ["addYears", () => DateUtils.addYears(base, 1), "2027-03-15 12:00:00"],
    ["subYears", () => DateUtils.subYears(base, 1), "2025-03-15 12:00:00"],
    ["addHours", () => DateUtils.addHours(base, 5), "2026-03-15 17:00:00"],
    ["subHours", () => DateUtils.subHours(base, 5), "2026-03-15 07:00:00"],
  ])("%s", (_label, act, expected) => {
    expect(stamp(act())).toBe(expected)
  })

  it("clamps a month-end overflow", () => {
    expect(stamp(DateUtils.addMonths(at("2026-01-31T12:00:00Z"), 1))).toBe(
      "2026-02-28 12:00:00"
    )
  })
})

describe("boundaries", () => {
  const base = at("2026-03-15T12:34:56Z")

  it.each([
    ["startOfDay", () => DateUtils.startOfDay(base), "2026-03-15 00:00:00"],
    ["endOfDay", () => DateUtils.endOfDay(base), "2026-03-15 23:59:59"],
    ["startOfMonth", () => DateUtils.startOfMonth(base), "2026-03-01 00:00:00"],
    ["endOfMonth", () => DateUtils.endOfMonth(base), "2026-03-31 23:59:59"],
    ["startOfYear", () => DateUtils.startOfYear(base), "2026-01-01 00:00:00"],
    ["endOfYear", () => DateUtils.endOfYear(base), "2026-12-31 23:59:59"],
  ])("%s", (_label, act, expected) => {
    expect(stamp(act())).toBe(expected)
  })
})

describe("comparison", () => {
  const earlier = at("2026-03-15T10:00:00Z")
  const later = at("2026-03-15T14:00:00Z")

  it("orders two instants", () => {
    expect(DateUtils.isBefore(earlier, later)).toBe(true)
    expect(DateUtils.isAfter(earlier, later)).toBe(false)
    expect(DateUtils.isAfter(later, earlier)).toBe(true)
  })

  it("recognises today, tomorrow and yesterday", () => {
    expect(DateUtils.isToday(at("2026-03-15T23:00:00Z"))).toBe(true)
    expect(DateUtils.isTomorrow(at("2026-03-16T01:00:00Z"))).toBe(true)
    expect(DateUtils.isYesterday(at("2026-03-14T01:00:00Z"))).toBe(true)
  })

  it("rejects a neighbouring day", () => {
    expect(DateUtils.isToday(at("2026-03-16T00:00:00Z"))).toBe(false)
    expect(DateUtils.isTomorrow(at("2026-03-15T23:00:00Z"))).toBe(false)
    expect(DateUtils.isYesterday(at("2026-03-15T01:00:00Z"))).toBe(false)
  })

  it.each([
    ["a valid string", "2026-03-15", true],
    ["an instant", NOW, true],
    ["nonsense", "not a date", false],
    ["null", null, false],
  ])("reads %s as valid: %s", (_label, input, expected) => {
    expect(DateUtils.isValid(input)).toBe(expected)
  })
})

describe("differences", () => {
  const from = at("2026-03-18T15:30:45Z")
  const to = at("2026-03-15T12:00:00Z")

  it.each([
    ["differenceInDays", () => DateUtils.differenceInDays(from, to), 3],
    ["differenceInHours", () => DateUtils.differenceInHours(from, to), 75],
    [
      "differenceInMinutes",
      () => DateUtils.differenceInMinutes(from, to),
      4530,
    ],
    [
      "differenceInSeconds",
      () => DateUtils.differenceInSeconds(from, to),
      271845,
    ],
  ])("%s", (_label, act, expected) => {
    expect(act()).toBe(expected)
  })

  it("is negative when the arguments are reversed", () => {
    expect(DateUtils.differenceInDays(to, from)).toBe(-3)
  })

  it("describes the distance to now in words", () => {
    expect(DateUtils.distanceToNow(at("2026-03-15T10:34:56Z"))).toBe(
      "2 hours ago"
    )
  })

  it("uses the same wording for getDateHuman", () => {
    expect(DateUtils.getDateHuman(at("2026-03-14T12:34:56Z"))).toBe("a day ago")
  })
})

describe("presentation", () => {
  const date = at("2026-03-15T12:34:56Z")

  it.each([
    ["getDate", () => DateUtils.getDate(date), "15 March 2026"],
    ["getTime", () => DateUtils.getTime(date), "12:34"],
    [
      "getDateInformative",
      () => DateUtils.getDateInformative(date),
      "Sunday, March 15, 2026",
    ],
    [
      "getDateTimeInformative",
      () => DateUtils.getDateTimeInformative(date),
      "Sunday, March 15, 2026 12:34",
    ],
  ])("%s", (_label, act, expected) => {
    expect(act()).toBe(expected)
  })

  it("renders a date in another zone", () => {
    expect(DateUtils.getDateWithTimezone(date, "Asia/Seoul")).toBe(
      "15 March 2026"
    )
  })

  it("shifts the day when the other zone has already rolled over", () => {
    expect(
      DateUtils.getDateWithTimezone(at("2026-03-15T20:00:00Z"), "Asia/Seoul")
    ).toBe("16 March 2026")
  })

  it("names the zone alongside the time", () => {
    expect(DateUtils.getDateTimeWithTimezone(date, "Asia/Seoul")).toMatch(
      /^15 March 2026 21:34 /
    )
  })

  it("falls back to the configured zone when given none", () => {
    expect(DateUtils.getDateTimeInformativeWithTimezone(date)).toMatch(
      /^Sunday, March 15, 2026 12:34 /
    )
  })

  it("uses the zone it is given", () => {
    expect(
      DateUtils.getDateTimeInformativeWithTimezone(date, "Asia/Seoul")
    ).toMatch(/^Sunday, March 15, 2026 21:34 /)
  })

  it("names the zone in the informative date", () => {
    expect(
      DateUtils.getDateInformativeWithTimezone(date, "Asia/Seoul")
    ).toMatch(/^Sunday, March 15, 2026 /)
  })
})
