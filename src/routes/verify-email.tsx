import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AuthPageCard,
  AuthPageShell,
  authRedirectSearchSchema,
} from "@/client/features/auth/AuthPage";
import { captureClientEvent } from "@/client/lib/posthog";
import { authClient, useSession } from "@/lib/auth-client";
import {
  isEmailVerificationBypassed,
  isHostedClientAuthMode,
} from "@/lib/auth-mode";
import { getSignInSearch, normalizeAuthRedirect } from "@/lib/auth-redirect";
import { z } from "zod";

const verificationIssueSchema = z
  .enum(["invalid_token", "token_expired", "user_not_found", "unknown"])
  .catch("unknown");

const verifyEmailSearchSchema = authRedirectSearchSchema.extend({
  error: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: verifyEmailSearchSchema,
  component: VerifyEmailPage,
});

// With the address known the page offers Resend email; without it the only
// way to a new email is signing in, so the copy says that instead.
function getVerificationErrorMessage(
  error: string | undefined,
  canResend: boolean,
) {
  switch ((error ?? "").toLowerCase()) {
    case "invalid_token":
      return canResend
        ? "This link is no longer valid. Request a new email to keep going."
        : "This link is no longer valid. Sign in to request a new email.";
    case "token_expired":
      return canResend
        ? "This link has expired. Request a new email to keep going."
        : "This link has expired. Sign in to request a new email.";
    case "user_not_found":
      return "We couldn't find this account anymore. Try creating it again.";
    default:
      if (!error) return null;
      return canResend
        ? "We couldn't confirm this email. Request a new email and try again."
        : "We couldn't confirm this email. Sign in to request a new email.";
  }
}

function getVerifyEmailPageCopy({
  isHostedMode,
  errorMessage,
  isPending,
  isRedirecting,
  email,
}: {
  isHostedMode: boolean;
  errorMessage: string | null;
  isPending: boolean;
  isRedirecting: boolean;
  email: string | undefined;
}) {
  if (!isHostedMode) {
    return {
      title: "Verify email",
      helperText: "Email confirmation isn't available right now.",
    };
  }

  if (errorMessage) {
    return {
      title: "We couldn't confirm your email",
      helperText: "The reason and what to do next are below.",
    };
  }

  if (isRedirecting) {
    return {
      title: "Email confirmed",
      helperText: "You're all set. Taking you to your account now.",
    };
  }

  if (isPending) {
    return {
      title: "Verify email",
      helperText: "Checking your email confirmation.",
    };
  }

  // Default: the user just signed up (or reloaded this page) and still needs to
  // click the verification link. There is never a sign-in CTA here — an
  // unverified hosted user would be bounced straight back by the verification
  // gate.
  return {
    title: "Verify your email",
    helperText: email
      ? `Click the link we sent to ${email} to verify your email.`
      : "Check your inbox for the link to verify your email.",
  };
}

function VerifyEmailPage() {
  const search = Route.useSearch();
  const redirectTo = normalizeAuthRedirect(search.redirect);
  const isHostedMode = isHostedClientAuthMode();
  const { data: session, isPending } = useSession();
  const bypassEmailVerification = isEmailVerificationBypassed();
  const verificationIssueType = search.error
    ? verificationIssueSchema.parse(search.error)
    : null;
  const email = search.email ?? session?.user?.email;
  const canResendAfterError =
    Boolean(email) && verificationIssueType !== "user_not_found";
  const errorMessage = getVerificationErrorMessage(
    search.error,
    canResendAfterError,
  );
  const isVerified = !!session?.user?.emailVerified;
  const [isResending, setIsResending] = useState(false);
  // Verified (or bypass) users are sent on to the app by the effect below; until
  // that lands we show the redirecting state instead of the resend prompt.
  const isRedirecting =
    isVerified || (bypassEmailVerification && Boolean(session?.user?.id));
  const pageCopy = getVerifyEmailPageCopy({
    isHostedMode,
    errorMessage,
    isPending,
    isRedirecting,
    email,
  });

  useEffect(() => {
    if (
      isPending ||
      (!isVerified && !(bypassEmailVerification && session?.user?.id))
    ) {
      return;
    }

    if (isVerified) {
      captureClientEvent("auth:verification_success", {
        redirect_to: redirectTo,
      });
    }

    // Full page reload instead of client-side navigation: the auth→app
    // transition needs a clean server-side load so that all server function
    // handlers are freshly registered (client-side nav during Vite HMR can
    // hit the server before updated handlers are ready, causing
    // "action is not a function" errors).
    window.location.replace(redirectTo);
  }, [
    bypassEmailVerification,
    isPending,
    isVerified,
    redirectTo,
    session?.user?.id,
  ]);

  useEffect(() => {
    if (!verificationIssueType) {
      return;
    }

    captureClientEvent("auth:verification_issue", {
      issue_type: verificationIssueType,
    });
  }, [verificationIssueType]);

  async function handleResend() {
    if (!email) return;
    setIsResending(true);
    try {
      const callbackURL = new URL("/verify-email", window.location.origin);
      if (redirectTo !== "/")
        callbackURL.searchParams.set("redirect", redirectTo);
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: callbackURL.toString(),
      });
      if (result.error) {
        toast.error(result.error.message || "We couldn't send another email.");
        return;
      }
      captureClientEvent("auth:verification_resend");
      toast.success("A new email is on the way.");
    } catch {
      toast.error(
        "We couldn't send another email right now. Please try again.",
      );
    } finally {
      setIsResending(false);
    }
  }

  const resendButton = (
    <button
      type="button"
      className="btn btn-soft w-full"
      onClick={() => void handleResend()}
      disabled={isResending}
    >
      {isResending ? "Sending email..." : "Resend email"}
    </button>
  );

  return (
    <AuthPageShell>
      <AuthPageCard
        title={pageCopy.title}
        helperText={pageCopy.helperText}
        footer={
          <p className="text-sm">
            <Link
              to="/sign-in"
              search={getSignInSearch(redirectTo)}
              className="text-base-content/70 hover:text-base-content transition-colors"
            >
              Back to sign in
            </Link>
          </p>
        }
      >
        {!isHostedMode ? null : errorMessage ? (
          <div className="space-y-3">
            <div className="alert alert-error" role="alert">
              <span>{errorMessage}</span>
            </div>
            {canResendAfterError ? (
              resendButton
            ) : (
              <Link
                to="/sign-in"
                search={getSignInSearch(redirectTo)}
                className="btn btn-soft w-full"
              >
                Back to sign in
              </Link>
            )}
          </div>
        ) : isPending || isRedirecting ? (
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : email ? (
          resendButton
        ) : null}
      </AuthPageCard>
    </AuthPageShell>
  );
}
