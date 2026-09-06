import { defineFixture, ref } from "../../define"

export default defineFixture("nodes", {
  rows: [
    { slug: "grandchild", parentId: ref("nodes", "child") },
    { slug: "child", parentId: ref("nodes", "root") },
    { slug: "root" },
  ],
})
