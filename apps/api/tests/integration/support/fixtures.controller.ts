import { Body, Controller, Get, Post, Query } from "@nestjs/common"
import { ApiException, RawResponse, ResponseMessage } from "@shared"
import { createZodDto } from "nestjs-zod"
import { z } from "zod"

const signUpSchema = z.object({
  email: z.email(),
  age: z.number().int().min(18),
  profile: z.object({ name: z.string().min(2) }).optional(),
})

const searchSchema = z.object({ term: z.string().min(3) })

export class SignUpDto extends createZodDto(signUpSchema) {}
export class SearchDto extends createZodDto(searchSchema) {}

@Controller("fixtures")
export class FixturesController {
  @Post("sign-up")
  signUp(@Body() body: SignUpDto) {
    return body
  }

  @Get("search")
  search(@Query() query: SearchDto) {
    return query
  }

  @Get("boom")
  boom(): never {
    throw new Error("kaboom")
  }

  @Get("conflict")
  conflict(): never {
    throw new ApiException(409, {
      code: "CONFLICT",
      messageKey: "common.conflict",
    })
  }

  @Get("explicit-message")
  explicitMessage(): never {
    throw new ApiException(409, {
      code: "CONFLICT",
      message: "That reference is already taken",
    })
  }

  @Get("translated")
  @ResponseMessage("common.not_found")
  translated() {
    return { ok: true }
  }

  @Get("raw")
  @RawResponse()
  raw() {
    return { untouched: true }
  }

  @Get("no-content")
  noContent() {
    return undefined
  }

  @Get("ping-a")
  pingA() {
    return { ping: "a" }
  }

  @Get("ping-b")
  pingB() {
    return { ping: "b" }
  }
}
