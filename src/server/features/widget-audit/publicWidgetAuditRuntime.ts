import { env } from "cloudflare:workers";
import { isHostedAuthMode } from "@/lib/auth-mode";
import { normalizeDomainInput } from "@/server/lib/domainUtils";
import { asAppError } from "@/server/lib/errors";
import {
  createPublicWidgetAuditHandler,
  PUBLIC_WIDGET_AUDIT_TURNSTILE_ACTION,
  PublicWidgetAuditError,
} from "@/server/features/widget-audit/publicWidgetAudit";
import {
  getPublicWidgetAuditBudget,
  type PublicWidgetDailyReservation,
  type PublicWidgetProviderCost,
  type PublicWidgetRateReservation,
} from "@/server/features/widget-audit/PublicWidgetAuditBudget";
import {
  billedProviderFailure,
  dailyCallLimit,
  hostedSearchNotRun,
  hostedTurnstileHostname,
  LANGUAGE_CODE_ENGLISH,
  LOCATION_CODE_CANADA,
  mapProviderResult,
  MAX_REQUESTS_PER_RATE_WINDOW,
  parseCachedEntry,
  PROVIDER_ERROR_CACHE_TTL_SECONDS,
  providerFailure,
  RATE_WINDOW_SECONDS,
  SEARCH_CACHE_TTL_SECONDS,
  sha256Hex,
  verifyCloudflareTurnstile,
  type ProviderResult,
  type WidgetAuditRuntimeEnv,
} from "@/server/features/widget-audit/publicWidgetAuditRuntimeSupport";

type RuntimeDependencies = {
  runtimeEnv: WidgetAuditRuntimeEnv;
  now(): Date;
  fetchProvider(input: {
    target: string;
    locationCode: number;
    languageCode: string;
  }): Promise<ProviderResult>;
  verifyTurnstile(input: {
    secret: string;
    token: string;
    ip: string | null;
  }): Promise<{
    success: boolean;
    action: string | null;
    hostname: string | null;
  }>;
  checkRate(input: PublicWidgetRateReservation): Promise<boolean>;
  reserveProviderCall(input: PublicWidgetDailyReservation): Promise<boolean>;
  recordProviderCost(input: PublicWidgetProviderCost): Promise<void>;
  onOperationalError(error: unknown): void;
};

export function createWidgetAuditSearchGateway(
  dependencies: RuntimeDependencies,
) {
  return async function getSearchOverview(input: {
    domain: string;
    request: Request;
    turnstileToken?: string;
  }) {
    const hosted = isHostedAuthMode(dependencies.runtimeEnv.AUTH_MODE);
    const ip = input.request.headers.get("cf-connecting-ip");

    if (hosted) {
      if (!ip) {
        throw new PublicWidgetAuditError(
          503,
          "SERVICE_NOT_CONFIGURED",
          "The public audit service is temporarily unavailable.",
        );
      }
      const secret = dependencies.runtimeEnv.TURNSTILE_SECRET_KEY?.trim();
      const expectedHostname = hostedTurnstileHostname(dependencies.runtimeEnv);
      if (!secret || !expectedHostname) {
        throw new PublicWidgetAuditError(
          503,
          "SERVICE_NOT_CONFIGURED",
          "The public audit service is not enabled.",
        );
      }
      if (!input.turnstileToken) {
        throw new PublicWidgetAuditError(
          403,
          "HUMAN_VERIFICATION_FAILED",
          "Complete human verification and try again.",
        );
      }
      const verification = await dependencies.verifyTurnstile({
        secret,
        token: input.turnstileToken,
        ip,
      });
      if (
        !verification.success ||
        verification.action !== PUBLIC_WIDGET_AUDIT_TURNSTILE_ACTION ||
        verification.hostname !== expectedHostname
      ) {
        throw new PublicWidgetAuditError(
          403,
          "HUMAN_VERIFICATION_FAILED",
          "Complete human verification and try again.",
        );
      }
    }

    const now = dependencies.now();
    const clientKey = await sha256Hex(ip ?? "unknown");
    const rateWindow = Math.floor(
      now.getTime() / (RATE_WINDOW_SECONDS * 1_000),
    );
    try {
      const allowed = await dependencies.checkRate({
        clientHash: clientKey,
        window: rateWindow,
        limit: MAX_REQUESTS_PER_RATE_WINDOW,
      });
      if (!allowed) {
        throw new PublicWidgetAuditError(
          429,
          "RATE_LIMITED",
          "Too many audit requests. Try again in a minute.",
          RATE_WINDOW_SECONDS,
        );
      }
    } catch (error) {
      if (error instanceof PublicWidgetAuditError) throw error;
      throw new PublicWidgetAuditError(
        503,
        "SERVICE_NOT_CONFIGURED",
        "The public audit service is temporarily unavailable.",
        60,
      );
    }

    // Accepted spec 0002 requires hosted DataForSEO calls to use the Autumn-
    // metered client. Anonymous public requests have no verified organization
    // billing identity, so hosted acquisition stays unavailable until an
    // operator-sponsored billing policy is approved and implemented.
    if (hosted) return hostedSearchNotRun();

    const configuredDailyLimit = dailyCallLimit(dependencies.runtimeEnv);

    const cacheKey = `widget-audit:search:${input.domain}:${LOCATION_CODE_CANADA}:${LANGUAGE_CODE_ENGLISH}`;
    try {
      const cached = parseCachedEntry(
        await dependencies.runtimeEnv.KV.get(cacheKey),
      );
      if (cached?.kind === "success") return cached.observation;
      if (cached?.kind === "provider_error") throw providerFailure(null);
    } catch (error) {
      if (error instanceof PublicWidgetAuditError) throw error;
      throw new PublicWidgetAuditError(
        503,
        "SERVICE_NOT_CONFIGURED",
        "The public audit service is temporarily unavailable.",
        60,
      );
    }

    const dateUtc = now.toISOString().slice(0, 10);
    try {
      const reserved = await dependencies.reserveProviderCall({
        dateUtc,
        limit: configuredDailyLimit,
      });
      if (!reserved) {
        throw new PublicWidgetAuditError(
          429,
          "DAILY_LIMIT_REACHED",
          "The public audit has reached its daily limit. Try again tomorrow.",
        );
      }
    } catch (error) {
      if (error instanceof PublicWidgetAuditError) throw error;
      throw new PublicWidgetAuditError(
        503,
        "SERVICE_NOT_CONFIGURED",
        "The public audit service is temporarily unavailable.",
        60,
      );
    }

    let result: ProviderResult;
    try {
      result = await dependencies.fetchProvider({
        target: input.domain,
        locationCode: LOCATION_CODE_CANADA,
        languageCode: LANGUAGE_CODE_ENGLISH,
      });
    } catch (error) {
      const billing = billedProviderFailure(error);
      if (billing) {
        await dependencies
          .recordProviderCost({
            ...billing,
            dateUtc,
            status: "failed",
          })
          .catch((operationalError) =>
            dependencies.onOperationalError(operationalError),
          );
      }
      await dependencies.runtimeEnv.KV.put(
        cacheKey,
        JSON.stringify({ kind: "provider_error" }),
        {
          expirationTtl: PROVIDER_ERROR_CACHE_TTL_SECONDS,
        },
      ).catch((operationalError) =>
        dependencies.onOperationalError(operationalError),
      );
      throw providerFailure(error);
    }

    const observation = mapProviderResult(
      result,
      dependencies.now().toISOString(),
    );
    await dependencies.runtimeEnv.KV.put(
      cacheKey,
      JSON.stringify({ kind: "success", observation }),
      { expirationTtl: SEARCH_CACHE_TTL_SECONDS },
    ).catch((operationalError) =>
      dependencies.onOperationalError(operationalError),
    );
    await dependencies
      .recordProviderCost({
        ...result.billing,
        dateUtc,
        status: "succeeded",
      })
      .catch((operationalError) =>
        dependencies.onOperationalError(operationalError),
      );
    return observation;
  };
}

const productionSearchGateway = createWidgetAuditSearchGateway({
  runtimeEnv: env,
  now: () => new Date(),
  fetchProvider: async (input) => {
    const { fetchDomainRankOverview } =
      await import("@/server/lib/dataforseo/labs");
    return fetchDomainRankOverview(input);
  },
  verifyTurnstile: verifyCloudflareTurnstile,
  checkRate: (input) => getPublicWidgetAuditBudget().checkRate(input),
  reserveProviderCall: (input) =>
    getPublicWidgetAuditBudget().reserveProviderCall(input),
  recordProviderCost: (input) =>
    getPublicWidgetAuditBudget().recordProviderCost(input),
  onOperationalError: (error) => {
    const appError = asAppError(error);
    console.error("widget-audit.operation.failed", {
      code: appError?.code ?? "INTERNAL_ERROR",
      name: error instanceof Error ? error.name : "UnknownError",
    });
  },
});

export const handlePublicWidgetAuditRequest = createPublicWidgetAuditHandler({
  normalizeDomain: (input) => normalizeDomainInput(input, false),
  getSearchOverview: productionSearchGateway,
  now: () => new Date(),
  onError: (error) => {
    const appError = asAppError(error);
    console.error("widget-audit.request.failed", {
      code: appError?.code ?? "INTERNAL_ERROR",
      name: error instanceof Error ? error.name : "UnknownError",
    });
  },
});
