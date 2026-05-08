import { NextRequest, NextResponse } from "next/server";
import { callMiniMaxRaw, extractJSON } from "@/lib/ai-client";
import { z } from "zod";

export const runtime = "nodejs";

const ContentPlanSchema = z.object({
  steps: z.array(
    z.object({
      stepNumber: z.number(),
      title: z.string(),
      description: z.string(),
      actionType: z.enum(["title_tag", "meta_description", "content", "schema", "redirect", "internal_links", "backlinks", "technical", "heading_structure", "faq_section", "intro_optimization", "content_restructuring", "eeat_signals"]),
      difficulty: z.enum(["easy", "medium", "hard"]),
      estimatedTime: z.string(),
      expectedLift: z.string(),
      requirements: z.array(z.string()).optional(),
      codeExample: z.string().optional(),
      beforeAfter: z.object({ before: z.string(), after: z.string() }).optional(),
      checklist: z.array(z.string()).optional(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const { type, data } = await req.json();

    if (!type || !data) {
      return NextResponse.json({ error: "type and data are required" }, { status: 400 });
    }

    const systemPrompt = `You are an expert SEO implementation specialist. You generate detailed, actionable step-by-step SEO plans with specific code examples, checklists, and expected outcomes. Always be specific and actionable — no generic advice.`;

    let userContent = "";

    if (type === "quick_win") {
      const qw = data as {
        query: string;
        page: string;
        position: number;
        currentCTR: number;
        benchmarkCTR: number;
        impressions: number;
        intent: string;
        action: string;
      };
      const gap = (qw.benchmarkCTR - qw.currentCTR).toFixed(2);
      const estGain = Math.round(qw.impressions * (qw.benchmarkCTR - qw.currentCTR) / 100);

      userContent = `Generate a detailed SEO implementation plan for this Quick Win opportunity:

QUERY: "${qw.query}"
PAGE: ${qw.page}
CURRENT POSITION: ${qw.position}
CURRENT CTR: ${qw.currentCTR}%
BENCHMARK CTR: ${qw.benchmarkCTR}%
CTR GAP: -${gap}%
MONTHLY IMPRESSIONS: ${qw.impressions.toLocaleString()}
ESTIMATED TRAFFIC GAIN: +${estGain} clicks/month
SEARCH INTENT: ${qw.intent}
RECOMMENDED ACTION: ${qw.action}

Return a JSON plan with 4-6 specific steps. Each step must include:
- stepNumber (1-based)
- title (short, clear action name)
- description (detailed explanation of WHAT to do and WHY)
- actionType: one of ["title_tag", "meta_description", "content", "schema", "heading_structure", "faq_section", "internal_links"]
- difficulty: "easy" | "medium" | "hard"
- estimatedTime: specific time like "15 minutes" or "2 hours"
- expectedLift: specific expected improvement like "+0.5% CTR" or "+25 clicks/month"
- For title_tag steps: include beforeAfter with specific before/after title examples
- For schema steps: include codeExample with valid JSON-LD
- For content steps: include a checklist of specific content improvements
- For FAQ sections: include codeExample with FAQ JSON-LD schema

The plan should go from easiest/quickest to most complex. Focus on actions that give the biggest CTR lift with least effort.`;
    } else if (type === "ai_overview") {
      const aio = data as {
        query: string;
        page: string;
        position: number;
        impressions: number;
        intent: string;
        eligibilityScore: number;
        optimizationFocus: string;
        eeatSignals: string[];
        contentFormat: string;
      };

      userContent = `Generate a detailed AI Overview optimization plan for this content:

QUERY: "${aio.query}"
PAGE: ${aio.page}
CURRENT POSITION: ${aio.position}
ELIGIBILITY SCORE: ${aio.eligibilityScore}/10
MONTHLY IMPRESSIONS: ${aio.impressions.toLocaleString()}
SEARCH INTENT: ${aio.intent}
CONTENT FORMAT: ${aio.contentFormat}
CURRENT OPTIMIZATION FOCUS: ${aio.optimizationFocus}
CURRENT E-E-A-T SIGNALS: ${aio.eeatSignals.join(", ") || "none detected"}

Return a JSON plan with 5-7 specific steps to improve AI Overview eligibility. Each step must include:
- stepNumber (1-based)
- title (short, clear action name)
- description (detailed explanation of WHAT to do and WHY it helps AI Overview eligibility)
- actionType: one of ["content_restructuring", "eeat_signals", "schema", "heading_structure", "faq_section", "intro_optimization", "internal_links"]
- difficulty: "easy" | "medium" | "hard"
- estimatedTime: specific time like "30 minutes" or "3 hours"
- expectedLift: specific expected improvement like "Score 7→9/10" or "+200 impressions from AI Overview"
- For FAQ sections: include codeExample with valid FAQ JSON-LD schema
- For content restructuring: include checklist of specific structural improvements
- For E-E-A-T: include requirements array of specific signals to add
- Include at least one step about intro optimization (first 100 words are critical for AI Overview)

The plan should follow Google's quality evaluator guidelines (E-E-A-T framework) and be specific to the content format detected.`;
    } else if (type === "priority_matrix") {
      const pm = data as {
        query: string;
        page: string;
        opportunityScore: number;
        commercialValue: number;
        effort: string;
        impact: string;
        category: string;
        recommendedAction: string;
        timeToValue: string;
      };

      const categoryContext: Record<string, string> = {
        ctr: "CTR improvement — optimize title tags and meta descriptions",
        content_gap: "Content gap — fix zero-click queries with content or schema improvements",
        cannibalization: "Cannibalization fix — consolidate competing pages with 301 redirects",
        position: "Position push — improve rankings through content depth and backlinks",
        serp: "SERP competition — win featured snippets, PAAs, or supplementary features",
      };

      userContent = `Generate a detailed SEO implementation plan for this Priority Matrix item:

QUERY: "${pm.query}"
PAGE: ${pm.page}
CATEGORY: ${pm.category} — ${categoryContext[pm.category] || pm.category}
OPPORTUNITY SCORE: ${pm.opportunityScore}/100
COMMERCIAL VALUE: ${pm.commercialValue}/100
IMPACT: ${pm.impact}
EFFORT: ${pm.effort}
TIME TO VALUE: ${pm.timeToValue}
RECOMMENDED ACTION: ${pm.recommendedAction}

Return a JSON plan with 4-7 specific steps. Each step must include:
- stepNumber (1-based)
- title (short, clear action name)
- description (detailed explanation of WHAT to do, WHY it works, and specific details)
- actionType: one of ["title_tag", "meta_description", "content", "schema", "redirect", "internal_links", "backlinks", "technical"]
- difficulty: "easy" | "medium" | "hard"
- estimatedTime: specific time like "20 minutes" or "1 week"
- expectedLift: specific expected improvement like "+50 clicks/month" or "position 4.5 → 3.2"
- For redirect steps: include codeExample showing valid 301 redirect format
- For content steps: include checklist of specific content improvements
- For internal_links: include checklist of specific anchor text and page suggestions

The plan should match the category (e.g., cannibalization = redirects, CTR = title/meta, content_gap = content + schema). Start with lowest-effort, highest-impact steps.`;
    } else {
      return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }

    const rawText = await callMiniMaxRaw(systemPrompt, userContent, 4096);
    const jsonStr = extractJSON(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON. Please try again.", details: rawText.slice(0, 500) }, { status: 500 });
    }

    const result = ContentPlanSchema.safeParse(parsed);
    if (!result.success) {
      return NextResponse.json({ error: "AI output validation failed", issues: result.error.issues }, { status: 500 });
    }

    return NextResponse.json({ result: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ai-content-plan]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
