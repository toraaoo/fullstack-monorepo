import { bool, cleanEnv, num, port, str } from "envalid"

interface IEnvConfig {
  APP_NAME: string
  APP_VERSION: string
  APP_PORT: number
  APP_URL: string
  APP_TIMEZONE: string
  NODE_ENV: "development" | "dev" | "staging" | "production" | "test"
  API_DOCS_ENABLED: boolean

  DATABASE_URL: string

  THROTTLER_TTL: number
  THROTTLER_LIMIT: number

  ALLOWED_ORIGINS: string[]
  ALLOWED_METHODS: string[]
  ALLOWED_HEADERS: string[]
  MAX_AGE: number
  CREDENTIALS: boolean
}

let _cachedEnv: IEnvConfig | null = null

/* Reads and validates process.env once, then serves the same frozen object for
   the life of the process. Modules call this at import time (CorsConfig,
   swaggerConfig, LoggerUtils), so a missing or malformed variable fails at
   boot rather than on the first request that happens to need it.

   Every variable carries a default so the app boots with no .env at all --
   useful for tests and a first `bun run dev`. Anything that must not have a
   development default (a real secret, once auth lands) should be declared
   without one, which makes envalid exit at boot when it is absent. */
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
      default: "development",
    }),
    /* Mounts the Scalar API reference at /docs. Defaults to false so an
       environment that never sets it cannot expose the schema by accident;
       .env.example enables it for local development. */
    API_DOCS_ENABLED: bool({ default: false }),

    /* Placeholder for the data layer. Empty by default so the app boots with
       no database; give it no default once a real connection is required. */
    DATABASE_URL: str({ default: "" }),

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

    DATABASE_URL: env.DATABASE_URL,

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
