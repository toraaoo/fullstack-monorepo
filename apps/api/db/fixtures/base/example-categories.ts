import { uuid } from "@workspace/seed"
import { defineFixture } from "../define"

export default defineFixture("example_categories", {
  description:
    "Scaffolding. Base tier: applied in every environment, safe to re-run.",
  update: ["name", "position"],
  rows: [
    {
      id: uuid("example_categories/tools"),
      slug: "tools",
      name: "Tools",
      position: 1,
    },
    {
      id: uuid("example_categories/materials"),
      slug: "materials",
      name: "Materials",
      position: 2,
    },
    {
      id: uuid("example_categories/archived"),
      slug: "archived",
      name: "Archived",
      position: 99,
    },
  ],
})
