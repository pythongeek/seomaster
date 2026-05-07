"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Badge, Button, Section, Input, TextArea, StatCard, LoadingSpinner, ErrorBanner, DataTable, Modal, ProgressBar } from "@/components/ui";
import { CtrBarchart, PositionScatter, IntentPie } from "@/components/charts";
import { parseGSCcsv, splitCSVLine } from "@/lib/api";
import { useStore } from "@/store";
import { useJobPolling } from "@/hooks/useJobPolling";
import type { GSCRow, GSCResult } from "@/types";
import { QuickWinDetailModal } from "@/components/modals/QuickWinDetailModal";
import { AiOverviewDetailModal } from "@/components/modals/AiOverviewDetailModal";
import { PriorityMatrixDetailModal } from "@/components/modals/PriorityMatrixDetailModal";
import type { SearchType, AggregationType, DimensionType } from "@/store";

interface GscCommandCenterProps {
  onAnalysis?: (data: unknown, type: string) => void;
}

// ─── Dimension options for SEO experts ─────────────────────────────────────
const DIMENSION_OPTIONS: { value: DimensionType; label: string; description: string }[] = [
  { value: "query", label: "Query", description: "Search terms users typed" },
  { value: "page", label: "Page", description: "URLs that received impressions" },
  { value: "device", label: "Device", description: "Desktop, Mobile, Tablet split" },
  { value: "country", label: "Country", description: "Geographic performance by country" },
  { value: "date", label: "Date", description: "Day-by-day trends" },
];

const COUNTRY_OPTIONS = [
  { value: "", label: "All Countries" },
  { value: "USA", label: "United States" },
  { value: "GBR", label: "United Kingdom" },
  { value: "CAN", label: "Canada" },
  { value: "AUS", label: "Australia" },
  { value: "IND", label: "India" },
  { value: "BGD", label: "Bangladesh" },
  { value: "DEU", label: "Germany" },
  { value: "FRA", label: "France" },
  { value: "NLD", label: "Netherlands" },
  { value: "BRA", label: "Brazil" },
  { value: "SGP", label: "Singapore" },
  { value: "ARE", label: "UAE" },
];

export function GscCommandCenter({ onAnalysis }: GscCommandCenterProps) {
  const csvText = useStore((s) => s.csvText);
  const setCsvText = useStore((s) => s.setCsvText);
  const siteUrl = useStore((s) => s.siteUrl);
  const setSiteUrl = useStore((s) => s.setSiteUrl);
  const startDate = useStore((s) => s.startDate);
  const setStartDate = useStore((s) => s.setStartDate);
  const endDate = useStore((s) => s.endDate);
  const setEndDate = useStore((s) => s.setEndDate);
  const gscRows = useStore((s) => s.gscRows);
  const setGscRows = useStore((s) => s.setGscRows);
  const gscResult = useStore((s) => s.gscResult);
  const setGscResult = useStore((s) => s.setGscResult);
  const gscFetchJobId = useStore((s) => s.gscFetchJobId);
  const setGscFetchJobId = useStore((s) => s.setGscFetchJobId);
  const activeJobs = useStore((s) => s.activeJobs);
  const searchType = useStore((s) => s.searchType);
  const setSearchType = useStore((s) => s.setSearchType);
  const selectedDimensions = useStore((s) => s.selectedDimensions);
  const setSelectedDimensions = useStore((s) => s.setSelectedDimensions);
  const deviceFilter = useStore((s) => s.deviceFilter);
  const setDeviceFilter = useStore((s) => s.setDeviceFilter);
  const countryFilter = useStore((s) => s.countryFilter);
  const setCountryFilter = useStore((s) => s.setCountryFilter);
  const aggregationType = useStore((s) => s.aggregationType);
  const setAggregationType = useStore((s) => s.setAggregationType);
  const rowLimit = useStore((s) => s.rowLimit);
  const setRowLimit = useStore((s) => s.setRowLimit);

  const rows = gscRows;
  const setRows = setGscRows;
  const result = gscResult;
  const setResult = setGscResult;

  const [mode, setMode] = useState<"upload" | "api">("api");
  const [loading, setLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [apiError, setApiError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [showReportConfig, setShowReportConfig] = useState(false);

  // Modal state
  const [selectedQuickWin, setSelectedQuickWin] = useState<GSCResult["quickWins"][number] | null>(null);
  const [selectedAiCandidate, setSelectedAiCandidate] = useState<GSCResult["aiOverviewCandidates"][number] | null>(null);
  const [selectedPriorityItem, setSelectedPriorityItem] = useState<GSCResult["priorityMatrix"][number] | null>(null);

  const gscFetchJob = gscFetchJobId ? activeJobs[gscFetchJobId] : null;
  const fetchLoading = gscFetchJob?.status === "processing";

  const currentJob = useJobPolling(activeJobId, (res) => {
    setResult(res);
    setLoading(false);
    setActiveJobId(null);
    onAnalysis?.(res, "gsc_full");
  }, (err) => {
    setError(err);
    setLoading(false);
    setActiveJobId(null);
  });

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
  const processFiles = async (files: File[]) => {
    let combinedText = ""; let combinedRows: GSCRow[] = [];
    for (const f of files) { const text = await f.text(); combinedText += text + "\n"; combinedRows = combinedRows.concat(parseGSCcsv(text)); }
    setCsvText(combinedText); setRows(combinedRows);
    if (combinedRows.length) { detectAndAutoMapColumns(combinedRows); setError(""); }
    else { setError("Could not parse CSV. Check format."); setShowColumnMapper(true); }
  };
  const handleDrop = async (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); const files = Array.from(e.dataTransfer.files || []); if (files.length) await processFiles(files); };
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(e.target.files || []); if (files.length) await processFiles(files); };
  const handleParse = () => processFile(csvText);

  const applyColumnMapping = () => {
    if (!csvText) return;
    const lines = csvText.trim().split("\n");
    const headerIdx = lines.findIndex(l => /clicks/i.test(l) && /impressions/i.test(l));
    if (headerIdx < 0) { setError("Could not find header row"); return; }
    const headers = splitCSVLine(lines[headerIdx]).map(h => h.replace(/"/g, "").trim().toLowerCase());
    const targetToSource: Record<string, string> = {};
    Object.entries(columnMapping).forEach(([target, source]) => { const idx = headers.indexOf(source.toLowerCase()); if (idx >= 0) targetToSource[target] = headers[idx]; });
    const mapped: GSCRow[] = lines.slice(headerIdx + 1).map(line => {
      const cols = splitCSVLine(line);
      const get = (t: string) => cols[headers.indexOf(targetToSource[t])] || "";
      return { query: get("query") || cols[0] || "", page: get("page") || cols[1] || "", clicks: parseInt(get("clicks")) || 0, impressions: parseInt(get("impressions")) || 0, ctr: parseFloat(String(get("ctr") || "0").replace("%", "")) || 0, position: parseFloat(get("position")) || 0 };
    }).filter(r => r.query || r.page);
    setRows(mapped); setShowColumnMapper(false);
    if (mapped.length) setError(""); else setError("No valid rows after mapping");
  };

  const handleAnalyze = async () => {
    if (!rows.length) { setError("Load data first."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const payload = { type: "gsc_full", data: rows, options: { siteUrl, startDate, endDate } };
      if (rows.length > 10000) {
        const resp = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "analyze", input: payload }) });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || "Failed to start background job");
        setActiveJobId(json.jobId);
        return;
      }
      const resp = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Analysis failed");
      setResult(json.result);
      onAnalysis?.(json.result, "gsc_full");
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  // ─── Google OAuth state ────────────────────────────────────────────────────
  const [gscConnected, setGscConnected] = useState(false);
  const [gscEmail, setGscEmail] = useState("");
  const [gscSites, setGscSites] = useState<{ url: string; permission: string }[]>([]);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [loadingSites, setLoadingSites] = useState(false);

  const checkGscConnection = useCallback(async () => {
    try {
      const res = await fetch("/api/gsc-oauth");
      const data = await res.json();
      if (data.connected) {
        setGscConnected(true);
        setGscEmail(data.email || "");
        setLoadingSites(true);
        const sitesRes = await fetch(`/api/gsc-sites?email=${encodeURIComponent(data.email || "")}`);
        const sitesData = await sitesRes.json();
        if (sitesData.sites) setGscSites(sitesData.sites);
        setLoadingSites(false);
      }
    } catch { setLoadingSites(false); }
  }, []);

  useEffect(() => {
    checkGscConnection();
    const params = new URLSearchParams(window.location.search);
    if (params.get("gsc_connected") === "1") {
      checkGscConnection();
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("gsc_error")) {
      setApiError(`Google connection failed: ${params.get("gsc_error")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [checkGscConnection]);

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const res = await fetch("/api/auth/gsc");
      const data = await res.json();
      if (data.authUrl) window.location.href = data.authUrl;
      else setApiError("Failed to initiate Google connection");
    } catch (e) { setApiError("Failed to connect Google"); }
    finally { setConnectingGoogle(false); }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await fetch(`/api/auth/gsc/disconnect?email=${encodeURIComponent(gscEmail)}`, { method: "POST" });
      setGscConnected(false); setGscEmail(""); setGscSites([]);
    } catch {}
  };

  const toggleDimension = (dim: DimensionType) => {
    if (selectedDimensions.includes(dim)) {
      if (selectedDimensions.length <= 1) return; // must have at least 1
      setSelectedDimensions(selectedDimensions.filter(d => d !== dim));
    } else {
      setSelectedDimensions([...selectedDimensions, dim]);
    }
  };

  const handleFetchGscOAuth = async () => {
    if (!siteUrl) { setApiError("Site URL required"); return; }
    setApiError("");
    setLoading(true);
    try {
      const payload = {
        email: gscEmail,
        siteUrl,
        startDate,
        endDate,
        searchType,
        dimensions: selectedDimensions,
        device: deviceFilter || undefined,
        country: countryFilter || undefined,
        aggregationType,
        rowLimit,
      };
      const resp = await fetch("/api/gsc-oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Failed to fetch");
      const rows = json.rows || [];
      setRows(rows);
      if (rows.length) { detectAndAutoMapColumns(rows); setError(""); }
    } catch (e) { setApiError((e as Error).message); }
    finally { setLoading(false); }
  };

  // Handle background job completion
  useEffect(() => {
    if (gscFetchJob?.status === "completed" && gscFetchJob.result) {
      const fetchedRows = (gscFetchJob.result as { rows?: GSCRow[] }).rows || [];
      setRows(fetchedRows);
      if (fetchedRows.length) { detectAndAutoMapColumns(fetchedRows); setError(""); }
      setGscFetchJobId(null);
    } else if (gscFetchJob?.status === "failed") {
      setApiError(gscFetchJob.error || "Fetch failed");
      setGscFetchJobId(null);
    }
  }, [gscFetchJob]);

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
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} ref={fileRef} className="hidden" multiple />
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

      {/* API Mode — Google OAuth */}
      {mode === "api" && (
        <Section title="🔗 Google Search Console">
          {!gscConnected ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🔐</div>
              <div className="text-text font-bold text-lg mb-2">Connect Your Google Account</div>
              <div className="text-muted text-sm mb-6 max-w-md mx-auto">
                Sign in with Google to securely access your Search Console data. No service account needed.
              </div>
              <Button onClick={handleConnectGoogle} loading={connectingGoogle} className="px-6 py-3 text-base">
                🚀 Connect Google
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {/* Connected account */}
              <div className="flex items-center justify-between bg-green/10 border border-green/25 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">✅</div>
                  <div>
                    <div className="text-text font-semibold text-sm">{gscEmail}</div>
                    <div className="text-green text-xs">Connected to Google Search Console</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDisconnectGoogle}>Disconnect</Button>
                </div>
              </div>

              {/* Site selector */}
              {loadingSites ? (
                <div className="text-muted text-sm flex items-center gap-2"><LoadingSpinner /> Loading your GSC properties…</div>
              ) : gscSites.length > 0 ? (
                <div>
                  <label className="text-muted text-xs mb-1.5 block">📍 Select GSC Property</label>
                  <select
                    value={siteUrl}
                    onChange={e => setSiteUrl(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text text-sm">
                    <option value="">— Select a verified property —</option>
                    {gscSites.map(s => (
                      <option key={s.url} value={s.url}>
                        {s.url} ({s.permission.replace("siteOwner", "Owner").replace("siteUnverifiedUser", "Unverified").replace("siteVerifiedUser", "Verified")})
                      </option>
                    ))}
                  </select>
                  {siteUrl && (
                    <div className="mt-1.5 text-muted text-[11px]">
                      Using: <span className="text-text font-mono">{siteUrl}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-muted text-xs mb-1.5 block">🔗 Manual Property URL</label>
                  <Input
                    value={siteUrl}
                    onChange={setSiteUrl}
                    placeholder="https://yoursite.com or sc-domain:yoursite.com"
                  />
                </div>
              )}

              {/* ─── Report Configuration ───────────────────────────────────── */}
              <div className="border border-border rounded-xl overflow-hidden">
                {/* Config header — toggle */}
                <button
                  onClick={() => setShowReportConfig(!showReportConfig)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface/80 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-blue text-sm">⚙️</span>
                    <span className="text-text font-semibold text-sm">Report Configuration</span>
                    <span className="text-muted text-[11px] hidden sm:inline">— customize what to fetch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedDimensions.length > 0 && (
                      <Badge variant="blue">{selectedDimensions.length} dim{selectedDimensions.length > 1 ? "s" : ""}</Badge>
                    )}
                    <span className={`text-muted text-sm transition-transform ${showReportConfig ? "rotate-180" : ""}`}>▼</span>
                  </div>
                </button>

                {/* Config body */}
                {showReportConfig && (
                  <div className="px-4 pb-4 pt-2 grid gap-4 border-t border-border">
                    {/* Search Type */}
                    <div>
                      <label className="text-muted text-[11px] mb-1.5 block uppercase tracking-wider">🔍 Search Type</label>
                      <div className="flex gap-2 flex-wrap">
                        {(["web", "image", "video", "news"] as SearchType[]).map(t => (
                          <button key={t} onClick={() => setSearchType(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${searchType === t ? "bg-blue text-white" : "bg-surface text-muted border border-border hover:border-blue/50"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dimensions */}
                    <div>
                      <label className="text-muted text-[11px] mb-1.5 block uppercase tracking-wider">📐 Dimensions <span className="normal-case tracking-normal">(select 1–5)</span></label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {DIMENSION_OPTIONS.map(dim => {
                          const active = selectedDimensions.includes(dim.value);
                          return (
                            <button key={dim.value} onClick={() => toggleDimension(dim.value)}
                              disabled={!active && selectedDimensions.length >= 5}
                              title={dim.description}
                              className={`text-left px-3 py-2 rounded-lg text-xs transition-all border ${active ? "bg-blue/10 border-blue/40 text-blue font-semibold" : "bg-surface border-border text-muted hover:border-blue/30 hover:text-text"} ${!active && selectedDimensions.length >= 5 ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                              <div className="font-bold">{dim.label}</div>
                              <div className="text-[10px] opacity-70 mt-0.5">{dim.description}</div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-1.5 text-[10px] text-muted">
                        Selected: <span className="text-text font-mono">{selectedDimensions.join(", ") || "none"}</span>
                      </div>
                    </div>

                    {/* Date Range */}
                    <div>
                      <label className="text-muted text-[11px] mb-1.5 block uppercase tracking-wider">📅 Date Range</label>
                      <div className="flex gap-2 flex-wrap mb-2">
                        {datePresets.map(p => (
                          <button key={p.days} onClick={() => applyDatePreset(p.days)}
                            className="px-3 py-1.5 rounded-md text-xs font-bold bg-surface text-muted hover:text-text border border-border hover:border-blue/50 transition-all">
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-muted text-[10px] mb-1 block">From</label>
                          <Input value={startDate} onChange={setStartDate} type="date" />
                        </div>
                        <div>
                          <label className="text-muted text-[10px] mb-1 block">To</label>
                          <Input value={endDate} onChange={setEndDate} type="date" />
                        </div>
                      </div>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-muted text-[11px] mb-1 block uppercase tracking-wider">🌐 Country</label>
                        <select
                          value={countryFilter}
                          onChange={e => setCountryFilter(e.target.value)}
                          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm">
                          {COUNTRY_OPTIONS.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-muted text-[11px] mb-1 block uppercase tracking-wider">📱 Device</label>
                        <select
                          value={deviceFilter}
                          onChange={e => setDeviceFilter(e.target.value)}
                          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm">
                          <option value="">All Devices</option>
                          <option value="DESKTOP">Desktop</option>
                          <option value="MOBILE">Mobile</option>
                          <option value="TABLET">Tablet</option>
                        </select>
                      </div>
                    </div>

                    {/* Aggregation */}
                    <div>
                      <label className="text-muted text-[11px] mb-1.5 block uppercase tracking-wider">🔗 Aggregation</label>
                      <div className="flex gap-2">
                        {([["byProperty", "By Property (default)"], ["byPage", "By Page"]] as [AggregationType, string][]).map(([val, label]) => (
                          <button key={val} onClick={() => setAggregationType(val)}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${aggregationType === val ? "bg-blue/10 border-blue/40 text-blue" : "bg-surface border-border text-muted hover:border-blue/30"}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1 text-[10px] text-muted">"By Page" returns one row per URL; "By Property" aggregates across the whole site.</div>
                    </div>

                    {/* Row limit */}
                    <div>
                      <label className="text-muted text-[11px] mb-1.5 block uppercase tracking-wider">📊 Row Limit: <span className="text-text font-mono">{rowLimit.toLocaleString()}</span></label>
                      <input
                        type="range"
                        min={100}
                        max={10000}
                        step={100}
                        value={rowLimit}
                        onChange={e => setRowLimit(parseInt(e.target.value))}
                        className="w-full accent-blue"
                      />
                      <div className="flex justify-between text-[10px] text-muted mt-1">
                        <span>100</span>
                        <span>5,000 (recommended)</span>
                        <span>10,000</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary of selected config */}
              {siteUrl && selectedDimensions.length > 0 && (
                <div className="bg-blue/5 border border-blue/20 rounded-lg px-3 py-2 text-[11px] text-muted flex flex-wrap gap-x-4 gap-y-1">
                  <span>🔍 <span className="text-text capitalize">{searchType}</span></span>
                  <span>📐 <span className="text-text">{selectedDimensions.join(", ")}</span></span>
                  <span>📅 <span className="text-text">{startDate} → {endDate}</span></span>
                  {countryFilter && <span>🌐 <span className="text-text">{countryFilter}</span></span>}
                  {deviceFilter && <span>📱 <span className="text-text">{deviceFilter}</span></span>}
                  <span>📊 <span className="text-text">max {rowLimit.toLocaleString()} rows</span></span>
                  <span>🔗 <span className="text-text">{aggregationType}</span></span>
                </div>
              )}

              {/* Fetch button */}
              <Button
                onClick={handleFetchGscOAuth}
                loading={loading}
                disabled={!siteUrl}
                className="w-full py-3 text-base"
              >
                {loading ? "Fetching…" : "🔗 Fetch GSC Data"}
              </Button>
            </div>
          )}
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
          <div className="flex items-center gap-3">
            <span className="text-green text-sm font-bold">✓ {rows.length.toLocaleString()} rows loaded</span>
            {siteUrl && <span className="text-muted text-xs">{siteUrl}</span>}
          </div>
          <Button onClick={handleAnalyze} loading={loading}>🚀 Run Full Analysis</Button>
        </div>
      )}

      <ErrorBanner message={error} />
      <ErrorBanner message={apiError} />

      {currentJob && (
        <div className="mb-4">
          <ProgressBar progress={currentJob.progress || 0} message={currentJob.progressMessage || "Processing data..."} status={currentJob.status as any} />
        </div>
      )}

      {loading && !currentJob && <LoadingSpinner />}

      {/* Results */}
      {result && !loading && (
        <div className="animate-fade-in">
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

          {result.quickWins?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-7">
              <CtrBarchart data={result.quickWins.map(q => ({ query: q.query, impressions: q.impressions, ctr: q.currentCTR }))} />
              <PositionScatter data={result.quickWins.map(q => ({ query: q.query, position: q.position, clicks: q.clicks }))} />
              {result.intentAnalysis?.distribution && <IntentPie data={result.intentAnalysis.distribution} />}
            </div>
          ) : null}

          {result.quickWins?.length ? (
            <Section title="⚡ Quick Wins — Fastest ROI" accent="green">
              <div className="mb-3 bg-green/5 border border-green/20 rounded-lg px-3 py-2">
                <span className="text-green text-xs font-semibold">💡 Tip: Click any item below to see detailed analysis + AI-generated step-by-step fix plan</span>
              </div>
              <div className="grid gap-2.5">
                {result.quickWins.slice(0, 10).map((qw, i) => (
                  <div key={i} onClick={() => setSelectedQuickWin(qw)}
                    className={`bg-card border rounded-lg p-3 cursor-pointer hover:border-green/40 hover:shadow-lg hover:shadow-green/5 transition-all duration-200 ${i < 3 ? "border-green/40" : "border-border"}`}>
                    <div className="flex justify-between flex-wrap gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-text font-semibold text-[13px]">{qw.query}</span>
                        {i < 3 && <span className="text-[10px] bg-green/10 text-green px-1.5 py-0.5 rounded font-bold">TOP</span>}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="green">+{qw.estimatedTrafficGain} clicks</Badge>
                        <Badge variant={qw.effort === "low" ? "green" : qw.effort === "medium" ? "amber" : "red"}>{qw.effort} effort</Badge>
                        <Badge variant="muted">→ Details</Badge>
                      </div>
                    </div>
                    <div className="text-muted text-[11px] mb-1">Position: {qw.position} · Impressions: {qw.impressions.toLocaleString()} · CTR: {qw.currentCTR}% → {qw.benchmarkCTR}%</div>
                    <div className="text-blue text-xs">{qw.action}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

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

          {result.cannibalization?.length ? (
            <Section title="⚠️ Keyword Cannibalization" accent="red">
              <div className="grid gap-3">
                {result.cannibalization.slice(0, 8).map((c, i) => (
                  <div key={i} className={`bg-card border rounded-xl p-4 ${c.severity === "critical" ? "border-red/40" : "border-border"}`}>
                    <div className="flex justify-between mb-2 flex-wrap gap-2">
                      <span className="text-text font-bold text-sm">"{c.query}"</span>
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

          {result.aiOverviewCandidates?.length ? (
            <Section title="🤖 AI Overview Candidates" accent="purple">
              <div className="mb-3 bg-purple/5 border border-purple/20 rounded-lg px-3 py-2">
                <span className="text-purple text-xs font-semibold">💡 Click any candidate to see detailed analysis + AI content optimization plan</span>
              </div>
              <div className="grid gap-2.5">
                {result.aiOverviewCandidates.slice(0, 10).map((c, i) => (
                  <div key={i} onClick={() => setSelectedAiCandidate(c)}
                    className={`bg-card border rounded-lg p-3 cursor-pointer hover:border-purple/40 hover:shadow-lg hover:shadow-purple/5 transition-all ${c.eligibility === "high" ? "border-purple/40" : "border-border"}`}>
                    <div className="flex justify-between mb-1.5 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-text font-semibold text-[13px]">{c.query}</span>
                        {c.eligibility === "high" && <span className="text-[10px] bg-purple/10 text-purple px-1.5 py-0.5 rounded font-bold">TOP</span>}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={c.eligibility === "high" ? "green" : c.eligibility === "medium" ? "amber" : "muted"}>{c.eligibility} eligibility</Badge>
                        <Badge variant="purple">{c.contentFormat}</Badge>
                        <Badge variant="muted">→ Details</Badge>
                      </div>
                    </div>
                    <div className="text-muted text-[11px]">Position: {c.position} · Impressions: {c.impressions.toLocaleString()} · Score: {c.eligibilityScore}/10</div>
                    <div className="text-blue text-xs mt-1">{c.optimizationFocus}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {result.priorityMatrix?.length ? (
            <Section title="📐 What To Work On First" accent="blue">
              <div className="mb-3 bg-blue/5 border border-blue/20 rounded-lg px-3 py-2">
                <span className="text-blue text-xs font-semibold">💡 Click any item to see detailed analysis + AI step-by-step implementation plan</span>
              </div>
              <div className="flex gap-3 flex-wrap mb-4 p-3 bg-surface rounded-lg border border-border">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue"/></div><span className="text-muted text-[11px]">CTR Fix</span>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber"/></div><span className="text-muted text-[11px]">Content Gap</span>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red"/></div><span className="text-muted text-[11px]">Cannibalization</span>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple"/></div><span className="text-muted text-[11px]">Position Push</span>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan"/></div><span className="text-muted text-[11px]">SERP Features</span>
              </div>
              <div className="grid gap-3">
                {result.priorityMatrix.filter(p => p.impact === "critical" || p.impact === "high").slice(0, 5).map((item, i) => (
                  <div key={i} onClick={() => setSelectedPriorityItem(item)}
                    className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-blue/40 hover:shadow-lg hover:shadow-blue/5 transition-all">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-text font-bold text-sm">{item.query}</span>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.category === "ctr" ? "bg-blue" : item.category === "content_gap" ? "bg-amber" : item.category === "cannibalization" ? "bg-red" : item.category === "position" ? "bg-purple" : "bg-cyan"}`}/>
                          <span className="text-muted text-[11px] capitalize">{item.category.replace("_", " ")}</span>
                          {item.impact === "critical" && <span className="text-[10px] bg-red/10 text-red px-1.5 py-0.5 rounded font-bold">CRITICAL</span>}
                          {item.impact === "high" && <span className="text-[10px] bg-amber/10 text-amber px-1.5 py-0.5 rounded font-bold">HIGH</span>}
                        </div>
                        <div className="text-text text-[12px] mb-1">{item.recommendedAction}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-extrabold text-blue font-mono">{item.opportunityScore}</div>
                        <div className="text-[10px] text-muted">score</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="text-muted">Effort: <strong className={item.effort === "low" ? "text-green" : item.effort === "medium" ? "text-amber" : "text-red"}>{item.effort}</strong></span>
                      <span className="text-muted">Time: <strong className="text-text">{item.timeToValue}</strong></span>
                      <span className="text-muted">Commercial: <strong className="text-text">{item.commercialValue}/100</strong></span>
                      <Badge variant="muted" className="ml-auto">→ View Plan</Badge>
                    </div>
                  </div>
                ))}
                {result.priorityMatrix.filter(p => p.impact === "medium" || p.impact === "low").slice(0, 5).length > 0 && (
                  <div className="mt-2">
                    <div className="text-muted text-[11px] uppercase tracking-wider mb-2">More Items</div>
                    <div className="grid gap-2">
                      {result.priorityMatrix.filter(p => p.impact === "medium" || p.impact === "low").slice(0, 5).map((item, i) => (
                        <div key={i} onClick={() => setSelectedPriorityItem(item)}
                          className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-blue/30 transition-all">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${item.category === "ctr" ? "bg-blue" : item.category === "content_gap" ? "bg-amber" : item.category === "cannibalization" ? "bg-red" : item.category === "position" ? "bg-purple" : "bg-cyan"}`}/>
                              <span className="text-text text-[12px]">{item.query}</span>
                              <span className="text-muted text-[10px] capitalize">{item.category.replace("_", " ")}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-muted text-[11px]">{item.effort} effort · {item.timeToValue}</span>
                              <Badge variant="muted">→</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          ) : null}

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

          {result.recommendations?.length ? (
            <Section title="🚀 Actionable Recommendations" accent="green">
              <div className="mb-3 bg-green/5 border border-green/20 rounded-lg px-3 py-2">
                <span className="text-green text-xs font-semibold">💡 Each recommendation is linked to a Quick Win or Priority item above. Click through for full implementation plans.</span>
              </div>
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

      {/* Detail Modals */}
      <QuickWinDetailModal open={!!selectedQuickWin} onClose={() => setSelectedQuickWin(null)} quickWin={selectedQuickWin} />
      <AiOverviewDetailModal open={!!selectedAiCandidate} onClose={() => setSelectedAiCandidate(null)} candidate={selectedAiCandidate} />
      <PriorityMatrixDetailModal open={!!selectedPriorityItem} onClose={() => setSelectedPriorityItem(null)} item={selectedPriorityItem} />
    </div>
  );
}
