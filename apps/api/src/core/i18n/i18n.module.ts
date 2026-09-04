import { join } from "node:path"
import { getEnv } from "@core/config"
import { Module } from "@nestjs/common"
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule as NestI18nModule,
  QueryResolver,
} from "nestjs-i18n"
import { I18N_HEADERS, I18N_QUERY_PARAMS } from "./i18n.constants"

@Module({
  imports: [
    NestI18nModule.forRoot({
      fallbackLanguage: "en",
      fallbacks: {
        "en-*": "en",
      },
      loaderOptions: {
        path: join(process.cwd(), "src", "core", "i18n", "lang"),
        watch: getEnv().NODE_ENV !== "production",
      },
      resolvers: [
        new QueryResolver([...I18N_QUERY_PARAMS]),
        new HeaderResolver([...I18N_HEADERS]),
        AcceptLanguageResolver,
      ],
    }),
  ],
})
export class I18nModule {}
