# Public Audit Widget: First-Party Hosted Flow

- Status: DRAFT implementation brief for independent review.
- Server contract base: `ece6505` on `codex/digital-audit-truth`.
- Implementation executor: Cursor in a separate branch and worktree created from
  the reviewed server-contract commit.
- Human accountable roles: Product Owner and Frontend/Product Engineering Lead.
- Security reviewer: Platform/Security Lead.

## Goal

Replace the legacy cross-origin Shadow DOM application with a tiny embeddable
loader that displays a first-party OpenSEO widget route in an iframe. The
first-party route owns Turnstile, form state, results, consent copy, and
accessibility. It consumes the truthful `2026-08-20` public-baseline response.

This packet does not enable paid hosted DataForSEO acquisition. Hosted search
remains `NOT_RUN` until an approved operator-sponsored billing policy is
implemented through the accepted billing boundary.

## Why this boundary is required

The public server contract validates a Turnstile token against the
`public_widget_audit` action and OpenSEO application hostname. Rendering the
challenge on an arbitrary embedding site would bind verification to that host,
not the OpenSEO application. A first-party iframe keeps challenge execution,
form submission, and result rendering under one reviewed origin.

## Path ownership

Cursor may edit only:

- `public/widget.js`;
- one new first-party widget route under `src/routes/`;
- components and client-only schemas under a new
  `src/client/features/widget-audit/` directory;
- focused component/browser tests for those paths;
- the generated route tree only through the repository's normal generator.

Cursor must not edit:

- `src/routes/api/widget/audit.ts`;
- `src/server/features/widget-audit/**`;
- `src/server.ts`, `src/env.d.ts`, or `wrangler.jsonc`;
- authentication, billing, provider, database, migration, or Durable Object
  paths;
- `src/routes/api/widget/pdf.ts` or `src/routes/widget-audit-print.tsx` from the
  current shared worktree. Those unreviewed artifacts are not an accepted base.

No other executor may edit Cursor-owned paths during the lease.

## Loader contract

`public/widget.js` must:

1. Resolve its own script origin without relying on `openseo.dev` defaults.
2. Create one isolated host and iframe whose source is the first-party widget
   route on that origin.
3. Avoid placing lead data, email addresses, audit results, or tokens in query
   strings, window globals, logs, or host-page markup.
4. Provide a meaningful iframe title and a host-controlled close mechanism.
5. Use a narrowly validated `postMessage` contract only if resizing or closing
   requires it; validate exact origin and message schema.
6. Avoid modifying host-page styles or global application state.

## First-party route contract

The route must:

1. Render domain input, optional email input, disclosure/consent text, and a
   Turnstile widget configured for action `public_widget_audit`.
2. Send strict JSON `{ domain, email?, turnstileToken }` to
   `POST /api/widget/audit`.
3. Parse the response as untrusted data with a client-side schema matching the
   server's versioned public contract.
4. Render `NOT_RUN`, `NOT_CONNECTED`, `UNAVAILABLE`, `NO_DATA`, and
   `NOT_COMPUTED` as explicit human-readable states such as **Not measured**.
5. Never render unavailable values as zero, success, corroborated, or a
   numerical score.
6. Parse errors from `{ error: { code, message } }` and provide retry/restart
   behavior without leaking internal details.
7. Hide report/PDF actions whenever `report.available !== true`.
8. Make no claim that email was stored, a report was delivered, or an audit is
   courtroom-ready/boardroom-ready unless a later persisted-report contract
   supplies that behavior.

## Reporting boundary

PDF generation is out of scope. A report download requires a persisted,
authorized canonical audit snapshot and a separate report model. Do not re-run
the paid public endpoint from a GET request and do not place email in a report
URL.

The first report delivery slice should be an authenticated print view backed by
one persisted snapshot. Server-side binary PDF remains conditional on a
separately reviewed Cloudflare/self-host runtime decision.

## Accessibility and security acceptance

- Keyboard-only form, close, retry, and result navigation works.
- Inputs have programmatic labels; status/error changes are announced without
  stealing focus.
- Focus indicators, contrast, reduced-motion behavior, and mobile viewport are
  verified.
- Script and iframe origins cannot be overridden by arbitrary query data.
- `postMessage`, if used, rejects wrong-origin and malformed messages.
- No secrets, Turnstile secret, provider credential, lead email, or response
  payload appears in logs or committed fixtures.
- A hosted contract test proves the submitted request includes a Turnstile
  token and the UI truthfully displays hosted search as `NOT_RUN`.

## Required verification

1. Focused schema/component tests for every response state.
2. Browser test on a neutral fixture host proving the loader does not inherit or
   overwrite host CSS.
3. Browser tests for form, valid mocked hosted response, structured API error,
   close/reopen behavior, keyboard operation, and mobile layout.
4. Repository typecheck, scoped lint, full relevant regression tests, and
   production build.
5. Final diff review proving only assigned paths changed.

## Handoff

Return:

- branch, worktree, fixed base SHA, and commit SHA;
- files changed;
- exact test commands/results;
- browser evidence and limitations;
- unresolved security/product questions;
- confirmation that the unreviewed PDF/print artifacts were not copied.

Completion requires review of the Git diff and evidence. A textual “done” claim
has no completion authority.
