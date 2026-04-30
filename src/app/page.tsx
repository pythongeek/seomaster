"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { C, TABS } from "@/lib/constants";
import { parseGSCcsv, callAI } from "@/lib/api";
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────
interface GSCRow { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number; estimatedClicksLost?: number; fix?: string; }
interface Report { id: number; report_type: string; title: string; data: unknown; summary?: unknown; created_at: string; }
interface AnalyzedRow { query: string; page?: string; impressions: number; ctr: number; position: number; benchmarkCTR?: number; ctrGap?: number; ctrRatio?: number; estimatedClicksLost?: number; fix?: string; priority?: number; performanceCategory?: string; }
interface QuickWin { query: string; page: string; position: number; clicks: number; impressions: number; estimatedTrafficGain: number; effort: string; action: string; currentCTR: number; benchmarkCTR: number; }
interface GSCResult {
  overview: { totalQueries: number; totalClicks: number; totalImpressions: number; avgCTR: number; avgPosition: number; potentialClicksGain: number; benchmarkClicks: number; performanceDistribution: Record<string, number>; };
  ctrOpportunities: AnalyzedRow[];
  quickWins: QuickWin[];
  contentGaps: Array<{ query: string; page: string; impressions: number; position: number; issue: string; priority: string; }>;
  aiOverviewCandidates: Array<{ query: string; page: string; intent: string; impressions: number; position: number; ctr: number; aiEligibility: string; contentSuggestion: string; }>;
  intentDistribution: Record<string, number>;
  ruleBasedRecommendations: string;
  aiSynthesis?: { summary?: string; topPriorityActions?: string[]; aiOverviewStrategy?: string; contentStrategy?: string; };
}
interface CTRResult { titleVariants: Array<{ title: string; predictedCTR: string; reasoning?: string }>; metaVariants: Array<{ text: string; charCount: number; cta: string; predictedCTR: string }>; schemaMarkup: string; keyword: string; searchIntent: string; }
interface KeywordResult { topGroups: Array<{ keyword: string; volume: number; cpc: number; difficulty: number; opportunity: string; modifiers: Array<{ keyword: string; volume: number }> }>; questionKeywords: Array<{ keyword: string; volume: number; cpc: number; intent: string; bestFormat: string }>; topic: string; }
interface TopicResult { clusterStructure: Array<{ name: string; keywords: string[]; weight: number }>; internalLinkSuggestions: Array<{ from: string; to: string; anchor: string; strength: string }>; pillarTopic: string; }
interface FilterResult { intentDistribution: Array<{ intent: string; count: number; impressions: number; clicks: number; avgCTR: number }>; ctrGaps: Array<{ query: string; page: string; impressions: number; ctr: number; position: number; ctrGap: number; potentialClicks: number; fix: string }>; cannibalization: Array<{ query: string; urls: Array<{ url: string; position: number; clicks: number; ctr: number }>; recommendation: string }>; executiveSummary: string; top5Opportunities: Array<Record<string, unknown>>; actionPlan: string[]; totalFiltered: number; regexFilter: string; }
interface IndexResult { patternGroups: Array<{ pattern: string; patternLabel: string; count: number; urls: string[]; diagnosis: string; resolution: string; priority: string }>; executiveSummary: string; quickFixes: string[]; totalUrls: number; uniquePatterns: number; }
interface CrawlResult { statusGroups: Array<{ code: string; percentage: number; status: string; recommendation: string }>; fileGroups: Array<{ type: string; percentage: number; status: string; recommendation: string }>; purposeGroups: Array<{ purpose: string; percentage: number; status: string; recommendation: string }>; issues: Array<{ category: string; severity: string; description: string; fix: string; devOpsChecklist?: string[] }>; severitySummary: { label: string; count: number; color: string }; executiveSummary: string; }
interface GEOResult { topPillars: Array<{ name: string; queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>; totalImpressions: number; avgPosition: number; avgCTR: number; dominantFormat: string }>; momentumPatterns: Array<{ format: string; avgCTR: number; sampleQueries: string[] }>; programmaticGaps: Array<{ modifier: string; volume: number; ctr: number; recommendation: string }>; newContentBlueprints: Array<{ niche: string; targetQuery: string; suggestedTitle: string; format: string; geoOptimizations: string[]; aeoOptimizations: string[] }>; geoRules: string[]; aeoRules: string[]; siteBaseline: { totalImpressions: number; avgPosition: number; avgCTR: number; totalClicks: number }; }
interface SitemapResult { success: boolean; validated: boolean; sitemapUrl: string; validationStatus: number | null; validationMessage: string; pingStatus: number | null; pingMessage: string; pingedAt: string | null; }

// ─── Shared Components ───────────────────────────────────────────────────────
const Badge = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", fontFamily: "monospace" }}>{children}</span>
);

const Stat = ({ label, value, color = C.blue, sub }: { label: string; value: string; color?: string; sub?: string }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
    <div style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
    <div style={{ color, fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>{value}</div>
    {sub && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{sub}</div>}
  </div>
);

const Btn = ({ onClick, disabled, loading, children, color = C.blue, small, outline }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode;
  color?: string; small?: boolean; outline?: boolean;
}) => (
  <button onClick={onClick} disabled={disabled || loading} style={{
    background: disabled || loading ? C.sub : outline ? 'transparent' : color,
    color: outline ? color : "#fff",
    border: outline ? `1px solid ${color}` : "none",
    borderRadius: 8, padding: small ? "6px 14px" : "10px 22px",
    fontSize: small ? 12 : 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.7 : 1, transition: "opacity 0.2s", fontFamily: "inherit",
  }}>{loading ? "⏳ Processing…" : children}</button>
);

const Input = ({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
    width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "10px 14px", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box",
  }} />
);

const TextArea = ({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{
    width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "12px 14px", fontSize: 13, fontFamily: "monospace", resize: "vertical", outline: "none", boxSizing: "border-box",
  }} />
);

const Section = ({ title, children, accent = C.blue, action }: { title: string; children: React.ReactNode; accent?: string; action?: React.ReactNode }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, paddingBottom: 10, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 3, height: 18, background: accent, borderRadius: 2 }} />
        <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{title}</span>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const LoadingSpinner = () => (
  <div style={{ textAlign: "center", padding: 40 }}>
    <div style={{ color: C.blue, fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>⚙️</div>
    <div style={{ color: C.muted, fontSize: 13 }}>Analyzing data with AI…</div>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ─── Report Card ────────────────────────────────────────────────────────────
function ReportCard({ report, onLoad }: { report: Report; onLoad: (r: Report) => void }) {
  const typeColors: Record<string, string> = { gsc_full: C.blue, ctr_optimize: C.green, keyword_research: C.purple, topic_cluster: C.amber, ai_overview: C.red, vitals: C.purple };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, cursor: "pointer", transition: "border-color 0.2s" }}
      onClick={() => onLoad(report)} onMouseEnter={e => (e.currentTarget.style.borderColor = typeColors[report.report_type] || C.blue)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <Badge color={typeColors[report.report_type] || C.blue}>{report.report_type.replace('_', ' ')}</Badge>
        <span style={{ color: C.muted, fontSize: 11 }}>{new Date(report.created_at).toLocaleDateString()}</span>
      </div>
      <div style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{report.title}</div>
      {report.summary !== null && report.summary !== undefined && typeof report.summary === 'object' && 'totalClicks' in (report.summary as object) && (
        <div style={{ color: C.green, fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>
          {((report.summary as Record<string, number>).totalClicks)?.toLocaleString() || 0} clicks
        </div>
      )}
    </div>
  );
}

// ─── Chart Components ───────────────────────────────────────────────────────
function CTRBarchart({ data }: { data: Array<{ query: string; impressions: number; ctr: number }> }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>📊 CTR Opportunity Distribution</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.slice(0, 8)} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="query" tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={v => v.slice(0, 12) + "…"} />
          <YAxis tick={{ fill: C.muted, fontSize: 9 }} />
          <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.text }} />
          <Bar dataKey="impressions" fill={C.blue} radius={[3, 3, 0, 0]} name="Impressions" />
          <Bar dataKey="ctr" fill={C.green} radius={[3, 3, 0, 0]} name="CTR %" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PositionScatter({ data }: { data: Array<{ query: string; position: number; clicks: number }> }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>🎯 Position vs Clicks</div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="position" name="Position" tick={{ fill: C.muted, fontSize: 9 }} domain={[0, 30]} label={{ value: "Position", fill: C.muted, fontSize: 9 }} />
          <YAxis dataKey="clicks" name="Clicks" tick={{ fill: C.muted, fontSize: 9 }} />
          <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
            formatter={(v, n) => [v, n]} labelFormatter={(l) => `Position: ${l}`} />
          <Scatter data={data.slice(0, 20)} fill={C.amber} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function IntentPie({ data }: { data: Record<string, number> }) {
  const colors = [C.blue, C.green, C.amber, C.red];
  const pieData = Object.entries(data).map(([name, value]) => ({ name, value }));
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>🔍 Intent Distribution</div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
          <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Recommendation Cards ───────────────────────────────────────────────────
function RecommendationCard({ icon, title, description, impact, effort }: { icon: string; title: string; description: string; impact: string; effort: string }) {
  const impactColors: Record<string, string> = { High: C.green, Medium: C.amber, Low: C.red };
  const effortColors: Record<string, string> = { Low: C.green, Medium: C.amber, High: C.red };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{title}</span>
          <Badge color={impactColors[impact] || C.blue}>{impact} Impact</Badge>
          <Badge color={effortColors[effort] || C.muted}>{effort} Effort</Badge>
        </div>
        <div style={{ color: C.muted, fontSize: 12 }}>{description}</div>
      </div>
    </div>
  );
}

// ─── GSC Tab ───────────────────────────────────────────────────────────────
function GSCTab({ onAnalysis }: { onAnalysis: (data: unknown, type: string) => void }) {
  const [mode, setMode] = useState<"upload" | "api">("upload");
  const [csvText, setCsvText] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<GSCRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [result, setResult] = useState<GSCResult | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [apiError, setApiError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const datePresets = [
    { label: "Last 7 days", days: 7 },
    { label: "Last 28 days", days: 28 },
    { label: "Last 3 months", days: 90 },
    { label: "Last 6 months", days: 180 },
    { label: "Last 12 months", days: 365 },
  ];

  const applyDatePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      const reader = new FileReader();
      reader.onload = ev => {
        const text = ev.target?.result as string || "";
        setCsvText(text);
        const parsed = parseGSCcsv(text);
        setRows(parsed);
        if (parsed.length) {
          detectAndAutoMapColumns(parsed);
          setError("");
        } else {
          setError("Could not parse CSV. Check format or manually map columns.");
          setShowColumnMapper(true);
        }
      };
      reader.readAsText(f);
    }
  };

  const detectAndAutoMapColumns = (parsed: GSCRow[]) => {
    if (!parsed.length) return;
    const firstRow = parsed[0];
    const possibleHeaders = Object.keys(firstRow);
    const mapping: Record<string, string> = {};
    possibleHeaders.forEach(h => {
      const lower = h.toLowerCase();
      if (lower.includes('query') || lower.includes('keyword') || lower.includes('top query') || lower.includes('top pages')) mapping['query'] = h;
      else if (lower.includes('page') || lower.includes('url') || lower.includes('landing')) mapping['page'] = h;
      else if (lower.includes('click')) mapping['clicks'] = h;
      else if (lower.includes('impression')) mapping['impressions'] = h;
      else if (lower.includes('ctr')) mapping['ctr'] = h;
      else if (lower.includes('position') || lower.includes('pos')) mapping['position'] = h;
    });
    setColumnMapping(mapping);
    setParsedHeaders(possibleHeaders);
    setShowColumnMapper(Object.keys(mapping).length < 4);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string || "";
      setCsvText(text);
      const parsed = parseGSCcsv(text);
      setRows(parsed);
      if (parsed.length) {
        detectAndAutoMapColumns(parsed);
        setError("");
      } else {
        setError("Could not parse CSV. Check format or manually map columns.");
        setShowColumnMapper(true);
      }
    };
    reader.readAsText(f);
  };

  const handleParse = () => {
    const parsed = parseGSCcsv(csvText);
    if (parsed.length) {
      setRows(parsed);
      detectAndAutoMapColumns(parsed);
      setError("");
    } else {
      setRows([]);
      setError("Could not parse CSV. Make sure it's a GSC export.");
      setShowColumnMapper(true);
    }
  };

  const handleManualMap = (target: string, source: string) => {
    setColumnMapping(prev => ({ ...prev, [target]: source }));
  };

  const applyColumnMapping = () => {
    if (!csvText) return;
    const lines = csvText.trim().split("\n");
    const headerIdx = lines.findIndex(l => /clicks/i.test(l) && /impressions/i.test(l));
    if (headerIdx < 0) { setError("Could not find header row"); return; }
    const headers = lines[headerIdx].split(",").map(h => h.replace(/"/g, "").trim().toLowerCase());
    const targetToSource: Record<string, string> = {};
    Object.entries(columnMapping).forEach(([target, source]) => {
      const sourceIdx = headers.indexOf(source.toLowerCase());
      if (sourceIdx >= 0) targetToSource[target] = headers[sourceIdx];
    });
    const mapped: GSCRow[] = lines.slice(headerIdx + 1).map(line => {
      const cols = line.split(",").map(c => c.replace(/"/g, "").trim());
      const get = (t: string) => cols[headers.indexOf(targetToSource[t])] || "";
      return {
        query: get('query') || cols[0] || "",
        page: get('page') || cols[1] || "",
        clicks: parseInt(get('clicks')) || 0,
        impressions: parseInt(get('impressions')) || 0,
        ctr: parseFloat(String(get('ctr') || "0").replace("%", "")) || 0,
        position: parseFloat(get('position')) || 0,
      };
    }).filter(r => r.query || r.page);
    setRows(mapped);
    setShowColumnMapper(false);
    if (mapped.length) setError("");
    else setError("No valid rows after mapping");
  };

  const handleAnalyze = async () => {
    if (!rows.length) { setError("Load data first."); return; }
    setLoading(true); setError("");
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "gsc_full", data: rows, options: { siteUrl, startDate, endDate } }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Analysis failed");
      setResult(json.result);
      onAnalysis(json.result, "gsc_full");
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const handleFetchAPI = async () => {
    if (!siteUrl) { setApiError("Site URL is required"); return; }
    setFetchLoading(true); setApiError("");
    try {
      const resp = await fetch("/api/gsc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl, startDate, endDate, dimensions: ["query", "page"], rowLimit: 5000 }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Failed to fetch GSC data");
      const fetchedRows = json.rows || [];
      setRows(fetchedRows);
      if (fetchedRows.length) {
        detectAndAutoMapColumns(fetchedRows);
        setApiConnected(true);
      }
    } catch (e) { setApiError((e as Error).message); setApiConnected(false); }
    finally { setFetchLoading(false); }
  };

  const overview = result?.overview ?? null;
  const ctrOpps = result?.ctrOpportunities ?? null;
  const quickWins = result?.quickWins ?? null;
  const aiTargets = result?.aiOverviewCandidates ?? null;
  const intentDist = result?.intentDistribution ?? null;
  const recommendations = result?.ruleBasedRecommendations ?? null;
  const aiSynthesis = result?.aiSynthesis ?? null;

  const showStats = rows.length > 0 && result === null;
  const statsContent = showStats ? (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
      <Stat label="Queries" value={rows.length.toLocaleString()} color={C.blue} />
      <Stat label="Total Clicks" value={rows.reduce((s, r) => s + r.clicks, 0).toLocaleString()} color={C.green} />
      <Stat label="Impressions" value={rows.reduce((s, r) => s + r.impressions, 0).toLocaleString()} color={C.purple} />
      <Stat label="Avg CTR" value={(rows.reduce((s, r) => s + r.ctr, 0) / rows.length).toFixed(1) + "%"} color={C.amber} />
      <Stat label="Avg Position" value={(rows.reduce((s, r) => s + r.position, 0) / rows.length).toFixed(1)} color={C.red} />
      {overview && <Stat label="Potential Gains" value={String(overview.potentialClicksGain || 0)} color={C.green} sub="estimated clicks" />}
    </div>
  ) : null;

  return (
    <div>
      {/* Mode Toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["upload", "api"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            background: mode === m ? C.blue : C.card, color: mode === m ? "#fff" : C.muted,
            border: `1px solid ${mode === m ? C.blue : C.border}`, borderRadius: 8, padding: "8px 18px",
            cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit"
          }}>{m === "upload" ? "📁 Upload CSV" : "🔑 API Connection"}</button>
        ))}
      </div>

      {/* Upload Mode */}
      {mode === "upload" && (
        <Section title="📊 Upload GSC Export">
          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? C.blue : C.border}`,
              borderRadius: 12,
              padding: "32px",
              textAlign: "center",
              cursor: "pointer",
              background: dragActive ? C.blue + "11" : C.surface,
              transition: "all 0.2s",
              marginBottom: 16,
            }}
          >
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} ref={fileRef} style={{ display: "none" }} />
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ color: C.text, fontWeight: 600, marginBottom: 4 }}>
              {dragActive ? "Drop your CSV file here" : "Drag & drop your GSC CSV or click to browse"}
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>Supports .csv, .tsv, .txt from GSC → Performance → Export</div>
          </div>

          {/* Quick paste area */}
          <TextArea value={csvText} onChange={setCsvText} placeholder="Or paste GSC CSV data directly here…" rows={3} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <Btn onClick={handleParse} color={C.blue} disabled={!csvText}>Parse Data</Btn>
            {rows.length > 0 && (
              <Btn onClick={() => setShowColumnMapper(true)} color={C.purple} small outline>Column Mapper</Btn>
            )}
            {rows.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", color: C.green, fontSize: 12, fontWeight: 600, marginLeft: 8 }}>
                ✓ {rows.length.toLocaleString()} rows parsed
              </div>
            )}
          </div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>GSC → Performance → Export → Download CSV</div>
        </Section>
      )}

      {/* Column Mapper Modal */}
      {showColumnMapper && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 200, padding: 20
        }} onClick={() => setShowColumnMapper(false)}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 600, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>🔗 Column Mapper</h3>
              <button onClick={() => setShowColumnMapper(false)} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>Map your CSV columns to GSC fields. Detected headers are highlighted.</p>
            {['query', 'page', 'clicks', 'impressions', 'ctr', 'position'].map(field => (
              <div key={field} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 100, color: C.blue, fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{field.toUpperCase()}</div>
                <select value={columnMapping[field] || ""} onChange={e => handleManualMap(field, e.target.value)}
                  style={{ flex: 1, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, fontFamily: "monospace" }}>
                  <option value="">-- Select Column --</option>
                  {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <Btn onClick={applyColumnMapping} color={C.green}>Apply Mapping</Btn>
              <Btn onClick={() => setShowColumnMapper(false)} color={C.muted} outline small>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* API Mode */}
      {mode === "api" && (
        <Section title="🔑 Google Search Console API">
          {/* Connection status banner */}
          {apiConnected && !apiError && (
            <div style={{ background: C.green + "11", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: C.green, fontSize: 16 }}>✓</span>
              <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>Connected to Google Search Console</span>
              <span style={{ color: C.muted, fontSize: 12, marginLeft: "auto" }}>{rows.length.toLocaleString()} rows loaded</span>
            </div>
          )}
          {apiError && (
            <div style={{ background: C.red + "11", border: `1px solid ${C.red}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: C.red, fontSize: 13 }}>{apiError}</div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            <Input value={siteUrl} onChange={setSiteUrl} placeholder="https://yoursite.com/" />
            {/* Date range with presets */}
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                {datePresets.map(preset => (
                  <button key={preset.days} onClick={() => applyDatePreset(preset.days)} style={{
                    background: C.card, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6,
                    padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit"
                  }}>{preset.label}</button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input type="date" value={startDate} onChange={setStartDate} />
                <Input type="date" value={endDate} onChange={setEndDate} />
              </div>
            </div>
            <Btn onClick={handleFetchAPI} loading={fetchLoading} color={C.green}>⬇️ Fetch & Analyze GSC</Btn>
          </div>
        </Section>
      )}

      {statsContent}

      {rows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Btn onClick={handleAnalyze} loading={loading} color={C.green} disabled={rows.length === 0}>🧠 Run Full AI Analysis</Btn>
        </div>
      )}

      {loading && <LoadingSpinner />}

      {/* ─── Data Preview Table ─── */}
      {rows.length > 0 && !result && (
        <Section title={`📋 Data Preview (${Math.min(rows.length, 100).toLocaleString()} of ${rows.length.toLocaleString()} rows)`} accent={C.muted}>
          <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
              <thead>
                <tr style={{ background: C.surface }}>
                  {["Query", "Page", "Clicks", "Impr", "CTR", "Pos"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: C.muted, borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}>
                    <td style={{ padding: "6px 10px", color: C.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.query}</td>
                    <td style={{ padding: "6px 10px", color: C.muted, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.page}</td>
                    <td style={{ padding: "6px 10px", color: C.green, fontFamily: "monospace" }}>{r.clicks.toLocaleString()}</td>
                    <td style={{ padding: "6px 10px", color: C.blue, fontFamily: "monospace" }}>{r.impressions.toLocaleString()}</td>
                    <td style={{ padding: "6px 10px", color: C.amber, fontFamily: "monospace" }}>{r.ctr.toFixed(1)}%</td>
                    <td style={{ padding: "6px 10px", color: r.position <= 3 ? C.green : r.position <= 10 ? C.amber : C.red, fontFamily: "monospace" }}>{r.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 50 && <div style={{ color: C.muted, fontSize: 11, textAlign: "center", padding: 8 }}>Showing first 50 of {rows.length.toLocaleString()} rows — run analysis for full processing</div>}
        </Section>
      )}

      {/* ─── Results ─── */}
      {result && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800 }}>📋 Analysis Report</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <Badge color={C.green}>🟢 Saved to History</Badge>
              {overview?.performanceDistribution && (
                <Badge color={overview.performanceDistribution["Critical Gap"] > 0 ? C.red : C.blue}>
                  {overview.performanceDistribution["Outperforming"]} Outperforming
                </Badge>
              )}
            </div>
          </div>

          {/* Overview Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Stat label="Total Clicks" value={(overview?.totalClicks as number)?.toLocaleString() || "—"} color={C.green} />
            <Stat label="Total Impressions" value={(overview?.totalImpressions as number)?.toLocaleString() || "—"} color={C.blue} />
            <Stat label="Avg CTR" value={(overview?.avgCTR as number)?.toFixed(1) + "%" || "—"} color={C.amber} />
            <Stat label="Avg Position" value={(overview?.avgPosition as number)?.toFixed(1) || "—"} color={C.red} />
            <Stat label="Potential Gains" value={`+${overview?.potentialClicksGain || 0}`} color={C.green} sub="estimated clicks/mo" />
            <Stat label="Benchmark Clicks" value={(overview?.benchmarkClicks as number)?.toLocaleString() || "—"} color={C.purple} sub="if at benchmark" />
          </div>

          {/* Performance Distribution Bar */}
          {overview?.performanceDistribution && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>📊 Performance vs Industry Benchmark</div>
              <div style={{ display: "flex", height: 24, borderRadius: 6, overflow: "hidden", gap: 2 }}>
                {Object.entries(overview.performanceDistribution as Record<string, number>).map(([cat, count]) => {
                  const colors: Record<string, string> = { "Outperforming": C.green, "At Benchmark": C.blue, "Underperforming": C.amber, "Critical Gap": C.red };
                  const total = Object.values(overview.performanceDistribution as Record<string, number>).reduce((s, v) => s + v, 0);
                  if (!count || total === 0) return null;
                  return (
                    <div key={cat} style={{ width: `${(count / total) * 100}%`, background: colors[cat] || C.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {count / total > 0.08 && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: "monospace" }}>{cat.split(' ')[0]}</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                {Object.entries(overview.performanceDistribution as Record<string, number>).map(([cat, count]) => {
                  const colors: Record<string, string> = { "Outperforming": C.green, "At Benchmark": C.blue, "Underperforming": C.amber, "Critical Gap": C.red };
                  return (
                    <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: colors[cat] || C.muted }} />
                      <span style={{ color: C.muted, fontSize: 11 }}>{cat}: {count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charts Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {ctrOpps?.length ? <CTRBarchart data={ctrOpps} /> : <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, textAlign: "center", color: C.muted }}>No CTR data</div>}
            {quickWins?.length ? <PositionScatter data={quickWins.map(w => ({ query: w.query, position: w.position, clicks: w.clicks }))} /> : <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, textAlign: "center", color: C.muted }}>No position data</div>}
            {intentDist ? <IntentPie data={intentDist} /> : <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, textAlign: "center", color: C.muted }}>No intent data</div>}
          </div>

          {/* Recommendations */}
          {recommendations && (
            <Section title="🚀 Rule-Based Recommendations" accent={C.green}>
              <div style={{ background: C.card, border: `1px solid ${C.green}44`, borderRadius: 10, padding: 16, color: C.text, fontSize: 13, lineHeight: 1.7 }}>{recommendations}</div>
            </Section>
          )}

          {/* AI Agentic Synthesis */}
          {aiSynthesis && (
            <Section title="🤖 AI Agentic Synthesis" accent={C.purple}>
              {aiSynthesis.summary && (
                <div style={{ background: C.card, border: `1px solid ${C.purple}44`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Executive Summary</div>
                  <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7 }}>{aiSynthesis.summary}</div>
                </div>
              )}
              {aiSynthesis.topPriorityActions?.length ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Top 3 Priority Actions</div>
                  {aiSynthesis.topPriorityActions.map((action, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ color: C.purple, fontSize: 16, fontWeight: 800, minWidth: 24 }}>{i + 1}.</span>
                      <span style={{ color: C.text, fontSize: 13 }}>{action}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {aiSynthesis.aiOverviewStrategy && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <div style={{ color: C.green, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>AI Overview Strategy</div>
                  <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{aiSynthesis.aiOverviewStrategy}</div>
                </div>
              )}
              {aiSynthesis.contentStrategy && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ color: C.blue, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Content Strategy</div>
                  <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{aiSynthesis.contentStrategy}</div>
                </div>
              )}
            </Section>
          )}

          {/* CTR Opportunities Table with Benchmark */}
          {ctrOpps?.length ? (
            <Section title="📈 Top CTR Opportunities" accent={C.amber}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{["Query", "Impressions", "CTR", "Benchmark", "Gap", "Position", "Clicks Lost", "Performance", "Fix"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: C.muted, borderBottom: `1px solid ${C.border}`, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {ctrOpps.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}>
                        <td style={{ padding: "7px 10px", color: C.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.query}</td>
                        <td style={{ padding: "7px 10px", color: C.blue, fontFamily: "monospace" }}>{(r.impressions ?? 0).toLocaleString()}</td>
                        <td style={{ padding: "7px 10px", color: C.amber, fontFamily: "monospace" }}>{(r.ctr ?? 0).toFixed(1)}%</td>
                        <td style={{ padding: "7px 10px", color: C.muted, fontFamily: "monospace" }}>{(r.benchmarkCTR ?? 0).toFixed(1)}%</td>
                        <td style={{ padding: "7px 10px", color: (r.ctrGap ?? 0) > 3 ? C.red : (r.ctrGap ?? 0) > 1 ? C.amber : C.green, fontFamily: "monospace" }}>{(r.ctrGap ?? 0) > 0 ? '-' : ''}{(r.ctrGap ?? 0).toFixed(1)}pp</td>
<td style={{ padding: "7px 10px", color: (r.position ?? 0) <= 3 ? C.green : (r.position ?? 0) <= 10 ? C.amber : C.red, fontFamily: "monospace" }}>{(r.position ?? 0).toFixed(1)}</td>
<td style={{ padding: "7px 10px", color: C.red, fontFamily: "monospace" }}>{r.estimatedClicksLost ?? 0}</td>
                        <td style={{ padding: "7px 10px" }}>
                          <Badge color={r.performanceCategory === 'Critical Gap' ? C.red : r.performanceCategory === 'Underperforming' ? C.amber : C.green}>{r.performanceCategory ?? 'Unknown'}</Badge>
                        </td>
                        <td style={{ padding: "7px 10px", color: C.green, fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.fix ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          {/* Quick Wins */}
          {quickWins?.length ? (
            <Section title="🎯 Quick Win Targets (Positions 4-10)" accent={C.green}>
              <div style={{ display: "grid", gap: 10 }}>
                {quickWins.slice(0, 8).map((w, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: C.text, fontWeight: 600, marginBottom: 2 }}>{w.query}</div>
                      <div style={{ color: C.muted, fontSize: 11 }}>{w.action}</div>
                      <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>Page: {w.page}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: C.amber, fontSize: 16, fontWeight: 800 }}>#{w.position ?? '?'}</div>
                      <div style={{ color: C.green, fontSize: 11 }}>+{w.estimatedTrafficGain ?? 0} clicks/mo</div>
                      <div style={{ color: C.muted, fontSize: 10 }}>CTR: {(w.currentCTR ?? 0).toFixed(1)}% → {(w.benchmarkCTR ?? 0).toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* AI Overview Targets */}
          {aiTargets?.length ? (
            <Section title="🤖 AI Overview Targets" accent={C.purple}>
              <div style={{ display: "grid", gap: 10 }}>
                {aiTargets.slice(0, 8).map((t: Record<string, unknown>, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.purple}44`, borderRadius: 8, padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>{t.query as string}</span>
                      <Badge color={t.aiEligibility === 'High' ? C.green : t.aiEligibility === 'Medium' ? C.amber : C.red}>{t.aiEligibility as string} Eligibility</Badge>
                    </div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{t.contentSuggestion as string}</div>
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

// ─── CTR Lab ─────────────────────────────────────────────────────────────────
function CTRTab() {
  const [keyword, setKeyword] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [intent, setIntent] = useState("informational");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CTRResult | null>(null);

  const handleAnalyze = async () => {
    if (!keyword) return;
    setLoading(true);
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ctr_optimize", data: { keyword, currentTitle, intent, context } }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { alert((e as Error).message); }
    finally { setLoading(false); }
  };

  const titles = result?.titleVariants ?? null;
  const metas = result?.metaVariants ?? null;
  const schema = result?.schemaMarkup ?? null;

  return (
    <div>
      <Section title="🎯 CTR Optimization Lab">
        <div style={{ display: "grid", gap: 12 }}>
          <Input value={keyword} onChange={setKeyword} placeholder="Target keyword (e.g. best project management software 2025)" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>Search Intent</div>
              <select value={intent} onChange={e => setIntent(e.target.value)} style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: "monospace", outline: "none" }}>
                {["informational", "commercial", "transactional", "navigational"].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <Input value={currentTitle} onChange={setCurrentTitle} placeholder="Current title (optional)" />
          </div>
          <TextArea value={context} onChange={setContext} placeholder="Related keywords or context for better variants…" rows={2} />
          <Btn onClick={handleAnalyze} loading={loading}>🔍 Generate CTR Variants</Btn>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {result && !loading && (
        <div style={{ marginTop: 24 }}>
          {/* Title Variants */}
          {titles?.length ? (
            <Section title="📝 Title Tag Variants (ranked by predicted CTR)" accent={C.green}>
              <div style={{ display: "grid", gap: 10 }}>
                {titles.map((t, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${i === 0 ? C.green + "66" : C.border}`, borderRadius: 8, padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{t.title}</span>
                      <Badge color={C.green}>{t.predictedCTR} CTR</Badge>
                    </div>
                    {i === 0 && <div style={{ color: C.green, fontSize: 11 }}>★ Recommended</div>}
                    {t.reasoning && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{t.reasoning}</div>}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Meta Descriptions */}
          {metas?.length ? (
            <Section title="📄 Meta Description Variants" accent={C.blue}>
              <div style={{ display: "grid", gap: 10 }}>
                {metas.map((m, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
                    <div style={{ color: C.text, fontSize: 13, marginBottom: 6, lineHeight: 1.5 }}>{m.text as string}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 11 }}>
                      <span>Characters: {m.charCount}</span>
                      <Badge color={C.blue}>{m.predictedCTR} CTR</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Schema Recommendation */}
          {schema && (
            <Section title="🏷️ Schema Markup Recommendation" accent={C.purple}>
              <div style={{ background: C.card, border: `1px solid ${C.purple}44`, borderRadius: 10, padding: 16 }}>
                <Badge color={C.purple}>{schema}</Badge>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Add these schemas to your page's JSON-LD structured data to improve SERP appearance and AI Overview eligibility.</div>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Keyword Research ────────────────────────────────────────────────────────
function KeywordTab() {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KeywordResult | null>(null);

  const handleAnalyze = async () => {
    if (!topic || !keywords) return;
    setLoading(true);
    try {
      const seedKeywords = keywords.split("\n").filter(k => k.trim());
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "keyword_research", data: { topic, seedKeywords } }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { alert((e as Error).message); }
    finally { setLoading(false); }
  };

  const groups = result?.topGroups ?? null;
  const questions = result?.questionKeywords ?? null;

  return (
    <div>
      <Section title="🔬 Keyword Research & Clustering">
        <div style={{ display: "grid", gap: 12 }}>
          <Input value={topic} onChange={setTopic} placeholder="Topic (e.g. CRM software)" />
          <TextArea value={keywords} onChange={setKeywords} placeholder="Seed keywords (one per line, e.g.\nCRM software\nbest CRM\nCRM for small business\ncrm pricing\ncrm comparison" rows={5} />
          <Btn onClick={handleAnalyze} loading={loading}>🔍 Analyze Keywords</Btn>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {result && !loading && (
        <div style={{ marginTop: 24 }}>
          {/* Keyword Groups */}
          {groups?.length ? (
            <Section title="📊 Keyword Groups by Topic" accent={C.blue}>
              <div style={{ display: "grid", gap: 12 }}>
                {groups.map((g, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{g.keyword as string}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Badge color={C.green}>{g.volume?.toLocaleString()}/mo</Badge>
                        <Badge color={C.amber}>${g.cpc} CPC</Badge>
                        <Badge color={g.opportunity === 'High' ? C.green : C.muted}>{g.opportunity as string}</Badge>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(g.modifiers as Array<{ keyword: string; volume: number }>)?.map((m, j) => (
                        <span key={j} style={{ background: C.surface, color: C.muted, borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>{m.keyword} ({m.volume?.toLocaleString()})</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Question Keywords */}
          {questions?.length ? (
            <Section title="❓ Question Keywords (High AI Overview Potential)" accent={C.purple}>
              <div style={{ display: "grid", gap: 8 }}>
                {questions.map((q, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.purple}44`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.text }}>{q.keyword as string}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ color: C.muted, fontSize: 11 }}>{q.volume?.toLocaleString()}/mo</span>
                      <Badge color={C.purple}>{q.bestFormat as string}</Badge>
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

// ─── Topic Cluster ───────────────────────────────────────────────────────────
function TopicTab() {
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TopicResult | null>(null);

  const handleAnalyze = async () => {
    if (!seed) return;
    setLoading(true);
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "topic_cluster", data: { seed } }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { alert((e as Error).message); }
    finally { setLoading(false); }
  };

  const structure = result?.clusterStructure ?? null;
  const links = result?.internalLinkSuggestions ?? null;

  return (
    <div>
      <Section title="🔬 Topic Cluster Builder">
        <Input value={seed} onChange={setSeed} placeholder="Seed topic/keyword (e.g. email marketing)" />
        <div style={{ marginTop: 12 }}>
          <Btn onClick={handleAnalyze} loading={loading}>🧠 Generate Cluster</Btn>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {result && !loading && (
        <div style={{ marginTop: 24 }}>
          {/* Cluster Structure */}
          {structure?.length ? (
            <Section title="📐 Cluster Structure" accent={C.blue}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {structure.map((cluster, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <Badge color={i === 0 ? C.green : i === 1 ? C.blue : C.muted}>{cluster.name as string}</Badge>
                      <span style={{ color: C.muted, fontSize: 11 }}>×{(cluster.keywords as string[])?.length || 0} pages</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {(cluster.keywords as string[])?.map((kw, j) => (
                        <span key={j} style={{ color: C.text, fontSize: 12, padding: "4px 8px", background: C.surface, borderRadius: 4 }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Internal Link Suggestions */}
          {links?.length ? (
            <Section title="🔗 Internal Link Strategy" accent={C.green}>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  {links.map((link, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: C.surface, borderRadius: 6 }}>
                      <span style={{ color: C.muted, fontSize: 12 }}>{link.from}</span>
                      <span style={{ color: C.blue }}>→</span>
                      <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{link.to}</span>
                      <Badge color={C.green}>{link.strength}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Reports History ─────────────────────────────────────────────────────────
function ReportsTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/reports");
      const json = await resp.json();
      setReports(json.reports || []);
    } catch { setReports([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleDelete = async (id: number) => {
    await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
    setReports(prev => prev.filter(r => r.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>📚 Report History</h2>
        <Btn onClick={loadReports} color={C.blue} small>🔄 Refresh</Btn>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {reports.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
              No reports saved yet. Run an analysis to create your first report.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {reports.map(r => (
                <div key={r.id} style={{ position: "relative" }}>
                  <ReportCard report={r} onLoad={setSelected} />
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} style={{
                    position: "absolute", top: 8, right: 8, background: C.red + "44", color: C.red,
                    border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer"
                  }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Report Detail Modal */}
      {selected && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 100, padding: 20
        }} onClick={() => setSelected(null)}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 800, maxHeight: "80vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>{selected.title}</h3>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <pre style={{ color: C.muted, fontSize: 12, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(selected.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Regex Filter Engine ───────────────────────────────────────────────────
function FilterTab() {
  const [csvText, setCsvText] = useState("");
  const [searchType, setSearchType] = useState("web");
  const [regexFilter, setRegexFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FilterResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText((ev.target?.result as string) || "");
    reader.readAsText(f);
  };

  const handleAnalyze = async () => {
    if (!csvText.trim()) { setError("Load data first."); return; }
    setLoading(true); setError("");
    try {
      const rows = parseGSCcsv(csvText);
      const resp = await fetch("/api/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset: rows, searchType, regexFilter }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="🔍 Regex Search Console Filter">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} ref={fileRef} style={{ display: "none" }} />
            <Btn onClick={() => fileRef.current?.click()} color={C.purple}>📁 Select CSV</Btn>
            <Btn onClick={handleAnalyze} loading={loading} color={C.green} disabled={!csvText}>🔍 Run Filter</Btn>
          </div>
          <TextArea value={csvText} onChange={setCsvText} placeholder="Paste GSC CSV data here…" rows={4} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>Search Surface</div>
              <select value={searchType} onChange={e => setSearchType(e.target.value)} style={{ width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: "monospace", outline: "none" }}>
                {["web", "news", "discover", "googleNews"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Input value={regexFilter} onChange={setRegexFilter} placeholder="Regex pattern (e.g. ^how to|guide$)" />
          </div>
          <div style={{ color: C.muted, fontSize: 11 }}>Supports regex like: <code style={{ color: C.blue }}>^how to|guide$</code> <code style={{ color: C.blue }}>\bbuy\b|\bprice\b</code> <code style={{ color: C.blue }}>blog|blog/</code></div>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {error && <div style={{ color: C.red, background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {result && !loading && (
        <div style={{ marginTop: 24 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Stat label="Filtered" value={result.totalFiltered.toLocaleString()} color={C.blue} />
            <Stat label="CTR Gaps" value={result.ctrGaps.length.toString()} color={C.amber} />
            <Stat label="Cannibalization" value={result.cannibalization.length.toString()} color={C.red} />
            <Stat label="Intent Buckets" value={result.intentDistribution.length.toString()} color={C.green} />
          </div>

          {/* Executive Summary */}
          {result.executiveSummary && (
            <Section title="📝 Executive Summary" accent={C.green}>
              <div style={{ background: C.card, border: `1px solid ${C.green}44`, borderRadius: 10, padding: 16, color: C.text, fontSize: 13, lineHeight: 1.7 }}>{result.executiveSummary}</div>
            </Section>
          )}

          {/* Intent Distribution */}
          {result.intentDistribution?.length ? (
            <Section title="🧠 Intent Distribution" accent={C.blue}>
              <div style={{ display: "grid", gap: 8 }}>
                {result.intentDistribution.map((bucket, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge color={bucket.intent === 'Transactional' ? C.green : bucket.intent === 'Navigational' ? C.blue : bucket.intent === 'Informational' ? C.amber : C.muted}>{bucket.intent}</Badge>
                      <span style={{ color: C.muted, fontSize: 12 }}>{bucket.count} queries</span>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ color: C.text, fontSize: 12 }}>{bucket.impressions?.toLocaleString()} impr</span>
                      <span style={{ color: C.green, fontSize: 12 }}>{(bucket.avgCTR as number)?.toFixed(1)}% avg CTR</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* CTR Gaps */}
          {result.ctrGaps?.length ? (
            <Section title="🎯 Top CTR Opportunities" accent={C.amber}>
              <div style={{ display: "grid", gap: 10 }}>
                {result.ctrGaps.slice(0, 10).map((gap, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>{gap.query}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Badge color={C.red}>-{gap.ctrGap}% CTR gap</Badge>
                        <Badge color={C.green}>+{gap.potentialClicks} clicks</Badge>
                      </div>
                    </div>
                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>Impressions: {gap.impressions?.toLocaleString()} · Position: {gap.position} · Current CTR: {gap.ctr}%</div>
                    <div style={{ color: C.blue, fontSize: 12 }}>Fix: {gap.fix}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Cannibalization */}
          {result.cannibalization?.length ? (
            <Section title="⚠️ Cannibalization Detected" accent={C.red}>
              <div style={{ display: "grid", gap: 10 }}>
                {result.cannibalization.map((c, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.red}44`, borderRadius: 8, padding: "12px 16px" }}>
                    <div style={{ color: C.text, fontWeight: 600, marginBottom: 6 }}>"{c.query}" — {c.urls.length} URLs competing</div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {c.urls.map((u, j) => (
                        <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: C.surface, borderRadius: 4, fontSize: 11 }}>
                          <span style={{ color: C.muted, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.url}</span>
                          <span style={{ color: C.amber }}>pos {u.position} · {u.clicks} clicks · {u.ctr?.toFixed(1)}% CTR</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ color: C.green, fontSize: 11, marginTop: 6 }}>{c.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Action Plan */}
          {result.actionPlan?.length ? (
            <Section title="🚀 Action Plan" accent={C.purple}>
              <div style={{ display: "grid", gap: 6 }}>
                {result.actionPlan.map((action, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: C.green, fontSize: 14 }}>✓</span>
                    <span style={{ color: C.text, fontSize: 13 }}>{action}</span>
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

// ─── Indexation Diagnostic ──────────────────────────────────────────────────
function IndexTab() {
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
        <div style={{ display: "grid", gap: 12 }}>
          <TextArea value={rawText} onChange={setRawText} placeholder="Paste raw CSV or text from GSC 'Why pages aren't indexed' report here…&#10;&#10;Example format:&#10;https://yoursite.com/blog/post1&#9;Crawled - currently not indexed&#10;https://yoursite.com/tag/news&#9;Crawled - currently not indexed" rows={8} />
          <Btn onClick={handleAnalyze} loading={loading} color={C.green}>🩺 Diagnose Indexation</Btn>
          <div style={{ color: C.muted, fontSize: 11 }}>Supports tab-separated, comma-separated, or pipe-separated (URL • Reason) formats</div>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {error && <div style={{ color: C.red, background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {result && !loading && (
        <div style={{ marginTop: 24 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Stat label="URLs Analyzed" value={result.totalUrls.toLocaleString()} color={C.blue} />
            <Stat label="Patterns Found" value={result.uniquePatterns.toString()} color={C.amber} />
            <Stat label="High Priority" value={result.patternGroups?.filter(g => g.priority === 'High').length.toString() || "0"} color={C.red} />
            <Stat label="Medium Priority" value={result.patternGroups?.filter(g => g.priority === 'Medium').length.toString() || "0"} color={C.amber} />
          </div>

          {/* Executive Summary */}
          {result.executiveSummary && (
            <Section title="📝 Executive Summary" accent={C.green}>
              <div style={{ background: C.card, border: `1px solid ${C.green}44`, borderRadius: 10, padding: 16, color: C.text, fontSize: 13, lineHeight: 1.7 }}>{result.executiveSummary}</div>
            </Section>
          )}

          {/* Quick Fixes */}
          {result.quickFixes?.length ? (
            <Section title="⚡ Quick Fixes — Start Here" accent={C.red}>
              <div style={{ display: "grid", gap: 8 }}>
                {result.quickFixes.map((fix, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.red}44`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13 }}>{fix}</div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Pattern Groups */}
          {result.patternGroups?.length ? (
            <Section title="🔎 Pattern-Based Diagnosis" accent={C.blue}>
              <div style={{ display: "grid", gap: 16 }}>
                {result.patternGroups.map((group, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${group.priority === 'High' ? C.red + '66' : group.priority === 'Medium' ? C.amber + '44' : C.border}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge color={group.priority === 'High' ? C.red : group.priority === 'Medium' ? C.amber : C.muted}>{group.priority} Priority</Badge>
                        <span style={{ color: C.text, fontWeight: 700 }}>{group.patternLabel}</span>
                      </div>
                      <span style={{ color: C.muted, fontSize: 12 }}>{group.count} URLs</span>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div style={{ color: C.muted, fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Diagnosis</div>
                      <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{group.diagnosis}</div>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div style={{ color: C.muted, fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Resolution</div>
                      <div style={{ color: C.green, fontSize: 13, lineHeight: 1.6, background: C.surface, borderRadius: 6, padding: "8px 12px" }}>{group.resolution}</div>
                    </div>

                    <div>
                      <div style={{ color: C.muted, fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Affected URLs ({group.urls.length})</div>
                      <div style={{ maxHeight: 120, overflowY: "auto", display: "grid", gap: 2 }}>
                        {group.urls.slice(0, 20).map((url, j) => (
                          <div key={j} style={{ color: C.muted, fontSize: 11, fontFamily: "monospace", padding: "2px 4px", background: C.bg, borderRadius: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</div>
                        ))}
                        {group.urls.length > 20 && <div style={{ color: C.muted, fontSize: 11, fontStyle: "italic" }}>…and {group.urls.length - 20} more</div>}
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

// ─── Crawl Budget Analyzer ─────────────────────────────────────────────────
function CrawlTab() {
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
        <div style={{ display: "grid", gap: 12 }}>
          <TextArea value={crawlText} onChange={setCrawlText} placeholder="Paste GSC Crawl Stats raw text here…&#10;&#10;Example format:&#10;200 OK — 87.0%&#10;404 Not Found — 4.2%&#10;301 Moved Permanently — 3.1%&#10;500 Server Error — 0.5%&#10;HTML — 55.0%&#10;JS — 22.0%&#10;CSS — 8.0%&#10;Images — 12.0%&#10;Discovery — 12.0%&#10;Refresh — 76.0%&#10;Click tracking — 8.0%" rows={10} />
          <Btn onClick={handleAnalyze} loading={loading} color={C.green}>🖥️ Analyze Crawl Budget</Btn>
          <div style={{ color: C.muted, fontSize: 11 }}>Paste raw GSC Crawl Stats percentages for: response codes, file types, and crawl purpose. Percentages are parsed automatically.</div>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {error && <div style={{ color: C.red, background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {result && !loading && (
        <div style={{ marginTop: 24 }}>
          {/* Severity Banner */}
          <div style={{ background: result.severitySummary.color + '22', border: `1px solid ${result.severitySummary.color}66`, borderRadius: 10, padding: "16px 20px", marginBottom: 24, display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ fontSize: 32 }}>{result.severitySummary.label === 'HEALTHY' ? '✅' : result.severitySummary.label === 'CRITICAL' ? '🚨' : '⚠️'}</span>
            <div>
              <div style={{ color: result.severitySummary.color, fontSize: 18, fontWeight: 800 }}>{result.severitySummary.label}</div>
              <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{result.executiveSummary}</div>
            </div>
          </div>

          {/* Status Code Breakdown */}
          {result.statusGroups?.length ? (
            <Section title="📡 HTTP Response Codes" accent={C.blue}>
              <div style={{ display: "grid", gap: 8 }}>
                {result.statusGroups.map((g, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${g.status === 'Healthy' ? C.green + '44' : g.status === 'Critical' ? C.red + '66' : C.amber + '44'}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge color={g.status === 'Healthy' ? C.green : g.status === 'Critical' ? C.red : C.amber}>{g.code}</Badge>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{g.percentage}%</span>
                        <span style={{ color: C.muted, fontSize: 11 }}>{g.status}</span>
                      </div>
                    </div>
                    <div style={{ color: C.muted, fontSize: 11, maxWidth: 400, textAlign: "right" }}>{g.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* File Type Breakdown */}
          {result.fileGroups?.length ? (
            <Section title="📦 File Type Crawl Distribution" accent={C.amber}>
              <div style={{ display: "grid", gap: 8 }}>
                {result.fileGroups.map((g, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge color={g.status === 'Healthy' ? C.green : C.amber}>{g.type}</Badge>
                      <span style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{g.percentage}%</span>
                    </div>
                    <div style={{ color: C.muted, fontSize: 11, maxWidth: 400, textAlign: "right" }}>{g.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Crawl Purpose */}
          {result.purposeGroups?.length ? (
            <Section title="🎯 Crawl Purpose Distribution" accent={C.purple}>
              <div style={{ display: "grid", gap: 8 }}>
                {result.purposeGroups.map((g, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge color={g.status === 'Healthy' ? C.green : g.status === 'Critical' ? C.red : C.amber}>{g.purpose}</Badge>
                      <span style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{g.percentage}%</span>
                    </div>
                    <div style={{ color: C.muted, fontSize: 11, maxWidth: 400, textAlign: "right" }}>{g.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Issues */}
          {result.issues?.length ? (
            <Section title="🚀 Prioritized Fix List" accent={C.red}>
              <div style={{ display: "grid", gap: 14 }}>
                {result.issues.map((issue, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${issue.severity === 'High' ? C.red + '66' : C.border}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge color={issue.severity === 'High' ? C.red : issue.severity === 'Medium' ? C.amber : C.muted}>{issue.severity}</Badge>
                        <span style={{ color: C.text, fontWeight: 700 }}>{issue.category}</span>
                      </div>
                    </div>
                    <div style={{ color: C.text, fontSize: 13, marginBottom: 8 }}>{issue.description}</div>
                    <div style={{ color: C.green, fontSize: 12, marginBottom: 8, lineHeight: 1.6 }}>{issue.fix}</div>
                    {issue.devOpsChecklist?.length ? (
                      <div>
                        <div style={{ color: C.muted, fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>DevOps Checklist</div>
                        <div style={{ display: "grid", gap: 3 }}>
                          {issue.devOpsChecklist.map((step, j) => (
                            <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                              <span style={{ color: C.blue, fontSize: 11 }}>▸</span>
                              <span style={{ color: C.muted, fontSize: 11, fontFamily: "monospace" }}>{step}</span>
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

// ─── GEO Matrix ──────────────────────────────────────────────────────────────
function GEOTab() {
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GEOResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText((ev.target?.result as string) || "");
    reader.readAsText(f);
  };

  const handleAnalyze = async () => {
    if (!csvText.trim()) { setError("Load GSC data first."); return; }
    setLoading(true); setError("");
    try {
      const rows = parseGSCcsv(csvText);
      const resp = await fetch("/api/geo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalDataset: rows }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="📐 GEO Matrix & Content Strategy">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} ref={fileRef} style={{ display: "none" }} />
            <Btn onClick={() => fileRef.current?.click()} color={C.purple}>📁 Load Full GSC CSV</Btn>
            <Btn onClick={handleAnalyze} loading={loading} color={C.green} disabled={!csvText}>📐 Generate GEO Matrix</Btn>
          </div>
          <TextArea value={csvText} onChange={setCsvText} placeholder="Paste your full GSC CSV (top 500 rows) here for programmatic content analysis…" rows={4} />
          <div style={{ color: C.muted, fontSize: 11 }}>Upload top 500 rows of GSC data for full semantic clustering, momentum detection, and content blueprint generation.</div>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {error && <div style={{ color: C.red, background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {result && !loading && (
        <div style={{ marginTop: 24 }}>
          {/* Site Baseline */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Stat label="Total Impressions" value={result.siteBaseline.totalImpressions.toLocaleString()} color={C.blue} />
            <Stat label="Avg Position" value={result.siteBaseline.avgPosition.toFixed(1)} color={C.amber} />
            <Stat label="Avg CTR" value={result.siteBaseline.avgCTR.toFixed(1) + "%"} color={C.green} />
            <Stat label="Total Clicks" value={result.siteBaseline.totalClicks.toLocaleString()} color={C.purple} />
          </div>

          {/* Top Pillars */}
          {result.topPillars?.length ? (
            <Section title="🏛️ Top Content Pillars" accent={C.blue}>
              <div style={{ display: "grid", gap: 14 }}>
                {result.topPillars.map((pillar, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge color={C.green}>{pillar.dominantFormat}</Badge>
                        <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{pillar.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <span style={{ color: C.blue, fontSize: 12 }}>{pillar.totalImpressions.toLocaleString()} impr</span>
                        <span style={{ color: C.amber, fontSize: 12 }}>pos {pillar.avgPosition}</span>
                        <span style={{ color: C.green, fontSize: 12 }}>{pillar.avgCTR}% CTR</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {pillar.queries.slice(0, 8).map((q, j) => (
                        <span key={j} style={{ background: C.surface, color: C.muted, borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>{q.query} ({q.clicks})</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Momentum Patterns */}
          {result.momentumPatterns?.length ? (
            <Section title="📈 Content Format Momentum" accent={C.green}>
              <div style={{ display: "grid", gap: 8 }}>
                {result.momentumPatterns.filter(p => p.avgCTR > 0).map((p, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.green}44`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge color={C.blue}>{p.format}</Badge>
                      <span style={{ color: C.green, fontWeight: 700, fontSize: 14 }}>{p.avgCTR}% avg CTR</span>
                    </div>
                    <div style={{ color: C.muted, fontSize: 11 }}>{p.sampleQueries.slice(0, 3).join(' · ')}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Programmatic Gaps */}
          {result.programmaticGaps?.length ? (
            <Section title="🔍 Programmatic Gap Opportunities" accent={C.amber}>
              <div style={{ display: "grid", gap: 8 }}>
                {result.programmaticGaps.map((gap, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <Badge color={C.amber}>"{gap.modifier}"</Badge>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: C.muted, fontSize: 11 }}>CTR: {gap.ctr}%</span>
                        <span style={{ color: C.blue, fontSize: 11 }}>{gap.volume.toLocaleString()} queries</span>
                      </div>
                    </div>
                    <div style={{ color: C.text, fontSize: 12 }}>{gap.recommendation}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* New Content Blueprints */}
          {result.newContentBlueprints?.length ? (
            <Section title="🗺️ New Content Blueprints" accent={C.purple}>
              <div style={{ display: "grid", gap: 16 }}>
                {result.newContentBlueprints.map((bp, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.purple}44`, borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <Badge color={C.blue}>{bp.format}</Badge>
                      <Badge color={C.purple}>{bp.niche}</Badge>
                    </div>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{bp.suggestedTitle}</div>
                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 10 }}>Target: {bp.targetQuery}</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ color: C.green, fontSize: 11, marginBottom: 4 }}>GEO OPTIMIZATIONS</div>
                        {bp.geoOptimizations.map((o, j) => (
                          <div key={j} style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>• {o}</div>
                        ))}
                      </div>
                      <div>
                        <div style={{ color: C.blue, fontSize: 11, marginBottom: 4 }}>AEO OPTIMIZATIONS</div>
                        {bp.aeoOptimizations.map((o, j) => (
                          <div key={j} style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>• {o}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* GEO Rules */}
          {result.geoRules?.length ? (
            <Section title="🤖 GEO Rules (AI Overview Optimization)" accent={C.green}>
              <div style={{ display: "grid", gap: 6 }}>
                {result.geoRules.map((rule, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: C.green, fontSize: 14 }}>✓</span>
                    <span style={{ color: C.text, fontSize: 13 }}>{rule}</span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* AEO Rules */}
          {result.aeoRules?.length ? (
            <Section title="💬 AEO Rules (Answer Engine Optimization)" accent={C.blue}>
              <div style={{ display: "grid", gap: 6 }}>
                {result.aeoRules.map((rule, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: C.blue, fontSize: 14 }}>✓</span>
                    <span style={{ color: C.text, fontSize: 13 }}>{rule}</span>
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

// ─── Sitemap Validator ──────────────────────────────────────────────────────
function SitemapTab() {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SitemapResult | null>(null);
  const [error, setError] = useState("");

  const handleValidate = async () => {
    if (!sitemapUrl.trim()) { setError("Enter a sitemap URL first."); return; }
    setLoading(true); setError("");
    try {
      const resp = await fetch("/api/sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitemapUrl }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      setResult(json.result);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="🗺️ Automated Sitemap Validation System">
        <div style={{ display: "grid", gap: 12 }}>
          <Input value={sitemapUrl} onChange={setSitemapUrl} placeholder="https://yoursite.com/sitemap_index.xml" />
          <Btn onClick={handleValidate} loading={loading} color={C.green}>🗺️ Validate & Ping Google</Btn>
          <div style={{ color: C.muted, fontSize: 11 }}>Validates your XML sitemap and notifies Google of updates. Supports standard sitemap formats including sitemap_index.xml.</div>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {error && <div style={{ color: C.red, background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {result && !loading && (
        <div style={{ marginTop: 24 }}>
          {/* Result Banner */}
          <div style={{ background: result.success ? C.green + '22' : C.red + '22', border: `1px solid ${result.success ? C.green + '66' : C.red + '66'}`, borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{result.success ? '✅' : '❌'}</span>
              <div>
                <div style={{ color: result.success ? C.green : C.red, fontSize: 16, fontWeight: 800 }}>{result.success ? 'SITEMAP VALIDATED' : 'VALIDATION FAILED'}</div>
                <div style={{ color: C.muted, fontSize: 12 }}>{result.sitemapUrl}</div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: C.muted, fontSize: 12, width: 140 }}>Validation:</span>
                <Badge color={result.validated ? C.green : C.red}>{result.validationStatus || 'N/A'}</Badge>
                <span style={{ color: C.text, fontSize: 12 }}>{result.validationMessage}</span>
              </div>
              {result.pingedAt && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: C.muted, fontSize: 12, width: 140 }}>Pinged:</span>
                  <Badge color={C.blue}>GOOGLE PING SENT</Badge>
                  <span style={{ color: C.text, fontSize: 12 }}>{new Date(result.pingedAt).toLocaleString()}</span>
                </div>
              )}
              {result.pingMessage && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: C.muted, fontSize: 12, width: 140 }}>Note:</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>{result.pingMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* How It Works */}
          <Section title="📖 How It Works" accent={C.muted}>
            <div style={{ display: "grid", gap: 8, color: C.muted, fontSize: 12, lineHeight: 1.7 }}>
              <div>1. <strong style={{ color: C.text }}>HEAD request</strong> — Server validates sitemap exists and returns 200 OK</div>
              <div>2. <strong style={{ color: C.text }}>Google ping</strong> — Notifies Googlebot to re-crawl and ingest sitemap changes</div>
              <div>3. <strong style={{ color: C.text }}>GSC confirmation</strong> — Check Google Search Console to confirm update was processed</div>
              <div style={{ marginTop: 8, color: C.amber, fontSize: 11 }}>Note: Google does not return a CORS-usable response for ping requests — the ping is sent but confirmation requires checking GSC.</div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function SEOMaster() {
  const [activeTab, setActiveTab] = useState("gsc");
  const [analysisHistory, setAnalysisHistory] = useState<Array<{ data: unknown; type: string; timestamp: Date }>>([]);

  const handleAnalysis = (data: unknown, type: string) => {
    setAnalysisHistory(prev => [{ data, type, timestamp: new Date() }, ...prev]);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>🔍 SEOMaster</h1>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>AI-Powered SEO Analytics · Powered by MiniMax M2.7</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge color={C.green}>🟢 YOLO</Badge>
          <Badge color={C.blue}>MiniMax M2.7</Badge>
        </div>
      </header>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 4, padding: "12px 24px", borderBottom: `1px solid ${C.border}`, overflowX: "auto", background: C.surface }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: activeTab === tab.id ? C.card : "transparent",
            color: activeTab === tab.id ? C.text : C.muted,
            border: `1px solid ${activeTab === tab.id ? C.border : "transparent"}`,
            borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
            fontFamily: "inherit", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        {activeTab === "gsc" && <GSCTab onAnalysis={handleAnalysis} />}
        {activeTab === "ctr" && <CTRTab />}
        {activeTab === "ai" && <KeywordTab />}
        {activeTab === "filter" && <FilterTab />}
        {activeTab === "index" && <IndexTab />}
        {activeTab === "crawl" && <CrawlTab />}
        {activeTab === "geo" && <GEOTab />}
        {activeTab === "sitemap" && <SitemapTab />}
        {activeTab === "topic" && <TopicTab />}
        {activeTab === "reports" && <ReportsTab />}
      </main>
    </div>
  );
}