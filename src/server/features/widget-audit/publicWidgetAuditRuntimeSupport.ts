import { isHostedAuthMode } from "@/lib/auth-mode";
import { asAppError } from "@/server/lib/errors";
import {
  PublicWidgetAuditError,
  searchOverviewObservationSchema,
  type SearchOverviewObservation,
} from "@/server/features/widget-audit/publicWidgetAudit";

export const LOCATION_CODE_CANADA = 2124;
export const LOCATION_LABEL_CANADA = "Canada";
export const LANGUAGE_CODE_ENGLISH = "en";
export const SEARCH_CACHE_TTL_SECONDS = 12 * 60 * 60;
export const PROVIDER_ERROR_CACHE_TTL_SECONDS = 2 * 60;
export const RATE_WINDOW_SECONDS = 60;
export const MAX_REQUESTS_PER_RATE_WINDOW = 5;

const LOCAL_DAILY_CALL_LIMIT = 10;

export type WidgetAuditRuntimeEnv = {
  AUTH_MODE?: string;
  BETTER_AUTH_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
  WIDGET_AUDIT_DAILY_CALL_LIMIT?: string;
  KV: {
    get(key: string): Promise<string | null>;
    put(
      key: string,
      value: string,
      options?: { expirationTtl?: number },
    ): Promise<void>;
  };
};

export type ProviderResult = {
  data: Array<{
    metrics?: {
      organic?: {
        etv?: number | null;
        count?: number | null;
      } | null;
    } | null;
  }>;
  billing: {
    costUsd: number;
    path: string[];
  };
};

type CachedSearchEntry =
  | { kind: "success"; observation: SearchOverviewObservation }
  | { kind: "provider_error" };

export function dailyCallLimit(runtimeEnv: WidgetAuditRuntimeEnv) {
  const configured = runtimeEnv.WIDGET_AUDIT_DAILY_CALL_LIMIT?.trim();
  if (!configured) {
    if (isHostedAuthMode(runtimeEnv.AUTH_MODE)) {
      throw new PublicWidgetAuditError(
        503,
        "SERVICE_NOT_CONFIGURED",
        "The public audit service is not enabled.",
      );
    }
    return LOCAL_DAILY_CALL_LIMIT;
  }

  if (!/^\d+$/.test(configured)) {
    throw new PublicWidgetAuditError(
      503,
      "SERVICE_NOT_CONFIGURED",
      "The public audit service is not enabled.",
    );
  }

  const parsed = Number(configured);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new PublicWidgetAuditError(
      503,
      "SERVICE_NOT_CONFIGURED",
      "The public audit service is not enabled.",
    );
  }
  return parsed;
}

export async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyCloudflareTurnstile(input: {
  secret: string;
  token: string;
  ip: string | null;
}) {
  const body = new URLSearchParams({
    secret: input.secret,
    response: input.token,
  });
  if (input.ip) body.set("remoteip", input.ip);

  let response: Response;
  try {
    response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    throw new PublicWidgetAuditError(
      503,
      "HUMAN_VERIFICATION_UNAVAILABLE",
      "Human verification is temporarily unavailable.",
      60,
    );
  }

  if (!response.ok) {
    throw new PublicWidgetAuditError(
      503,
      "HUMAN_VERIFICATION_UNAVAILABLE",
      "Human verification is temporarily unavailable.",
      60,
    );
  }

  const parsed = await response.json().catch(() => null);
  if (typeof parsed !== "object" || parsed === null) {
    return { success: false, action: null, hostname: null };
  }
  return {
    success: "success" in parsed && parsed.success === true,
    action:
      "action" in parsed && typeof parsed.action === "string"
        ? parsed.action
        : null,
    hostname:
      "hostname" in parsed && typeof parsed.hostname === "string"
        ? parsed.hostname.toLowerCase()
        : null,
  };
}

export function hostedTurnstileHostname(runtimeEnv: WidgetAuditRuntimeEnv) {
  const configuredUrl = runtimeEnv.BETTER_AUTH_URL?.trim();
  if (!configuredUrl) return null;
  try {
    const parsed = new URL(configuredUrl);
    return parsed.protocol === "https:" ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function parseCachedEntry(raw: string | null): CachedSearchEntry | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      "kind" in value &&
      value.kind === "provider_error"
    ) {
      return { kind: "provider_error" };
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "kind" in value &&
      value.kind === "success" &&
      "observation" in value
    ) {
      const observation = searchOverviewObservationSchema.safeParse(
        value.observation,
      );
      return observation.success
        ? { kind: "success", observation: observation.data }
        : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function mapProviderResult(
  result: ProviderResult,
  fetchedAt: string,
): SearchOverviewObservation {
  const metrics = result.data[0]?.metrics?.organic;
  const organicTraffic =
    metrics?.etv != null ? Math.max(0, Math.round(metrics.etv)) : null;
  const organicKeywords =
    metrics?.count != null ? Math.max(0, Math.round(metrics.count)) : null;
  const populatedFields = [organicTraffic, organicKeywords].filter(
    (value) => value !== null,
  ).length;

  return {
    status: populatedFields > 0 ? "AVAILABLE" : "NO_DATA",
    organicTraffic,
    organicKeywords,
    fetchedAt,
    dataAsOf: null,
    provider: "dataforseo",
    integration: "domain_rank_overview_live",
    sourceClass: "estimated",
    locationCode: LOCATION_CODE_CANADA,
    locationLabel: LOCATION_LABEL_CANADA,
    languageCode: LANGUAGE_CODE_ENGLISH,
    completeness:
      populatedFields === 2
        ? "complete"
        : populatedFields === 1
          ? "partial"
          : "unknown",
  };
}

export function hostedSearchNotRun(): SearchOverviewObservation {
  return {
    status: "NOT_RUN",
    organicTraffic: null,
    organicKeywords: null,
    fetchedAt: null,
    dataAsOf: null,
    provider: null,
    integration: null,
    sourceClass: null,
    locationCode: LOCATION_CODE_CANADA,
    locationLabel: LOCATION_LABEL_CANADA,
    languageCode: LANGUAGE_CODE_ENGLISH,
    completeness: "unknown",
    reason:
      "Anonymous hosted DataForSEO acquisition is disabled until an approved operator-sponsored billing policy exists.",
  };
}

export function providerFailure(error: unknown) {
  const appError = asAppError(error);
  const status = appError?.code === "RATE_LIMITED" ? 503 : 502;
  return new PublicWidgetAuditError(
    status,
    "PROVIDER_UNAVAILABLE",
    "The public search estimate is temporarily unavailable.",
    status === 503 ? 60 : undefined,
  );
}

export function billedProviderFailure(error: unknown) {
  if (typeof error !== "object" || error === null || !("billing" in error)) {
    return null;
  }
  const billing = error.billing;
  if (
    typeof billing !== "object" ||
    billing === null ||
    !("costUsd" in billing) ||
    typeof billing.costUsd !== "number" ||
    !Number.isFinite(billing.costUsd) ||
    billing.costUsd < 0 ||
    !("path" in billing) ||
    !Array.isArray(billing.path) ||
    !billing.path.every((part) => typeof part === "string")
  ) {
    return null;
  }
  return { costUsd: billing.costUsd, path: billing.path };
}
