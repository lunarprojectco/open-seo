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

  it("wraps the auth pages in a main landmark", () => {
    const src = readFileSync("src/client/features/auth/AuthPage.tsx", "utf8");
    expect(src).toMatch(/<main className="m-auto/);
  });

  // Batch 8: a refused sign-in or sign-up is announced, so every error line is an alert.
  it.each([
    "src/routes/_auth.sign-in.tsx",
    "src/routes/_auth.sign-up.tsx",
    "src/routes/forgot-password.tsx",
    "src/routes/reset-password.tsx",
    "src/routes/verify-email.tsx",
  ])("marks every error in %s as an alert", (file) => {
    const src = readFileSync(file, "utf8");
    const errors = src.match(/<(p|div) className="[^"]*(text-error|alert-error)[^"]*"[^>]*>/g) ?? [];
    expect(errors.length).toBeGreaterThan(0);
    for (const element of errors) expect(element).toContain('role="alert"');
  });
});

describe("auth page footers and the verify-email error (batch 8 live check)", () => {
  it("draws footer links at 70% ink, not 50% (3.38:1 on the auth card, under 4.5:1)", () => {
    for (const f of ["src/routes/_auth.sign-in.tsx", "src/routes/_auth.sign-up.tsx", "src/routes/forgot-password.tsx", "src/routes/reset-password.tsx", "src/routes/verify-email.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/text-base-content\/50/);
    }
  });

  it("says the verify-email reason once, in the alert, not again in the header", () => {
    expect(readFileSync("src/routes/verify-email.tsx", "utf8")).not.toMatch(/helperText: errorMessage/);
  });
});
