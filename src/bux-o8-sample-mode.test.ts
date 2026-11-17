// Sample mode (Lunar behavioural UX run, batch 8): while DataForSEO answers with made-up sample data, nothing simulated
// may be shown or stored as measured, and the app shell banner must follow the server once a data call falls back.
// The shell's page content also sits in a main landmark.
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient } from "@tanstack/query-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sampleReason: null as string | null,
  useQueryCalls: [] as Array<Record<string, unknown>>,
}));

const client = vi.hoisted(() => ({
  aiSearch: {
    aggregatedMetrics: vi.fn(),
    topPages: vi.fn(),
    mentionsSearch: vi.fn(),
    crossAggregatedMetrics: vi.fn(),
    llmResponse: vi.fn(),
  },
  backlinks: { summary: vi.fn() },
}));

const snapshots = vi.hoisted(() => ({
  getLatestForProject: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ waitUntil: vi.fn(), env: {} }));
vi.mock("@/server/lib/dataforseo/sample", () => ({
  dataforseoSampleReason: () => state.sampleReason,
  inDataforseoSampleMode: async () => state.sampleReason !== null,
}));
vi.mock("@/server/lib/dataforseo", () => ({
  CHATGPT_LANGUAGE_CODE: "en",
  CHATGPT_LOCATION_CODE: 2840,
  buildLlmTarget: ({ value }: { value: string }) => ({ domain: value }),
  createDataforseoClient: () => client,
  normalizeBacklinksTarget: (domain: string) => ({ apiTarget: domain, includeSubdomains: true }),
}));
vi.mock("@/server/lib/r2-cache", () => ({
  AI_SEARCH_PROMPT_CACHE_NAMESPACE: "ai-search:prompt",
  buildCacheKey: async (_prefix: string, params: unknown) => JSON.stringify(params),
  getCached: async () => null,
  setCached: vi.fn(async () => undefined),
}));
vi.mock("@/server/features/dashboard/repositories/BacklinkSnapshotRepository", () => ({
  BacklinkSnapshotRepository: snapshots,
}));
vi.mock("@/server/features/activation/repositories/ActivationRepository", () => ({ ActivationRepository: {} }));
vi.mock("@/server/features/audit/repositories/AuditRepository", () => ({ AuditRepository: {} }));
vi.mock("@/server/features/audit/repositories/auditSummaryQueries", () => ({ getIssueTypePageCountsForAudit: vi.fn() }));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({ Ga4ConnectionRepository: {} }));
vi.mock("@/server/features/gsc/repositories/GscConnectionRepository", () => ({ GscConnectionRepository: {} }));
vi.mock("@/server/features/rank-tracking/repositories/RankTrackingRepository", () => ({ RankTrackingRepository: {} }));
vi.mock("@/server/features/rank-tracking/services/rankTrackingResults", () => ({ getLatestResults: vi.fn() }));

// App shell: render the real layout with its neighbours stubbed.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => React.createElement("a", null, children),
  useLocation: () => ({ pathname: "/p/project_1/keywords" }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: Record<string, unknown>) => {
    state.useQueryCalls.push(options);
    return { data: undefined, isError: false };
  },
  useQueryClient: () => new QueryClient(),
}));
vi.mock("@/client/layout/AppShellParts", () => ({
  MobileSidebarDrawer: () => null,
  SeoApiStatusBanners: () => null,
}));
vi.mock("@/client/features/gsc/GscReEngagementModal", () => ({ GscReEngagementModal: () => null }));
vi.mock("@/client/components/Sidebar", () => ({ Sidebar: () => React.createElement("nav", null, "sidebar") }));
vi.mock("@/serverFunctions/config", () => ({ getSeoApiKeyStatus: vi.fn() }));
vi.mock("@/serverFunctions/projects", () => ({ getProjects: vi.fn() }));
vi.mock("@/client/lib/active-project", () => ({ getLastProjectId: () => null }));

const { getBrandLookup } = await import("@/server/features/ai-search/services/brandLookup");
const { explorePrompt } = await import("@/server/features/ai-search/services/promptExplorer");
const { BrandLookupResults } = await import("@/client/features/ai-search/components/BrandLookupResults");
const { DashboardService } = await import("@/server/features/dashboard/services/DashboardService");
const { AuthenticatedAppLayout, refreshSampleStatusOnSettle } = await import("@/client/layout/AppShell");

const billingCustomer = { organizationId: "org_1", userId: "user_1", userEmail: "owner@example.com" };

beforeEach(() => {
  state.sampleReason = null;
  state.useQueryCalls = [];
  client.aiSearch.aggregatedMetrics.mockResolvedValue({});
  client.aiSearch.topPages.mockResolvedValue([]);
  client.aiSearch.mentionsSearch.mockResolvedValue([]);
  client.aiSearch.llmResponse.mockResolvedValue({ model_name: "gpt-5", web_search: true, items: [] });
  client.backlinks.summary.mockResolvedValue({ rank: 40, backlinks: 1200, referring_domains: 90 });
  snapshots.getLatestForProject.mockResolvedValue(null);
  snapshots.insert.mockResolvedValue(undefined);
});

function lookup() {
  return getBrandLookup(
    { projectId: "project_1", query: "acme.com", competitors: [], locationCode: 2840, languageCode: "en" },
    billingCustomer,
  );
}

describe("Brand Lookup in sample mode (optimize_03)", () => {
  it("returns an unmeasured state when the AI mention calls fell back to sample data", async () => {
    state.sampleReason = "credits";
    const result = await lookup();
    expect(result.notMeasured).toBe(true);
    expect(result.hasData).toBe(false);
  });

  it("keeps a live empty answer as a real 'no mentions' result", async () => {
    const result = await lookup();
    expect(result.notMeasured).toBeUndefined();
    const html = renderToStaticMarkup(React.createElement(BrandLookupResults, { result, projectId: "project_1" }));
    expect(html).toContain("No AI mentions found");
  });

  it("says nothing was measured instead of 'No AI mentions found'", async () => {
    state.sampleReason = "no_key";
    const result = await lookup();
    const html = renderToStaticMarkup(React.createElement(BrandLookupResults, { result, projectId: "project_1" }));
    expect(html).not.toContain("No AI mentions found");
    expect(html).toContain("nothing was measured");
    expect(html).toContain("DATAFORSEO_API_KEY");
  });
});

describe("Prompt Explorer in sample mode (optimize_03)", () => {
  it("does not present an empty sample answer as a model's real reply", async () => {
    state.sampleReason = "no_key";
    const out = await explorePrompt(
      { projectId: "project_1", prompt: "best crm", models: ["chat_gpt"], webSearch: true },
      billingCustomer,
    );
    const [first] = out.results;
    expect(first.status).toBe("error");
    expect(first.status === "error" ? first.message : "").toContain("nothing was measured");
  });
});

describe("Dashboard backlink snapshot in sample mode (optimize_02)", () => {
  const input = { projectId: "project_1", domain: "acme.com", billingCustomer };

  it("does not store a snapshot taken while DataForSEO answers with sample data", async () => {
    state.sampleReason = "credits";
    await DashboardService.ensureBacklinkSnapshot(input);
    expect(client.backlinks.summary).toHaveBeenCalledTimes(1);
    expect(snapshots.insert).not.toHaveBeenCalled();
  });

  it("still stores a live snapshot", async () => {
    await DashboardService.ensureBacklinkSnapshot(input);
    expect(snapshots.insert).toHaveBeenCalledTimes(1);
  });
});

describe("App shell sample banner follows the server (optimize_01)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the sample status with staleTime 0", () => {
    renderToStaticMarkup(React.createElement(AuthenticatedAppLayout, { children: "page" }));
    const status = state.useQueryCalls.find(
      (o) => Array.isArray(o.queryKey) && o.queryKey[0] === "seoApiKeyStatus",
    );
    expect(status?.staleTime).toBe(0);
  });

  it("re-reads the sample status once, debounced, after data queries and mutations settle", async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const stop = refreshSampleStatusOnSettle(queryClient);

    await queryClient.fetchQuery({ queryKey: ["keywords", "a"], queryFn: async () => 1 });
    await queryClient
      .fetchQuery({ queryKey: ["keywords", "b"], retry: false, queryFn: async () => Promise.reject(new Error("refused")) })
      .catch(() => undefined);
    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: async () => "done" })
      .execute(undefined);
    expect(invalidate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["seoApiKeyStatus"] });
    stop();
  });

  it("does not re-read the status because the status query itself settled", async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const stop = refreshSampleStatusOnSettle(queryClient);

    await queryClient.fetchQuery({ queryKey: ["seoApiKeyStatus"], queryFn: async () => ({ sample: true }) });
    vi.advanceTimersByTime(1000);
    expect(invalidate).not.toHaveBeenCalled();
    stop();
  });
});

describe("App shell main landmark (optimize_12)", () => {
  it("puts the page content in a main element, outside the sidebar", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthenticatedAppLayout, { children: React.createElement("p", null, "page body") }),
    );
    expect(html).toMatch(/<main[^>]*><p>page body<\/p><\/main>/);
    expect(html.match(/<main/g)).toHaveLength(1);
  });
});
