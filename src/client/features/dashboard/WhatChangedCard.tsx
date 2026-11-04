import { useQuery } from "@tanstack/react-query";
import {
  CardShell,
  MetricCard,
  PercentDelta,
} from "@/client/features/dashboard/cardParts";
import type {
  DashboardAuditSummary,
  DashboardRankSummaryPublic,
} from "@/server/features/dashboard/services/DashboardService";
import { getSearchPerformanceReport } from "@/serverFunctions/searchPerformance";

// The Overview's first answer: what changed, from the sources that can say so today.
// Search Console: last 28 days against the 28 before. Rank tracker: keywords up and down since
// the last check. Audit: the issue types found by the last crawl. Each number names its provider
// and its collection time; a source that is not connected says so, it does not show a zero.

function formatCount(n: number): string {
  return new Intl.NumberFormat("en", {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
}

export function WhatChangedCard({
  projectId,
  gscConnected,
  rank,
  audit,
}: {
  projectId: string;
  gscConnected: boolean;
  rank: DashboardRankSummaryPublic | null;
  audit: DashboardAuditSummary | null;
}) {
  const report = useQuery({
    queryKey: ["dashboard", "what-changed", projectId],
    queryFn: () =>
      getSearchPerformanceReport({
        data: { projectId, dateRange: "last_28_days" },
      }),
    enabled: gscConnected,
  });
  const gsc = report.data && report.data.connected ? report.data : null;
  const gscSource = {
    provider: "Google Search Console",
    collectedAt: gsc ? gsc.range.endDate : null,
    limitation: "Search Console data lags about two days",
  };
  const rankSource = {
    provider: "Rank tracker",
    collectedAt: rank?.lastCheckedAt ?? null,
  };
  const auditSource = {
    provider: "Site audit",
    collectedAt: audit?.startedAt ?? null,
    limitation: audit ? `${audit.pagesCrawled} pages crawled` : undefined,
  };
  const issues =
    audit && audit.status === "completed"
      ? audit.topIssues.reduce(
          (n, i) =>
            n +
            (i.severity === "critical" || i.severity === "warning"
              ? i.count
              : 0),
          0,
        )
      : null;
  return (
    <CardShell
      title="What changed"
      stamp="Last 28 days against the 28 before, where a source can say"
    >
      {gscConnected && report.isPending ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard
            label="Clicks"
            value={gsc ? formatCount(gsc.totals.clicks) : null}
            source={gscSource}
            empty={
              gscConnected ? "No rows in the window" : "Connect Search Console"
            }
            sub={
              gsc ? (
                <PercentDelta
                  current={gsc.totals.clicks}
                  previous={gsc.prevTotals.clicks}
                />
              ) : null
            }
          />
          <MetricCard
            label="Impressions"
            value={gsc ? formatCount(gsc.totals.impressions) : null}
            source={gscSource}
            empty={
              gscConnected ? "No rows in the window" : "Connect Search Console"
            }
            sub={
              gsc ? (
                <PercentDelta
                  current={gsc.totals.impressions}
                  previous={gsc.prevTotals.impressions}
                />
              ) : null
            }
          />
          <MetricCard
            label="Keywords up / down"
            value={
              rank && rank.trackedKeywords > 0
                ? `${rank.improved} / ${rank.declined}`
                : null
            }
            source={rankSource}
            empty="Track keywords first"
            sub={
              rank && rank.trackedKeywords > 0 ? (
                <p className="text-xs text-base-content/60">
                  {rank.top10} in the top 10 of {rank.trackedKeywords}
                </p>
              ) : null
            }
          />
          <MetricCard
            label="Open issues"
            value={issues === null ? null : formatCount(issues)}
            source={auditSource}
            empty={
              audit?.status === "running" ? "Crawl in progress" : "Run an audit"
            }
            tone={issues ? "error" : undefined}
            sub={
              audit && audit.status === "completed" ? (
                <p className="text-xs text-base-content/60">
                  critical and warnings, by page
                </p>
              ) : null
            }
          />
        </div>
      )}
    </CardShell>
  );
}
