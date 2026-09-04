import { bool, cleanEnv, num, port, str } from "envalid"

interface IEnvConfig {
  APP_NAME: string
  APP_VERSION: string
  APP_PORT: number
  APP_URL: string
  APP_TIMEZONE: string
  NODE_ENV: "development" | "dev" | "staging" | "production" | "test"
  API_DOCS_ENABLED: boolean
  API_DEBUG_ERRORS: boolean
  LOG_LEVEL: string

  DATABASE_URL: string
  DATABASE_POOL_MAX: number
  DATABASE_SSL: boolean
  DATABASE_PREPARE: boolean

  THROTTLER_TTL: number
  THROTTLER_LIMIT: number

  ALLOWED_ORIGINS: string[]
  ALLOWED_METHODS: string[]
  ALLOWED_HEADERS: string[]
  MAX_AGE: number
  CREDENTIALS: boolean
}

const DEVELOPMENT_ENVS = ["development", "dev", "test"]

export function isDevelopment(nodeEnv: string): boolean {
  return DEVELOPMENT_ENVS.includes(nodeEnv)
}

let _cachedEnv: IEnvConfig | null = null

export function getEnv(): IEnvConfig {
  if (_cachedEnv) return _cachedEnv

  const env = cleanEnv(process.env, {
    APP_NAME: str({ default: "API" }),
    APP_VERSION: str({ default: "1.0.0" }),
    APP_PORT: port({ default: 8001 }),
    APP_URL: str({ default: "http://localhost:8001" }),
    APP_TIMEZONE: str({ default: "UTC" }),
    NODE_ENV: str({
      choices: ["development", "dev", "staging", "production", "test"],
      default: "production",
    }),
    API_DOCS_ENABLED: bool({ default: false }),
    API_DEBUG_ERRORS: bool({ default: undefined }),

    LOG_LEVEL: str({
      choices: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
      default: "info",
    }),

    DATABASE_URL: str(),
    DATABASE_POOL_MAX: num({ default: 10 }),
    DATABASE_SSL: bool({ default: false }),
    DATABASE_PREPARE: bool({ default: true }),

    THROTTLER_TTL: num({ default: 60 }),
    THROTTLER_LIMIT: num({ default: 60 }),

    ALLOWED_ORIGINS: str({ default: "*" }),
    ALLOWED_METHODS: str({ default: "GET,POST,PUT,PATCH,DELETE,OPTIONS" }),
    ALLOWED_HEADERS: str({ default: "Content-Type,Authorization" }),
    MAX_AGE: num({ default: 3600 }),
    CREDENTIALS: bool({ default: false }),
  })

  const list = (value: string): string[] =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

  _cachedEnv = {
    APP_NAME: env.APP_NAME,
    APP_VERSION: env.APP_VERSION,
    APP_PORT: env.APP_PORT,
    APP_URL: env.APP_URL,
    APP_TIMEZONE: env.APP_TIMEZONE,
    NODE_ENV: env.NODE_ENV,
    API_DOCS_ENABLED: env.API_DOCS_ENABLED,
    API_DEBUG_ERRORS: env.API_DEBUG_ERRORS ?? isDevelopment(env.NODE_ENV),
    LOG_LEVEL: env.LOG_LEVEL,

    DATABASE_URL: env.DATABASE_URL,
    DATABASE_POOL_MAX: env.DATABASE_POOL_MAX,
    DATABASE_SSL: env.DATABASE_SSL,
    DATABASE_PREPARE: env.DATABASE_PREPARE,

    THROTTLER_TTL: env.THROTTLER_TTL,
    THROTTLER_LIMIT: env.THROTTLER_LIMIT,

    ALLOWED_ORIGINS: list(env.ALLOWED_ORIGINS),
    ALLOWED_METHODS: list(env.ALLOWED_METHODS),
    ALLOWED_HEADERS: list(env.ALLOWED_HEADERS),
    MAX_AGE: env.MAX_AGE,
    CREDENTIALS: env.CREDENTIALS,
  }

  return _cachedEnv
}
