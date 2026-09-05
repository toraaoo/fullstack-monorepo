import { env, faker, hash, now, random } from "@workspace/seed"
import { defineFixture, ref } from "../define"

const ownerEmail = env("SEED_OWNER_EMAIL", "demo@example.com")

export default defineFixture("example_items", {
  description:
    "Scaffolding. Local environment: demo data, applied by `seed run local`.",
  rows: [
    {
      reference: "ITEM-0001",
      categoryId: ref("example_categories", "tools"),
      title: "Torque wrench",
      ownerEmail,
      secret: hash("changeme"),
      token: random(48),
      publishedAt: now("-30d"),
      active: true,
      metadata: {
        batch: `batch-${faker.number.int({ min: 1000, max: 9999 })}`,
        grade: faker.helpers.arrayElement(["alpha", "beta", "gamma"]),
        reviewedAt: "2024-01-15",
        tags: [
          "demo",
          faker.helpers.arrayElement(["calibrated", "uncalibrated"]),
        ],
      },
    },
    {
      reference: "ITEM-0002",
      categoryId: ref("example_categories", "materials"),
      title: "Copper foil",
      ownerEmail,
      token: random(48),
      publishedAt: now("-2h"),
      active: true,
      metadata: {
        batch: `batch-${faker.number.int({ min: 1000, max: 9999 })}`,
        grade: faker.helpers.arrayElement(["alpha", "beta"]),
      },
    },
    {
      reference: "ITEM-0003",
      categoryId: ref("example_categories", "archived"),
      title: "Retired fixture",
      ownerEmail,
      publishedAt: now("-1y"),
      active: false,
      metadata: null,
    },
    ...Array.from({ length: 12 }, (_, index) => ({
      reference: `ITEM-${String(index + 4).padStart(4, "0")}`,
      categoryId: ref("example_categories", "tools"),
      title: faker.commerce.productName(),
      ownerEmail,
      token: random(48),
      publishedAt: now(`-${index + 1}d`),
      active: true,
      metadata: { batch: faker.string.alphanumeric(8), generated: true },
    })),
  ],
})
