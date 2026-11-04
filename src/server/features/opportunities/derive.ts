// Opportunities, derived, not scored. Every opportunity names its evidence rows, the provider
// they came from and when they were collected, and leaves `impact` empty when the inputs cannot
// support a figure. The same inputs always give the same list, in the same order.

export type AuditInput = {
  status: "running" | "completed" | "failed";
  startedAt: string;
  pagesCrawled: number;
  topIssues: {
    issueType: string;
    severity: "critical" | "warning" | "info";
    count: number;
  }[];
} | null;

export type SearchInput =
  | { connected: false }
  | {
      connected: true;
      range: { startDate: string; endDate: string };
      collectedAt: string;
      strikingDistance: {
        query: string;
        page: string;
        clicks: number;
        impressions: number;
        position: number;
      }[];
    };

export type Opportunity = {
  id: string;
  kind:
    | "audit_issue"
    | "striking_distance"
    | "connect_search_console"
    | "run_audit";
  title: string;
  /** Why it exists: the rows behind it, as the person can check them. */
  evidence: { label: string; value: string }[];
  affected: string[];
  /** Null when the inputs cannot support a figure. Never invented. */
  impact: null;
  confidence: "measured" | "sampled" | "none";
  effort: "small" | "medium" | "large" | "unknown";
  action: string;
  source: {
    provider: string;
    collectedAt: string | null;
    limitation: string | null;
  };
  /** Where to inspect the evidence. */
  href: "audit" | "search-performance" | "settings-integrations";
};

const ISSUE_WORDS: Record<
  string,
  { title: string; action: string; effort: Opportunity["effort"] }
> = {
  missing_title: {
    title: "Pages without a title",
    action: "Write a title for each page that names the service and the place.",
    effort: "small",
  },
  missing_meta_description: {
    title: "Pages without a meta description",
    action: "Add a description that says what the page offers and for whom.",
    effort: "small",
  },
  broken_link: {
    title: "Broken links",
    action: "Fix or remove each link that answers an error.",
    effort: "medium",
  },
  missing_h1: {
    title: "Pages without a heading",
    action: "Give each page one H1 that matches its title.",
    effort: "small",
  },
  duplicate_title: {
    title: "Pages sharing a title",
    action: "Make each title specific to its page.",
    effort: "small",
  },
  slow_page: {
    title: "Slow pages",
    action: "Reduce page weight on the slowest pages first.",
    effort: "large",
  },
};

function words(issueType: string): {
  title: string;
  action: string;
  effort: Opportunity["effort"];
} {
  return (
    ISSUE_WORDS[issueType] ?? {
      title: issueType
        .replace(/[_-]+/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase()),
      action: "Open the audit for the pages affected and fix them one by one.",
      effort: "unknown",
    }
  );
}

// Order: critical audit issues, then near-first-page queries by impressions, then warnings,
// then the setup items. Stable, so the same inputs give the same page.
function rank(o: Opportunity): number {
  return o.kind === "audit_issue" && o.evidence[0]?.value === "critical"
    ? 0
    : o.kind === "striking_distance"
      ? 1
      : o.kind === "audit_issue"
        ? 2
        : 3;
}

export function deriveOpportunities(input: {
  audit: AuditInput;
  search: SearchInput;
}): Opportunity[] {
  const out: Opportunity[] = [];
  const { audit, search } = input;

  if (!audit) {
    out.push({
      id: "run_audit",
      kind: "run_audit",
      title: "No site audit yet",
      evidence: [],
      affected: [],
      impact: null,
      confidence: "none",
      effort: "small",
      action:
        "Run an audit so technical issues can be listed here with the pages they affect.",
      source: { provider: "Site audit", collectedAt: null, limitation: null },
      href: "audit",
    });
  } else if (audit.status === "completed") {
    const limitation = `${audit.pagesCrawled} page${audit.pagesCrawled === 1 ? "" : "s"} crawled`;
    const bySeverity = (sev: "critical" | "warning") =>
      audit.topIssues
        .filter((i) => i.severity === sev)
        .sort(
          (a, b) => b.count - a.count || a.issueType.localeCompare(b.issueType),
        );
    for (const sev of ["critical", "warning"] as const) {
      for (const issue of bySeverity(sev)) {
        const w = words(issue.issueType);
        out.push({
          id: `audit:${issue.issueType}`,
          kind: "audit_issue",
          title: w.title,
          evidence: [
            { label: "Severity", value: sev },
            { label: "Pages affected", value: String(issue.count) },
          ],
          affected: [`${issue.count} page${issue.count === 1 ? "" : "s"}`],
          impact: null,
          confidence: "measured",
          effort: w.effort,
          action: w.action,
          source: {
            provider: "Site audit",
            collectedAt: audit.startedAt,
            limitation,
          },
          href: "audit",
        });
      }
    }
  }

  if (!search.connected) {
    out.push({
      id: "connect_gsc",
      kind: "connect_search_console",
      title: "Search Console is not connected",
      evidence: [],
      affected: [],
      impact: null,
      confidence: "none",
      effort: "small",
      action:
        "Connect Google Search Console so your own clicks, impressions and near-first-page queries can be used here.",
      source: {
        provider: "Google Search Console",
        collectedAt: null,
        limitation: null,
      },
      href: "settings-integrations",
    });
  } else {
    const rows = search.strikingDistance
      .toSorted(
        (a, b) =>
          b.impressions - a.impressions ||
          a.position - b.position ||
          a.query.localeCompare(b.query),
      )
      .slice(0, 10);
    for (const row of rows) {
      out.push({
        id: `sd:${row.query}:${row.page}`,
        kind: "striking_distance",
        title: `“${row.query}” sits at position ${row.position.toFixed(1)}`,
        evidence: [
          { label: "Impressions", value: String(row.impressions) },
          { label: "Clicks", value: String(row.clicks) },
          { label: "Average position", value: row.position.toFixed(1) },
          { label: "Page", value: row.page },
          {
            label: "Window",
            value: `${search.range.startDate} to ${search.range.endDate}`,
          },
        ],
        affected: [row.page],
        impact: null,
        confidence: "measured",
        effort: "medium",
        action:
          "Strengthen this page for the query: cover it in the title, the heading and the opening, and link to it from related pages.",
        source: {
          provider: "Google Search Console",
          collectedAt: search.collectedAt,
          limitation:
            "positions 5 to 20 with at least 20 impressions; Search Console samples and rounds",
        },
        href: "search-performance",
      });
    }
  }

  return out
    .map((o, i) => ({ o, i }))
    .toSorted((a, b) => rank(a.o) - rank(b.o) || a.i - b.i)
    .map(({ o }) => o);
}
