"use client";

import { useState } from "react";
import { Badge, Button, Section, TextArea, LoadingSpinner, ErrorBanner } from "@/components/ui";
import type { CrawlResult } from "@/types";

export function CrawlAnalyzer() {
  const [crawlText, setCrawlText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!crawlText.trim()) { setError("Paste crawl stats data first."); return; }
    setLoading(true); setError("");
    try {
      const resp = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crawlStatsText: crawlText }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="🖥️ Crawl Budget & Server Log Analyzer">
        <div className="grid gap-3">
          <TextArea value={crawlText} onChange={setCrawlText} placeholder={"Paste GSC Crawl Stats raw text here…\n\nExample format:\n200 OK — 87.0%\n404 Not Found — 4.2%\nHTML — 55.0%\nDiscovery — 12.0%"} rows={10} />
          <Button onClick={handleAnalyze} loading={loading}>🖥️ Analyze Crawl Budget</Button>
          <div className="text-muted text-[11px]">Paste raw GSC Crawl Stats percentages for: response codes, file types, and crawl purpose.</div>
        </div>
      </Section>

      {loading && <LoadingSpinner />}
      <ErrorBanner message={error} />

      {result && !loading && (
        <div className="mt-6 animate-fade-in">
          {/* Severity Banner */}
          <div className="rounded-xl p-4 mb-6 flex gap-4 items-center" style={{ background: result.severitySummary.color + "22", border: `1px solid ${result.severitySummary.color}66` }}>
            <span className="text-[32px]">{result.severitySummary.label === "HEALTHY" ? "✅" : result.severitySummary.label === "CRITICAL" ? "🚨" : "⚠️"}</span>
            <div>
              <div className="text-lg font-extrabold" style={{ color: result.severitySummary.color }}>{result.severitySummary.label}</div>
              <div className="text-muted text-[13px] mt-0.5">{result.executiveSummary}</div>
            </div>
          </div>

          {result.statusGroups?.length ? (
            <Section title="📡 HTTP Response Codes" accent="blue">
              <div className="grid gap-2">
                {result.statusGroups.map((g, i) => (
                  <div key={i} className={`bg-card border rounded-lg px-3.5 py-2.5 flex justify-between items-center flex-wrap gap-2 ${g.status === "Healthy" ? "border-green/25" : g.status === "Critical" ? "border-red/40" : "border-amber/25"}`}>
                    <div className="flex gap-2 items-center">
                      <Badge variant={g.status === "Healthy" ? "green" : g.status === "Critical" ? "red" : "amber"}>{g.code}</Badge>
                      <span className="text-text text-sm font-bold">{g.percentage}%</span>
                      <span className="text-muted text-[11px]">{g.status}</span>
                    </div>
                    <div className="text-muted text-[11px] max-w-[400px] text-right">{g.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.fileGroups?.length ? (
            <Section title="📦 File Type Crawl Distribution" accent="amber">
              <div className="grid gap-2">
                {result.fileGroups.map((g, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg px-3.5 py-2.5 flex justify-between items-center flex-wrap gap-2">
                    <div className="flex gap-2 items-center">
                      <Badge variant={g.status === "Healthy" ? "green" : "amber"}>{g.type}</Badge>
                      <span className="text-text text-sm font-bold">{g.percentage}%</span>
                    </div>
                    <div className="text-muted text-[11px] max-w-[400px] text-right">{g.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.purposeGroups?.length ? (
            <Section title="🎯 Crawl Purpose Distribution" accent="purple">
              <div className="grid gap-2">
                {result.purposeGroups.map((g, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg px-3.5 py-2.5 flex justify-between items-center flex-wrap gap-2">
                    <div className="flex gap-2 items-center">
                      <Badge variant={g.status === "Healthy" ? "green" : g.status === "Critical" ? "red" : "amber"}>{g.purpose}</Badge>
                      <span className="text-text text-sm font-bold">{g.percentage}%</span>
                    </div>
                    <div className="text-muted text-[11px] max-w-[400px] text-right">{g.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.issues?.length ? (
            <Section title="🚀 Prioritized Fix List" accent="red">
              <div className="grid gap-3.5">
                {result.issues.map((issue, i) => (
                  <div key={i} className={`bg-card border rounded-xl p-4 ${issue.severity === "High" ? "border-red/40" : "border-border"}`}>
                    <div className="flex justify-between mb-2 flex-wrap gap-2">
                      <div className="flex gap-2 items-center">
                        <Badge variant={issue.severity === "High" ? "red" : issue.severity === "Medium" ? "amber" : "muted"}>{issue.severity}</Badge>
                        <span className="text-text font-bold text-[13px]">{issue.category}</span>
                      </div>
                    </div>
                    <div className="text-text text-[13px] mb-2">{issue.description}</div>
                    <div className="text-green text-xs mb-2 leading-relaxed">{issue.fix}</div>
                    {issue.devOpsChecklist?.length ? (
                      <div>
                        <div className="text-muted text-[11px] uppercase tracking-wider mb-1">DevOps Checklist</div>
                        <div className="grid gap-0.5">
                          {issue.devOpsChecklist.map((step, j) => (
                            <div key={j} className="flex gap-2 items-start">
                              <span className="text-blue text-[11px]">▸</span>
                              <span className="text-muted text-[11px] font-mono">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}
