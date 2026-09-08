import {
  acceptForVersion,
  acceptHeaderOf,
  LATEST_API_VERSION,
  negotiateApiVersion,
  requestedApiVersions,
} from "@core/versioning"
import { describe, expect, it } from "vitest"

describe("the Accept value clients are told to send", () => {
  it("puts the version in a media type parameter", () => {
    expect(acceptForVersion("1")).toBe("application/json;v=1")
  })
})

describe("reading versions out of Accept", () => {
  it("finds none when the client names none", () => {
    expect(requestedApiVersions(undefined)).toEqual([])
    expect(requestedApiVersions("application/json")).toEqual([])
    expect(requestedApiVersions("*/*")).toEqual([])
  })

  it("reads the parameter whatever order and shape it arrives in", () => {
    expect(requestedApiVersions("application/json;v=2")).toEqual(["2"])
    expect(requestedApiVersions("application/json;q=0.8;v=2")).toEqual(["2"])
    expect(requestedApiVersions(' Application/JSON ; V = "2" ')).toEqual(["2"])
  })

  it("looks at every media type that could carry JSON", () => {
    expect(requestedApiVersions("*/*;v=2")).toEqual(["2"])
    expect(requestedApiVersions("application/*;v=2")).toEqual(["2"])
    expect(requestedApiVersions("application/hal+json;v=2")).toEqual(["2"])
    expect(requestedApiVersions("text/html;v=2")).toEqual([])
  })

  it("orders candidates by quality, best first", () => {
    expect(
      requestedApiVersions(
        "application/json;v=1;q=0.5, application/json;v=3, application/json;v=2;q=0.8"
      )
    ).toEqual(["3", "2", "1"])
  })

  it("drops a candidate the client explicitly refuses", () => {
    expect(
      requestedApiVersions("application/json;v=2;q=0, application/json;v=1")
    ).toEqual(["1"])
  })
})

describe("negotiating a version", () => {
  it("falls back to the latest when the client names none", () => {
    expect(negotiateApiVersion(undefined)).toBe(LATEST_API_VERSION)
    expect(negotiateApiVersion("application/json")).toBe(LATEST_API_VERSION)
  })

  it("takes the best supported candidate, not simply the first", () => {
    expect(
      negotiateApiVersion(
        `application/json;v=99, ${acceptForVersion(LATEST_API_VERSION)};q=0.5`
      )
    ).toBe(LATEST_API_VERSION)
  })

  it("refuses when every candidate is unknown", () => {
    expect(negotiateApiVersion("application/json;v=99")).toBeNull()
  })
})

describe("pulling Accept off a request", () => {
  it("reads the header, however the platform hands it over", () => {
    expect(acceptHeaderOf({ headers: { accept: "application/json" } })).toBe(
      "application/json"
    )
    expect(acceptHeaderOf({ headers: { accept: ["a/b", "c/d"] } })).toBe(
      "a/b,c/d"
    )
  })

  it("yields nothing when there is no header to read", () => {
    expect(acceptHeaderOf(undefined)).toBeUndefined()
    expect(acceptHeaderOf({})).toBeUndefined()
  })
})
