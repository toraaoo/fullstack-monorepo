import { env, hash, now, once, random } from "#src/authoring/helpers"
import { defineFixture, ref } from "../../define"

export default defineFixture("items", {
  rows: [
    {
      reference: "ITEM-0001",
      categoryId: ref("categories", "tools"),
      title: "Torque wrench",
      ownerEmail: env("SEED_OWNER_EMAIL", "demo@example.com"),
      secret: hash("changeme"),
      token: random(16),
      metadata: { grade: "alpha", tags: ["demo"] },
      publishedAt: now("-30d"),
    },
    {
      reference: "ITEM-0002",
      categoryId: ref("categories", "toys"),
      title: "Spinning top",
      ownerEmail: "demo@example.com",
      metadata: once({ generated: true }),
    },
  ],
})
