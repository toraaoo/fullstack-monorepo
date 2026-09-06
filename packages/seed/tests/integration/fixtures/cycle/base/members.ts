import { defineFixture } from "../../define"

export default defineFixture("members", {
  key: ["teamSlug", "email"],
  rows: [
    { teamSlug: "acme", email: "ana@example.com", role: "owner" },
    { teamSlug: "acme", email: "bo@example.com", role: "member" },
  ],
})
