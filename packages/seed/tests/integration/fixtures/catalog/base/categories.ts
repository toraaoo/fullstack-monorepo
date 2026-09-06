import { defineFixture } from "../../define"

export default defineFixture("categories", {
  description: "Reference categories",
  rows: [
    { slug: "tools", name: "Tools", position: 1 },
    { slug: "toys", name: "Toys", position: 2 },
  ],
})
