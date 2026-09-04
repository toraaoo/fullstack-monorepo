import { join } from "node:path"
import { getEnv } from "@core/config"
import { Module } from "@nestjs/common"
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule as NestI18nModule,
  QueryResolver,
} from "nestjs-i18n"

/* Configures nestjs-i18n with the en catalog and the request-language
   resolvers (?lang query, x-lang header, Accept-Language). Add a locale by
   dropping a sibling folder next to lang/en and listing it under `fallbacks`.

   disableMiddleware is required on the Fastify adapter: the i18n middleware
   sets the language but its async context does not propagate to the route
   handler under Fastify, which would leave I18nContext.current() undefined and
   silently fall back to the default language. With the middleware off,
   nestjs-i18n's global interceptor resolves the language and wraps the handler
   in I18nContext.createAsync, so translations resolve in the controller, the
   validation pipe (CustomValidationPipe), services, and the response handler.

   The loader reads from source rather than dist so the catalogs stay editable
   without a rebuild; that means the process must run with apps/api as its
   working directory, which every script here does. */
@Module({
  imports: [
    NestI18nModule.forRoot({
      fallbackLanguage: "en",
      fallbacks: {
        "en-*": "en",
      },
      disableMiddleware: true,
      loaderOptions: {
        path: join(process.cwd(), "src", "core", "i18n", "lang"),
        watch: getEnv().NODE_ENV !== "production",
      },
      resolvers: [
        new QueryResolver(["lang", "locale"]),
        new HeaderResolver(["x-lang", "x-custom-lang"]),
        AcceptLanguageResolver,
      ],
    }),
  ],
})
export class I18nModule {}
