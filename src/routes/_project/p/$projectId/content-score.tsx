import { withIntelligenceTabs } from "@/client/features/intelligence/IntelligenceTabs";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ContentScorePage } from "@/client/features/content-score/ContentScorePage";

export const Route = createFileRoute("/_project/p/$projectId/content-score")({
  // The Intelligence box hands a page URL over as ?url=; it lands in "Compare against".
  validateSearch: z.object({ url: z.string().optional() }),
  component: withIntelligenceTabs(ContentScoreRoute),
});

function ContentScoreRoute() {
  const { projectId } = Route.useParams();
  const { url } = Route.useSearch();
  return <ContentScorePage projectId={projectId} initialUrl={url} />;
}
