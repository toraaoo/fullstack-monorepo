import { SetMetadata } from "@nestjs/common"

export const RAW_RESPONSE_KEY = "app:raw-response"
export const RESPONSE_MESSAGE_KEY = "app:response-message"
export const RAW_RESPONSE_FLAG = Symbol.for("app.raw-response")

type RawResponseCarrier = { [RAW_RESPONSE_FLAG]?: boolean }

export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true)

export const ResponseMessage = (messageKey: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, messageKey)

export function markRawResponse(request: unknown): void {
  if (typeof request === "object" && request !== null) {
    ;(request as RawResponseCarrier)[RAW_RESPONSE_FLAG] = true
  }
}

export function isRawResponse(request: unknown): boolean {
  return (
    typeof request === "object" &&
    request !== null &&
    (request as RawResponseCarrier)[RAW_RESPONSE_FLAG] === true
  )
}
