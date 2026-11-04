import { Link, useParams } from "@tanstack/react-router";
import type { ComponentType } from "react";
import type React from "react";
import { INTELLIGENCE_VIEWS } from "@/client/navigation/items";

// The strip above every Intelligence view: one tab per view, the current one marked.
// Keyboard: it is a list of links, so Tab moves through it and Enter follows.
export function IntelligenceTabs({ projectId }: { projectId: string }) {
  return (
    <nav aria-label="Intelligence views" className="mb-4 -mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 px-1 pb-1">
        {INTELLIGENCE_VIEWS.map((view) => (
          <li key={view.to}>
            <Link
              to={view.to}
              params={{ projectId }}
              search={{}}
              activeOptions={{ exact: false, includeSearch: false }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-base-content/70 hover:bg-base-300/30 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2"
              activeProps={{
                className: "bg-base-300/50 font-medium text-base-content",
                "aria-current": "page",
              }}
            >
              <view.icon className="h-3.5 w-3.5 shrink-0" />
              {view.short}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Wraps a research view's route component so the Intelligence tab strip sits above it. Route components take no props. */
export function withIntelligenceTabs(
  View: ComponentType,
): () => React.JSX.Element {
  function IntelligenceView() {
    const { projectId } = useParams({ strict: false });
    return (
      <>
        {projectId ? (
          <div className="px-6 pt-4">
            <IntelligenceTabs projectId={projectId} />
          </div>
        ) : null}
        <View />
      </>
    );
  }
  IntelligenceView.displayName = `withIntelligenceTabs(${View.displayName ?? View.name ?? "View"})`;
  return IntelligenceView;
}
