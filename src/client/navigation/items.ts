import {
  Bookmark,
  Bot,
  ClipboardCheck,
  FileText,
  Globe,
  LayoutDashboard,
  Lightbulb,
  Link2,
  MessageSquare,
  Radar,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { linkOptions } from "@tanstack/react-router";
import { GoogleGlyphMuted } from "@/client/features/gsc/GoogleGlyph";

// Five destinations for a project. The research tools are views inside
// Intelligence: they keep their own URLs (nothing a person bookmarked breaks),
// are reached from the Intelligence page and its tab strip, and light up the
// Intelligence item in the sidebar. They are no longer sidebar items of their own.

export const INTELLIGENCE_VIEWS = [
  {
    to: "/p/$projectId/keywords" as const,
    label: "Keyword Research",
    short: "Keywords",
    icon: Search,
    blurb: "Search demand and related queries.",
  },
  {
    to: "/p/$projectId/search-performance" as const,
    label: "GSC Insights",
    short: "Search Console",
    icon: GoogleGlyphMuted,
    blurb: "Your own clicks, impressions and positions.",
  },
  {
    to: "/p/$projectId/content-score" as const,
    label: "Content Score",
    short: "Content",
    icon: FileText,
    blurb: "How a page covers its topic.",
  },
  {
    to: "/p/$projectId/domain" as const,
    label: "Domain Overview",
    short: "Domain",
    icon: Globe,
    blurb: "A domain's footprint, yours or a competitor's.",
  },
  {
    to: "/p/$projectId/backlinks" as const,
    label: "Backlinks",
    short: "Backlinks",
    icon: Link2,
    blurb: "Referring links and domains.",
  },
  {
    to: "/p/$projectId/rank-tracking" as const,
    label: "Rank Tracking",
    short: "Rankings",
    icon: TrendingUp,
    blurb: "Tracked keywords by location and language.",
  },
  {
    to: "/p/$projectId/saved" as const,
    label: "Saved Keywords",
    short: "Saved",
    icon: Bookmark,
    blurb: "Keywords you kept.",
  },
  {
    to: "/p/$projectId/brand-lookup" as const,
    label: "Brand Lookup",
    short: "Brand",
    icon: Sparkles,
    blurb: "How AI answers describe a brand.",
  },
  {
    to: "/p/$projectId/prompt-explorer" as const,
    label: "Prompt Explorer",
    short: "Prompts",
    icon: MessageSquare,
    blurb: "Which prompts surface which sources.",
  },
] as const;

export type IntelligenceViewPath = (typeof INTELLIGENCE_VIEWS)[number]["to"];

export function intelligenceViewPaths(projectId: string): string[] {
  return INTELLIGENCE_VIEWS.map((v) => v.to.replace("$projectId", projectId));
}

const projectNavItems = [
  {
    to: "/p/$projectId" as const,
    label: "Overview",
    icon: LayoutDashboard,
    // Without exact matching, the index path is a prefix of every project
    // route and the Overview item would render active everywhere.
    activeOptions: { exact: true, includeSearch: false },
  },
  {
    to: "/p/$projectId/intelligence" as const,
    label: "Intelligence",
    icon: Radar,
  },
  {
    to: "/p/$projectId/opportunities" as const,
    label: "Opportunities",
    icon: Lightbulb,
  },
  {
    to: "/p/$projectId/audit" as const,
    label: "Audit",
    icon: ClipboardCheck,
  },
  {
    to: "/p/$projectId/settings" as const,
    label: "Settings",
    icon: Settings,
  },
] as const;

const aiNavItem = linkOptions({
  to: "/ai" as const,
  label: "AI & MCP",
  icon: Bot,
});

// Always-visible sidebar group (not project-scoped, unlike the group below).
export const connectNavGroup = {
  label: "Connect",
  items: [aiNavItem],
};

function getProjectNavItems(projectId: string) {
  return linkOptions(
    projectNavItems.map((item) => ({
      ...item,
      params: { projectId },
      search: {},
    })),
  );
}

export function getProjectNavGroups(projectId: string) {
  const all = getProjectNavItems(projectId);
  const byPath = (path: (typeof projectNavItems)[number]["to"]) =>
    all.find((i) => i.to === path)!;
  const intelligence = {
    ...byPath("/p/$projectId/intelligence"),
    alsoActiveFor: intelligenceViewPaths(projectId),
  };

  return [
    {
      label: "Project",
      items: [
        byPath("/p/$projectId"),
        intelligence,
        byPath("/p/$projectId/opportunities"),
        byPath("/p/$projectId/audit"),
        byPath("/p/$projectId/settings"),
      ],
    },
  ];
}

export const dataforseoHelpLinkOptions = linkOptions({
  to: "/help/dataforseo-api-key",
});
