import { defineFixture, ref } from "../../define"

export default defineFixture("teams", {
  rows: [
    { slug: "acme", ownerId: ref("members", ["acme", "ana@example.com"]) },
  ],
})
