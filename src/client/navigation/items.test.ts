import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INTELLIGENCE_VIEWS,
  connectNavGroup,
  getProjectNavGroups,
  intelligenceViewPaths,
} from "./items";

describe("project navigation", () => {
  it("offers five destinations for a project, plus Connect", () => {
    const groups = getProjectNavGroups("p1");
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.label)).toEqual([
      "Overview",
      "Intelligence",
      "Opportunities",
      "Audit",
      "Settings",
    ]);
    expect(connectNavGroup.items.map((i) => i.label)).toEqual(["AI & MCP"]);
  });

  it("lights Intelligence up on every research view, each of which keeps its own URL", () => {
    expect(getProjectNavGroups("p1")[0].items[1]).toMatchObject({
      alsoActiveFor: intelligenceViewPaths("p1"),
    });
    expect(intelligenceViewPaths("p1")).toContain("/p/p1/keywords");
    expect(INTELLIGENCE_VIEWS).toHaveLength(9);
    for (const view of INTELLIGENCE_VIEWS) {
      const file = join(
        process.cwd(),
        "src/routes/_project/p/$projectId",
        `${view.to.split("/").pop()}.tsx`,
      );
      expect(readFileSync(file, "utf8"), view.to).toContain("IntelligenceTabs");
    }
  });
});
