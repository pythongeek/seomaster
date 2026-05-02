"use client";

import { useState } from "react";
import { Badge, Button, Section, TextArea, StatCard, LoadingSpinner, ErrorBanner } from "@/components/ui";
import type { IndexResult } from "@/types";

export function IndexDiagnoser() {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IndexResult | null>(null);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!rawText.trim()) { setError("Paste GSC indexing data first."); return; }
    setLoading(true); setError("");
    try {
      const resp = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="🩺 Indexation Diagnostic Engine">
        <div className="grid gap-3">
          <TextArea value={rawText} onChange={setRawText} placeholder={"Paste raw CSV or text from GSC 'Why pages aren't indexed' report here…\n\nExample format:\nhttps://yoursite.com/blog/post1\tCrawled - currently not indexed"} rows={8} />
          <Button onClick={handleAnalyze} loading={loading}>🩺 Diagnose Indexation</Button>
          <div className="text-muted text-[11px]">Supports tab-separated, comma-separated, or pipe-separated (URL • Reason) formats</div>
        </div>
      </Section>

      {loading && <LoadingSpinner />}
      <ErrorBanner message={error} />

      {result && !loading && (
        <div className="mt-6 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="URLs Analyzed" value={result.totalUrls.toLocaleString()} variant="blue" />
            <StatCard label="Patterns Found" value={result.uniquePatterns.toString()} variant="amber" />
            <StatCard label="High Priority" value={result.patternGroups?.filter(g => g.priority === "High").length.toString() || "0"} variant="red" />
            <StatCard label="Medium Priority" value={result.patternGroups?.filter(g => g.priority === "Medium").length.toString() || "0"} variant="amber" />
          </div>

          {result.executiveSummary && (
            <Section title="📝 Executive Summary" accent="green">
              <div className="bg-card border border-green/25 rounded-xl p-4 text-text text-[13px] leading-relaxed">{result.executiveSummary}</div>
            </Section>
          )}

          {result.quickFixes?.length ? (
            <Section title="⚡ Quick Fixes — Start Here" accent="red">
              <div className="grid gap-2">
                {result.quickFixes.map((fix, i) => (
                  <div key={i} className="bg-card border border-red/25 rounded-lg px-3.5 py-2.5 text-text text-[13px]">{fix}</div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.patternGroups?.length ? (
            <Section title="🔎 Pattern-Based Diagnosis" accent="blue">
              <div className="grid gap-4">
                {result.patternGroups.map((group, i) => (
                  <div key={i} className={`bg-card border rounded-xl p-4 ${group.priority === "High" ? "border-red/40" : group.priority === "Medium" ? "border-amber/25" : "border-border"}`}>
                    <div className="flex justify-between items-start mb-2.5 flex-wrap gap-2">
                      <div className="flex gap-2 items-center">
                        <Badge variant={group.priority === "High" ? "red" : group.priority === "Medium" ? "amber" : "muted"}>{group.priority} Priority</Badge>
                        <span className="text-text font-bold text-[13px]">{group.patternLabel}</span>
                      </div>
                      <span className="text-muted text-xs">{group.count} URLs</span>
                    </div>
                    <div className="mb-2.5">
                      <div className="text-muted text-[11px] uppercase tracking-wider mb-1">Diagnosis</div>
                      <div className="text-text text-[13px] leading-relaxed">{group.diagnosis}</div>
                    </div>
                    <div className="mb-2.5">
                      <div className="text-muted text-[11px] uppercase tracking-wider mb-1">Resolution</div>
                      <div className="text-green text-[13px] leading-relaxed bg-surface rounded-md px-3 py-2">{group.resolution}</div>
                    </div>
                    <div>
                      <div className="text-muted text-[11px] uppercase tracking-wider mb-1">Affected URLs ({group.urls.length})</div>
                      <div className="max-h-[120px] overflow-y-auto grid gap-0.5">
                        {group.urls.slice(0, 20).map((url, j) => (
                          <div key={j} className="text-muted text-[11px] font-mono px-1 py-0.5 bg-bg rounded truncate">{url}</div>
                        ))}
                        {group.urls.length > 20 && <div className="text-muted text-[11px] italic">…and {group.urls.length - 20} more</div>}
                      </div>
                    </div>
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
