"use client";

import { useState, useRef } from "react";
import { Badge, Button, Section, TextArea, StatCard, LoadingSpinner, ErrorBanner, ProgressBar } from "@/components/ui";
import { parseGSCcsv } from "@/lib/api";
import { useStore } from "@/store";
import { useJobPolling } from "@/hooks/useJobPolling";
import type { GEOResult } from "@/types";

export function GeoMatrix() {
  const { csvText, setCsvText, gscRows } = useStore();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GEOResult | null>(null);
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
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText((ev.target?.result as string) || "");
    reader.readAsText(f);
  };

  const handleAnalyze = async () => {
    let rows = gscRows;
    if (!rows.length) {
      if (!csvText.trim()) { setError("Load GSC data first."); return; }
      rows = parseGSCcsv(csvText);
    }
    setLoading(true); setError(""); setResult(null);
    try {
      if (rows.length > 1500) {
        const resp = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "geo", input: { globalDataset: rows } }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || "Failed to start background job");
        setActiveJobId(json.jobId);
        return;
      }

      const resp = await fetch("/api/geo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ globalDataset: rows }) });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { setError((e as Error).message); }
    finally { if (!activeJobId) setLoading(false); }
  };

  return (
    <div>
      <Section title="📐 GEO Matrix & Content Strategy">
        <div className="grid gap-3">
          <div className="flex gap-2.5">
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} ref={fileRef} className="hidden" />
            {!gscRows.length && <Button variant="outline" onClick={() => fileRef.current?.click()}>📁 Load Full GSC CSV</Button>}
            <Button onClick={handleAnalyze} loading={loading} disabled={!gscRows.length && !csvText}>📐 Generate GEO Matrix</Button>
          </div>
          {!gscRows.length && <TextArea value={csvText} onChange={setCsvText} placeholder="Paste your full GSC CSV (top 500 rows) here…" rows={4} />}
          {gscRows.length > 0 && <div className="text-green text-xs font-bold mt-2">✓ Using {gscRows.length.toLocaleString()} rows from GSC tab.</div>}
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
            <StatCard label="Total Impressions" value={result.siteBaseline.totalImpressions.toLocaleString()} variant="blue" />
            <StatCard label="Avg Position" value={result.siteBaseline.avgPosition.toFixed(1)} variant="amber" />
            <StatCard label="Avg CTR" value={result.siteBaseline.avgCTR.toFixed(1) + "%"} variant="green" />
            <StatCard label="Total Clicks" value={result.siteBaseline.totalClicks.toLocaleString()} variant="purple" />
          </div>

          {result.topPillars?.length ? (
            <Section title="🏛️ Top Content Pillars" accent="blue">
              <div className="grid gap-3.5">
                {result.topPillars.map((pillar, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex justify-between mb-2.5 flex-wrap gap-2">
                      <div className="flex gap-2 items-center">
                        <Badge variant="green">{pillar.dominantFormat}</Badge>
                        <span className="text-text font-bold text-[15px]">{pillar.name}</span>
                      </div>
                      <div className="flex gap-2.5 text-xs">
                        <span className="text-blue">{pillar.totalImpressions.toLocaleString()} impr</span>
                        <span className="text-amber">pos {pillar.avgPosition}</span>
                        <span className="text-green">{pillar.avgCTR}% CTR</span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {pillar.queries.slice(0, 8).map((q, j) => (
                        <span key={j} className="bg-surface text-muted rounded px-2 py-0.5 text-[11px]">{q.query} ({q.clicks})</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.momentumPatterns?.length ? (
            <Section title="📈 Content Format Momentum" accent="green">
              <div className="grid gap-2">
                {result.momentumPatterns.filter(p => p.avgCTR > 0).map((p, i) => (
                  <div key={i} className="bg-card border border-green/25 rounded-lg px-3.5 py-2.5 flex justify-between items-center flex-wrap gap-2">
                    <div className="flex gap-2 items-center">
                      <Badge variant="blue">{p.format}</Badge>
                      <span className="text-green font-bold text-sm">{p.avgCTR}% avg CTR</span>
                    </div>
                    <div className="text-muted text-[11px]">{p.sampleQueries.slice(0, 3).join(" · ")}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.programmaticGaps?.length ? (
            <Section title="🔍 Programmatic Gap Opportunities" accent="amber">
              <div className="grid gap-2">
                {result.programmaticGaps.map((gap, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg px-3.5 py-2.5">
                    <div className="flex justify-between mb-1 flex-wrap gap-2">
                      <Badge variant="amber">&quot;{gap.modifier}&quot;</Badge>
                      <div className="flex gap-2 text-[11px]">
                        <span className="text-muted">CTR: {gap.ctr}%</span>
                        <span className="text-blue">{gap.volume.toLocaleString()} queries</span>
                      </div>
                    </div>
                    <div className="text-text text-xs">{gap.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.newContentBlueprints?.length ? (
            <Section title="🗺️ New Content Blueprints" accent="purple">
              <div className="grid gap-4">
                {result.newContentBlueprints.map((bp, i) => (
                  <div key={i} className="bg-card border border-purple/25 rounded-xl p-4">
                    <div className="flex gap-2 mb-2.5">
                      <Badge variant="blue">{bp.format}</Badge>
                      <Badge variant="purple">{bp.niche}</Badge>
                    </div>
                    <div className="text-text font-bold text-sm mb-1.5">{bp.suggestedTitle}</div>
                    <div className="text-muted text-[11px] mb-2.5">Target: {bp.targetQuery}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-green text-[11px] mb-1">GEO OPTIMIZATIONS</div>
                        {bp.geoOptimizations.map((o, j) => (<div key={j} className="text-muted text-[11px] mb-0.5">• {o}</div>))}
                      </div>
                      <div>
                        <div className="text-blue text-[11px] mb-1">AEO OPTIMIZATIONS</div>
                        {bp.aeoOptimizations.map((o, j) => (<div key={j} className="text-muted text-[11px] mb-0.5">• {o}</div>))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.geoRules?.length ? (
            <Section title="🤖 GEO Rules" accent="green">
              <div className="grid gap-1.5">
                {result.geoRules.map((rule, i) => (<div key={i} className="flex gap-2.5 items-start"><span className="text-green text-sm">✓</span><span className="text-text text-[13px]">{rule}</span></div>))}
              </div>
            </Section>
          ) : null}

          {result.aeoRules?.length ? (
            <Section title="💬 AEO Rules" accent="blue">
              <div className="grid gap-1.5">
                {result.aeoRules.map((rule, i) => (<div key={i} className="flex gap-2.5 items-start"><span className="text-blue text-sm">✓</span><span className="text-text text-[13px]">{rule}</span></div>))}
              </div>
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}
