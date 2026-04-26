"use client";

import { useState, useRef } from "react";
import { C, TABS } from "@/lib/constants";
import { callAI, fetchGSCData } from "@/lib/api";

interface BadgeProps {
  color: string;
  children: React.ReactNode;
}

const Badge = ({ color, children }: BadgeProps) => (
  <span style={{
    background: color + "22",
    color,
    border: `1px solid ${color}44`,
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    fontFamily: "monospace"
  }}>{children}</span>
);

interface StatProps {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}

const Stat = ({ label, value, color = C.blue, sub }: StatProps) => (
  <div style={{
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "16px 20px",
  }}>
    <div style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
    <div style={{ color, fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>{value}</div>
    {sub && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{sub}</div>}
  </div>
);

interface BtnProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  color?: string;
  small?: boolean;
}

const Btn = ({ onClick, disabled, loading, children, color = C.blue, small }: BtnProps) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    style={{
      background: disabled || loading ? C.sub : color,
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: small ? "6px 14px" : "10px 22px",
      fontSize: small ? 12 : 14,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled || loading ? 0.7 : 1,
      transition: "opacity 0.2s",
      fontFamily: "inherit",
    }}
  >{loading ? "⏳ Analyzing…" : children}</button>
);

interface TextAreaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
}

const TextArea = ({ value, onChange, placeholder, rows = 5 }: TextAreaProps) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    style={{
      width: "100%",
      background: C.surface,
      color: C.text,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "12px 14px",
      fontSize: 13,
      fontFamily: "monospace",
      resize: "vertical",
      outline: "none",
      boxSizing: "border-box",
    }}
  />
);

interface InputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
}

const Input = ({ value, onChange, placeholder, type = "text" }: InputProps) => (
  <input
    type={type}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      width: "100%",
      background: C.surface,
      color: C.text,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 13,
      fontFamily: "monospace",
      outline: "none",
      boxSizing: "border-box",
    }}
  />
);

interface SectionProps {
  title: string;
  children: React.ReactNode;
  accent?: string;
}

const Section = ({ title, children, accent = C.blue }: SectionProps) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: 10,
      marginBottom: 16
    }}>
      <div style={{ width: 3, height: 18, background: accent, borderRadius: 2 }} />
      <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{title}</span>
    </div>
    {children}
  </div>
);

interface AnalysisBoxProps {
  result: string;
  loading: boolean;
}

const AnalysisBox = ({ result, loading }: AnalysisBoxProps) => {
  if (loading) return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: 24,
      textAlign: "center"
    }}>
      <div style={{ color: C.blue, fontSize: 24, marginBottom: 8 }}>⚙️</div>
      <div style={{ color: C.muted, fontSize: 13 }}>Running AI analysis…</div>
    </div>
  );
  if (!result) return null;
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.green}44`,
      borderRadius: 10,
      padding: 20,
      fontFamily: "monospace",
      fontSize: 13,
      color: C.text,
      whiteSpace: "pre-wrap",
      lineHeight: 1.7,
      maxHeight: 480,
      overflowY: "auto"
    }}>{result}</div>
  );
};

// ─── GSC Command Center ────────────────────────────────────────────────────
function GSCTab() {
  const [mode, setMode] = useState("upload");
  const [csvText, setCsvText] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState("2025-04-01");
  const [rows, setRows] = useState<Array<{
    query: string;
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setCsvText(ev.target?.result as string || "");
      const parsed = parseGSCcsv(ev.target?.result as string || "");
      setRows(parsed);
    };
    reader.readAsText(f);
  };

  const parseGSCcsv = (csv: string) => {
    const lines = csv.trim().split("\n");
    const headerIdx = lines.findIndex(l =>
      /clicks/i.test(l) && /impressions/i.test(l)
    );
    if (headerIdx < 0) return [];
    const headers = lines[headerIdx].split(",").map(h =>
      h.replace(/"/g, "").trim().toLowerCase()
    );
    return lines.slice(headerIdx + 1).map(line => {
      const cols = line.split(",").map(c => c.replace(/"/g, "").trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = cols[i] || ""; });
      return {
        query: obj.query || obj["top queries"] || "",
        page: obj.page || obj["landing page"] || "",
        clicks: parseInt(obj.clicks) || 0,
        impressions: parseInt(obj.impressions) || 0,
        ctr: parseFloat(String(obj.ctr || "0").replace("%", "")) || 0,
        position: parseFloat(obj.position) || 0,
      };
    }).filter(r => r.query || r.page);
  };

  const handleParse = () => {
    const parsed = parseGSCcsv(csvText);
    setRows(parsed);
    setError(parsed.length ? "" : "Could not parse CSV. Make sure it's a GSC export with Clicks/Impressions columns.");
  };

  const handleFetchAPI = async () => {
    if (!siteUrl) { setError("Site URL required."); return; }
    setFetchLoading(true); setError("");
    try {
      const parsed = await fetchGSCData({
        siteUrl,
        startDate,
        endDate,
        dimensions: ["query", "page"],
        rowLimit: 5000,
      });
      setRows(parsed);
    } catch (e) {
      setError("API error: " + (e as Error).message + ". Make sure your Service Account has Search Console access.");
    } finally { setFetchLoading(false); }
  };

  const handleAnalyze = async () => {
    if (!rows.length) { setError("Load data first."); return; }
    setLoading(true); setAnalysis("");
    try {
      const top100 = rows.slice(0, 100);
      const summary = {
        totalQueries: rows.length,
        totalClicks: rows.reduce((s, r) => s + r.clicks, 0),
        totalImpressions: rows.reduce((s, r) => s + r.impressions, 0),
        avgCTR: (rows.reduce((s, r) => s + r.ctr, 0) / rows.length).toFixed(2),
        avgPosition: (rows.reduce((s, r) => s + r.position, 0) / rows.length).toFixed(1),
        topRows: top100
      };
      const text = await callAI(
        `You are a Silicon Valley SEO director with 15 years experience. Analyze this Google Search Console data with extreme precision.

Provide:
1. EXECUTIVE SUMMARY (3 sentences)
2. TOP 5 CTR OPPORTUNITIES (queries with >200 impressions but <3% CTR — list query, impressions, current CTR, recommended title fix)
3. TOP 5 POSITION WIN TARGETS (positions 4-10 with >50 clicks — list query, position, recommended action)
4. CONTENT GAPS (queries with >500 impressions but 0 clicks)
5. AI OVERVIEW TARGETS (informational queries ideal for AI answer optimization)
6. 30-DAY ACTION PLAN (numbered, specific, prioritized)

Use emojis for section headers. Be specific and data-driven.`,
        `Site data: ${JSON.stringify(summary)}`
      );
      setAnalysis(text);
    } catch (e) {
      setError("Analysis failed: " + (e as Error).message);
    } finally { setLoading(false); }
  };

  const ctrOpps = rows.filter(r => r.impressions > 100 && r.ctr < 3 && r.position < 20)
    .sort((a, b) => b.impressions - a.impressions).slice(0, 8);
  const posWins = rows.filter(r => r.position >= 4 && r.position <= 10)
    .sort((a, b) => b.clicks - a.clicks).slice(0, 8);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["upload", "api"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            background: mode === m ? C.blue : C.card,
            color: mode === m ? "#fff" : C.muted,
            border: `1px solid ${mode === m ? C.blue : C.border}`,
            borderRadius: 8,
            padding: "8px 18px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit"
          }}>
            {m === "upload" ? "📁 Upload CSV Export" : "🔑 API Token"}
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <Section title="Upload GSC Export">
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} ref={fileRef} style={{ display: "none" }} />
            <Btn onClick={() => fileRef.current?.click()} color={C.purple}>📁 Select CSV File</Btn>
            <Btn onClick={handleParse} color={C.blue} disabled={!csvText}>Parse Data</Btn>
          </div>
          <TextArea value={csvText} onChange={setCsvText} placeholder="Or paste GSC CSV data here (Performance export)…" rows={4} />
          <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>
            In GSC → Performance → Export → Download CSV. Supports Queries and Pages exports.
          </div>
        </Section>
      )}

      {mode === "api" && (
        <Section title="GSC API Connection (Service Account)">
          <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>Site URL (exact, e.g. https://example.com/)</div>
              <Input value={siteUrl} onChange={setSiteUrl} placeholder="https://yoursite.com/" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>Start Date</div>
                <Input type="date" value={startDate} onChange={setStartDate} />
              </div>
              <div>
                <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>End Date</div>
                <Input type="date" value={endDate} onChange={setEndDate} />
              </div>
            </div>
            <Btn onClick={handleFetchAPI} loading={fetchLoading} color={C.green}>⬇️ Fetch GSC Data</Btn>
          </div>
          <div style={{ color: C.muted, fontSize: 11 }}>
            Uses Service Account from <span style={{ color: C.blue }}>GSC_SERVICE_ACCOUNT_EMAIL</span> env var. Ensure the service account email has Search Console access.
          </div>
        </Section>
      )}

      {error && <div style={{
        color: C.red,
        background: C.red + "11",
        border: `1px solid ${C.red}33`,
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 16,
        fontSize: 13
      }}>{error}</div>}

      {rows.length > 0 && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 24
          }}>
            <Stat label="Queries" value={rows.length.toLocaleString()} color={C.blue} />
            <Stat label="Total Clicks" value={rows.reduce((s, r) => s + r.clicks, 0).toLocaleString()} color={C.green} />
            <Stat label="Impressions" value={rows.reduce((s, r) => s + r.impressions, 0).toLocaleString()} color={C.purple} />
            <Stat label="Avg CTR" value={(rows.reduce((s, r) => s + r.ctr, 0) / rows.length).toFixed(1) + "%"} color={C.amber} />
            <Stat label="Avg Position" value={(rows.reduce((s, r) => s + r.position, 0) / rows.length).toFixed(1)} color={C.red} />
          </div>

          <Section title="Data loaded - use CSV upload or API to analyze">
            <Btn onClick={handleAnalyze} loading={loading} color={C.green}>🧠 Run Full AI Analysis</Btn>
            <div style={{ marginTop: 16 }}><AnalysisBox result={analysis} loading={loading} /></div>
          </Section>
        </>
      )}
    </div>
  );
}

// ─── CTR Lab ───────────────────────────────────────────────────────────────
function CTRTab() {
  const [keywords, setKeywords] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [targetKw, setTargetKw] = useState("");
  const [intent, setIntent] = useState("informational");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const handleAnalyze = async () => {
    setLoading(true); setResult("");
    try {
      const text = await callAI(
        `You are a conversion rate optimization expert specializing in Google SERP CTR.
Generate title tag and meta description variants that maximize click-through rate.

Rules:
- Title: 50-60 chars, include keyword, use power words
- Meta: 140-155 chars, CTA, benefit-driven
- Give 5 title variants (ranked best to worst with CTR prediction %)
- Give 3 meta description variants
- Explain WHY each choice works
- Include: Power word list, Emotional triggers used, Schema markup recommendation
Use emojis for sections. Be specific and actionable.`,
        `Page/keyword: ${targetKw}
Current title: ${currentTitle || "none provided"}
Search intent: ${intent}
Related queries context: ${keywords || "none"}`,
      );
      setResult(text);
    } catch (e) { setResult("Error: " + (e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ color: C.muted, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Target Keyword</div>
          <Input value={targetKw} onChange={setTargetKw} placeholder="e.g. best project management software 2025" />
        </div>
        <div>
          <div style={{ color: C.muted, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Search Intent</div>
          <select value={intent} onChange={e => setIntent(e.target.value)} style={{
            width: "100%",
            background: C.surface,
            color: C.text,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            fontFamily: "monospace",
            outline: "none"
          }}>
            <option value="informational">Informational</option>
            <option value="commercial">Commercial Investigation</option>
            <option value="transactional">Transactional</option>
            <option value="navigational">Navigational</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: C.muted, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Current Title Tag (if optimizing existing)</div>
        <Input value={currentTitle} onChange={setCurrentTitle} placeholder="Your current page title…" />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: C.muted, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Related Queries / Context</div>
        <TextArea value={keywords} onChange={setKeywords} placeholder="List related queries you want to capture…" rows={3} />
      </div>
      <Btn onClick={handleAnalyze} loading={loading}>🔍 Generate CTR Variants</Btn>
      <div style={{ marginTop: 20 }}><AnalysisBox result={result} loading={loading} /></div>
    </div>
  );
}

// ─── AI Overview & GEO ────────────────────────────────────────────────────
function AITab() {
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true); setResult("");
    try {
      const text = await callAI(
        `You are an SEO AI optimization expert specializing in Google's AI Overviews and GEO (Generative Engine Optimization).
Analyze the content and provide actionable recommendations.

Provide:
1. AI OVERVIEW ELIGIBILITY (rate 1-10, explain why)
2. CONTENT OPTIMIZATION (5 specific changes to rank in AI Overview)
3. STRUCTURED DATA RECOMMENDATIONS (JSON-LD schema to add)
4. ENTITY OPTIMIZATION (entities to mention, relationships to build)
5. E-E-A-T SIGNALS (how to demonstrate Experience, Expertise, Authority, Trust)
6. GEO STRATEGY (how to appear in AI Overviews and Google's other AI features)

Use emojis. Be specific and actionable.`,
        `Target URL: ${url}
Target keyword/context: ${keyword || "auto-detect from page content"}`,
      );
      setResult(text);
    } catch (e) { setResult("Error: " + (e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="AI Overview & GEO Analyzer">
        <div style={{ display: "grid", gap: 12 }}>
          <Input value={url} onChange={setUrl} placeholder="https://example.com/blog/post" />
          <Input value={keyword} onChange={setKeyword} placeholder="Target keyword (optional — auto-detected if blank)" />
          <Btn onClick={handleAnalyze} loading={loading}>🧠 Analyze for AI Overview</Btn>
        </div>
      </Section>
      <div style={{ marginTop: 20 }}><AnalysisBox result={result} loading={loading} /></div>
    </div>
  );
}

// ─── Trend Intelligence ────────────────────────────────────────────────────
function TrendTab() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const handleAnalyze = async () => {
    if (!topic) return;
    setLoading(true); setResult("");
    try {
      const text = await callAI(
        `You are a trend intelligence expert. Analyze this topic and provide SEO-driven trend insights.

Provide:
1. TREND SCORE (1-10, with reasoning)
2. EMERGING QUERIES (10 new related queries gaining traction)
3. CONTENT ANGLES (5 fresh angles competitors aren't covering)
4. SERP FEATURE OPPORTUNITIES (People Also Ask, Featured Snippets, AI Overview)
5. SEASONALITY INSIGHTS (is this trending now? timing recommendations)
6. COMPETITOR GAPS (what are top ranking pages missing?)

Use emojis. Be specific and data-driven.`,
        `Topic: ${topic}`,
      );
      setResult(text);
    } catch (e) { setResult("Error: " + (e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="Trend Intelligence">
        <Input value={topic} onChange={setTopic} placeholder="Enter any topic to analyze trends…" />
        <div style={{ marginTop: 12 }}>
          <Btn onClick={handleAnalyze} loading={loading}>📈 Analyze Trends</Btn>
        </div>
      </Section>
      <div style={{ marginTop: 20 }}><AnalysisBox result={result} loading={loading} /></div>
    </div>
  );
}

// ─── Topic Analyzer ────────────────────────────────────────────────────────
function TopicTab() {
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const handleAnalyze = async () => {
    if (!seed) return;
    setLoading(true); setResult("");
    try {
      const text = await callAI(
        `You are a topic cluster strategist. Build a complete topic cluster from this seed keyword.

Provide:
1. PILLAR CONTENT STRATEGY (main topic, optimal content structure)
2. CLUSTER TOPICS (15 related topics to cover)
3. INTERNAL LINKING STRATEGY (how to interlink for maximum SEO benefit)
4. CONTENT GAP ANALYSIS (what your competitors haven't covered)
5. SEARCH INTENT MAP (how to serve all 3 intent types across the cluster)
6. PRIORITY ROADMAP (which topics to target first based on difficulty/opportunity)

Use emojis. Be specific and actionable.`,
        `Seed keyword/topic: ${seed}`,
      );
      setResult(text);
    } catch (e) { setResult("Error: " + (e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="Topic Cluster Analyzer">
        <Input value={seed} onChange={setSeed} placeholder="Enter a seed keyword or topic…" />
        <div style={{ marginTop: 12 }}>
          <Btn onClick={handleAnalyze} loading={loading}>🔬 Generate Topic Cluster</Btn>
        </div>
      </Section>
      <div style={{ marginTop: 20 }}><AnalysisBox result={result} loading={loading} /></div>
    </div>
  );
}

// ─── Core Web Vitals ───────────────────────────────────────────────────────
function VitalsTab() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true); setResult("");
    try {
      const text = await callAI(
        `You are a Core Web Vitals expert. Optimize this page for LCP, FID, and CLS.

Provide:
1. LCP OPTIMIZATION (Largest Contentful Paint — 5 specific fixes)
2. FID/INP OPTIMIZATION (First Input Delay / Interaction to Next Paint — 5 fixes)
3. CLS OPTIMIZATION (Cumulative Layout Shift — 5 fixes)
4. TECHNICAL CHECKLIST (image optimization, lazy loading, font loading)
5. PERFORMANCE BUDGET (recommended sizes for images, JS, CSS)
6. PRIORITY ACTIONS (top 3 things to fix immediately)

Use emojis. Be specific and technical.`,
        `Page URL: ${url}`,
      );
      setResult(text);
    } catch (e) { setResult("Error: " + (e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="Core Web Vitals Analyzer">
        <Input value={url} onChange={setUrl} placeholder="https://example.com/page-to-audit" />
        <div style={{ marginTop: 12 }}>
          <Btn onClick={handleAnalyze} loading={loading}>⚡ Analyze Web Vitals</Btn>
        </div>
      </Section>
      <div style={{ marginTop: 20 }}><AnalysisBox result={result} loading={loading} /></div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────
export default function SEOMaster() {
  const [activeTab, setActiveTab] = useState("gsc");

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>
            🔍 SEOMaster
          </h1>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
            AI-Powered SEO Analytics · Powered by MiniMax M2.7 · Hermes Agent
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge color={C.green}>🟢 YOLO Mode</Badge>
          <Badge color={C.blue}>MiniMax M2.7</Badge>
        </div>
      </header>

      {/* Tab Bar */}
      <div style={{
        display: "flex",
        gap: 4,
        padding: "12px 24px",
        borderBottom: `1px solid ${C.border}`,
        overflowX: "auto",
        background: C.surface
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? C.card : "transparent",
              color: activeTab === tab.id ? C.text : C.muted,
              border: `1px solid ${activeTab === tab.id ? C.border : "transparent"}`,
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        {activeTab === "gsc" && <GSCTab />}
        {activeTab === "ctr" && <CTRTab />}
        {activeTab === "ai" && <AITab />}
        {activeTab === "trend" && <TrendTab />}
        {activeTab === "topic" && <TopicTab />}
        {activeTab === "vitals" && <VitalsTab />}
      </main>
    </div>
  );
}