// The public welcome page (owner, 2026-11-15: rebuilt in the spirit of a well-known SEO tool's home page).
// Structure only: no other product named, every preview labelled as example data, and no button that leads to a
// sign-up that refuses everyone without an invitation.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/client/features/lunar-optimize/WelcomePage.tsx", "utf8");
const visible = src.replace(/\/\*[\s\S]*?\*\//g, "");

describe("Lunar Optimize welcome page", () => {
  it("names no other SEO product", () => {
    expect(visible).not.toMatch(/ubersuggest|semrush|ahrefs|moz\b|surfer/i);
  });

  it("labels every preview as example data", () => {
    expect(src).toContain("Example data");
    expect(src).toContain("Example data, not your site.");
  });

  it("sends visitors to sign in or to ask for an invitation, not to a closed sign-up", () => {
    expect(src).not.toContain("/sign-up");
    expect(src).toContain("Sign-up is by invitation while billing is set up");
    expect(src).toContain('href="/sign-in"');
  });

  it("claims source and date only where the screens show them", () => {
    // Keyword research and domain overview rows carry no source or date; dashboard and opportunity cards do.
    expect(visible).not.toMatch(/every figure|every number|every row/i);
    expect(visible).toContain("Source and date on dashboard and opportunity cards");
  });

  it("promises no related-questions count and no per-screen sample label", () => {
    // Keyword research modes are related, suggestions and ideas; the Sample data notice is one shell banner.
    expect(visible).not.toContain("Related questions");
    expect(visible).not.toContain("every screen that uses it says Sample data");
  });
});

describe("Lunar Optimize welcome page scrolling", () => {
  it("scrolls inside itself, because the app locks html and body", () => {
    const css = readFileSync("src/client/styles/lunar-optimize.css", "utf8");
    const page = /\.lo-page \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(page).toMatch(/overflow-y: auto/);
    expect(page).not.toMatch(/overflow: hidden/);
  });
});
