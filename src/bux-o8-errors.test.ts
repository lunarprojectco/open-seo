// Error states (Lunar behavioural UX run, batch 8): failed actions say so and name a next step. The onboarding site
// form, rank tracking archive and audit delete toast their failure; a failed dashboard overview shows an alert with
// Retry instead of empty pitches; AI visibility lookups can be retried; a failed rank check is announced; a failed
// onboarding Finish stays on the step with an alert, and Finish says Saving... while it saves.
import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  mutations: [] as Array<{
    mutationFn?: (arg?: unknown) => unknown;
    onError?: (error: unknown) => void;
  }>,
  toastError: [] as unknown[],
}));

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: (options: { queryKey: unknown[] }) =>
    state.queries[String(options.queryKey[0])] ?? {
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: false,
      refetch: () => {},
    },
  useMutation: (options: (typeof state.mutations)[number]) => {
    state.mutations.push(options);
    return { mutate: () => {}, mutateAsync: async () => {}, isPending: false };
  },
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children?: ReactNode }) =>
    createElement("a", null, children),
  useNavigate: () => () => {},
}));
vi.mock("sonner", () => ({
  toast: {
    error: (message: unknown) => state.toastError.push(message),
    success: () => {},
    info: () => {},
  },
}));
vi.mock("@/lib/auth-client", () => ({ useSession: () => ({ data: null }) }));
vi.mock("@/client/lib/posthog", () => ({ captureClientEvent: () => {} }));
const deleteAudit = vi.fn();
vi.mock("@/serverFunctions/audit", () => ({
  deleteAudit: (arg: unknown) => deleteAudit(arg),
  getAuditHistory: () => {},
  startAudit: () => {},
}));
vi.mock("@/serverFunctions/onboardingChat", () => ({ saveOnboardingSite: () => {} }));
vi.mock("@/serverFunctions/rank-tracking", () => ({
  getRankTrackingConfigSummaries: () => {},
  updateRankTrackingConfig: () => {},
}));
vi.mock("@/serverFunctions/dashboard", () => ({
  getDashboardActivation: () => {},
  getDashboardOverview: () => {},
  markDashboardCompetitorClicked: () => {},
  refreshDashboardBacklinkSnapshot: () => {},
}));
vi.mock("@/serverFunctions/projects", () => ({ setProjectDomain: () => {} }));
vi.mock("@/serverFunctions/ai-search", () => ({
  explorePrompt: () => {},
  lookupBrand: () => {},
}));
vi.mock("@/client/features/onboarding/onboardingChatQueries", () => ({
  onboardingChatStateQueryOptions: () => ({ queryKey: ["onboardingChatState"] }),
  invalidateOnboardingChatState: () => {},
}));
const stub = (name: string) => () => createElement("div", null, `[${name}]`);
vi.mock("@/client/features/onboarding/OnboardingAccountMenu", () => ({
  OnboardingAccountMenu: stub("AccountMenu"),
}));
vi.mock("@/client/features/onboarding/OnboardingChatConversation", () => ({
  OnboardingChatConversation: stub("Conversation"),
}));
vi.mock("@/client/features/onboarding/SearchConsoleOnboardingStep", () => ({
  SearchConsoleOnboardingStep: stub("SearchConsoleStep"),
}));
vi.mock("@/client/components/LocationSelect", () => ({
  LocationSelect: stub("LocationSelect"),
}));
vi.mock("@/client/features/dashboard/DashboardCards", () => ({
  AuditHealthCard: stub("AuditHealthCard"),
  BacklinkPulseCard: stub("BacklinkPulseCard"),
  GscCard: stub("GscCard"),
}));
vi.mock("@/client/features/dashboard/Ga4Card", () => ({ Ga4Card: stub("Ga4Card") }));
vi.mock("@/client/features/dashboard/WhatChangedCard", () => ({
  WhatChangedCard: stub("WhatChangedCard"),
}));
vi.mock("@/client/features/dashboard/McpConnectCard", () => ({
  McpConnectCard: stub("McpConnectCard"),
}));
vi.mock("@/client/features/dashboard/WorkspaceMergeBanner", () => ({
  WorkspaceMergeBanner: stub("MergeBanner"),
}));
vi.mock("@/client/features/billing/HostedPlanGate", () => ({
  HostedPlanGate: ({
    children,
  }: {
    children: (gate: { isFreePlan: boolean }) => ReactNode;
  }) => children({ isFreePlan: false }),
}));
vi.mock("@/client/features/ai-search/components/PromptExplorerForm", () => ({
  PromptExplorerForm: stub("PromptExplorerForm"),
}));
vi.mock("@/client/features/ai-search/components/PromptExplorerResults", () => ({
  PromptExplorerResults: stub("PromptExplorerResults"),
}));
vi.mock("@/client/features/ai-search/components/PromptExplorerLoadingState", () => ({
  PromptExplorerLoadingState: stub("PromptExplorerLoading"),
}));
vi.mock("@/client/features/ai-search/components/PromptExplorerHistorySection", () => ({
  PromptExplorerHistorySection: stub("PromptExplorerHistory"),
}));
vi.mock("@/client/features/ai-search/components/AiSearchPaidPlanGate", () => ({
  AiSearchPaidPlanGate: stub("PaidPlanGate"),
}));
vi.mock("@/client/features/ai-search/components/BrandLookupResults", () => ({
  BrandLookupResults: stub("BrandLookupResults"),
}));
vi.mock("@/client/features/ai-search/components/BrandLookupSearchCard", () => ({
  BrandLookupSearchCard: stub("BrandLookupSearchCard"),
}));
vi.mock("@/client/features/ai-search/components/BrandLookupHistorySection", () => ({
  BrandLookupHistorySection: stub("BrandLookupHistory"),
}));
vi.mock("@/client/features/ai-search/components/AiSearchLoadingState", () => ({
  AiSearchLoadingState: stub("AiSearchLoading"),
}));
const history = { history: [], isLoaded: true, addSearch: () => {}, removeHistoryItem: () => {} };
vi.mock("@/client/hooks/usePromptExplorerSearchHistory", () => ({
  usePromptExplorerSearchHistory: () => history,
}));
vi.mock("@/client/hooks/useBrandLookupSearchHistory", () => ({
  useBrandLookupSearchHistory: () => history,
}));

const { OnboardingChat } = await import("@/client/features/onboarding/OnboardingChat");
const { RankTrackingDomainList } = await import(
  "@/client/features/rank-tracking/RankTrackingDomainList"
);
const { useLaunchController } = await import(
  "@/client/features/audit/launch/useLaunchController"
);
const { DashboardPage } = await import("@/client/features/dashboard/DashboardPage");
const { RankTrackingTableToolbar } = await import(
  "@/client/features/rank-tracking/RankTrackingTableToolbar"
);
const { PostSignupOnboarding } = await import(
  "@/client/features/onboarding/PostSignupOnboarding"
);
const EMPTY_ONBOARDING_ANSWERS = {
  selectedInterests: [],
  interestOther: "",
  workFor: "",
  workForOther: "",
  clientWebsiteCount: "",
  source: "",
  sourceOther: "",
} as never;
const { PromptExplorerPage, isSamePromptExplorerSearch } = await import(
  "@/client/features/ai-search/PromptExplorerPage"
);
const { BrandLookupPage, isSameBrandLookup } = await import(
  "@/client/features/ai-search/BrandLookupPage"
);

beforeEach(() => {
  state.queries = {};
  state.mutations = [];
  state.toastError = [];
});

function textOf(html: string) {
  return html.replace(/<[^>]+>/g, "");
}

function buttonText(html: string, pattern: RegExp) {
  const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
  return buttons.find((button) => pattern.test(textOf(button)));
}

function alertOf(html: string) {
  return html.match(/<(\w+)[^>]*role="alert"[^>]*>[\s\S]*?<\/\1>/)?.[0];
}

describe("failed mutations name the failure in a toast", () => {
  it("onboarding site form Continue toasts the save error", () => {
    state.queries.onboardingChatState = {
      data: { projectId: "p1", domain: null },
      isError: false,
    };
    renderToStaticMarkup(createElement(OnboardingChat));
    expect(state.mutations).toHaveLength(1);
    state.mutations[0].onError?.(new Error("Domain is not valid"));
    expect(state.toastError).toEqual(["Domain is not valid"]);
  });

  it("rank tracking Archive toasts the archive error", () => {
    renderToStaticMarkup(
      createElement(RankTrackingDomainList, { projectId: "p1", onAddDomain: () => {} }),
    );
    expect(state.mutations).toHaveLength(1);
    state.mutations[0].onError?.("not an Error");
    expect(state.toastError).toHaveLength(1);
    expect(String(state.toastError[0])).toMatch(/archive/i);
    expect(String(state.toastError[0])).toMatch(/try again/i);
  });

  it("Delete audit toasts the delete error", () => {
    function Harness() {
      useLaunchController({ projectId: "p1", isFreePlan: true, onAuditStarted: () => {} });
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
    const remove = state.mutations.find((m) => {
      deleteAudit.mockClear();
      m.mutationFn?.("a1");
      return deleteAudit.mock.calls.length > 0;
    });
    expect(remove).toBeTruthy();
    remove?.onError?.(new Error("Audit is still running"));
    expect(state.toastError).toEqual(["Audit is still running"]);
    remove?.onError?.(undefined);
    expect(String(state.toastError[1])).toMatch(/delete/i);
    expect(String(state.toastError[1])).toMatch(/try again/i);
  });
});

describe("dashboard overview failure", () => {
  function renderDashboard(overview: Record<string, unknown>) {
    state.queries.dashboardActivation = {
      data: {
        domain: "acme.com",
        gsc: { connected: false },
        ga4: { connected: false, cardDismissedAt: null },
        mcp: { firstToolCallAt: "x", cardDismissedAt: null },
      },
      isError: false,
    };
    state.queries.dashboardOverview = {
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      error: new Error("Overview timed out"),
      refetch: () => {},
      ...overview,
    };
    return renderToStaticMarkup(createElement(DashboardPage, { projectId: "p1" }));
  }

  it("shows an alert with Retry instead of the empty audit and rank pitches", () => {
    const html = renderDashboard({});
    const alert = alertOf(html);
    expect(alert).toBeTruthy();
    expect(textOf(alert ?? "")).toContain("Overview timed out");
    expect(buttonText(alert ?? "", /^Retry$/)).not.toMatch(/disabled/);
    expect(html).not.toContain("[AuditHealthCard]");
    expect(html).not.toContain("[BacklinkPulseCard]");
    expect(html).not.toContain("[WhatChangedCard]");
    expect(html).toContain("[GscCard]");
  });

  it("disables Retry and says so while it retries", () => {
    const html = renderDashboard({ isFetching: true });
    expect(buttonText(alertOf(html) ?? "", /^Retrying\.\.\.$/)).toMatch(/disabled/);
  });

  it("keeps the cards when the overview loads", () => {
    const html = renderDashboard({ isError: false, data: { audit: null, rank: null, backlinks: null } });
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("[AuditHealthCard]");
  });
});

describe("rank tracking toolbar", () => {
  function renderToolbar(latestRun: { status: string } | null, isRunning = false) {
    return renderToStaticMarkup(
      createElement(RankTrackingTableToolbar, {
        showFilters: false,
        onToggleFilters: () => {},
        activeFilterCount: 0,
        isRunning,
        latestRun: latestRun && { ...latestRun, keywordsChecked: 0, keywordsTotal: 4 },
        keywordCount: 4,
        viewMode: "table",
        onViewModeChange: () => {},
        historyAvailable: false,
        onExport: () => {},
        onExportToSheets: () => {},
        onCopyKeywords: () => {},
        onCheckNow: () => {},
        onRefreshMetrics: () => {},
        metricsRefreshing: false,
        checkBusy: false,
        checkDisabled: false,
        hasData: true,
      }),
    );
  }

  it("announces a failed rank check and how to retry", () => {
    const html = renderToolbar({ status: "failed" });
    const alert = html.match(/<[^>]*role="alert"[^>]*>[\s\S]*?<\/span>/)?.[0] ?? "";
    expect(textOf(alert)).toMatch(/last rank check failed/i);
    expect(textOf(alert)).toMatch(/Check rankings/);
  });

  it("shows no alert for a completed check", () => {
    expect(renderToolbar({ status: "completed" })).not.toContain('role="alert"');
    expect(renderToolbar(null)).not.toContain('role="alert"');
  });
});

describe("onboarding Finish", () => {
  function renderFinish(isSaving: boolean, finishError: string | null) {
    return renderToStaticMarkup(
      createElement(PostSignupOnboarding, {
        firstName: "Ada",
        step: 3,
        answers: EMPTY_ONBOARDING_ANSWERS,
        onAnswersChange: () => {},
        onNext: () => {},
        onBack: () => {},
        onSkip: () => {},
        onFinish: () => {},
        isSaving,
        finishError,
        accountMenu: null,
      }),
    );
  }

  it("says Saving... and is disabled while it saves", () => {
    const html = renderFinish(true, null);
    expect(buttonText(html, /^Saving\.\.\.$/)).toMatch(/disabled/);
    expect(buttonText(html, /^Finish$/)).toBeUndefined();
  });

  it("shows the save failure as an alert on the step", () => {
    const html = renderFinish(false, "Could not save your answers. Press Finish to try again.");
    expect(textOf(alertOf(html) ?? "")).toBe(
      "Could not save your answers. Press Finish to try again.",
    );
    expect(buttonText(html, /^Finish$/)).not.toMatch(/disabled/);
    expect(renderFinish(false, null)).not.toContain('role="alert"');
  });

  it("does not navigate home after a failed save", () => {
    const src = readFileSync("src/routes/_authenticated.onboarding.index.tsx", "utf8");
    const finish = src.slice(src.indexOf("const handleFinish"), src.indexOf("return (", src.indexOf("const handleFinish")));
    const catchBlock = finish.slice(finish.indexOf("catch"), finish.indexOf('navigate({ to: "/"'));
    expect(catchBlock).toMatch(/setFinishError\(/);
    expect(catchBlock).toMatch(/return;/);
    expect(src).toMatch(/finishError=\{finishError\}/);
  });
});

describe("AI visibility lookups can be retried", () => {
  const failed = (isFetching: boolean) => ({
    data: undefined,
    isPending: false,
    isError: true,
    isSuccess: false,
    isFetching,
    error: new Error("Lookup failed"),
    refetch: () => {},
  });
  const urlState = {
    prompt: "best crm",
    highlightBrand: "",
    models: ["chatgpt", "claude"] as never,
    webSearch: true,
    webSearchCountryCode: "US" as never,
  };

  it("Prompt Explorer error offers Try again, busy while retrying", () => {
    state.queries["prompt-explorer"] = failed(false);
    let html = renderToStaticMarkup(
      createElement(PromptExplorerPage, { projectId: "p1", urlState, onSubmit: () => {} }),
    );
    expect(buttonText(alertOf(html) ?? "", /^Try again$/)).not.toMatch(/disabled/);
    state.queries["prompt-explorer"] = failed(true);
    html = renderToStaticMarkup(
      createElement(PromptExplorerPage, { projectId: "p1", urlState, onSubmit: () => {} }),
    );
    expect(buttonText(alertOf(html) ?? "", /^Trying again\.\.\.$/)).toMatch(/disabled/);
  });

  it("Prompt Explorer treats an unchanged resubmit as the active search", () => {
    expect(
      isSamePromptExplorerSearch(
        { ...urlState, prompt: " best crm ", models: ["claude", "chatgpt"] as never },
        urlState,
      ),
    ).toBe(true);
    expect(isSamePromptExplorerSearch({ ...urlState, prompt: "best erp" }, urlState)).toBe(false);
    expect(isSamePromptExplorerSearch({ ...urlState, webSearch: false }, urlState)).toBe(false);
  });

  it("Brand Lookup error offers Try again, busy while retrying", () => {
    const props = {
      projectId: "p1",
      initialQuery: "acme.com",
      initialCompetitors: [],
      initialScope: undefined,
      onSearchChange: () => {},
    };
    state.queries["brand-lookup"] = failed(false);
    let html = renderToStaticMarkup(createElement(BrandLookupPage, props));
    expect(buttonText(alertOf(html) ?? "", /^Try again$/)).not.toMatch(/disabled/);
    state.queries["brand-lookup"] = failed(true);
    html = renderToStaticMarkup(createElement(BrandLookupPage, props));
    expect(buttonText(alertOf(html) ?? "", /^Trying again\.\.\.$/)).toMatch(/disabled/);
  });

  it("Brand Lookup treats an unchanged resubmit as the active lookup", () => {
    const active = { query: "acme.com", competitorKey: "a.com,b.com", scope: undefined };
    expect(isSameBrandLookup({ query: "acme.com", competitors: ["a.com", "b.com"], scope: undefined }, active)).toBe(true);
    expect(isSameBrandLookup({ query: "acme.com", competitors: ["a.com"], scope: undefined }, active)).toBe(false);
    expect(isSameBrandLookup({ query: "acme.com", competitors: ["a.com", "b.com"], scope: "subdomains" }, active)).toBe(false);
  });
});
