"use client";

import { useState } from "react";
import { Badge, Button, Section, Input, TextArea, LoadingSpinner } from "@/components/ui";
import type { KeywordResult } from "@/types";

export function KeywordResearch() {
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
        <div className="grid gap-3">
          <Input value={topic} onChange={setTopic} placeholder="Topic (e.g. CRM software)" />
          <TextArea value={keywords} onChange={setKeywords} placeholder={"Seed keywords (one per line, e.g.\nCRM software\nbest CRM\nCRM for small business)"} rows={5} />
          <Button onClick={handleAnalyze} loading={loading}>🔍 Analyze Keywords</Button>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {result && !loading && (
        <div className="mt-6 animate-fade-in">
          {groups?.length ? (
            <Section title="📊 Keyword Groups by Topic" accent="blue">
              <div className="grid gap-3">
                {groups.map((g, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex justify-between mb-2 flex-wrap gap-2">
                      <span className="text-text font-bold text-sm">{g.keyword}</span>
                      <div className="flex gap-2">
                        <Badge variant="green">{g.volume?.toLocaleString()}/mo</Badge>
                        <Badge variant="amber">${g.cpc} CPC</Badge>
                        <Badge variant={g.opportunity === "High" ? "green" : "muted"}>{g.opportunity}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {g.modifiers?.map((m, j) => (
                        <span key={j} className="bg-surface text-muted rounded px-2 py-0.5 text-[11px]">{m.keyword} ({m.volume?.toLocaleString()})</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {questions?.length ? (
            <Section title="❓ Question Keywords (High AI Overview Potential)" accent="purple">
              <div className="grid gap-2">
                {questions.map((q, i) => (
                  <div key={i} className="bg-card border border-purple/25 rounded-lg px-3.5 py-2.5 flex justify-between items-center">
                    <span className="text-text text-[13px]">{q.keyword}</span>
                    <div className="flex gap-2 items-center">
                      <span className="text-muted text-[11px]">{q.volume?.toLocaleString()}/mo</span>
                      <Badge variant="purple">{q.bestFormat}</Badge>
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
