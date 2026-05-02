"use client";

import { useState } from "react";
import {
  GscCommandCenter,
  CtrLab,
  KeywordResearch,
  TopicAnalyzer,
  SavedReports,
  RegexFilter,
  IndexDiagnoser,
  CrawlAnalyzer,
  GeoMatrix,
  SitemapValidator,
} from "@/components/tabs";

// ─── Tab Configuration ──────────────────────────────────────────────────────
const TABS = [
  { key: "gsc", label: "GSC", icon: "📊" },
  { key: "ctr", label: "CTR Lab", icon: "🎯" },
  { key: "keywords", label: "Keywords", icon: "🔬" },
  { key: "filter", label: "Filter", icon: "🔍" },
  { key: "index", label: "Index", icon: "🩺" },
  { key: "crawl", label: "Crawl", icon: "🖥️" },
  { key: "geo", label: "GEO", icon: "📐" },
  { key: "sitemap", label: "Sitemap", icon: "🗺️" },
  { key: "topic", label: "Topic", icon: "🔬" },
  { key: "reports", label: "Reports", icon: "📚" },
];

export default function SEOMaster() {
  const [activeTab, setActiveTab] = useState("gsc");

  const renderTab = () => {
    switch (activeTab) {
      case "gsc": return <GscCommandCenter />;
      case "ctr": return <CtrLab />;
      case "keywords": return <KeywordResearch />;
      case "filter": return <RegexFilter />;
      case "index": return <IndexDiagnoser />;
      case "crawl": return <CrawlAnalyzer />;
      case "geo": return <GeoMatrix />;
      case "sitemap": return <SitemapValidator />;
      case "topic": return <TopicAnalyzer />;
      case "reports": return <SavedReports />;
      default: return <GscCommandCenter />;
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface/80 glass">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue to-purple flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue/25">
                S
              </div>
              <div>
                <h1 className="text-text text-base font-extrabold tracking-tight leading-none">
                  SEOMaster
                </h1>
                <p className="text-muted text-[10px] tracking-wide">
                  AI-POWERED SEO ANALYTICS
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="hidden sm:flex items-center gap-3 text-[11px]">
              <span className="text-muted">Engine</span>
              <span className="inline-flex items-center gap-1.5 bg-green/10 text-green border border-green/25 rounded px-2 py-0.5 text-[10px] font-bold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                MiniMax M2.7
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ──────────────────────────────────────────────── */}
      <nav className="sticky top-16 z-40 border-b border-border bg-bg/90 glass">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-blue text-white shadow-lg shadow-blue/20"
                    : "text-muted hover:text-text hover:bg-surface"
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
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
      <footer className="border-t border-border mt-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-[11px] text-muted">
          <span>SEOMaster © {new Date().getFullYear()}</span>
          <span>Powered by MiniMax M2.7 + Google Search Console API</span>
        </div>
      </footer>
    </div>
  );
}