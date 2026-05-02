"use client";

import { useState } from "react";
import { Badge, Button, Section, Input, TextArea, StatCard, LoadingSpinner, ErrorBanner, ProgressBar } from "@/components/ui";
import { parseGSCcsv } from "@/lib/api";
import { useStore } from "@/store";
import { useJobPolling } from "@/hooks/useJobPolling";
import type { FilterResult } from "@/types";
import { useRef } from "react";

export function RegexFilter() {
  const { csvText, setCsvText, gscRows } = useStore();
  const [searchType, setSearchType] = useState("web");
  const [regexFilter, setRegexFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FilterResult | null>(null);
  const [error, setError] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  
  const currentJob = useJobPolling(activeJobId, (res) => {
    setResult(res);
    setLoading(false);
    setActiveJobId(null);
  }, (err) => {
    setError(err);
    setLoading(false);
    setActiveJobId(null);
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText((ev.target?.result as string) || "");
    reader.readAsText(f);
  };

  const handleAnalyze = async () => {
    let dataset = gscRows;
    if (!dataset.length) {
      if (!csvText.trim()) { setError("Load data first."); return; }
      dataset = parseGSCcsv(csvText);
    }
    setLoading(true); setError(""); setResult(null);
    try {
      const payload = { dataset, searchType, regexFilter };

      if (dataset.length > 1500) {
        const resp = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "filter", input: payload }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || "Failed to start background job");
        setActiveJobId(json.jobId);
        return;
      }

      const resp = await fetch("/api/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { setError((e as Error).message); }
    finally { if (!activeJobId) setLoading(false); }
  };

  return (
    <div>
      <Section title="🔍 Regex Search Console Filter">
        <div className="grid gap-3">
          <div className="flex gap-2.5 flex-wrap">
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} ref={fileRef} className="hidden" />
            {!gscRows.length && <Button variant="outline" onClick={() => fileRef.current?.click()}>📁 Select CSV</Button>}
            <Button onClick={handleAnalyze} loading={loading} disabled={!gscRows.length && !csvText}>🔍 Run Filter</Button>
          </div>
          {!gscRows.length && <TextArea value={csvText} onChange={setCsvText} placeholder="Paste GSC CSV data here…" rows={4} />}
          {gscRows.length > 0 && <div className="text-green text-xs font-bold mt-2">✓ Using {gscRows.length.toLocaleString()} rows from GSC tab.</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div>
              <div className="text-muted text-[11px] mb-1">Search Surface</div>
              <select value={searchType} onChange={e => setSearchType(e.target.value)}
                className="w-full bg-surface text-text border border-border rounded-lg px-3.5 py-2.5 text-[13px] font-mono outline-none">
                {["web", "news", "discover", "googleNews"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Input value={regexFilter} onChange={setRegexFilter} placeholder="Regex pattern (e.g. ^how to|guide$)" />
          </div>
          <div className="text-muted text-[11px]">Supports regex like: <code className="text-blue">{"^how to|guide$"}</code> <code className="text-blue">{"\\bbuy\\b|\\bprice\\b"}</code></div>
        </div>
      </Section>

      {currentJob && (
        <div className="mb-4 mt-4">
          <ProgressBar progress={currentJob.progress || 0} message={currentJob.progressMessage || "Processing data..."} status={currentJob.status as any} />
        </div>
      )}

      {loading && !currentJob && <LoadingSpinner />}
      <ErrorBanner message={error} />

      {result && !loading && (
        <div className="mt-6 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Filtered" value={result.totalFiltered.toLocaleString()} variant="blue" />
            <StatCard label="CTR Gaps" value={result.ctrGaps.length.toString()} variant="amber" />
            <StatCard label="Cannibalization" value={result.cannibalization.length.toString()} variant="red" />
            <StatCard label="Intent Buckets" value={result.intentDistribution.length.toString()} variant="green" />
          </div>

          {result.executiveSummary && (
            <Section title="📝 Executive Summary" accent="green">
              <div className="bg-card border border-green/25 rounded-xl p-4 text-text text-[13px] leading-relaxed">{result.executiveSummary}</div>
            </Section>
          )}

          {result.intentDistribution?.length ? (
            <Section title="🧠 Intent Distribution" accent="blue">
              <div className="grid gap-2">
                {result.intentDistribution.map((bucket, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg px-3.5 py-2.5 flex justify-between items-center flex-wrap gap-2">
                    <div className="flex gap-2 items-center">
                      <Badge variant={bucket.intent === "Transactional" ? "green" : bucket.intent === "Navigational" ? "blue" : bucket.intent === "Informational" ? "amber" : "muted"}>{bucket.intent}</Badge>
                      <span className="text-muted text-xs">{bucket.count} queries</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-text text-xs">{bucket.impressions?.toLocaleString()} impr</span>
                      <span className="text-green text-xs">{bucket.avgCTR?.toFixed(1)}% avg CTR</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.ctrGaps?.length ? (
            <Section title="🎯 Top CTR Opportunities" accent="amber">
              <div className="grid gap-2.5">
                {result.ctrGaps.slice(0, 10).map((gap, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-3">
                    <div className="flex justify-between mb-1.5 flex-wrap gap-2">
                      <span className="text-text font-semibold text-[13px]">{gap.query}</span>
                      <div className="flex gap-2">
                        <Badge variant="red">-{gap.ctrGap}% CTR gap</Badge>
                        <Badge variant="green">+{gap.potentialClicks} clicks</Badge>
                      </div>
                    </div>
                    <div className="text-muted text-[11px] mb-1">Impressions: {gap.impressions?.toLocaleString()} · Position: {gap.position} · Current CTR: {gap.ctr}%</div>
                    <div className="text-blue text-xs">Fix: {gap.fix}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.cannibalization?.length ? (
            <Section title="⚠️ Cannibalization Detected" accent="red">
              <div className="grid gap-2.5">
                {result.cannibalization.map((c, i) => (
                  <div key={i} className="bg-card border border-red/25 rounded-lg p-3">
                    <div className="text-text font-semibold mb-1.5 text-[13px]">&quot;{c.query}&quot; — {c.urls.length} URLs competing</div>
                    <div className="grid gap-1">
                      {c.urls.map((u, j) => (
                        <div key={j} className="flex justify-between px-2 py-1 bg-surface rounded text-[11px]">
                          <span className="text-muted truncate max-w-[300px]">{u.url}</span>
                          <span className="text-amber">pos {u.position} · {u.clicks} clicks · {u.ctr?.toFixed(1)}% CTR</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-green text-[11px] mt-1.5">{c.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.actionPlan?.length ? (
            <Section title="🚀 Action Plan" accent="purple">
              <div className="grid gap-1.5">
                {result.actionPlan.map((action, i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <span className="text-green text-sm">✓</span>
                    <span className="text-text text-[13px]">{action}</span>
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
