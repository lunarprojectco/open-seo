// Auth pages behaviour (Lunar behavioural UX run, batch 8): sign-up says it is by invitation before the form, the
// refusal names where to ask, the auth shell is a main landmark, the forgot-password outcome is announced, and an
// expired verification link offers the next step it names.
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  search: {} as Record<string, string | undefined>,
  authOptions: undefined as Record<string, boolean> | undefined,
  placeholderBilling: true,
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    AUTH_MODE: "hosted",
    BETTER_AUTH_URL: "https://optimize.example.test",
    BETTER_AUTH_SECRET: "a-test-secret-that-is-long-enough-123456",
  },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    ...options,
    useSearch: () => state.search,
  }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) =>
    createElement("a", { href: to }, children),
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: state.authOptions }),
}));
vi.mock("@/serverFunctions/config", () => ({ getAuthOptions: () => ({}) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {},
  useSession: () => ({ data: null, isPending: false }),
}));
vi.mock("@/lib/auth-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth-mode")>()),
  isHostedClientAuthMode: () => true,
  isEmailVerificationBypassed: () => false,
}));
vi.mock("@/client/features/auth/TurnstileWidget", () => ({
  TURNSTILE_SITE_KEY: "",
  TurnstileWidget: () => null,
  useTurnstileCaptcha: () => ({
    tokenRef: { current: null },
    hasToken: false,
    onToken: () => {},
    reset: () => {},
    resetNonce: 0,
  }),
}));
vi.mock("@/client/lib/posthog", () => ({ captureClientEvent: () => {} }));
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

// Server auth: capture the config handed to Better Auth so the real sign-up hook can run.
vi.mock("better-auth", () => ({ betterAuth: (config: unknown) => config }));
vi.mock("better-auth/api", () => ({
  APIError: class extends Error {
    constructor(_status: string, body: { message: string }) {
      super(body.message);
    }
  },
}));
vi.mock("better-auth/plugins", () => ({ captcha: () => ({}) }));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: () => ({}) }));
vi.mock("better-auth/tanstack-start", () => ({ tanstackStartCookies: () => ({}) }));
vi.mock("@/db/d1/schema", () => ({}));
vi.mock("@/db/d1/client", () => ({ d1Db: {} }));
vi.mock("@/db/pg/client", () => ({ pgDb: {} }));
vi.mock("@/db/pg/schema", () => ({}));
vi.mock("@/db/provider", () => ({ getDatabaseProvider: () => "d1" }));
vi.mock("@/lib/auth-api-key", () => ({ createApiKeyPlugin: () => ({}) }));
vi.mock("@/lib/auth-config", () => ({
  createBaseAuthConfig: () => ({ emailAndPassword: {}, plugins: [] }),
}));
vi.mock("@/lib/auth-turnstile", () => ({
  getHostedTurnstileSecretKey: () => undefined,
  hasHostedTurnstileConfig: () => true,
}));
vi.mock("@/server/auth/default-hosted-organization", () => ({}));
vi.mock("@/server/email/loops", () => ({}));
vi.mock("@/server/billing/autumn-placeholder", () => ({
  usesPlaceholderBilling: async () => state.placeholderBilling,
}));
vi.mock("@/server/auth/signup-allowlist", () => ({ isEmailAllowed: () => false }));

const SUPPORT_URL = "https://mission-control.projectlunar.ai/support";
const WELCOME_SENTENCE = "Sign-up is by invitation while billing is set up.";

function routeComponent(route: unknown) {
  return (route as { component: ComponentType }).component;
}

// Imported while the file is collected, so a slow first import under a full run is not a test timeout.
const routes = {
  signUp: (await import("@/routes/_auth.sign-up")).Route,
  forgotPassword: (await import("@/routes/forgot-password")).Route,
  verifyEmail: (await import("@/routes/verify-email")).Route,
};
const { AuthPageShell } = await import("@/client/features/auth/AuthPage");
const { getAuth, isInviteOnlySignup } = await import("@/lib/auth");

function renderRoute(route: unknown, search: Record<string, string | undefined> = {}) {
  state.search = search;
  return renderToStaticMarkup(createElement(routeComponent(route)));
}

function text(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
}

describe("sign-up is by invitation (optimize_04)", () => {
  it("says so above the form, with the welcome page's sentence and support link", async () => {
    state.authOptions = { google: false };
    const html = renderRoute(routes.signUp);
    expect(text(html)).toContain(WELCOME_SENTENCE);
    expect(text(html)).toContain("Ask for one through the Project Lunar support page.");
    expect(html).toContain(`href="${SUPPORT_URL}"`);
    expect(html.indexOf(WELCOME_SENTENCE)).toBeLessThan(html.indexOf("Continue with email"));
  });

  it("drops the line when the deployment says sign-up is open", async () => {
    state.authOptions = { google: false, inviteOnly: false };
    const html = renderRoute(routes.signUp);
    expect(html).not.toContain(WELCOME_SENTENCE);
  });

  it("refuses an uninvited sign-up with a message that names where to ask", async () => {
    state.placeholderBilling = true;
    const config = getAuth() as unknown as {
      databaseHooks: { user: { create: { before: (user: { email: string }) => Promise<unknown> } } };
    };
    await expect(
      config.databaseHooks.user.create.before({ email: "someone@example.org" }),
    ).rejects.toThrow(SUPPORT_URL);
    expect(await isInviteOnlySignup()).toBe(true);
    state.placeholderBilling = false;
    expect(await isInviteOnlySignup()).toBe(false);
  });
});

describe("auth shell landmark (optimize_12)", () => {
  it("wraps the auth pages in a main element", async () => {
    const html = renderToStaticMarkup(createElement(AuthPageShell, null, "content"));
    expect(html).toMatch(/<main[^>]*>content<\/main>/);
  });
});

describe("forgot password outcome (optimize_10)", () => {
  it("keeps a polite status region mounted before the email is sent", async () => {
    const html = renderRoute(routes.forgotPassword);
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="status"/);
    expect(html).toContain("<form");
  });
});

describe("verify email next step (optimize_05)", () => {
  it("offers Resend email on an expired link when the address is known", async () => {
    const html = renderRoute(routes.verifyEmail, {
      error: "token_expired",
      email: "someone@example.org",
    });
    expect(text(html)).toContain("Request a new email to keep going.");
    expect(html).toMatch(/<button[^>]*>Resend email<\/button>/);
    expect(html).toMatch(/role="alert"/);
  });

  it("tells the person to sign in when the address is not known", async () => {
    const html = renderRoute(routes.verifyEmail, { error: "invalid_token" });
    expect(text(html)).not.toContain("Request a new email");
    expect(text(html)).toContain("Sign in to request a new email.");
    expect(html).not.toContain("Resend email");
  });
});

describe("optimize_04: the invitation line follows the server", () => {
  it("getAuthOptions reports the same invite-only check the sign-up refusal uses", () => {
    const src = readFileSync("src/serverFunctions/config.ts", "utf8");
    expect(src).toMatch(/inviteOnly: await isInviteOnlySignup\(\)/);
  });
});
