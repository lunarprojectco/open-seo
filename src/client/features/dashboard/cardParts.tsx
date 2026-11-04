// Shared building blocks for the dashboard cards. Same visual language as
// the GSC IntegrationCard (rounded-xl, shadow-sm, header row + divider) so
// the embedded SearchConsoleConnectionCard doesn't read as a different
// design system.
export function CardShell({
  title,
  stamp,
  action,
  children,
}: {
  title: string;
  stamp?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {action}
      </div>
      <div className="border-t border-base-300 p-5">
        {children}
        {stamp ? (
          <p className="mt-4 text-[11px] text-base-content/45">{stamp}</p>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyCardBody({
  message,
  cta,
}: {
  message: string;
  cta: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-base-content/70">{message}</p>
      {cta}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "success" | "error";
  sub?: React.ReactNode;
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "error" ? "text-error" : "";
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-base-content/60">
        {label}
      </p>
      <p className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
      {sub}
    </div>
  );
}

export function PercentDelta({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct)) return null;
  const rounded = Math.round(pct);
  const tone = rounded > 0 ? "text-success" : rounded < 0 ? "text-error" : "";
  return (
    <p className={`text-xs tabular-nums ${tone}`}>
      {rounded > 0 ? "▲" : rounded < 0 ? "▼" : ""} {Math.abs(rounded)}%
    </p>
  );
}

export const moreDetailsClass = "btn btn-ghost btn-xs";

export function newLost(value: number | null): string {
  return value === null ? "—" : String(value);
}

export function formatDay(timestamp: string): string {
  const ms = Date.parse(
    // SQLite's current_timestamp default has no timezone marker; treat it as
    // UTC rather than letting the browser parse it as local time.
    /^\d{4}-\d{2}-\d{2} /.test(timestamp)
      ? `${timestamp.replace(" ", "T")}Z`
      : timestamp,
  );
  if (Number.isNaN(ms)) return timestamp;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ---- Source and freshness contract -------------------------------------------------------
// Every measured number on the dashboard says where it came from and when. A card never shows
// a number without these, and a card with no data says so instead of showing a zero.

export type MetricSource = {
  /** Who measured it: "Google Search Console", "DataForSEO", "Site audit", "Rank tracker". */
  provider: string;
  /** When the provider's data was collected, ISO. Null means never. */
  collectedAt: string | null;
  /** Sample data is labelled; it is never a measurement. */
  sample?: boolean;
  /** The provider's own caveat, when it has one: "last 16 months", "top 1,000 rows". */
  limitation?: string;
};

export function freshnessLabel(
  collectedAt: string | null,
  now = Date.now(),
): string {
  if (!collectedAt) return "never collected";
  const at = new Date(
    collectedAt.includes("T")
      ? collectedAt
      : `${collectedAt.replace(" ", "T")}Z`,
  ).getTime();
  if (Number.isNaN(at)) return "collected at an unknown time";
  const hours = Math.max(0, Math.round((now - at) / 3_600_000));
  if (hours < 1) return "collected in the last hour";
  if (hours < 48) return `collected ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days <= 31) return `collected ${days} day${days === 1 ? "" : "s"} ago`;
  return `collected on ${formatDay(collectedAt)}`;
}

/** Older than this, a measurement is shown as stale. */
export const STALE_AFTER_HOURS = 72;

export function isStale(collectedAt: string | null, now = Date.now()): boolean {
  if (!collectedAt) return true;
  const at = new Date(
    collectedAt.includes("T")
      ? collectedAt
      : `${collectedAt.replace(" ", "T")}Z`,
  ).getTime();
  return Number.isNaN(at) || now - at > STALE_AFTER_HOURS * 3_600_000;
}

export function MetricCard({
  label,
  value,
  source,
  tone,
  sub,
  empty,
}: {
  label: string;
  /** The measured value, or null when there is none. Null renders "No data", never 0. */
  value: string | null;
  source: MetricSource;
  tone?: "success" | "error";
  sub?: React.ReactNode;
  /** What to say when there is no value: "Connect Search Console", "Run an audit". */
  empty?: string;
}) {
  const stale = value !== null && !source.sample && isStale(source.collectedAt);
  const toneClass =
    tone === "success" ? "text-success" : tone === "error" ? "text-error" : "";
  return (
    <div
      className="min-w-0"
      data-metric={label}
      data-sample={source.sample ? "true" : "false"}
      data-stale={stale ? "true" : "false"}
    >
      <p className="text-xs uppercase tracking-wide text-base-content/60">
        {label}
      </p>
      {value === null ? (
        <p
          className="text-base text-base-content/60"
          aria-label={`${label}: no data`}
        >
          No data{empty ? ` · ${empty}` : ""}
        </p>
      ) : (
        <p className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
          {value}
        </p>
      )}
      {sub}
      <p className="mt-1 text-[11px] text-base-content/50">
        {source.provider}
        {source.sample
          ? " · sample data, not a measurement"
          : ` · ${freshnessLabel(source.collectedAt)}`}
        {stale ? " · stale" : ""}
        {source.limitation ? ` · ${source.limitation}` : ""}
      </p>
    </div>
  );
}
