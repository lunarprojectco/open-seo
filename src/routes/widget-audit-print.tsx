import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect } from "react";
import {
  Lock,
  Compass,
  Search,
  Database,
  Activity,
  Sparkles,
  Shield,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle,
} from "lucide-react";

const searchSchema = z.object({
  domain: z.string().catch(""),
  email: z.string().catch(""),
  autoPrint: z.string().catch(""),
});

export const Route = createFileRoute("/widget-audit-print")({
  validateSearch: searchSchema,
  component: WidgetAuditPrintPage,
});

function WidgetAuditPrintPage() {
  const { domain, email, autoPrint } = Route.useSearch();

  const auditQuery = useQuery({
    queryKey: ["widget-audit-print-data", domain, email],
    queryFn: async () => {
      if (!domain) throw new Error("Domain is required.");
      const response = await fetch("/api/widget/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, email }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as any;
        const msg = body?.error?.message || body?.error || "Audit request failed.";
        throw new Error(msg);
      }
      return response.json() as Promise<any>;
    },
    enabled: !!domain,
    retry: false,
    staleTime: Infinity,
  });

  // Signal Playwright when the report is completely loaded and rendered, and trigger window.print if autoPrint is true
  useEffect(() => {
    if (auditQuery.data) {
      document.body.setAttribute("data-print-ready", "true");
      if (autoPrint === "true") {
        const timer = setTimeout(() => {
          window.print();
        }, 1000);
        return () => clearTimeout(timer);
      }
    } else {
      document.body.removeAttribute("data-print-ready");
    }
    return () => {
      document.body.removeAttribute("data-print-ready");
    };
  }, [auditQuery.data, autoPrint]);

  if (!domain) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl shadow-md max-w-md w-full border border-slate-200">
          <div className="flex items-center gap-3 text-red-600 mb-3">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-lg font-bold">Missing Target Domain</h2>
          </div>
          <p className="text-slate-600 text-sm mb-4">
            A valid target domain query parameter is required to generate this report.
          </p>
        </div>
      </div>
    );
  }

  if (auditQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-[#005EA6] animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800 mb-1">Generating Your Courtroom-Ready Report</h2>
        <p className="text-slate-500 text-sm animate-pulse max-w-sm text-center">
          Querying search footprint... assembling audit layers... structuring baseline models...
        </p>
      </div>
    );
  }

  if (auditQuery.isError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl shadow-md max-w-md w-full border border-slate-200">
          <div className="flex items-center gap-3 text-red-600 mb-3">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-lg font-bold">Generation Failed</h2>
          </div>
          <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 mb-4">
            {auditQuery.error instanceof Error ? auditQuery.error.message : "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-[#005EA6] hover:bg-[#004b85] text-white py-2 rounded-lg font-semibold text-sm transition-colors"
          >
            Retry Generation
          </button>
        </div>
      </div>
    );
  }

  const data = auditQuery.data as any;
  const summary = data.summary || {};
  const layers = data.layers || {};
  const searchLayer = layers.search || {};
  const formattedDate = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "Recently";

  return (
    <div className="min-h-screen bg-white p-8 max-w-4xl mx-auto print:p-0 print:max-w-full font-sans antialiased text-slate-800">
      {/* Printable page layout container */}
      <div className="border border-slate-200 rounded-2xl p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#005EA6] text-white text-xs font-bold px-2.5 py-1 rounded">OpenSEO</span>
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Baseline Audit</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Courtroom-Ready Trust Report</h1>
            <p className="text-slate-500 text-sm mt-1">
              Independent audit of <strong className="text-slate-800">{domain}</strong>
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Report Generated</div>
            <div className="text-sm font-medium text-slate-700 mt-0.5">{formattedDate}</div>
            {email && (
              <div className="text-xs text-slate-400 mt-1">
                Requested by: <span className="text-slate-600 font-medium">{email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Brand Invariants Row / Disclaimer */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-8 flex gap-3 items-start">
          <Shield className="w-5 h-5 text-[#005EA6] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">獨立性及合規性聲明 (Audit Disclaimers)</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              This report provides an independent public baseline assessment. Standard scores (Reputation Risk and Data Confidence) are strictly marked as <strong>Not Computed</strong> to prevent data fabrication. A full certified rating is unlocked only upon explicit account integration.
            </p>
          </div>
        </div>

        {/* Scores Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-5 text-center flex flex-col justify-between min-h-[140px]">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reputation Risk Score</span>
              <p className="text-xs text-slate-400 mt-0.5">{summary.reputationRiskScore?.reason || "Requires integrated data."}</p>
            </div>
            <div className="text-3xl font-black text-slate-400 my-3">— / 100</div>
            <div className="flex items-center justify-center gap-1.5 text-orange-600 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Connect Accounts to Unlock</span>
            </div>
          </div>

          <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-5 text-center flex flex-col justify-between min-h-[140px]">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Data Confidence</span>
              <p className="text-xs text-slate-400 mt-0.5">{summary.overallDataConfidence?.reason || "Requires connected accounts."}</p>
            </div>
            <div className="text-3xl font-black text-slate-400 my-3">— %</div>
            <div className="flex items-center justify-center gap-1.5 text-orange-600 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Connect Accounts to Unlock</span>
            </div>
          </div>
        </div>

        {/* Main Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Estimated Search Visibility Column */}
          <div className="md:col-span-1 border border-slate-100 rounded-xl p-5 bg-slate-50/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-green-50 text-green-600 rounded-lg">
                <Search className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Estimated Search</h3>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-slate-100 rounded-lg p-3.5 shadow-sm">
                <span className="text-xs font-medium text-slate-400">Est. Organic Traffic</span>
                <p className="text-xl font-extrabold text-[#005EA6] mt-1">
                  {searchLayer.organicTraffic != null ? searchLayer.organicTraffic.toLocaleString() : "No Data"}
                </p>
                <span className="text-[10px] text-slate-400 mt-1 block">estimated monthly visits</span>
              </div>

              <div className="bg-white border border-slate-100 rounded-lg p-3.5 shadow-sm">
                <span className="text-xs font-medium text-slate-400">Organic Keywords</span>
                <p className="text-xl font-extrabold text-[#005EA6] mt-1">
                  {searchLayer.organicKeywords != null ? searchLayer.organicKeywords.toLocaleString() : "No Data"}
                </p>
                <span className="text-[10px] text-slate-400 mt-1 block">estimated rankings</span>
              </div>
            </div>
            
            <div className="mt-5 flex items-center gap-1.5 text-green-600 text-xs font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Layer Available</span>
            </div>
          </div>

          {/* Audit Integration Statuses Column */}
          <div className="md:col-span-2 border border-slate-100 rounded-xl p-5 bg-slate-50/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Verification Planes &amp; Layers</h3>
            </div>

            <ul className="divide-y divide-slate-100">
              <li className="py-3 flex justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Website Crawl &amp; SEO Diagnostics</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{layers.website?.reason}</p>
                </div>
                <span className="inline-flex h-fit bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100 tracking-wide uppercase shrink-0">
                  {layers.website?.status || "NOT RUN"}
                </span>
              </li>

              <li className="py-3 flex justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Reputation &amp; Trust Authority</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{layers.reputation?.reason}</p>
                </div>
                <span className="inline-flex h-fit bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100 tracking-wide uppercase shrink-0">
                  {layers.reputation?.status || "NOT RUN"}
                </span>
              </li>

              <li className="py-3 flex justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-700">First-Party Analytics Connection</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{layers.analytics?.reason}</p>
                </div>
                <span className="inline-flex h-fit bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100 tracking-wide uppercase shrink-0">
                  {layers.analytics?.status || "NOT RUN"}
                </span>
              </li>

              <li className="py-3 flex justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Brand DNA &amp; Content Alignment</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{layers.brand?.reason}</p>
                </div>
                <span className="inline-flex h-fit bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100 tracking-wide uppercase shrink-0">
                  {layers.brand?.status || "NOT RUN"}
                </span>
              </li>

              <li className="py-3 flex justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Motion Execution Sync</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{layers.execution?.reason}</p>
                </div>
                <span className="inline-flex h-fit bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100 tracking-wide uppercase shrink-0">
                  {layers.execution?.status || "NOT RUN"}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF7A00] opacity-10 rounded-full blur-2xl transform translate-x-12 -translate-y-12"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#005EA6] opacity-15 rounded-full blur-3xl transform -translate-x-12 translate-y-12"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <span className="bg-[#FF7A00] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2 inline-block">
                Upgrade Audit Action
              </span>
              <h2 className="text-lg font-extrabold tracking-tight">Activate Bounded Crawler &amp; Full Reputation Planes</h2>
              <p className="text-slate-300 text-xs mt-1 max-w-xl leading-relaxed">
                Connect your GA4, Search Console, and Google Places profiles. Run site-wide crawler crawls, evaluate true review sentiment, map compliance, and auto-sync action items onto your courtroom workspace.
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-center">
              <span className="text-xs font-bold text-[#FF7A00] mb-1">Confidential Lead ID</span>
              <span className="font-mono text-xs text-slate-400 uppercase tracking-widest bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700/50">
                {domain.replace(/\.[^/.]+$/, "").substring(0, 8)}-{Math.floor(1000 + Math.random() * 9000)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer info (Print only or global) */}
        <div className="border-t border-slate-100 pt-6 mt-8 flex flex-col md:flex-row justify-between items-center text-slate-400 text-[10px]">
          <div>&copy; 2026 Alberta Indoor Comfort &amp; OpenSEO. All Rights Reserved.</div>
          <div className="flex items-center gap-2 mt-2 md:mt-0 font-medium">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span>Independent Compliance Ledger Version {data.schemaVersion || "2026-08-20"}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
