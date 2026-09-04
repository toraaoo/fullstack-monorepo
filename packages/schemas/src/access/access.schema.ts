import { z } from "zod"
import { key } from "../i18n"
import { accessMessages } from "./access.keys"

export const accessRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, key(accessMessages.emailRequired))
    .pipe(z.email(key(accessMessages.emailInvalid))),
})

export type AccessRequest = z.infer<typeof accessRequestSchema>
