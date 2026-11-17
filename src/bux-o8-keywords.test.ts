// Keyword Research behaviour (Lunar behavioural UX run, batch 8): the save dialog is a real dialog with a busy
// Save button, the search bar selects have names, and a failed search is announced.
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/client/features/keywords/state/useKeywordResearchController", () => ({
  useKeywordResearchController: () => ({}),
}));
vi.mock("@/client/features/keywords/state/keywordControllerInternals", () => ({
  useKeywordSearchParams: () => () => {},
  useResolvedKeywordLocation: () => ({}),
}));

const { KeywordSaveDialog, KeywordResearchContent } = await import(
  "@/client/features/keywords/page/KeywordResearchPage"
);
const { KeywordResearchSearchBar } = await import(
  "@/client/features/keywords/page/KeywordResearchSearchBar"
);

type AnyController = Parameters<typeof KeywordSaveDialog>[0]["controller"];

function saveController(isSaving: boolean) {
  return {
    showSaveDialog: true,
    selectedRows: new Set(["seo", "seo tools"]),
    setShowSaveDialog: () => {},
    confirmSave: () => {},
    isSaving,
  } as unknown as AnyController;
}

function buttonText(html: string, pattern: RegExp) {
  const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
  return buttons.find((button) => pattern.test(button.replace(/<[^>]+>/g, "")));
}

describe("Keyword Research save dialog", () => {
  it("is a labelled dialog", () => {
    const html = renderToStaticMarkup(
      createElement(KeywordSaveDialog, { controller: saveController(false) }),
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toMatch(new RegExp(`id="${labelledBy}"[^>]*>Save 2 Keywords`));
  });

  it("offers an enabled Save button while idle", () => {
    const html = renderToStaticMarkup(
      createElement(KeywordSaveDialog, { controller: saveController(false) }),
    );
    const save = buttonText(html, /^Save$/);
    expect(save).toBeTruthy();
    expect(save).not.toMatch(/disabled/);
  });

  it("disables Save and says Saving... while the request runs", () => {
    const html = renderToStaticMarkup(
      createElement(KeywordSaveDialog, { controller: saveController(true) }),
    );
    expect(buttonText(html, /^Save$/)).toBeUndefined();
    const saving = buttonText(html, /^Saving\.\.\.$/);
    expect(saving).toMatch(/disabled=""/);
  });
});

describe("Keyword Research search failure", () => {
  it("announces the error as an alert and keeps the next step", () => {
    const controller = {
      isLoading: false,
      researchError: "Keyword research failed. Try again.",
      researchMutationError: new Error("boom"),
      retrySearch: () => {},
    } as unknown as AnyController;
    const html = renderToStaticMarkup(
      createElement(KeywordResearchContent, { controller, projectId: "p1" }),
    );
    expect(html).toMatch(/role="alert"[^>]*>[\s\S]*Keyword research failed\. Try again\./);
    expect(html).toContain("Try again</button>");
  });
});

describe("Keyword Research search bar", () => {
  function fakeForm() {
    const values: Record<string, unknown> = {
      keyword: "",
      locationCode: 2840,
      resultLimit: 150,
      mode: "auto",
      clickstream: false,
    };
    return {
      Field: ({
        name,
        children,
      }: {
        name: string;
        children: (field: unknown) => ReactNode;
      }) =>
        children({
          state: { value: values[name], meta: { errors: [] } },
          handleChange: () => {},
        }),
      handleSubmit: async () => {},
    };
  }

  it("names the result-count and mode selects", () => {
    const controller = {
      controlsForm: fakeForm(),
      handleSearchSubmit: () => {},
    } as unknown as AnyController;
    const html = renderToStaticMarkup(
      createElement(KeywordResearchSearchBar, { controller }),
    );
    const selects = html.match(/<select[^>]*>/g) ?? [];
    expect(selects).toHaveLength(2);
    for (const select of selects) {
      expect(select).toMatch(/aria-label="[^"]+"/);
    }
    expect(selects[0]).toContain('aria-label="Number of results"');
    expect(selects[1]).toContain('aria-label="Research mode"');
  });
});
