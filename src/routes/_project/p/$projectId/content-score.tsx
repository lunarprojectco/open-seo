import { withIntelligenceTabs } from "@/client/features/intelligence/IntelligenceTabs";
import { createFileRoute } from "@tanstack/react-router";
import { ContentScorePage } from "@/client/features/content-score/ContentScorePage";

export const Route = createFileRoute("/_project/p/$projectId/content-score")({
  component: withIntelligenceTabs(ContentScoreRoute),
});

function ContentScoreRoute() {
  const { projectId } = Route.useParams();
  return <ContentScorePage projectId={projectId} />;
}
