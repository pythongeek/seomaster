"use client";

import { useState } from "react";
import { Modal, Badge, Button } from "@/components/ui";

interface QuickWinDetailModalProps {
  open: boolean;
  onClose: () => void;
  quickWin: {
    query: string;
    page: string;
    position: number;
    clicks: number;
    impressions: number;
    currentCTR: number;
    benchmarkCTR: number;
    estimatedTrafficGain: number;
    effort: "low" | "medium" | "high";
    action: string;
    intent: string;
  } | null;
}

interface ContentPlan {
  stepNumber: number;
  title: string;
  description: string;
  actionType: "title_tag" | "meta_description" | "schema" | "content" | "internal_links" | "heading";
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: string;
  expectedLift: string;
  codeExample?: string;
  beforeAfter?: { before: string; after: string };
}

export function QuickWinDetailModal({ open, onClose, quickWin }: QuickWinDetailModalProps) {
  const [aiPlan, setAiPlan] = useState<ContentPlan[] | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [aiError, setAiError] = useState("");

  if (!quickWin) return null;

  const gap = quickWin.benchmarkCTR - quickWin.currentCTR;
  const gapPercent = gap.toFixed(2);
  const totalMonthlyGain = quickWin.estimatedTrafficGain;
  const intentLabel = quickWin.intent.charAt(0).toUpperCase() + quickWin.intent.slice(1);

  const generateAiPlan = async () => {
    setLoadingAi(true);
    setAiError("");
    setAiPlan(null);
    try {
      const resp = await fetch("/api/ai-content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "quick_win",
          data: {
            query: quickWin.query,
            page: quickWin.page,
            position: quickWin.position,
            currentCTR: quickWin.currentCTR,
            benchmarkCTR: quickWin.benchmarkCTR,
            impressions: quickWin.impressions,
            intent: quickWin.intent,
            action: quickWin.action,
          },
        }),
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

  const effortColors = { low: "green", medium: "amber", high: "red" };
  const effortBg = { low: "bg-green/10 border-green/25", medium: "bg-amber/10 border-amber/25", high: "bg-red/10 border-red/25" };

  const stepTypeIcons: Record<string, string> = {
    title_tag: " 🏷️",
    meta_description: "📝",
    schema: "🏗️",
    content: "📄",
    internal_links: "🔗",
    heading: "📌",
  };

  return (
    <Modal open={open} onClose={onClose} title={`⚡ Quick Win: "${quickWin.query}"`} maxWidth="max-w-3xl">
      {/* Opportunity Summary */}
      <div className={`rounded-xl border p-4 mb-4 ${effortBg[quickWin.effort]}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-600 mb-1">🎯 Opportunity Summary</div>
            <div className="text-text text-base font-semibold mb-2">
              Your page ranks at <span className="text-amber font-bold">position {quickWin.position}</span> but only gets{" "}
              <span className="text-red font-bold">{quickWin.currentCTR}%</span> CTR.
              For this position and query type, you should be getting{" "}
              <span className="text-green font-bold">{quickWin.benchmarkCTR}%</span> CTR.
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span>Impressions: <strong className="text-text">{quickWin.impressions.toLocaleString()}/mo</strong></span>
              <span>Current clicks: <strong className="text-text">{quickWin.clicks}/mo</strong></span>
              <span>Est. gain: <strong className="text-green">+{totalMonthlyGain} clicks/mo</strong></span>
            </div>
          </div>
          <Badge variant={effortColors[quickWin.effort] as "green" | "amber" | "red"}>
            {quickWin.effort} effort
          </Badge>
        </div>
      </div>

      {/* The Gap Visual */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-600 mb-3">📊 CTR Gap Analysis</div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-slate-600 text-xs w-20">Current CTR</span>
          <div className="flex-1 bg-red/20 rounded-full h-4 relative overflow-hidden">
            <div
              className="bg-red h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
              style={{ width: `${Math.min((quickWin.currentCTR / quickWin.benchmarkCTR) * 100, 100)}%` }}
            >
              <span className="text-[10px] font-bold text-white">{quickWin.currentCTR}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-slate-600 text-xs w-20">Benchmark</span>
          <div className="flex-1 bg-green/20 rounded-full h-4 relative overflow-hidden">
            <div
              className="bg-green h-full rounded-full flex items-center justify-end pr-2"
              style={{ width: "100%" }}
            >
              <span className="text-[10px] font-bold text-white">{quickWin.benchmarkCTR}%</span>
            </div>
          </div>
        </div>
        <div className="text-center">
          <span className="text-red text-base font-bold">Gap: -{gapPercent}%</span>
          <span className="text-slate-600 text-xs ml-3">
            Closing this gap = <strong className="text-green">+{totalMonthlyGain} clicks/month</strong>
          </span>
        </div>
      </div>

      {/* Why This Matters */}
      <div className="bg-blue/5 border border-blue/20 rounded-xl p-4 mb-4">
        <div className="text-[11px] uppercase tracking-wider text-blue mb-2">💡 Why This Happens</div>
        <div className="text-text text-[13px] leading-relaxed">
          {quickWin.intent === "informational" ? (
            <>
              <strong>"{quickWin.query}"</strong> is an informational query — searchers want a quick answer. When they see your result, 
              your title probably doesn't promise the specific answer they're looking for. A better title + FAQ schema can dramatically 
              lift CTR without changing your ranking position. Position {quickWin.position} queries like this typically see 
              <strong> 40-80% CTR lift</strong> from title optimization alone.
            </>
          ) : quickWin.intent === "transactional" ? (
            <>
              <strong>"{quickWin.query}"</strong> is a transactional query — searchers are ready to take action. 
              Your title likely doesn't communicate urgency or value. Adding power words like "Best", "Top", 
              or "Deal" + a clear meta description can boost CTR by <strong>30-60%</strong>.
            </>
          ) : (
            <>
              <strong>"{quickWin.query}"</strong> has a CTR gap because your title and meta don't match what 
              searchers expect to find at position {quickWin.position}. This is a <strong>zero-cost, high-impact</strong> fix — 
              you don't need new content, just better messaging.
            </>
          )}
        </div>
      </div>

      {/* AI Content Plan */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-600">🧠 AI-Generated Implementation Plan</div>
          {!aiPlan && (
            <Button
              size="sm"
              variant="outline"
              onClick={generateAiPlan}
              loading={loadingAi}
            >
              {loadingAi ? "Researching..." : "✨ Generate Plan"}
            </Button>
          )}
        </div>

        {aiError && (
          <div className="bg-red/5 border border-red/25 rounded-lg p-3 text-red text-xs mb-3">{aiError}</div>
        )}

        {aiPlan && (
          <div className="space-y-3">
            {/* Step pills */}
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

            {/* Active step detail */}
            {aiPlan[activeStep] && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue font-bold text-base">{aiPlan[activeStep].stepNumber}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text font-bold text-base">
                        {stepTypeIcons[aiPlan[activeStep].actionType] || "📋"} {aiPlan[activeStep].title}
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

                {aiPlan[activeStep].codeExample && (
                  <div className="bg-surface rounded-lg p-3 mt-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">💻 Code Example</div>
                    <pre className="text-[11px] text-green font-mono whitespace-pre-wrap overflow-x-auto">
                      {aiPlan[activeStep].codeExample}
                    </pre>
                  </div>
                )}

                {aiPlan[activeStep].beforeAfter && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-red/5 border border-red/20 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wider text-red mb-1">❌ Before</div>
                      <div className="text-text text-xs">{aiPlan[activeStep].beforeAfter?.before}</div>
                    </div>
                    <div className="bg-green/5 border border-green/20 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wider text-green mb-1">✅ After</div>
                      <div className="text-text text-xs">{aiPlan[activeStep].beforeAfter?.after}</div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                    disabled={activeStep === 0}
                  >
                    ← Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveStep(Math.min(aiPlan.length - 1, activeStep + 1))}
                    disabled={activeStep === aiPlan.length - 1}
                  >
                    Next Step →
                  </Button>
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface rounded-full h-1.5">
                <div
                  className="bg-blue h-full rounded-full transition-all duration-300"
                  style={{ width: `${((activeStep + 1) / aiPlan.length) * 100}%` }}
                />
              </div>
              <span className="text-slate-600 text-[10px]">{activeStep + 1}/{aiPlan.length} steps</span>
            </div>
          </div>
        )}

        {!aiPlan && !loadingAi && (
          <div className="bg-surface border border-border border-dashed rounded-xl p-6 text-center">
            <div className="text-2xl mb-2">🧠</div>
            <div className="text-slate-600 text-xs">Click "Generate Plan" to get an AI-customized step-by-step implementation guide for this specific keyword and page.</div>
          </div>
        )}
      </div>

      {/* Raw Data */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-600 mb-2">📋 Raw Data</div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex justify-between"><span className="text-slate-600">Query:</span><span className="text-text font-mono truncate max-w-[200px]">{quickWin.query}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Intent:</span><span className="text-text">{intentLabel}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Page:</span><span className="text-text font-mono truncate max-w-[200px]">{quickWin.page.replace(/^https?:\/\/[^/]+/, "")}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Position:</span><span className="text-text">{quickWin.position}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Impressions:</span><span className="text-text">{quickWin.impressions.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Current CTR:</span><span className="text-red">{quickWin.currentCTR}%</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Benchmark CTR:</span><span className="text-green">{quickWin.benchmarkCTR}%</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Est. gain:</span><span className="text-green">+{totalMonthlyGain}</span></div>
        </div>
      </div>
    </Modal>
  );
}
