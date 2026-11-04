import { createServerFn } from "@tanstack/react-start";
import { DashboardService } from "@/server/features/dashboard/services/DashboardService";
import {
  GscNotConnectedError,
  GscService,
  isExpectedGrantFailure,
} from "@/server/features/gsc/services/GscService";
import { resolveDateRange } from "@/server/features/gsc/searchAnalytics";
import { buildStrikingDistanceRows } from "@/server/features/gsc/searchPerformanceReport";
import {
  deriveOpportunities,
  type SearchInput,
} from "@/server/features/opportunities/derive";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { dashboardProjectInputSchema } from "@/types/schemas/dashboard";

// query x page fan-out needs more rows to find the 5..20 band.
const STRIKING_DISTANCE_FETCH_LIMIT = 1000;

/**
 * The project's opportunities: derived from the last completed audit and, when Search Console
 * is connected, the last 28 days of near-first-page queries. No provider is paid for here: the
 * audit is already stored, and Search Console is first-party data.
 */
export const getOpportunities = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(dashboardProjectInputSchema)
  .handler(async ({ context }) => {
    const projectId = context.projectId;
    const overview = await DashboardService.getOverview({
      projectId,
      domain: context.project.domain,
    });
    let search: SearchInput = { connected: false };
    try {
      const { startDate, endDate } = resolveDateRange({
        dateRange: "last_28_days",
      });
      const queryPages = await GscService.getPerformance({
        projectId,
        startDate,
        endDate,
        dimensions: ["query", "page"],
        filters: [],
        rowLimit: STRIKING_DISTANCE_FETCH_LIMIT,
      });
      search = {
        connected: true,
        range: { startDate, endDate },
        collectedAt: new Date().toISOString(),
        strikingDistance: buildStrikingDistanceRows(queryPages.rows),
      };
    } catch (error) {
      if (
        !(error instanceof GscNotConnectedError) &&
        !isExpectedGrantFailure(error)
      )
        throw error;
    }
    return {
      computedAt: new Date().toISOString(),
      opportunities: deriveOpportunities({ audit: overview.audit, search }),
    };
  });
