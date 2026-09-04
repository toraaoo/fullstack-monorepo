import { Module } from "@nestjs/common"

/* Seam for the database connection -- and only the connection. Register the
   client here as a provider, export it, and import DatabaseModule from the
   feature modules that need it.

   Repositories deliberately do not live here. Upstream keeps every schema and
   every repository in one `libs/repositories` tree, which means a change to
   users touches that tree and the users feature both. Instead a repository
   belongs beside the feature that owns it:

     src/modules/users/
       users.controller.ts
       users.service.ts
       users.repository.ts   <- injects the client from this module
       users.schema.ts
       dto/

   When an ORM lands: register the connection below, give DATABASE_URL a real
   (defaultless) declaration in src/core/config so a missing connection string fails
   at boot, and add the db probe in src/health/health.controller.ts. */
@Module({
  providers: [],
  exports: [],
})
export class DatabaseModule {}
