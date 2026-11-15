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
});
