import { createFileRoute } from "@tanstack/react-router";
import { IntelligencePage } from "@/client/features/intelligence/IntelligencePage";

export const Route = createFileRoute("/_project/p/$projectId/intelligence")({
  component: IntelligenceRoute,
});

function IntelligenceRoute() {
  const { projectId } = Route.useParams();
  return <IntelligencePage projectId={projectId} />;
}
