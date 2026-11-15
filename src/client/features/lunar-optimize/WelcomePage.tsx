import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  FileText,
  Globe2,
  Lightbulb,
  Link2,
  ScanSearch,
  Search,
} from "lucide-react";
import landingCss from "@/client/styles/lunar-optimize.css?url";
import {
  LUNAR_MONTHLY_PRICE_USD,
  LUNAR_MONTHLY_USAGE_CREDIT_USD,
} from "@/shared/billing";

/*
 * The public face of Lunar Optimize (owner, 2026-11-15: in the spirit of a
 * well-known SEO tool's home page: the two places to win, a tabbed product
 * preview, feature chapters, a loop and an FAQ). Structure only; no other
 * product's words or data. Every preview is labelled as example data, and
 * sign-up is by invitation while billing is set up, so the page says so.
 */

const SUPPORT_URL = "https://mission-control.projectlunar.ai/support";

const capabilities = [
  {
    title: "Keyword research",
    description:
      "Explore search demand and related queries with provider-backed data.",
    icon: Search,
  },
  {
    title: "Rank tracking",
    description:
      "Monitor selected keywords for a project, location, and language.",
    icon: BarChart3,
  },
  {
    title: "Competitor insights",
    description: "Compare domains and discover the terms that shape a market.",
    icon: Globe2,
  },
  {
    title: "Backlinks",
    description:
      "Inspect referring links and domains from the connected data provider.",
    icon: Link2,
  },
  {
    title: "Site audits",
    description:
      "Crawl accessible pages and turn technical issues into a work queue.",
    icon: ScanSearch,
  },
  {
    title: "AI visibility",
    description:
      "Explore supported answer surfaces and keep observations distinct from estimates.",
    icon: Bot,
  },
  {
    title: "Content score",
    description:
      "Score a page's copy in your browser, without spending data credits.",
    icon: FileText,
  },
  {
    title: "Opportunities",
    description:
      "Next steps drawn from your audit issues and Search Console, never from guesses.",
    icon: Lightbulb,
  },
] as const;

type Row = { label: string; value: string };
const previews: { id: string; tab: string; title: string; rows: Row[] }[] = [
  {
    id: "audit",
    tab: "Audit",
    title: "Site audit",
    rows: [
      { label: "Pages crawled", value: "148" },
      { label: "Issues to fix", value: "23" },
      { label: "Slowest page", value: "3.4 s" },
      { label: "Next action", value: "Add missing titles (9 pages)" },
    ],
  },
  {
    id: "keywords",
    tab: "Keywords",
    title: "Keyword research",
    rows: [
      { label: "furnace repair near me", value: "2,400 / month" },
      { label: "furnace tune-up cost", value: "880 / month" },
      { label: "Related keywords", value: "14" },
      { label: "Columns", value: "Volume, CPC, intent" },
    ],
  },
  {
    id: "tracking",
    tab: "Tracking",
    title: "Rank tracking",
    rows: [
      { label: "Tracked keywords", value: "40" },
      { label: "In the top 10", value: "12" },
      { label: "Moved up this week", value: "5" },
      { label: "Location and language", value: "Per project" },
    ],
  },
  {
    id: "ai",
    tab: "AI visibility",
    title: "AI answers",
    rows: [
      { label: "Questions checked", value: "20" },
      { label: "Answers naming your brand", value: "6" },
      { label: "Observed or estimated", value: "Always labelled" },
      { label: "Surfaces", value: "Supported ones only" },
    ],
  },
];

const faq = [
  {
    q: "Is the data real?",
    a: "Yes, when the data provider is connected and answering. When the keyword data provider is not connected, the workspace shows a Sample data notice.",
  },
  {
    q: "Can I sign up today?",
    a: "Sign-up is by invitation while billing is set up. Ask for one through the Project Lunar support page.",
  },
  {
    q: "What does it cost?",
    a: `One plan, $${LUNAR_MONTHLY_PRICE_USD} a month, including $${LUNAR_MONTHLY_USAGE_CREDIT_USD.toFixed(2)} of metered data credits. Enrollment opens once billing setup is complete.`,
  },
  {
    q: "Does it cover AI answers as well as search?",
    a: "Yes. AI visibility looks at supported answer surfaces and keeps what it observed apart from what it estimated.",
  },
];

export const landingHead = () => ({
  meta: [
    {
      title:
        "Lunar Optimize | Be found in search and in AI answers",
    },
    {
      name: "description",
      content:
        "Audit your site, research keywords and competitors, track rankings and see where AI answers mention you, in one Project Lunar workspace.",
    },
  ],
  links: [{ rel: "stylesheet", href: landingCss }],
});

function Preview() {
  const [active, setActive] = useState(0);
  const preview = previews[active]!;
  return (
    <div className="lo-tabs">
      <div className="lo-tablist" role="tablist" aria-label="Product preview">
        {previews.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`lo-tab-${p.id}`}
            aria-selected={i === active}
            aria-controls="lo-tabpanel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              const step =
                e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = (active + step + previews.length) % previews.length;
              setActive(next);
              document.getElementById(`lo-tab-${previews[next]!.id}`)?.focus();
            }}
          >
            {p.tab}
          </button>
        ))}
      </div>
      <div
        className="lo-preview"
        role="tabpanel"
        id="lo-tabpanel"
        aria-labelledby={`lo-tab-${preview.id}`}
      >
        <div className="lo-preview-top">
          <span className="lo-preview-dot" /> {preview.title.toUpperCase()}{" "}
          <span className="lo-example">Example data</span>
        </div>
        <div className="lo-preview-body">
          {preview.rows.map((r) => (
            <div className="lo-preview-row" key={r.label}>
              <span>{r.label}</span>
              <span>{r.value}</span>
            </div>
          ))}
        </div>
        <p>Example data, not your site.</p>
      </div>
    </div>
  );
}

export function WelcomePage() {
  return (
    <main className="lo-page">
      <a className="lo-skip" href="#main-content">
        Skip to content
      </a>
      <header className="lo-header">
        <a
          className="lo-brand"
          href="/welcome"
          aria-label="Lunar Optimize home"
        >
          <span className="lo-mark" aria-hidden="true">
            ◐
          </span>
          <span>
            <strong>lunar</strong>
            <em>optimize</em>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#capabilities">Features</a>
          <a href="#faq">Questions</a>
          <a className="lo-header-signin" href="/sign-in">
            Sign in
          </a>
        </nav>
      </header>

      <section
        className="lo-hero"
        id="main-content"
        aria-labelledby="hero-title"
      >
        <div className="lo-orbit lo-orbit-one" aria-hidden="true" />
        <div className="lo-orbit lo-orbit-two" aria-hidden="true" />
        <div className="lo-hero-inner">
          <p className="lo-eyebrow">
            <span /> PROJECT LUNAR · SEARCH INTELLIGENCE
          </p>
          <h1 id="hero-title">
            Be found in search.
            <br />
            <span>And in AI answers.</span>
          </h1>
          <p className="lo-hero-copy">
            Audit your site, research keywords and competitors, track your
            rankings and see where AI answers mention you.
          </p>
          <div className="lo-actions">
            <a className="lo-button lo-button-primary" href="/sign-in">
              Sign in <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="lo-button lo-button-secondary" href={SUPPORT_URL}>
              Ask for an invitation
            </a>
          </div>
          <ul className="lo-reassure" aria-label="Good to know">
            <li>Sign-up is by invitation while billing is set up</li>
            <li>The previews on this page are example data</li>
            <li>Source and date on dashboard and opportunity cards</li>
          </ul>
        </div>
        <Preview />
      </section>

      <section className="lo-section" aria-labelledby="two-title">
        <div className="lo-section-heading">
          <p className="lo-kicker">ONE QUESTION, TWO PLACES</p>
          <h2 id="two-title">People ask search engines and AI assistants</h2>
          <p>
            The same question now has two places to answer it. Lunar Optimize
            looks at both.
          </p>
        </div>
        <div className="lo-two">
          <article className="lo-card">
            <Search size={22} strokeWidth={1.8} aria-hidden="true" />
            <h3>Search results</h3>
            <p>
              Keywords, rankings, competitors, backlinks and the technical
              health of your pages.
            </p>
          </article>
          <article className="lo-card">
            <Bot size={22} strokeWidth={1.8} aria-hidden="true" />
            <h3>AI answers</h3>
            <p>
              Which supported answer surfaces mention you, kept apart from
              estimates.
            </p>
          </article>
        </div>
      </section>

      <section
        className="lo-section"
        id="capabilities"
        aria-labelledby="capabilities-title"
      >
        <div className="lo-section-heading">
          <p className="lo-kicker">ONE WORKSPACE</p>
          <h2 id="capabilities-title">From research to action</h2>
          <p>
            Choose a project, connect the relevant sources, and work from the
            evidence available for that domain.
          </p>
        </div>
        <div className="lo-grid">
          {capabilities.map(({ title, description, icon: Icon }) => (
            <article className="lo-card" key={title}>
              <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lo-section" aria-labelledby="loop-title">
        <div className="lo-section-heading">
          <p className="lo-kicker">THE LOOP</p>
          <h2 id="loop-title">Audit, fix, write, track. Then again.</h2>
        </div>
        <ol className="lo-loop">
          <li>Audit</li>
          <li>Fix</li>
          <li>Write</li>
          <li>Track</li>
          <li>Repeat</li>
        </ol>
      </section>

      <section
        className="lo-section lo-process"
        id="how-it-works"
        aria-labelledby="process-title"
      >
        <div className="lo-section-heading">
          <p className="lo-kicker">A CLEAR START</p>
          <h2 id="process-title">Three steps to a picture you can trust</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Add a domain</h3>
              <p>
                Create a project and choose the site you want to understand.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Run the right research</h3>
              <p>
                Use provider-backed lookups and connect first-party sources when
                available.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Make the next move</h3>
              <p>
                Review timestamps, gaps, and findings before changing a page or
                campaign.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section
        className="lo-pricing lo-section"
        aria-labelledby="pricing-title"
      >
        <div className="lo-section-heading">
          <p className="lo-kicker">SIMPLE PRICING</p>
          <h2 id="pricing-title">One plan for the whole workflow</h2>
          <p>Enrollment will open after billing setup is complete.</p>
        </div>
        <div className="lo-price-card">
          <div>
            <p className="lo-price-name">Lunar Optimize</p>
            <p className="lo-price-amount">
              ${LUNAR_MONTHLY_PRICE_USD}
              <span>/month</span>
            </p>
            <p className="lo-price-detail">
              Includes ${LUNAR_MONTHLY_USAGE_CREDIT_USD.toFixed(2)} in metered
              data credits each month. Usage cost varies by feature; the
              workspace shows your remaining balance.
            </p>
          </div>
          <a className="lo-button lo-button-secondary" href="/subscribe">
            View enrollment status <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="lo-section" id="faq" aria-labelledby="faq-title">
        <div className="lo-section-heading">
          <p className="lo-kicker">QUESTIONS</p>
          <h2 id="faq-title">Before you start</h2>
        </div>
        <div className="lo-faq">
          {faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lo-final" aria-labelledby="final-title">
        <p className="lo-kicker">START WITH CLARITY</p>
        <h2 id="final-title">
          Your next search opportunity starts with better evidence.
        </h2>
        <div className="lo-actions lo-actions-center">
          <a className="lo-button lo-button-primary" href="/sign-in">
            Sign in <ArrowRight size={17} aria-hidden="true" />
          </a>
          <a className="lo-button lo-button-secondary" href={SUPPORT_URL}>
            Ask for an invitation
          </a>
        </div>
      </section>
      <footer className="lo-footer">
        <span>
          © {new Date().getUTCFullYear()} Project Lunar · Lunar Optimize
        </span>
        <span>Data availability and freshness are shown in the product.</span>
      </footer>
    </main>
  );
}
