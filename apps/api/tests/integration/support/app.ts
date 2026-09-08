import { CoreModule } from "@core"
import { CorsConfig, HelmetConfig } from "@core/config"
import { versioningConfig } from "@core/versioning"
import type { INestApplication } from "@nestjs/common"
import { Test, type TestingModuleBuilder } from "@nestjs/testing"
import { CustomValidationPipe } from "@shared"
import helmet from "helmet"
import request from "supertest"
import type TestAgent from "supertest/lib/agent"
import { AppModule } from "../../../src/app.module"
import { FixturesController } from "./fixtures.controller"

export interface TestApp {
  app: INestApplication
  http: TestAgent
  close: () => Promise<void>
}

async function boot(builder: TestingModuleBuilder): Promise<TestApp> {
  const moduleRef = await builder.compile()
  const app = moduleRef.createNestApplication({ logger: false })

  app.enableVersioning(versioningConfig)
  app.useGlobalPipes(new CustomValidationPipe())
  app.enableCors(CorsConfig)
  app.use(helmet(HelmetConfig))

  await app.init()

  return {
    app,
    http: request(app.getHttpServer()),
    close: () => app.close(),
  }
}

export function createApp(): Promise<TestApp> {
  return boot(Test.createTestingModule({ imports: [AppModule] }))
}

export function createFixtureApp(): Promise<TestApp> {
  return boot(
    Test.createTestingModule({
      imports: [CoreModule],
      controllers: [FixturesController],
    })
  )
}
