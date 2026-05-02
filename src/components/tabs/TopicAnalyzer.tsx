"use client";

import { useState } from "react";
import { Badge, Button, Section, Input, LoadingSpinner } from "@/components/ui";
import type { TopicResult } from "@/types";

export function TopicAnalyzer() {
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
        <div className="mt-3">
          <Button onClick={handleAnalyze} loading={loading}>🧠 Generate Cluster</Button>
        </div>
      </Section>

      {loading && <LoadingSpinner />}

      {result && !loading && (
        <div className="mt-6 animate-fade-in">
          {structure?.length ? (
            <Section title="📐 Cluster Structure" accent="blue">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {structure.map((cluster, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex justify-between mb-2.5">
                      <Badge variant={i === 0 ? "green" : i === 1 ? "blue" : "muted"}>{cluster.name}</Badge>
                      <span className="text-muted text-[11px]">×{cluster.keywords?.length || 0} pages</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {cluster.keywords?.map((kw, j) => (
                        <span key={j} className="text-text text-xs px-2 py-1 bg-surface rounded">{kw}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {links?.length ? (
            <Section title="🔗 Internal Link Strategy" accent="green">
              <div className="bg-card border border-border rounded-xl p-4 grid gap-2">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 bg-surface rounded-md text-xs">
                    <span className="text-muted">{link.from}</span>
                    <span className="text-blue">→</span>
                    <span className="text-text font-semibold">{link.to}</span>
                    <Badge variant="green">{link.strength}</Badge>
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
