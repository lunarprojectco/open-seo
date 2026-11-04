import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { freshnessLabel } from "@/client/features/dashboard/cardParts";
import { getOpportunities } from "@/serverFunctions/opportunities";
import type { Opportunity } from "@/server/features/opportunities/derive";

// Each card is an opportunity as the gap check defines it: evidence, affected assets, impact
// (empty when the inputs cannot support it), confidence, effort, the proposed action, and the
// source with its timestamp and limitation. There is no score.

const HREF: Record<
  Opportunity["href"],
  {
    to:
      | "/p/$projectId/audit"
      | "/p/$projectId/search-performance"
      | "/p/$projectId/settings/integrations";
    label: string;
  }
> = {
  audit: { to: "/p/$projectId/audit", label: "Open the audit" },
  "search-performance": {
    to: "/p/$projectId/search-performance",
    label: "Open Search Console insights",
  },
  "settings-integrations": {
    to: "/p/$projectId/settings/integrations",
    label: "Open connections",
  },
};

export function OpportunityCard({
  projectId,
  item,
}: {
  projectId: string;
  item: Opportunity;
}) {
  const link = HREF[item.href];
  return (
    <li
      className="rounded-xl border border-base-300 bg-base-100 p-5 shadow-sm"
      data-kind={item.kind}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-tight">{item.title}</h2>
        <span className="badge badge-ghost badge-sm">
          {item.confidence === "measured"
            ? "measured"
            : item.confidence === "sampled"
              ? "sample"
              : "setup"}
        </span>
      </div>
      {item.evidence.length > 0 ? (
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {item.evidence.map((e) => (
            <div
              key={e.label}
              className="flex justify-between gap-3 border-b border-base-200 py-1"
            >
              <dt className="text-base-content/60">{e.label}</dt>
              <dd className="truncate text-right tabular-nums" title={e.value}>
                {e.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-3 text-sm">{item.action}</p>
      <p className="mt-2 text-xs text-base-content/60">
        Impact:{" "}
        {item.impact === null
          ? "not estimated, the inputs do not support a figure"
          : String(item.impact)}{" "}
        · Effort: {item.effort}
        {item.affected.length
          ? ` · Affects ${item.affected.length === 1 ? item.affected[0] : `${item.affected.length} items`}`
          : ""}
      </p>
      <p className="mt-1 text-[11px] text-base-content/50">
        {item.source.provider} · {freshnessLabel(item.source.collectedAt)}
        {item.source.limitation ? ` · ${item.source.limitation}` : ""}
      </p>
      <Link
        to={link.to}
        params={{ projectId }}
        className="btn btn-sm btn-outline mt-3"
      >
        {link.label}
      </Link>
    </li>
  );
}

export function OpportunitiesPage({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: ["opportunities", projectId],
    queryFn: () => getOpportunities({ data: { projectId } }),
  });
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Opportunities</h1>
      <p className="mt-1 text-sm text-base-content/70">
        What the evidence says to do next, from your audit and your own Search
        Console data. Nothing here is scored; each item shows the rows behind
        it.
      </p>
      {query.isPending ? (
        <div className="mt-6 grid gap-4" aria-busy>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="mt-6 text-sm text-error">
          Couldn’t load opportunities.{" "}
          <button
            type="button"
            className="link"
            onClick={() => void query.refetch()}
          >
            Try again
          </button>
        </p>
      ) : query.data.opportunities.length === 0 ? (
        <p className="mt-6 text-sm text-base-content/70">
          Nothing to show yet.
        </p>
      ) : (
        <>
          <ul className="mt-6 grid gap-4" aria-label="Opportunities">
            {query.data.opportunities.map((item) => (
              <OpportunityCard
                key={item.id}
                projectId={projectId}
                item={item}
              />
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-base-content/50">
            Derived from the sources named on each item; each item carries its
            own collection time.
          </p>
        </>
      )}
    </div>
  );
}
