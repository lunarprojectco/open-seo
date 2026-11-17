// Behavioural UX batch 8 (Lunar Optimize), findings optimize_10, optimize_13 and optimize_14: every control has a
// name a screen reader can say, errors are announced, and nothing keeps moving for people who ask for reduced motion.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  mutation: {} as Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children?: ReactNode; className?: string }) =>
    h("a", { className, href: "#" }, children),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => state.query,
  useMutation: () => state.mutation,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/serverFunctions/opportunities", () => ({ getOpportunities: vi.fn() }));
vi.mock("@/serverFunctions/contentScore", () => ({ buildContentReference: vi.fn() }));
vi.mock("@/client/components/Modal", () => ({
  Modal: ({ children }: { children?: ReactNode }) => h("div", { role: "dialog" }, children),
}));
vi.mock("@/client/components/LocationSelect", () => ({ LocationSelect: () => null }));
vi.mock("@/client/components/ResearchScopeSelect", () => ({ ResearchScopeSelect: () => null }));
vi.mock("@/client/features/projects/useProjectMarket", () => ({
  useProjectMarket: () => ({ locationCode: 2840, languageCode: "en" }),
}));
vi.mock("@/client/features/rank-tracking/useSaveConfigMutations", () => ({
  useSaveConfigMutations: () => ({
    createMutation: { isPending: false, mutate: vi.fn() },
    updateMutation: { isPending: false, mutate: vi.fn() },
  }),
}));
vi.mock("@/client/features/rank-tracking/SearchTargetingField", () => ({ SearchTargetingField: () => null }));
vi.mock("@/client/features/rank-tracking/KeywordSuggestionStep", () => ({ KeywordSuggestionStep: () => null }));

import { LaunchFormCard } from "@/client/features/audit/launch/LaunchFormCard";
import { BacklinksHistorySection } from "@/client/features/backlinks/BacklinksHistorySection";
import { ContentScorePage } from "@/client/features/content-score/ContentScorePage";
import { DomainHistorySection } from "@/client/features/domain/components/DomainHistorySection";
import { DomainSearchCard } from "@/client/features/domain/components/DomainSearchCard";
import { KeywordResearchEmptyState } from "@/client/features/keywords/page/KeywordResearchEmptyState";
import { OpportunitiesPage } from "@/client/features/opportunities/OpportunitiesPage";
import { RankTrackingConfigModal } from "@/client/features/rank-tracking/RankTrackingConfigModal";

/** A stand-in for a TanStack form: every field renders with the given value and no errors. */
function fakeForm(values: Record<string, unknown>) {
  const formState = { isSubmitting: false, errorMap: {}, values };
  return {
    state: formState,
    setErrorMap: vi.fn(),
    handleSubmit: vi.fn(),
    Field: ({ name, children }: { name: string; children: (field: unknown) => ReactNode }) =>
      children({ state: { value: values[name], meta: { errors: [] } }, handleChange: vi.fn() }),
    Subscribe: ({ selector, children }: { selector: (s: unknown) => unknown; children: (v: unknown) => ReactNode }) =>
      children(selector(formState)),
  };
}

const text = (markup: string) => markup.replace(/<[^>]*>/g, "").trim();

/** Opening tags of buttons whose content is only an icon (no words a screen reader could say). */
function iconOnlyButtons(markup: string): string[] {
  return [...markup.matchAll(/(<button\b[^>]*>)([\s\S]*?)<\/button>/g)]
    .filter(([, , inner]) => text(inner) === "")
    .map(([, open]) => open);
}

/** The id a visible label points at, found by the label's words. */
function labelTarget(markup: string, words: string): string | undefined {
  const label = [...markup.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/g)].find(([, , inner]) =>
    text(inner).startsWith(words),
  );
  return label?.[1].match(/\bfor="([^"]+)"/)?.[1];
}

const history = [
  {
    timestamp: 1,
    domain: "example.com",
    target: "example.com",
    keyword: "boilers",
    locationName: "Canada",
    locationCode: 2124,
    scope: "domain",
  },
];

describe("optimize_13: every control has an accessible name", () => {
  it("names each remove-history button after its item and shows it on keyboard focus", () => {
    const sections = [
      renderToStaticMarkup(
        h(DomainHistorySection, {
          history: history as never,
          historyLoaded: true,
          onRemoveHistoryItem: vi.fn(),
          onSelectHistoryItem: vi.fn(),
        }),
      ),
      renderToStaticMarkup(
        h(BacklinksHistorySection, {
          projectId: "p1",
          history: history as never,
          historyLoaded: true,
          onRemoveHistoryItem: vi.fn(),
        }),
      ),
      renderToStaticMarkup(
        h(KeywordResearchEmptyState, {
          projectId: "p1",
          controller: {
            history,
            historyLoaded: true,
            removeHistoryItem: vi.fn(),
            hasSearched: false,
            isLoading: false,
            lastSearchError: null,
          } as never,
        }),
      ),
    ];
    for (const markup of sections) {
      const buttons = iconOnlyButtons(markup);
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toMatch(/aria-label="Remove (example\.com|boilers) from recent searches"/);
      expect(buttons[0]).toMatch(/focus-visible:opacity-100/);
    }
  });

  it("names the Domain Overview sort select", () => {
    const markup = renderToStaticMarkup(
      h(DomainSearchCard, {
        controlsForm: fakeForm({ domain: "", scope: "domain", locationCode: 2840, sort: "traffic" }) as never,
        isLoading: false,
        onSubmit: vi.fn(),
        onDomainChange: vi.fn(),
        onScopeChange: vi.fn(),
        onSortChange: vi.fn(),
        onLocationChange: vi.fn(),
      }),
    );
    expect(markup).toMatch(/<select\b[^>]*aria-label="Sort results"/);
  });

  it("links the audit Max pages label to its input", () => {
    const markup = renderToStaticMarkup(
      h(LaunchFormCard, {
        launchForm: fakeForm({ url: "", maxPagesInput: "50", runLighthouse: false }) as never,
        commitMaxPagesInput: () => 50,
        maxPagesLimit: 50,
      }),
    );
    const id = labelTarget(markup, "Max pages");
    expect(id).toBeTruthy();
    expect(markup).toMatch(new RegExp(`<input\\b(?=[^>]*type="number")[^>]*id="${id}"`));
  });

  it("links every rank tracking config label to its control and names the close button", () => {
    const markup = renderToStaticMarkup(
      h(RankTrackingConfigModal, { projectId: "p1", onClose: vi.fn(), onSaved: vi.fn() }),
    );
    for (const [words, tag] of [
      ["Target Domain", "input"],
      ["Language", "select"],
      ["Devices", "select"],
      ["Schedule", "select"],
      ["Search Depth", "select"],
    ]) {
      const id = labelTarget(markup, words);
      expect(id, words).toBeTruthy();
      expect(markup, words).toMatch(new RegExp(`<${tag}\\b[^>]*id="${id}"`));
    }
    const buttons = iconOnlyButtons(markup);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toMatch(/aria-label="Close"/);
  });

  // These two sit in components whose data hooks are too deep to render here; the assertion pins the name on the
  // button that holds only the X icon.
  it("names the keyword suggestion close button and the tag search clear button", () => {
    const step = readFileSync("src/client/features/rank-tracking/KeywordSuggestionStep.tsx", "utf8");
    expect(step).toMatch(/<button\s[^>]*aria-label="Close"[^>]*onClick=\{onClose\}[^>]*>\s*<X /);
    const tags = readFileSync("src/client/features/saved-keywords/SavedKeywordsTagFilter.tsx", "utf8");
    expect(tags).toMatch(
      /<button\s[^>]*aria-label="Clear tag search"[^>]*onClick=\{\(\) => onQueryChange\(""\)\}\s*>\s*<X /,
    );
  });
});

describe("optimize_10: errors are announced", () => {
  it("announces the Opportunities load failure", () => {
    state.query = { isPending: false, isError: true, data: undefined, refetch: vi.fn() };
    const markup = renderToStaticMarkup(h(OpportunitiesPage, { projectId: "p1" }));
    expect(markup).toMatch(/<p\b[^>]*role="alert"[^>]*>Couldn’t load opportunities/);
  });

  it("announces the Content Score measuring failure", () => {
    state.mutation = { isPending: false, isError: true, data: undefined, mutate: vi.fn() };
    const markup = renderToStaticMarkup(h(ContentScorePage, { projectId: "p1" }));
    expect(markup).toMatch(/<p\b[^>]*role="alert"[^>]*>The pages could not be measured\./);
  });

  // The subscribe route reads its session and billing hooks at the top; the assertion pins the role on the element
  // that shows the checkout error.
  it("announces the Subscribe checkout error", () => {
    const src = readFileSync("src/routes/_authenticated.subscribe.tsx", "utf8");
    expect(src).toMatch(/\{error \? \(?\s*<p\b[^>]*role="alert"[^>]*>\s*\{error\}/);
  });
});

describe("optimize_14: nothing moves under reduced motion", () => {
  const css = readFileSync("src/client/styles/app.css", "utf8");
  const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\r?\n\}/)?.[1] ?? "";

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".tsx") ? [path] : [];
    });
  }

  it("stops every Tailwind animation class the app uses", () => {
    const used = new Set(
      sourceFiles("src").flatMap(
        (file) => readFileSync(file, "utf8").match(/\banimate-(spin|ping|pulse|bounce)\b/g) ?? [],
      ),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const cls of used) expect(block, cls).toContain(`.${cls}`);
    expect(block).toMatch(/animation:\s*none/);
  });

  it("swaps the daisyUI spinner, which animates inside its SVG mask, for a still ring", () => {
    const rule = block.match(/\.loading\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/mask-image:\s*url\("data:image\/svg\+xml,/);
    expect(rule).not.toMatch(/%3Canimate/i);
  });
});
