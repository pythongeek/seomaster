"use client";

import { useState } from "react";
import { Badge, Button, Section, Input, TextArea, StatCard, LoadingSpinner } from "@/components/ui";
import type { CTRResult } from "@/types";

export function CtrLab() {
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
        <div className="grid gap-3">
          <Input value={keyword} onChange={setKeyword} placeholder="Target keyword (e.g. best project management software 2025)" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-muted text-[11px] mb-1">Search Intent</div>
              <select value={intent} onChange={e => setIntent(e.target.value)} className="w-full bg-surface text-text border border-border rounded-lg px-3.5 py-2.5 text-[13px] font-mono outline-none focus:border-blue/50">
                {["informational", "commercial", "transactional", "navigational"].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <Input value={currentTitle} onChange={setCurrentTitle} placeholder="Current title (optional)" />
          </div>
          <TextArea value={context} onChange={setContext} placeholder="Related keywords or context for better variants…" rows={2} />
          <Button onClick={handleAnalyze} loading={loading}>🔍 Generate CTR Variants</Button>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {result && !loading && (
        <div className="mt-6 animate-fade-in">
          {titles?.length ? (
            <Section title="📝 Title Tag Variants (ranked by predicted CTR)" accent="green">
              <div className="grid gap-2.5">
                {titles.map((t, i) => (
                  <div key={i} className={`bg-card border rounded-lg p-3 ${i === 0 ? "border-green/40" : "border-border"}`}>
                    <div className="flex justify-between mb-1.5 flex-wrap gap-2">
                      <span className="text-text text-sm font-semibold">{t.title}</span>
                      <Badge variant="green">{t.predictedCTR} CTR</Badge>
                    </div>
                    {i === 0 && <div className="text-green text-[11px]">★ Recommended</div>}
                    {t.reasoning && <div className="text-muted text-[11px] mt-1">{t.reasoning}</div>}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {metas?.length ? (
            <Section title="📄 Meta Description Variants" accent="blue">
              <div className="grid gap-2.5">
                {metas.map((m, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-3">
                    <div className="text-text text-[13px] mb-1.5 leading-relaxed">{m.text as string}</div>
                    <div className="flex justify-between text-muted text-[11px]">
                      <span>Characters: {m.charCount}</span>
                      <Badge variant="blue">{m.predictedCTR} CTR</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {schema && (
            <Section title="🏷️ Schema Markup Recommendation" accent="purple">
              <div className="bg-card border border-purple/25 rounded-xl p-4">
                <Badge variant="purple">{schema}</Badge>
                <div className="text-muted text-xs mt-2">Add these schemas to your page&apos;s JSON-LD structured data to improve SERP appearance and AI Overview eligibility.</div>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
