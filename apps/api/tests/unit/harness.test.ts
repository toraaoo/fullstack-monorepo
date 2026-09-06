import { Injectable } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { successResponse } from "@shared"
import { describe, expect, it } from "vitest"

@Injectable()
class Dependency {
  value(): string {
    return "resolved"
  }
}

@Injectable()
class Consumer {
  constructor(private readonly dependency: Dependency) {}

  read(): string {
    return this.dependency.value()
  }
}

describe("test harness", () => {
  it("resolves path aliases", () => {
    expect(successResponse("ok")).toEqual({ success: true, message: "ok" })
  })

  it("emits decorator metadata for nest dependency injection", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [Consumer, Dependency],
    }).compile()

    expect(moduleRef.get(Consumer).read()).toBe("resolved")
  })
})
