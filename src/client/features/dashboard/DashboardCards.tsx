import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { SearchConsoleConnectionCard } from "@/client/features/gsc/SearchConsoleConnectionCard";
import { AUDIT_ISSUE_TYPES } from "@/shared/audit-issues";

import {
  formatCount,
  formatCtr,
  formatPosition,
} from "@/client/features/search-performance/SearchPerformanceColumns";
import { getSearchPerformanceReport } from "@/serverFunctions/searchPerformance";
import {
  CardShell,
  EmptyCardBody,
  MetricCard,
  PercentDelta,
  formatDay,
  moreDetailsClass,
  newLost,
} from "@/client/features/dashboard/cardParts";
import type {
  DashboardAuditSummary,
  DashboardBacklinkSummary,
} from "@/server/features/dashboard/services/DashboardService";

// Plain string-keyed view of the registry: issue types from the DB are not
// statically guaranteed to be registry keys.
const issueTitles: Record<string, string | undefined> = Object.fromEntries(
  Object.entries(AUDIT_ISSUE_TYPES).map(([key, value]) => [key, value.title]),
);

// Search Console numbers are as of the window's last day; Google publishes with a lag of about two days.
const gscSource = (endDate: string) => ({
  provider: "Google Search Console",
  collectedAt: endDate,
  limitation: "data lags about two days",
});

export function GscCard({
  projectId,
  connected,
}: {
  projectId: string;
  connected: boolean;
}) {
  const reportQuery = useQuery({
    queryKey: ["dashboardGscReport", projectId],
    queryFn: () =>
      getSearchPerformanceReport({
        data: { projectId, dateRange: "last_28_days" },
      }),
    enabled: connected,
  });

  // Not connected (or a dead grant discovered by the report call): the
  // connection card sells and runs the whole flow itself.
  if (!connected || (reportQuery.data && !reportQuery.data.connected)) {
    return (
      <div id="connect-gsc">
        <SearchConsoleConnectionCard projectId={projectId} />
      </div>
    );
  }

  const report = reportQuery.data;

  return (
    <CardShell
      title="Search performance"
      stamp="Google Search Console · last 28 days"
      action={
        <Link
          to="/p/$projectId/search-performance"
          params={{ projectId }}
          className={moreDetailsClass}
        >
          More details
        </Link>
      }
    >
      {reportQuery.isPending ? (
        <div className="grid grid-cols-2 gap-3" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : reportQuery.isError ? (
        <p className="text-sm text-base-content/60">
          Couldn&rsquo;t load Search Console data. Try again shortly.
        </p>
      ) : report?.connected ? (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Clicks"
            value={formatCount(report.totals.clicks)}
            source={gscSource(report.range.endDate)}
            sub={
              <PercentDelta
                current={report.totals.clicks}
                previous={report.prevTotals.clicks}
              />
            }
          />
          <MetricCard
            label="Impressions"
            value={formatCount(report.totals.impressions)}
            source={gscSource(report.range.endDate)}
            sub={
              <PercentDelta
                current={report.totals.impressions}
                previous={report.prevTotals.impressions}
              />
            }
          />
          <MetricCard
            label="CTR"
            value={formatCtr(report.totals.ctr)}
            source={gscSource(report.range.endDate)}
          />
          <MetricCard
            label="Avg position"
            value={formatPosition(report.totals.position)}
            source={gscSource(report.range.endDate)}
          />
        </div>
      ) : null}
    </CardShell>
  );
}

export function AuditHealthCard({
  projectId,
  audit,
}: {
  projectId: string;
  audit: DashboardAuditSummary | null;
}) {
  if (!audit) {
    return (
      <CardShell title="Site audit">
        <EmptyCardBody
          message="Crawl your site for broken links, missing tags and indexability problems."
          cta={
            <Link
              to="/p/$projectId/audit"
              params={{ projectId }}
              className="btn btn-primary btn-sm"
            >
              Run an audit
            </Link>
          }
        />
      </CardShell>
    );
  }

  return (
    <CardShell
      title="Site audit"
      stamp={`Site audit · ${
        audit.status === "completed"
          ? `crawled ${audit.pagesCrawled} pages · ${formatDay(audit.startedAt)}`
          : audit.status === "running"
            ? "crawl in progress"
            : "last crawl failed"
      }`}
      action={
        <Link
          to="/p/$projectId/audit"
          params={{ projectId }}
          className={moreDetailsClass}
        >
          More details
        </Link>
      }
    >
      {audit.topIssues.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <Check className="size-4 text-success" />
          No issues found — your site looks healthy.
        </div>
      ) : (
        <ul className="space-y-2">
          {audit.topIssues.map((issue) => (
            <li
              key={issue.issueType}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    issue.severity === "critical"
                      ? "bg-error"
                      : issue.severity === "warning"
                        ? "bg-warning"
                        : "bg-base-content/30"
                  }`}
                />
                <span className="truncate">
                  {issueTitles[issue.issueType] ?? issue.issueType}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-base-content/60">
                {issue.count} {issue.count === 1 ? "page" : "pages"}
              </span>
            </li>
          ))}
          {audit.totalIssueTypes > audit.topIssues.length ? (
            <li className="text-xs text-base-content/50">
              + {audit.totalIssueTypes - audit.topIssues.length} more issue
              {audit.totalIssueTypes - audit.topIssues.length === 1 ? "" : "s"}
            </li>
          ) : null}
        </ul>
      )}
    </CardShell>
  );
}

export function BacklinkPulseCard({
  projectId,
  backlinks,
  refreshing,
}: {
  projectId: string;
  backlinks: DashboardBacklinkSummary | null;
  refreshing: boolean;
}) {
  if (!backlinks && refreshing) {
    return (
      <CardShell title="Backlink pulse" stamp="Taking your first snapshot…">
        <div className="grid grid-cols-2 gap-3" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      </CardShell>
    );
  }

  if (!backlinks) {
    return (
      <CardShell title="Backlink pulse">
        <p className="text-sm text-base-content/60">
          We&rsquo;ll snapshot who links to your domain — nothing to set up.
        </p>
      </CardShell>
    );
  }

  const backlinkSource = {
    provider: "DataForSEO backlinks",
    collectedAt: backlinks.capturedAt,
    limitation: backlinks.stale
      ? "snapshot is past its refresh window"
      : undefined,
  };
  return (
    <CardShell
      title="Backlink pulse"
      stamp={`Backlinks · snapshot ${formatDay(backlinks.capturedAt)}${
        refreshing ? " · refreshing…" : ""
      }`}
      action={
        <Link
          to="/p/$projectId/backlinks"
          params={{ projectId }}
          search={{ target: backlinks.domain, scope: "domain" }}
          className={moreDetailsClass}
        >
          More details
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          source={backlinkSource}
          label="Ref. domains"
          value={
            backlinks.referringDomains === null
              ? null
              : backlinks.referringDomains.toLocaleString()
          }
        />
        <MetricCard
          source={backlinkSource}
          label="Backlinks"
          value={
            backlinks.backlinks === null
              ? null
              : backlinks.backlinks.toLocaleString()
          }
        />
        <MetricCard
          source={backlinkSource}
          label="New links"
          value={`▲ ${newLost(backlinks.newBacklinks)}`}
          tone={
            backlinks.newBacklinks && backlinks.newBacklinks > 0
              ? "success"
              : undefined
          }
        />
        <MetricCard
          source={backlinkSource}
          label="Lost links"
          value={`▼ ${newLost(backlinks.lostBacklinks)}`}
          tone={
            backlinks.lostBacklinks && backlinks.lostBacklinks > 0
              ? "error"
              : undefined
          }
        />
      </div>
    </CardShell>
  );
}
