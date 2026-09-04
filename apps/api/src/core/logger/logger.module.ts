import { Module } from "@nestjs/common"
import { LoggerModule as PinoLoggerModule } from "nestjs-pino"
import { getEnv } from "../config"
import { resolveRequestId } from "../request-context/request-context.module"

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      useFactory: () => {
        const env = getEnv()
        const isDevelopment = ["development", "dev"].includes(env.NODE_ENV)

        return {
          pinoHttp: {
            level: env.LOG_LEVEL,
            genReqId: (req) => resolveRequestId(req),
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "res.headers['set-cookie']",
            ],
            customLogLevel: (_req, res, error) => {
              if (error || res.statusCode >= 500) return "error"
              if (res.statusCode >= 400) return "warn"
              return "info"
            },
            transport: isDevelopment
              ? {
                  target: "pino-pretty",
                  options: { singleLine: true, translateTime: "SYS:standard" },
                }
              : undefined,
          },
        }
      },
    }),
  ],
})
export class LoggerModule {}
