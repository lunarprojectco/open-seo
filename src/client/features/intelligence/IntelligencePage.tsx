import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { INTELLIGENCE_VIEWS } from "@/client/navigation/items";

// One place to start research. The box takes a keyword, a domain or a URL and opens
// the view that fits; the tiles open each view directly. The views keep their own
// URLs and their own data, so nothing here loads a provider until a view does.

export type Intent = { kind: "domain" | "url" | "keyword"; value: string };

export function classifyQuery(raw: string): Intent | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return { kind: "url", value };
  // A bare host with no spaces and a dot is a domain; "furnace repair calgary" is a keyword.
  if (!/\s/.test(value) && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value))
    return { kind: "domain", value: value.toLowerCase() };
  return { kind: "keyword", value };
}

export function IntelligencePage({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const intent = classifyQuery(query);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!intent) return;
    if (intent.kind === "domain")
      void navigate({
        to: "/p/$projectId/domain",
        params: { projectId },
        search: { domain: intent.value },
      });
    else if (intent.kind === "url")
      void navigate({
        to: "/p/$projectId/content-score",
        params: { projectId },
        search: { url: intent.value },
      });
    else
      void navigate({
        to: "/p/$projectId/keywords",
        params: { projectId },
        search: { q: intent.value },
      });
  };
  const hint =
    intent === null
      ? "A keyword, a domain or a page URL."
      : intent.kind === "domain"
        ? `Opens Domain Overview for ${intent.value}.`
        : intent.kind === "url"
          ? "Opens Content Score for that page."
          : `Opens Keyword Research for “${intent.value}”.`;
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Intelligence</h1>
      <p className="mt-1 text-sm text-base-content/70">
        Research from one place. Each view says which provider it used and when
        the data was collected.
      </p>
      <form
        onSubmit={submit}
        className="mt-6 flex flex-col gap-2 sm:flex-row"
        role="search"
        aria-label="Start research"
      >
        <label className="sr-only" htmlFor="intelligence-query">
          Keyword, domain or URL
        </label>
        <input
          id="intelligence-query"
          className="input input-bordered w-full"
          placeholder="furnace repair calgary · example.com · https://example.com/page"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={!intent}>
          Research
        </button>
      </form>
      <p className="mt-2 text-xs text-base-content/60" aria-live="polite">
        {hint}
      </p>
      <ul
        className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Intelligence views"
      >
        {INTELLIGENCE_VIEWS.map((view) => (
          <li key={view.to}>
            <Link
              to={view.to}
              params={{ projectId }}
              search={{}}
              className="block h-full rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="flex items-center gap-2 font-medium">
                <view.icon className="h-4 w-4" />
                {view.label}
              </span>
              <span className="mt-1 block text-sm text-base-content/70">
                {view.blurb}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
