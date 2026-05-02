"use client";

import { useState, useRef, useCallback } from "react";
import { Badge, Button, Section, Input, TextArea, StatCard, LoadingSpinner, ErrorBanner, DataTable, Modal } from "@/components/ui";
import { CtrBarchart, PositionScatter, IntentPie } from "@/components/charts";
import { parseGSCcsv } from "@/lib/api";
import type { GSCRow, GSCResult } from "@/types";

interface GscCommandCenterProps {
  onAnalysis?: (data: unknown, type: string) => void;
}

export function GscCommandCenter({ onAnalysis }: GscCommandCenterProps) {
  const [mode, setMode] = useState<"upload" | "api">("upload");
  const [csvText, setCsvText] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().split("T")[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<GSCRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [result, setResult] = useState<GSCResult | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [apiError, setApiError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const datePresets = [
    { label: "7d", days: 7 }, { label: "28d", days: 28 }, { label: "3m", days: 90 },
    { label: "6m", days: 180 }, { label: "12m", days: 365 },
  ];

  const applyDatePreset = (days: number) => {
    const end = new Date(); const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const detectAndAutoMapColumns = useCallback((parsed: GSCRow[]) => {
    if (!parsed.length) return;
    const possibleHeaders = Object.keys(parsed[0]);
    const mapping: Record<string, string> = {};
    possibleHeaders.forEach(h => {
      const lower = h.toLowerCase();
      if (lower.includes("query") || lower.includes("keyword")) mapping["query"] = h;
      else if (lower.includes("page") || lower.includes("url")) mapping["page"] = h;
      else if (lower.includes("click")) mapping["clicks"] = h;
      else if (lower.includes("impression")) mapping["impressions"] = h;
      else if (lower.includes("ctr")) mapping["ctr"] = h;
      else if (lower.includes("position")) mapping["position"] = h;
    });
    setColumnMapping(mapping);
    setParsedHeaders(possibleHeaders);
    setShowColumnMapper(Object.keys(mapping).length < 4);
  }, []);

  const processFile = useCallback((text: string) => {
    setCsvText(text);
    const parsed = parseGSCcsv(text);
    setRows(parsed);
    if (parsed.length) { detectAndAutoMapColumns(parsed); setError(""); }
    else { setError("Could not parse CSV. Check format."); setShowColumnMapper(true); }
  }, [detectAndAutoMapColumns]);

  const handleDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === "dragenter" || e.type === "dragover"); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => processFile((ev.target?.result as string) || ""); r.readAsText(f); } };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => processFile((ev.target?.result as string) || ""); r.readAsText(f); } };
  const handleParse = () => processFile(csvText);

  const applyColumnMapping = () => {
    if (!csvText) return;
    const lines = csvText.trim().split("\n");
    const headerIdx = lines.findIndex(l => /clicks/i.test(l) && /impressions/i.test(l));
    if (headerIdx < 0) { setError("Could not find header row"); return; }
    const headers = lines[headerIdx].split(",").map(h => h.replace(/"/g, "").trim().toLowerCase());
    const targetToSource: Record<string, string> = {};
    Object.entries(columnMapping).forEach(([target, source]) => { const idx = headers.indexOf(source.toLowerCase()); if (idx >= 0) targetToSource[target] = headers[idx]; });
    const mapped: GSCRow[] = lines.slice(headerIdx + 1).map(line => {
      const cols = line.split(",").map(c => c.replace(/"/g, "").trim());
      const get = (t: string) => cols[headers.indexOf(targetToSource[t])] || "";
      return { query: get("query") || cols[0] || "", page: get("page") || cols[1] || "", clicks: parseInt(get("clicks")) || 0, impressions: parseInt(get("impressions")) || 0, ctr: parseFloat(String(get("ctr") || "0").replace("%", "")) || 0, position: parseFloat(get("position")) || 0 };
    }).filter(r => r.query || r.page);
    setRows(mapped); setShowColumnMapper(false);
    if (mapped.length) setError(""); else setError("No valid rows after mapping");
  };

  const handleAnalyze = async () => {
    if (!rows.length) { setError("Load data first."); return; }
    setLoading(true); setError("");
    try {
      const resp = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "gsc_full", data: rows, options: { siteUrl, startDate, endDate } }) });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Analysis failed");
      setResult(json.result);
      onAnalysis?.(json.result, "gsc_full");
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const handleFetchAPI = async () => {
    if (!siteUrl) { setApiError("Site URL is required"); return; }
    setFetchLoading(true); setApiError("");
    try {
      const resp = await fetch("/api/gsc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteUrl, startDate, endDate, dimensions: ["query", "page"], rowLimit: 5000 }) });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Failed to fetch");
      const fetchedRows = json.rows || [];
      setRows(fetchedRows);
      if (fetchedRows.length) { detectAndAutoMapColumns(fetchedRows); setError(""); }
    } catch (e) { setApiError((e as Error).message); }
    finally { setFetchLoading(false); }
  };

  const ov = result?.overview;
  const ctr = result?.ctrAnalysis;

  return (
    <div>
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        {(["upload", "api"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${mode === m ? "bg-blue text-white shadow-lg shadow-blue/20" : "bg-surface text-muted hover:text-text border border-border"}`}>
            {m === "upload" ? "📁 Upload CSV" : "🔗 API Connect"}
          </button>
        ))}
      </div>

      {/* Upload Mode */}
      {mode === "upload" && (
        <Section title="📊 Load GSC Data">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${dragActive ? "border-blue bg-blue/5" : "border-border hover:border-muted"}`}
            onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag}
            onDrop={handleDrop} onClick={() => fileRef.current?.click()}>
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} ref={fileRef} className="hidden" />
            <div className="text-3xl mb-2">{dragActive ? "📥" : "📊"}</div>
            <div className="text-text font-semibold mb-1">Drop CSV here or click to upload</div>
            <div className="text-muted text-xs">Supports GSC CSV exports with query, page, clicks, impressions, CTR, position columns</div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-muted text-xs"><span>or</span><div className="flex-1 h-px bg-border" /></div>
          <TextArea value={csvText} onChange={setCsvText} placeholder="Paste GSC CSV data here…" rows={4} />
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={handleParse} disabled={!csvText}>Parse CSV</Button>
          </div>
        </Section>
      )}

      {/* API Mode */}
      {mode === "api" && (
        <Section title="🔗 Google Search Console API">
          <div className="grid gap-3">
            <Input value={siteUrl} onChange={setSiteUrl} placeholder="https://yoursite.com or sc-domain:yoursite.com" />
            <div className="flex gap-2 flex-wrap">
              {datePresets.map(p => (
                <button key={p.days} onClick={() => applyDatePreset(p.days)}
                  className="px-3 py-1.5 rounded-md text-xs font-bold bg-surface text-muted hover:text-text border border-border hover:border-blue/50 transition-all">{p.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input value={startDate} onChange={setStartDate} type="date" />
              <Input value={endDate} onChange={setEndDate} type="date" />
            </div>
            <Button onClick={handleFetchAPI} loading={fetchLoading}>🔗 Fetch GSC Data</Button>
            <ErrorBanner message={apiError} />
          </div>
        </Section>
      )}

      {/* Column Mapper Modal */}
      <Modal open={showColumnMapper} onClose={() => setShowColumnMapper(false)} title="📐 Map CSV Columns">
        <div className="text-muted text-xs mb-4">Map your CSV columns to the expected GSC fields:</div>
        <div className="grid gap-3">
          {["query", "page", "clicks", "impressions", "ctr", "position"].map(field => (
            <div key={field} className="flex gap-2 items-center">
              <span className="text-text text-sm font-bold w-24">{field}</span>
              <select value={columnMapping[field] || ""} onChange={e => setColumnMapping(prev => ({ ...prev, [field]: e.target.value }))}
                className="flex-1 bg-surface text-text border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none">
                <option value="">— select —</option>
                {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
          <Button onClick={applyColumnMapping} size="sm">Apply Mapping</Button>
        </div>
      </Modal>

      {/* Data Status */}
      {rows.length > 0 && (
        <div className="bg-green/5 border border-green/20 rounded-lg px-4 py-3 mb-4 flex justify-between items-center animate-fade-in">
          <span className="text-green text-sm font-bold">✓ {rows.length.toLocaleString()} rows loaded</span>
          <Button onClick={handleAnalyze} loading={loading}>🚀 Run Full Analysis</Button>
        </div>
      )}

      <ErrorBanner message={error} />
      {loading && <LoadingSpinner />}

      {/* Results */}
      {result && !loading && (
        <div className="animate-fade-in">
          {/* Overview */}
          {ov && (
            <Section title="📊 Overview Dashboard" accent="blue">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatCard label="Total Queries" value={ov.totalQueries.toLocaleString()} variant="blue" />
                <StatCard label="Total Clicks" value={ov.totalClicks.toLocaleString()} variant="green" />
                <StatCard label="Total Impressions" value={ov.totalImpressions.toLocaleString()} variant="amber" />
                <StatCard label="Avg CTR" value={ov.avgCTR.toFixed(2) + "%"} variant="purple" />
                <StatCard label="Avg Position" value={ov.avgPosition.toFixed(1)} variant="cyan" />
                <StatCard label="Potential Clicks Gain" value={"+" + ov.potentialClicksGain.toLocaleString()} variant="green" sub="at benchmark CTR" />
                <StatCard label="Cannibalized Queries" value={ov.cannibalizedQueries.toString()} variant="red" />
                <StatCard label="Zero-Click Queries" value={ov.zeroClickQueries.toString()} variant="amber" />
              </div>
            </Section>
          )}

          {/* CTR Analysis */}
          {ctr && (
            <Section title="🎯 CTR Gap Analysis" accent="green">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <StatCard label="Overall CTR" value={ctr.overallCTR.toFixed(2) + "%"} variant="blue" />
                <StatCard label="Benchmark CTR" value={ctr.benchmarkCTR.toFixed(2) + "%"} variant="green" />
                <StatCard label="CTR Gap" value={ctr.gap.toFixed(2) + "%"} variant="red" />
                <StatCard label="Critical Gaps" value={ctr.criticalGaps.toString()} variant="red" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div className="bg-card border border-green/25 rounded-xl p-4 text-center"><div className="text-green text-xl font-extrabold font-mono">{ctr.aboveBenchmark}</div><div className="text-muted text-xs mt-1">Above Benchmark</div></div>
                <div className="bg-card border border-amber/25 rounded-xl p-4 text-center"><div className="text-amber text-xl font-extrabold font-mono">{ctr.atBenchmark}</div><div className="text-muted text-xs mt-1">At Benchmark</div></div>
                <div className="bg-card border border-red/25 rounded-xl p-4 text-center"><div className="text-red text-xl font-extrabold font-mono">{ctr.belowBenchmark}</div><div className="text-muted text-xs mt-1">Below Benchmark</div></div>
              </div>
            </Section>
          )}

          {/* Charts */}
          {result.quickWins?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-7">
              <CtrBarchart data={result.quickWins.map(q => ({ query: q.query, impressions: q.impressions, ctr: q.currentCTR }))} />
              <PositionScatter data={result.quickWins.map(q => ({ query: q.query, position: q.position, clicks: q.clicks }))} />
              {result.intentAnalysis?.distribution && <IntentPie data={result.intentAnalysis.distribution} />}
            </div>
          ) : null}

          {/* Quick Wins */}
          {result.quickWins?.length ? (
            <Section title="⚡ Quick Wins — Fastest ROI" accent="green">
              <div className="grid gap-2.5">
                {result.quickWins.slice(0, 10).map((qw, i) => (
                  <div key={i} className={`bg-card border rounded-lg p-3 ${i < 3 ? "border-green/40" : "border-border"}`}>
                    <div className="flex justify-between flex-wrap gap-2 mb-1.5">
                      <span className="text-text font-semibold text-[13px]">{qw.query}</span>
                      <div className="flex gap-2">
                        <Badge variant="green">+{qw.estimatedTrafficGain} clicks</Badge>
                        <Badge variant={qw.effort === "low" ? "green" : qw.effort === "medium" ? "amber" : "red"}>{qw.effort} effort</Badge>
                      </div>
                    </div>
                    <div className="text-muted text-[11px] mb-1">Position: {qw.position} · Impressions: {qw.impressions.toLocaleString()} · CTR: {qw.currentCTR}% → {qw.benchmarkCTR}%</div>
                    <div className="text-blue text-xs">{qw.action}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Content Gaps */}
          {result.contentGaps?.length ? (
            <Section title="🔍 Content Gaps — Zero-Click Queries" accent="amber">
              <div className="grid gap-2">
                {result.contentGaps.slice(0, 10).map((gap, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-3">
                    <div className="flex justify-between mb-1 flex-wrap gap-2">
                      <span className="text-text text-[13px] font-semibold">{gap.query}</span>
                      <Badge variant={gap.priority === "critical" ? "red" : gap.priority === "high" ? "amber" : "muted"}>{gap.priority}</Badge>
                    </div>
                    <div className="text-muted text-[11px]">Position: {gap.position} · Impressions: {gap.impressions.toLocaleString()} · Reason: {gap.zeroClickReason}</div>
                    <div className="text-green text-xs mt-1">{gap.fix}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Cannibalization */}
          {result.cannibalization?.length ? (
            <Section title="⚠️ Keyword Cannibalization" accent="red">
              <div className="grid gap-3">
                {result.cannibalization.slice(0, 8).map((c, i) => (
                  <div key={i} className={`bg-card border rounded-xl p-4 ${c.severity === "critical" ? "border-red/40" : "border-border"}`}>
                    <div className="flex justify-between mb-2 flex-wrap gap-2">
                      <span className="text-text font-bold text-sm">&quot;{c.query}&quot;</span>
                      <Badge variant={c.severity === "critical" ? "red" : c.severity === "high" ? "amber" : "muted"}>{c.severity}</Badge>
                    </div>
                    <DataTable
                      columns={[
                        { key: "url", label: "URL", render: (v) => <span className="text-muted truncate max-w-[200px] block">{String(v).replace(/^https?:\/\/[^/]+/, "")}</span> },
                        { key: "clicks", label: "Clicks" }, { key: "impressions", label: "Impr" },
                        { key: "position", label: "Pos", render: (v) => <span>{Number(v).toFixed(1)}</span> },
                        { key: "shareOfClicks", label: "Share", render: (v) => <span>{Number(v).toFixed(0)}%</span> },
                      ]}
                      rows={c.pages as unknown as Record<string, unknown>[]} maxRows={5}
                    />
                    <div className="text-green text-xs mt-2">{c.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Page Health */}
          {result.pageHealth?.length ? (
            <Section title="🏥 Page Health Scores" accent="purple">
              <DataTable
                columns={[
                  { key: "url", label: "URL", render: (v) => <span className="text-muted truncate max-w-[200px] block">{String(v).replace(/^https?:\/\/[^/]+/, "") || "/"}</span> },
                  { key: "healthGrade", label: "Grade", render: (v) => { const gc: Record<string, string> = { A: "green", B: "blue", C: "amber", D: "red", F: "red" }; return <Badge variant={(gc[String(v)] || "muted") as "green"}>{String(v)}</Badge>; } },
                  { key: "totalClicks", label: "Clicks", render: (v) => <span>{Number(v).toLocaleString()}</span> },
                  { key: "avgCTR", label: "CTR", render: (v) => <span>{Number(v).toFixed(2)}%</span> },
                  { key: "avgPosition", label: "Pos" },
                  { key: "potentialClicksGain", label: "+Clicks", render: (v) => <span className="text-green">+{Number(v).toLocaleString()}</span> },
                ]}
                rows={result.pageHealth as unknown as Record<string, unknown>[]} maxRows={15} totalRows={result.pageHealth.length}
              />
            </Section>
          ) : null}

          {/* AI Overview Candidates */}
          {result.aiOverviewCandidates?.length ? (
            <Section title="🤖 AI Overview Candidates" accent="purple">
              <div className="grid gap-2.5">
                {result.aiOverviewCandidates.slice(0, 10).map((c, i) => (
                  <div key={i} className={`bg-card border rounded-lg p-3 ${c.eligibility === "high" ? "border-purple/40" : "border-border"}`}>
                    <div className="flex justify-between mb-1.5 flex-wrap gap-2">
                      <span className="text-text font-semibold text-[13px]">{c.query}</span>
                      <div className="flex gap-2">
                        <Badge variant={c.eligibility === "high" ? "green" : c.eligibility === "medium" ? "amber" : "muted"}>{c.eligibility} eligibility</Badge>
                        <Badge variant="purple">{c.contentFormat}</Badge>
                      </div>
                    </div>
                    <div className="text-muted text-[11px]">Position: {c.position} · Impressions: {c.impressions.toLocaleString()} · Score: {c.eligibilityScore}/10</div>
                    <div className="text-blue text-xs mt-1">{c.optimizationFocus}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Priority Matrix */}
          {result.priorityMatrix?.length ? (
            <Section title="📐 Priority Matrix" accent="blue">
              <DataTable
                columns={[
                  { key: "query", label: "Query", render: (v) => <span className="text-text font-semibold">{String(v)}</span> },
                  { key: "category", label: "Category", render: (v) => <Badge variant={String(v) === "ctr" ? "blue" : String(v) === "content_gap" ? "amber" : String(v) === "cannibalization" ? "red" : "muted"}>{String(v)}</Badge> },
                  { key: "opportunityScore", label: "Score" },
                  { key: "impact", label: "Impact", render: (v) => <Badge variant={String(v) === "critical" ? "red" : String(v) === "high" ? "amber" : "muted"}>{String(v)}</Badge> },
                  { key: "effort", label: "Effort", render: (v) => <Badge variant={String(v) === "low" ? "green" : String(v) === "medium" ? "amber" : "red"}>{String(v)}</Badge> },
                  { key: "timeToValue", label: "Time" },
                ]}
                rows={result.priorityMatrix as unknown as Record<string, unknown>[]} maxRows={15} totalRows={result.priorityMatrix.length}
              />
            </Section>
          ) : null}

          {/* AI Synthesis */}
          {result.aiSynthesis?.executiveSummary && (
            <Section title="🧠 AI Executive Synthesis" accent="purple">
              <div className="bg-card border border-purple/25 rounded-xl p-5">
                <div className="text-text text-[13px] leading-relaxed mb-4">{result.aiSynthesis.executiveSummary}</div>
                {result.aiSynthesis.criticalFindings?.length ? (
                  <div className="mb-3">
                    <div className="text-red text-[11px] uppercase tracking-wider mb-1.5">Critical Findings</div>
                    {result.aiSynthesis.criticalFindings.map((f, i) => <div key={i} className="text-text text-xs mb-1">• {f}</div>)}
                  </div>
                ) : null}
                {result.aiSynthesis.winningStrategy && (
                  <div className="mb-3">
                    <div className="text-green text-[11px] uppercase tracking-wider mb-1.5">Winning Strategy</div>
                    <div className="text-text text-xs">{result.aiSynthesis.winningStrategy}</div>
                  </div>
                )}
                {result.aiSynthesis.investmentPriority?.length ? (
                  <div>
                    <div className="text-blue text-[11px] uppercase tracking-wider mb-1.5">Investment Priority</div>
                    {result.aiSynthesis.investmentPriority.map((p, i) => <div key={i} className="text-text text-xs mb-1">{i + 1}. {p}</div>)}
                  </div>
                ) : null}
              </div>
            </Section>
          )}

          {/* Recommendations */}
          {result.recommendations?.length ? (
            <Section title="🚀 Actionable Recommendations" accent="green">
              <div className="grid gap-2">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-2.5 items-start bg-card border border-border rounded-lg px-3.5 py-2.5">
                    <span className="text-green text-sm font-bold">{i + 1}.</span>
                    <span className="text-text text-[13px]">{rec}</span>
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
