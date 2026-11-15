// Accessibility of the sign-in page (Lunar behavioural UX run, 2026-11-15): axe found no page language and a label on
// a plain div. Both stay fixed.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("sign-in page accessibility", () => {
  it("declares the page language on the root html element", () => {
    expect(readFileSync("src/routes/__root.tsx", "utf8")).toMatch(/<html lang="en"/);
  });

  it("gives the labelled logo an image role, like LunarMark", () => {
    const src = readFileSync("src/client/features/auth/AuthPage.tsx", "utf8");
    expect(src).toMatch(/role="img"\s+aria-label="Lunar Optimize"/);
  });
});
