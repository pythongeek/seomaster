"use client";

import {
  GscCommandCenter,
  CtrLab,
  CrawlAnalyzer,
  GeoMatrix,
  TopicClusters,
  CoreWebVitals,
} from "@/components/tabs";

import {
  AIOverviewPanel,
  ContentGapPanel,
  ExecutiveDashboard,
  OpportunityQueue,
} from "@/components/panels";

import { ExpertiseLevelToggle } from "@/components/ui/ExpertiseLevelToggle";
import { useStore } from "@/store";

// ─── Tab Configuration ──────────────────────────────────────────────────────
const TABS = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "opportunities", label: "Opportunities", icon: "🎯" },
  { key: "ai_risk", label: "AI & GEO Risk", icon: "🤖" },
  { key: "content_gap", label: "Content Gap", icon: "📋" },
  { key: "gsc", label: "GSC Data", icon: "🔌" },
  { key: "ctr", label: "CTR Lab", icon: "📐" },
  { key: "clusters", label: "Topic Clusters", icon: "🔬" },
  { key: "cwv", label: "Core Web Vitals", icon: "⚡" },
  { key: "geo", label: "Geo & Device", icon: "🌍" },
  { key: "crawl", label: "Crawl & Index", icon: "🩺" },
];

export default function SEOMaster() {
  const { activeTab, setActiveTab, siteUrl, gscResult } = useStore();

  const renderTab = () => {
    // Map gscResult to expected arrays if possible, else empty array
    const opportunities = (gscResult as any)?.opportunities || [];
    const aiItems = gscResult?.aiOverviewCandidates || [];
    const contentGaps = gscResult?.contentGaps || [];
    const topicClusters = (gscResult as any)?.clusters || [];
    const cwvPages = (gscResult as any)?.cwvPages || [];

    switch (activeTab) {
      case "dashboard": return <ExecutiveDashboard siteUrl={siteUrl} />;
      case "opportunities": return <OpportunityQueue siteUrl={siteUrl} opportunities={opportunities} />;
      case "ai_risk": return <AIOverviewPanel items={aiItems as any} />;
      case "content_gap": return <ContentGapPanel gaps={contentGaps as any} />;
      case "gsc": return <GscCommandCenter />;
      case "ctr": return <CtrLab />;
      case "clusters": return <TopicClusters clusters={topicClusters} />;
      case "cwv": return <CoreWebVitals pages={cwvPages} />;
      case "geo": return <GeoMatrix />;
      case "crawl": return <CrawlAnalyzer />;
      default: return <ExecutiveDashboard siteUrl={siteUrl} />;
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-bg border-b border-border shadow-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-15 py-3">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red flex items-center justify-center text-white font-black text-sm shadow-md shadow-red/20">
                S
              </div>
              <div>
                <h1 className="text-text text-base font-extrabold tracking-tight leading-none">
                  SEOMaster
                </h1>
                <p className="text-muted text-[10px] tracking-widest uppercase font-medium">
                  AI SEO Analytics
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="hidden sm:flex items-center gap-6 text-[11px]">
              <ExpertiseLevelToggle compact />
              
              <div className="flex items-center gap-3">
                <span className="text-muted">Engine</span>
                <span className="inline-flex items-center gap-1.5 bg-green-light text-green-dark border border-green/20 rounded-full px-3 py-1 text-[10px] font-bold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                  MiniMax M2.7
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ──────────────────────────────────────────────── */}
      <nav className="bg-bg border-b border-border sticky top-[60px] z-40">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-all duration-150 ${
                  activeTab === tab.key || (activeTab === "gsc" && tab.key === "dashboard" && false) // fallbacks handled in switch
                    ? "bg-red text-white shadow-md shadow-red/15"
                    : "text-muted hover:text-text hover:bg-surface"
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span className="inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-fade-in" key={activeTab}>
          {renderTab()}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-12 bg-surface">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-[11px] text-muted">
          <span className="font-medium">SEOMaster © {new Date().getFullYear()}</span>
          <span>MiniMax M2.7 + Google Search Console</span>
        </div>
      </footer>
    </div>
  );
}