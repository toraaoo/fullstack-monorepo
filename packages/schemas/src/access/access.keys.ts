export const accessMessages = {
  emailRequired: "access.email.required",
  emailInvalid: "access.email.invalid",
} as const

export type AccessMessage = (typeof accessMessages)[keyof typeof accessMessages]
