import { I18N_HEADERS } from "../i18n/i18n.constants"
import { getEnv } from "./env"

interface ICorsConfig {
  origin: string | string[]
  methods: string[]
  allowedHeaders: string[]
  maxAge: number
  credentials: boolean
}

const isWildcardOrigin = getEnv().ALLOWED_ORIGINS.includes("*")

const allowedHeaders = [
  ...new Set([...getEnv().ALLOWED_HEADERS, ...I18N_HEADERS]),
]

export const CorsConfig: ICorsConfig = {
  origin: isWildcardOrigin ? "*" : getEnv().ALLOWED_ORIGINS,
  methods: getEnv().ALLOWED_METHODS,
  allowedHeaders,
  maxAge: getEnv().MAX_AGE,
  credentials: getEnv().CREDENTIALS,
}
