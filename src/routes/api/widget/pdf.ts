import { createFileRoute } from "@tanstack/react-router";

async function handlePdfRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain")?.trim();
  const email = url.searchParams.get("email")?.trim() || "";

  if (!domain) {
    return new Response("domain is required", { status: 400 });
  }

  // Redirect to the public print layout with autoPrint enabled
  const redirectUrl = new URL("/widget-audit-print", url.origin);
  redirectUrl.searchParams.set("domain", domain);
  if (email) {
    redirectUrl.searchParams.set("email", email);
  }
  redirectUrl.searchParams.set("autoPrint", "true");

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString(),
    },
  });
}

export const Route = createFileRoute("/api/widget/pdf")({
  server: {
    handlers: {
      GET: ({ request }) => handlePdfRequest(request),
    },
  },
});
