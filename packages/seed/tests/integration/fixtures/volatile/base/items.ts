import { hash, random, sql, uuid } from "#src/authoring/helpers"
import { defineFixture, ref } from "../../define"

export default defineFixture("items", {
  rows: [
    {
      reference: "ITEM-0001",
      categoryId: ref("categories", "tools"),
      title: "Torque wrench",
      ownerEmail: "demo@example.com",
      secret: hash("changeme"),
      token: random(16),
      publishedAt: sql("NOW()"),
      metadata: { id: uuid("stable-item") },
    },
  ],
})
