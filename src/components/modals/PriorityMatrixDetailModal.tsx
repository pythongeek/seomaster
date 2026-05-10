"use client";

import { useState } from "react";
import { Modal, Badge, Button } from "@/components/ui";
import { useStore } from "@/store";

interface PriorityItem {
  query: string;
  page: string;
  opportunityScore: number;
  commercialValue: number;
  effort: "low" | "medium" | "high";
  impact: "critical" | "high" | "medium" | "low";
  category: "ctr" | "content_gap" | "cannibalization" | "position" | "serp";
  recommendedAction: string;
  timeToValue: string;
}

interface PriorityMatrixDetailModalProps {
  open: boolean;
  onClose: () => void;
  item: PriorityItem | null;
}

interface ActionStep {
  stepNumber: number;
  title: string;
  description: string;
  actionType: "title_tag" | "meta_description" | "content" | "schema" | "redirect" | "internal_links" | "backlinks" | "technical";
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: string;
  expectedLift: string;
  codeExample?: string;
  checklist?: string[];
}

export function PriorityMatrixDetailModal({ open, onClose, item }: PriorityMatrixDetailModalProps) {
  const [aiPlan, setAiPlan] = useState<ActionStep[] | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [aiError, setAiError] = useState("");

  if (!item) return null;

  const categoryLabels: Record<string, string> = {
    ctr: "CTR Improvement",
    content_gap: "Content Gap",
    cannibalization: "Cannibalization Fix",
    position: "Position Push",
    serp: "SERP Competition",
  };

  const categoryColors: Record<string, string> = {
    ctr: "blue",
    content_gap: "amber",
    cannibalization: "red",
    position: "purple",
    serp: "cyan",
  };

  const categoryDescriptions: Record<string, string> = {
    ctr: "Your title or meta description doesn't match what searchers expect. This is the fastest win — no content changes needed, just better messaging.",
    content_gap: "You rank but get zero clicks. Either your page doesn't match the query intent, or SERP features are stealing your clicks. Fixing this requires content or schema changes.",
    cannibalization: "Multiple pages on your site compete for the same keyword. Each page gets a fraction of the ranking power. Consolidate them to concentrate authority.",
    position: "You're close to a ranking tier jump (position 3→1, 5→3, 10→7). Moving up 1-3 positions dramatically increases clicks. Requires content depth + backlinks.",
    serp: "Google is showing special features (featured snippets, People Also Ask, video carousels) that steal clicks from your organic listing. You need to win those features.",
  };

  const impactColors: Record<string, string> = {
    critical: "red",
    high: "amber",
    medium: "blue",
    low: "muted",
  };

  const generateAiPlan = async () => {
    setLoadingAi(true);
    setAiError("");
    setAiPlan(null);
    try {
      const aiEngine = useStore.getState().aiEngine;
      const resp = await fetch("/api/ai-content-plan", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-ai-engine": aiEngine
        },
        body: JSON.stringify({ type: "priority_matrix", data: item }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Failed to generate plan");
      setAiPlan(json.result.steps);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setLoadingAi(false);
    }
  };

  const stepIcons: Record<string, string> = {
    title_tag: " 🏷️",
    meta_description: "📝",
    content: "📄",
    schema: "🏗️",
    redirect: "🔀",
    internal_links: "🔗",
    backlinks: "⬆️",
    technical: "⚙️",
  };

  return (
    <Modal open={open} onClose={onClose} title={`📐 Priority: "${item.query}"`} maxWidth="max-w-3xl">
      <div className={`rounded-xl border p-4 mb-4 bg-${categoryColors[item.category]}/5 border-${categoryColors[item.category]}/25`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-600 mb-1">Priority Category</div>
            <Badge variant={categoryColors[item.category] as "blue" | "amber" | "red" | "purple" | "cyan"}>
              {categoryLabels[item.category]}
            </Badge>
            <div className="text-text text-sm font-semibold mt-2 leading-relaxed">
              {categoryDescriptions[item.category]}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1">Opportunity</div>
          <div className="text-xl font-extrabold text-blue font-mono">{item.opportunityScore}</div>
          <div className="text-[10px] text-slate-600">score</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1">Commercial</div>
          <div className="text-xl font-extrabold text-green font-mono">{item.commercialValue}</div>
          <div className="text-[10px] text-slate-600">value</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1">Time</div>
          <div className="text-xl font-extrabold text-amber font-mono">{item.timeToValue}</div>
          <div className="text-[10px] text-slate-600">to value</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1">Effort</div>
          <div className={`text-xl font-extrabold font-mono ${item.effort === "low" ? "text-green" : item.effort === "medium" ? "text-amber" : "text-red"}`}>{item.effort}</div>
          <div className="text-[10px] text-slate-600">complexity</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-600">Recommended Action:</span>
          <Badge variant={impactColors[item.impact] as "red" | "amber" | "blue" | "muted"}>
            {item.impact} impact
          </Badge>
        </div>
        <div className="text-text text-[13px] leading-relaxed">{item.recommendedAction}</div>
      </div>

      <div className="bg-blue/5 border border-blue/20 rounded-xl p-4 mb-4">
        <div className="text-[11px] uppercase tracking-wider text-blue mb-2">💡 Why This Is Prioritized</div>
        <div className="text-text text-[13px] leading-relaxed">
          {item.category === "cannibalization" && (
            <>Multiple pages competing for the same keyword creates internal competition. Your ranking authority is split between multiple pages instead of being concentrated on one. Fixing this typically gives an immediate 15-30% lift to the winning page's position.</>
          )}
          {item.category === "ctr" && (
            <>CTR at {item.opportunityScore < 30 ? "below average" : item.opportunityScore < 60 ? "average" : "good"} levels suggests title or meta mismatch. With commercial value of {item.commercialValue}/100, this query has high revenue potential. Title optimization alone can lift CTR by 20-50% within days.</>
          )}
          {item.category === "content_gap" && (
            <>Zero clicks despite ranking means your content doesn't match the searcher's intent. You're showing up but getting skipped. This is a content-relevance problem — either rewrite the page or create a new piece targeting the specific intent.</>
          )}
          {item.category === "position" && (
            <>You're close to a ranking tier jump. Moving up a few positions can dramatically increase your clicks from this query. This requires content depth improvements and potentially backlinks to strengthen the page's authority.</>
          )}
          {item.category === "serp" && (
            <>SERP features are stealing clicks from your organic listing. You need to either win the featured snippet/PAAs or create supplementary content (video, images) to appear in those feature slots alongside your organic result.</>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-600">🧠 AI Step-by-Step Action Plan</div>
          {!aiPlan && (
            <Button size="sm" variant="outline" onClick={generateAiPlan} loading={loadingAi}>
              {loadingAi ? "Researching..." : "✨ Generate Plan"}
            </Button>
          )}
        </div>

        {aiError && (
          <div className="bg-red/5 border border-red/25 rounded-lg p-3 text-red text-xs mb-3">{aiError}</div>
        )}

        {aiPlan && (
          <div className="space-y-3">
            <div className="flex gap-1.5 flex-wrap mb-3">
              {aiPlan.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                    activeStep === i
                      ? "bg-blue text-white"
                      : "bg-surface text-slate-600 border border-border hover:border-blue/50"
                  }`}
                >
                  {step.stepNumber}. {step.title}
                </button>
              ))}
            </div>

            {aiPlan[activeStep] && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue font-bold text-sm">{aiPlan[activeStep].stepNumber}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text font-bold text-sm">
                        {stepIcons[aiPlan[activeStep].actionType] || "📋"} {aiPlan[activeStep].title}
                      </span>
                      <Badge variant={aiPlan[activeStep].difficulty === "easy" ? "green" : aiPlan[activeStep].difficulty === "medium" ? "amber" : "red"}>
                        {aiPlan[activeStep].difficulty}
                      </Badge>
                    </div>
                    <div className="text-slate-600 text-[11px] mb-2">
                      ⏱️ {aiPlan[activeStep].estimatedTime} · Expected lift: <strong className="text-green">{aiPlan[activeStep].expectedLift}</strong>
                    </div>
                    <div className="text-text text-[13px] leading-relaxed">{aiPlan[activeStep].description}</div>
                  </div>
                </div>

                {aiPlan[activeStep].checklist && aiPlan[activeStep].checklist.length > 0 && (
                  <div className="bg-surface rounded-lg p-3 mt-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">✅ Checklist</div>
                    {aiPlan[activeStep].checklist!.map((checkItem, i) => (
                      <div key={i} className="text-text text-[12px] mb-1 flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5 accent-blue flex-shrink-0" /> {checkItem}
                      </div>
                    ))}
                  </div>
                )}

                {aiPlan[activeStep].codeExample && (
                  <div className="bg-surface rounded-lg p-3 mt-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">💻 Code Example</div>
                    <pre className="text-[11px] text-green font-mono whitespace-pre-wrap overflow-x-auto">
                      {aiPlan[activeStep].codeExample}
                    </pre>
                  </div>
                )}

                <div className="flex justify-between mt-4">
                  <Button size="sm" variant="outline" onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0}>
                    ← Previous
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveStep(Math.min(aiPlan.length - 1, activeStep + 1))} disabled={activeStep === aiPlan.length - 1}>
                    Next Step →
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface rounded-full h-1.5">
                <div className="bg-blue h-full rounded-full transition-all" style={{ width: `${((activeStep + 1) / aiPlan.length) * 100}%` }} />
              </div>
              <span className="text-slate-600 text-[10px]">{activeStep + 1}/{aiPlan.length} steps</span>
            </div>
          </div>
        )}

        {!aiPlan && !loadingAi && (
          <div className="bg-surface border border-border border-dashed rounded-xl p-6 text-center">
            <div className="text-2xl mb-2">🧠</div>
            <div className="text-slate-600 text-xs">Click "Generate Plan" to get a detailed, AI-generated step-by-step implementation guide for this priority item.</div>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-600 mb-2">📋 Raw Data</div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex justify-between"><span className="text-slate-600">Query:</span><span className="text-text font-mono truncate max-w-[200px]">{item.query}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Category:</span><span className="text-text">{categoryLabels[item.category]}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Page:</span><span className="text-text font-mono truncate max-w-[200px]">{item.page.replace(/^https?:\/\/[^/]+/, "")}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Opportunity:</span><span className="text-text">{item.opportunityScore}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Commercial:</span><span className="text-text">{item.commercialValue}/100</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Impact:</span><span className={`font-bold ${impactColors[item.impact] === "red" ? "text-red" : impactColors[item.impact] === "amber" ? "text-amber" : "text-blue"}`}>{item.impact}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Effort:</span><span className={`font-bold ${item.effort === "low" ? "text-green" : item.effort === "medium" ? "text-amber" : "text-red"}`}>{item.effort}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Time:</span><span className="text-text">{item.timeToValue}</span></div>
        </div>
      </div>
    </Modal>
  );
}
