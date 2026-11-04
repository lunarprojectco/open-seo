import { describe, expect, it } from "vitest";
import {
  deriveOpportunities,
  type AuditInput,
  type SearchInput,
} from "./derive";

const audit: AuditInput = {
  status: "completed",
  startedAt: "2026-11-03T10:00:00.000Z",
  pagesCrawled: 42,
  topIssues: [
    { issueType: "missing_meta_description", severity: "warning", count: 12 },
    { issueType: "broken_link", severity: "critical", count: 3 },
    { issueType: "some_new_check", severity: "warning", count: 1 },
  ],
};
const search: SearchInput = {
  connected: true,
  range: { startDate: "2026-10-06", endDate: "2026-11-02" },
  collectedAt: "2026-11-03T11:00:00.000Z",
  strikingDistance: [
    {
      query: "furnace repair calgary",
      page: "https://example.com/furnace",
      clicks: 4,
      impressions: 180,
      position: 8.2,
    },
    {
      query: "ac tune up",
      page: "https://example.com/ac",
      clicks: 1,
      impressions: 60,
      position: 12.4,
    },
  ],
};

describe("opportunities are derived from evidence, never scored", () => {
  it("orders critical issues, then near-first-page queries, then warnings, and carries source and timestamp", () => {
    const list = deriveOpportunities({ audit, search });
    expect(list.map((o) => o.id)).toEqual([
      "audit:broken_link",
      "sd:furnace repair calgary:https://example.com/furnace",
      "sd:ac tune up:https://example.com/ac",
      "audit:missing_meta_description",
      "audit:some_new_check",
    ]);
    for (const o of list) {
      expect(o.impact).toBeNull();
      expect(o.source.provider).toBeTruthy();
      expect(o.source.collectedAt).toBeTruthy();
      expect(o.evidence.length).toBeGreaterThan(0);
      expect(o.action).toMatch(/\.$/);
    }
    expect(list[0].source.limitation).toBe("42 pages crawled");
    expect(
      list[1].evidence.find((e) => e.label === "Impressions")!.value,
    ).toBe("180");
    expect(list[4].title).toBe("Some new check");
  });

  it("is deterministic: the same inputs give the same list twice", () => {
    expect(deriveOpportunities({ audit, search })).toEqual(
      deriveOpportunities({ audit, search }),
    );
  });

  it("says what is missing instead of inventing rows", () => {
    const list = deriveOpportunities({
      audit: null,
      search: { connected: false },
    });
    expect(list.map((o) => o.kind)).toEqual([
      "run_audit",
      "connect_search_console",
    ]);
    for (const o of list) {
      expect(o.confidence).toBe("none");
      expect(o.source.collectedAt).toBeNull();
      expect(o.evidence).toEqual([]);
    }
    const running = deriveOpportunities({
      audit: { ...audit, status: "running" },
      search: { connected: false },
    });
    expect(running.filter((o) => o.kind === "audit_issue")).toHaveLength(0);
  });
});
