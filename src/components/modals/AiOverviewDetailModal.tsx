"use client";

import { useState } from "react";
import { Modal, Badge, Button } from "@/components/ui";

interface AiOverviewDetailModalProps {
  open: boolean;
  onClose: () => void;
  candidate: {
    query: string;
    page: string;
    position: number;
    impressions: number;
    ctr: number;
    intent: string;
    eligibility: "high" | "medium" | "low";
    eligibilityScore: number;
    optimizationFocus: string;
    eeatSignals: string[];
    contentFormat: string;
  } | null;
}

interface AioPlan {
  stepNumber: number;
  title: string;
  description: string;
  actionType: "content_restructuring" | "eeat_signals" | "schema" | "heading_structure" | "faq_section" | "intro_optimization";
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: string;
  expectedLift: string;
  requirements?: string[];
  codeExample?: string;
  checklist?: string[];
}

export function AiOverviewDetailModal({ open, onClose, candidate }: AiOverviewDetailModalProps) {
  const [aiPlan, setAiPlan] = useState<AioPlan[] | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [aiError, setAiError] = useState("");

  if (!candidate) return null;

  const eligibilityColors = { high: "green", medium: "amber", low: "muted" };
  const eligibilityBg = { high: "bg-green/10 border-green/25", medium: "bg-amber/10 border-amber/25", low: "bg-surface border-border" };
  const formatIcons: Record<string, string> = {
    "How-to guide": "📖",
    Definitional: "📚",
    Explanation: "💡",
    Listicle: "📋",
    Comparison: "⚖️",
    Troubleshooting: "🔧",
    Informational: "📝",
  };

  const generateAiPlan = async () => {
    setLoadingAi(true);
    setAiError("");
    setAiPlan(null);
    try {
      const resp = await fetch("/api/ai-content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ai_overview",
          data: {
            query: candidate.query,
            page: candidate.page,
            position: candidate.position,
            impressions: candidate.impressions,
            intent: candidate.intent,
            eligibilityScore: candidate.eligibilityScore,
            optimizationFocus: candidate.optimizationFocus,
            eeatSignals: candidate.eeatSignals,
            contentFormat: candidate.contentFormat,
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

  const stepIcons: Record<string, string> = {
    content_restructuring: "📝",
    eeat_signals: "🏆",
    schema: "🏗️",
    heading_structure: "📌",
    faq_section: "❓",
    intro_optimization: "🎯",
  };

  return (
    <Modal open={open} onClose={onClose} title={`🤖 AI Overview: "${candidate.query}"`} maxWidth="max-w-3xl">
      {/* Eligibility Status */}
      <div className={`rounded-xl border p-4 mb-4 ${eligibilityBg[candidate.eligibility]}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-600 mb-1">🎯 AI Overview Eligibility</div>
            <div className="text-text text-sm font-semibold mb-2">
              {candidate.eligibility === "high" ? (
                <>
                  This query is <strong className="text-green">highly eligible</strong> for AI Overview display. 
                  With position {candidate.position}, you're close to the sweet spot. 
                  <strong> AI Overview appears in ~40% of informational searches</strong> — capturing this slot could drive massive visibility.
                </>
              ) : candidate.eligibility === "medium" ? (
                <>
                  This query has <strong className="text-amber">medium eligibility</strong>. 
                  You need to strengthen E-E-A-T signals and push to position {Math.max(1, candidate.position - 2)} or better. 
                  {candidate.impressions > 200 && <> With {candidate.impressions.toLocaleString()} impressions, the potential reach is significant.</>}
                </>
              ) : (
                <>
                  This query has <strong className="text-slate-600">low eligibility</strong> for AI Overview right now. 
                  Focus on ranking improvements and E-E-A-T signals before optimizing specifically for AI Overview.
                </>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs mt-2">
              <span>Score: <strong className="text-text">{candidate.eligibilityScore}/10</strong></span>
              <span>Impressions: <strong className="text-text">{candidate.impressions.toLocaleString()}/mo</strong></span>
              <span>Position: <strong className="text-text">{candidate.position}</strong></span>
            </div>
          </div>
          <Badge variant={eligibilityColors[candidate.eligibility] as "green" | "amber" | "muted"}>
            {candidate.eligibility} eligibility
          </Badge>
        </div>
      </div>

      {/* Content Format Card */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{formatIcons[candidate.contentFormat] || "📝"}</span>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-600">Content Format Detected</div>
            <div className="text-text font-bold">{candidate.contentFormat}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[11px] uppercase tracking-wider text-slate-600">Intent</div>
            <div className="text-text font-bold capitalize">{candidate.intent}</div>
          </div>
        </div>
        <div className="bg-surface rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-600 mb-1">AI's Assessment</div>
          <div className="text-text text-[13px]">{candidate.optimizationFocus}</div>
        </div>
      </div>

      {/* E-E-A-T Signals */}
      {candidate.eeatSignals.length > 0 && (
        <div className="bg-purple/5 border border-purple/20 rounded-xl p-4 mb-4">
          <div className="text-[11px] uppercase tracking-wider text-purple mb-2">🏆 E-E-A-T Signals Present</div>
          <div className="grid gap-1.5">
            {candidate.eeatSignals.map((signal, i) => (
              <div key={i} className="flex items-center gap-2 text-text text-[12px]">
                <span className="text-green">✓</span> {signal}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What is AI Overview */}
      <div className="bg-blue/5 border border-blue/20 rounded-xl p-4 mb-4">
        <div className="text-[11px] uppercase tracking-wider text-blue mb-2">🤖 What is AI Overview?</div>
        <div className="text-text text-[13px] leading-relaxed">
          AI Overview (formerly SGE) is Google's AI-generated answer box that appears at the top of search results. 
          When your content qualifies, it can be featured prominently — giving you visibility even above position 1.
          For <strong>"{candidate.query}"</strong>, appearing in AI Overview means your content is cited as a trusted source.
          <span className="block mt-2 text-blue text-[12px]">
            📌 To qualify: Position {candidate.position} → Position {Math.max(1, candidate.position - 2)} (or better) + strong E-E-A-T signals.
          </span>
        </div>
      </div>

      {/* AI Content Plan */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-600">🧠 AI Content Optimization Plan</div>
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
            <div className="flex gap-1.5 flex-wrap mb-3">
              {aiPlan.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                    activeStep === i
                      ? "bg-purple text-white"
                      : "bg-surface text-slate-600 border border-border hover:border-purple/50"
                  }`}
                >
                  {step.stepNumber}. {step.title}
                </button>
              ))}
            </div>

            {aiPlan[activeStep] && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-purple/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple font-bold text-sm">{aiPlan[activeStep].stepNumber}</span>
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
                      ⏱️ {aiPlan[activeStep].estimatedTime} · Expected impact: <strong className="text-green">{aiPlan[activeStep].expectedLift}</strong>
                    </div>
                    <div className="text-text text-[13px] leading-relaxed">{aiPlan[activeStep].description}</div>
                  </div>
                </div>

                {aiPlan[activeStep].requirements && aiPlan[activeStep].requirements.length > 0 && (
                  <div className="bg-surface rounded-lg p-3 mt-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">📋 Requirements</div>
                    {aiPlan[activeStep].requirements!.map((req, i) => (
                      <div key={i} className="text-text text-[12px] mb-1">• {req}</div>
                    ))}
                  </div>
                )}

                {aiPlan[activeStep].checklist && aiPlan[activeStep].checklist.length > 0 && (
                  <div className="bg-surface rounded-lg p-3 mt-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">✅ Checklist</div>
                    {aiPlan[activeStep].checklist!.map((item, i) => (
                      <div key={i} className="text-text text-[12px] mb-1 flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5 accent-purple" /> {item}
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
                <div className="bg-purple h-full rounded-full transition-all" style={{ width: `${((activeStep + 1) / aiPlan.length) * 100}%` }} />
              </div>
              <span className="text-slate-600 text-[10px]">{activeStep + 1}/{aiPlan.length} steps</span>
            </div>
          </div>
        )}

        {!aiPlan && !loadingAi && (
          <div className="bg-surface border border-border border-dashed rounded-xl p-6 text-center">
            <div className="text-2xl mb-2">🧠</div>
            <div className="text-slate-600 text-xs">Click "Generate Plan" to get a personalized content restructuring plan for AI Overview eligibility.</div>
          </div>
        )}
      </div>

      {/* Raw Data */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-600 mb-2">📋 Raw Data</div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex justify-between"><span className="text-slate-600">Query:</span><span className="text-text font-mono truncate max-w-[200px]">{candidate.query}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Format:</span><span className="text-text">{candidate.contentFormat}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Page:</span><span className="text-text font-mono truncate max-w-[200px]">{candidate.page.replace(/^https?:\/\/[^/]+/, "")}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Position:</span><span className="text-text">{candidate.position}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Impressions:</span><span className="text-text">{candidate.impressions.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">CTR:</span><span className="text-text">{candidate.ctr}%</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Eligibility:</span><span className={`font-bold ${candidate.eligibility === "high" ? "text-green" : candidate.eligibility === "medium" ? "text-amber" : "text-slate-600"}`}>{candidate.eligibility}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Score:</span><span className="text-text">{candidate.eligibilityScore}/10</span></div>
        </div>
      </div>
    </Modal>
  );
}
