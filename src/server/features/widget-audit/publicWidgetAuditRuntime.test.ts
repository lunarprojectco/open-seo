import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  env: {},
  DurableObject: vi.fn(),
}));

import { createWidgetAuditSearchGateway } from "@/server/features/widget-audit/publicWidgetAuditRuntime";

class MemoryKv {
  readonly values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string) {
    this.values.set(key, value);
  }
}

const fixedNow = new Date("2026-08-20T12:00:00.000Z");

function request() {
  return new Request("https://app.openseo.so/api/widget/audit", {
    method: "POST",
    headers: { "cf-connecting-ip": "192.0.2.10" },
  });
}

function controls(
  overrides: Partial<{
    checkRate: () => Promise<boolean>;
    reserveProviderCall: () => Promise<boolean>;
  }> = {},
) {
  return {
    checkRate: vi.fn(overrides.checkRate ?? (async () => true)),
    reserveProviderCall: vi.fn(
      overrides.reserveProviderCall ?? (async () => true),
    ),
    recordProviderCost: vi.fn(async () => undefined),
    onOperationalError: vi.fn(),
  };
}

describe("widget audit runtime gateway", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("does not acquire paid search evidence for anonymous hosted requests", async () => {
    const fetchProvider = vi.fn();
    const runtimeControls = controls();
    const gateway = createWidgetAuditSearchGateway({
      runtimeEnv: {
        AUTH_MODE: "hosted",
        BETTER_AUTH_URL: "https://app.openseo.so",
        TURNSTILE_SECRET_KEY: "secret",
        KV: new MemoryKv(),
      },
      now: () => fixedNow,
      fetchProvider,
      verifyTurnstile: vi.fn(async () => ({
        success: true,
        action: "public_widget_audit",
        hostname: "app.openseo.so",
      })),
      ...runtimeControls,
    });

    await expect(
      gateway({
        domain: "example.com",
        request: request(),
        turnstileToken: "token",
      }),
    ).resolves.toMatchObject({
      status: "NOT_RUN",
      organicTraffic: null,
      organicKeywords: null,
      provider: null,
      sourceClass: null,
    });
    expect(runtimeControls.checkRate).toHaveBeenCalledOnce();
    expect(runtimeControls.reserveProviderCall).not.toHaveBeenCalled();
    expect(runtimeControls.recordProviderCost).not.toHaveBeenCalled();
    expect(fetchProvider).not.toHaveBeenCalled();
  });

  it("requires successful Turnstile verification in hosted mode", async () => {
    const fetchProvider = vi.fn();
    const gateway = createWidgetAuditSearchGateway({
      runtimeEnv: {
        AUTH_MODE: "hosted",
        BETTER_AUTH_URL: "https://app.openseo.so",
        TURNSTILE_SECRET_KEY: "secret",
        WIDGET_AUDIT_DAILY_CALL_LIMIT: "25",
        KV: new MemoryKv(),
      },
      now: () => fixedNow,
      fetchProvider,
      verifyTurnstile: vi.fn(async () => ({
        success: false,
        action: null,
        hostname: null,
      })),
      ...controls(),
    });

    await expect(
      gateway({
        domain: "example.com",
        request: request(),
        turnstileToken: "invalid",
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "HUMAN_VERIFICATION_FAILED",
    });
    expect(fetchProvider).not.toHaveBeenCalled();
  });

  it("binds a valid Turnstile token to the public-audit action and app hostname", async () => {
    const fetchProvider = vi.fn();
    const gateway = createWidgetAuditSearchGateway({
      runtimeEnv: {
        AUTH_MODE: "hosted",
        BETTER_AUTH_URL: "https://app.openseo.so",
        TURNSTILE_SECRET_KEY: "secret",
        WIDGET_AUDIT_DAILY_CALL_LIMIT: "25",
        KV: new MemoryKv(),
      },
      now: () => fixedNow,
      fetchProvider,
      verifyTurnstile: vi.fn(async () => ({
        success: true,
        action: "sign_up",
        hostname: "customer.example",
      })),
      ...controls(),
    });

    await expect(
      gateway({
        domain: "example.com",
        request: request(),
        turnstileToken: "valid-but-wrong-context",
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "HUMAN_VERIFICATION_FAILED",
    });
    expect(fetchProvider).not.toHaveBeenCalled();
  });

  it("caches real provider estimates and does not spend a second provider call", async () => {
    const kv = new MemoryKv();
    const runtimeControls = controls();
    const fetchProvider = vi.fn(async () => ({
      data: [
        {
          metrics: {
            organic: { etv: 321.4, count: 44.6 },
          },
        },
      ],
      billing: {
        costUsd: 0.01,
        path: [
          "v3",
          "dataforseo_labs",
          "google",
          "domain_rank_overview",
          "live",
        ],
      },
    }));
    const gateway = createWidgetAuditSearchGateway({
      runtimeEnv: {
        AUTH_MODE: "local_noauth",
        WIDGET_AUDIT_DAILY_CALL_LIMIT: "25",
        KV: kv,
      },
      now: () => fixedNow,
      fetchProvider,
      verifyTurnstile: vi.fn(async () => ({
        success: true,
        action: "public_widget_audit",
        hostname: "app.openseo.so",
      })),
      ...runtimeControls,
    });

    const first = await gateway({
      domain: "example.com",
      request: request(),
    });
    const second = await gateway({
      domain: "example.com",
      request: request(),
    });

    expect(first).toMatchObject({
      organicTraffic: 321,
      organicKeywords: 45,
      sourceClass: "estimated",
      locationLabel: "Canada",
    });
    expect(second).toEqual(first);
    expect(fetchProvider).toHaveBeenCalledOnce();
    expect(runtimeControls.checkRate).toHaveBeenCalledTimes(2);
    expect(runtimeControls.reserveProviderCall).toHaveBeenCalledOnce();
    expect(runtimeControls.recordProviderCost).toHaveBeenCalledWith({
      costUsd: 0.01,
      path: ["v3", "dataforseo_labs", "google", "domain_rank_overview", "live"],
      dateUtc: "2026-08-20",
      status: "succeeded",
    });
  });

  it("enforces the configured daily provider-call limit", async () => {
    const kv = new MemoryKv();
    const fetchProvider = vi.fn();
    const runtimeControls = controls({
      reserveProviderCall: async () => false,
    });
    const gateway = createWidgetAuditSearchGateway({
      runtimeEnv: {
        AUTH_MODE: "local_noauth",
        WIDGET_AUDIT_DAILY_CALL_LIMIT: "1",
        KV: kv,
      },
      now: () => fixedNow,
      fetchProvider,
      verifyTurnstile: vi.fn(async () => ({
        success: true,
        action: "public_widget_audit",
        hostname: "app.openseo.so",
      })),
      ...runtimeControls,
    });

    await expect(
      gateway({ domain: "example.com", request: request() }),
    ).rejects.toMatchObject({
      status: 429,
      code: "DAILY_LIMIT_REACHED",
    });
    expect(fetchProvider).not.toHaveBeenCalled();
    expect(runtimeControls.reserveProviderCall).toHaveBeenCalledWith({
      dateUtc: "2026-08-20",
      limit: 1,
    });
  });

  it("returns acquired evidence when post-call telemetry is unavailable", async () => {
    const operationalError = new Error("telemetry unavailable");
    const runtimeControls = controls();
    runtimeControls.recordProviderCost.mockRejectedValue(operationalError);
    const gateway = createWidgetAuditSearchGateway({
      runtimeEnv: {
        AUTH_MODE: "local_noauth",
        WIDGET_AUDIT_DAILY_CALL_LIMIT: "25",
        KV: new MemoryKv(),
      },
      now: () => fixedNow,
      fetchProvider: vi.fn(async () => ({
        data: [{ metrics: { organic: { etv: 10, count: 2 } } }],
        billing: { costUsd: 0.01, path: ["provider", "path"] },
      })),
      verifyTurnstile: vi.fn(async () => ({
        success: true,
        action: "public_widget_audit",
        hostname: "app.openseo.so",
      })),
      ...runtimeControls,
    });

    await expect(
      gateway({ domain: "example.com", request: request() }),
    ).resolves.toMatchObject({
      status: "AVAILABLE",
      organicTraffic: 10,
      organicKeywords: 2,
    });
    expect(runtimeControls.onOperationalError).toHaveBeenCalledWith(
      operationalError,
    );
  });
});
