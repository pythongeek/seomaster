import { z } from "zod";

const AI_TIMEOUT_MS = 90000;

// MiniMax Token Plan API — BASE_URL is the root; path appended per-call
const BASE_URL = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/anthropic";
const API_KEY = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.OPENROUTER_API_KEY || "";
const MODEL = process.env.MINIMAX_MODEL || process.env.ANTHROPIC_MODEL || "MiniMax-M2.7";

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Basic MiniMax/Anthropic call returning a raw string.
 */
export async function callMiniMaxRaw(systemPrompt: string, userContent: string, maxTokens = 4096): Promise<string> {
  if (!API_KEY) throw new Error("AI API key not configured");

  const resp = await fetchWithTimeout(
    `${BASE_URL}/v1/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "x-api-key": API_KEY, // MiniMax requires BOTH headers
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        stream: false,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    },
    AI_TIMEOUT_MS
  );

  const responseText = await resp.text();

  if (!resp.ok) {
    let errorMsg = `AI API error ${resp.status}: ${responseText}`;
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.error?.error?.message) errorMsg = parsed.error.error.message;
      else if (parsed.error?.message) errorMsg = parsed.error.message;
      else if (parsed.error) errorMsg = typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error);
    } catch {}
    throw new Error(errorMsg);
  }

  const data = JSON.parse(responseText);
  if (data.error) throw new Error(data.error?.error?.message || data.error?.message || JSON.stringify(data.error));

  return data.content?.map((b: { text?: string }) => b.text || "").join("") || "";
}

/**
 * Extracts JSON from a markdown string if wrapped in ```json ... ``` blocks
 */
export function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    return match[1].trim();
  }
  // Try to find first { and last } if no markdown
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      return text.substring(startIdx, endIdx + 1);
  }
  return text.trim();
}

/**
 * Calls AI and validates output against a Zod schema with a retry loop.
 */
export async function callAIValidated<T>(
  systemPrompt: string,
  userContent: string,
  schema: z.ZodSchema<T>,
  maxRetries = 2
): Promise<T> {
  let promptAttempt = userContent;
  
  // Append JSON structure hints to the prompt
  promptAttempt += `\n\nReturn ONLY valid JSON matching this structure. No markdown formatting, no explanations:\n${JSON.stringify(schema, null, 2)}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const rawText = await callMiniMaxRaw(systemPrompt, promptAttempt);
      const jsonStr = extractJSON(rawText);
      const parsed = JSON.parse(jsonStr);
      
      const result = schema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      
      // Validation failed, construct error message for retry
      const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      console.warn(`[AI Validation Failed - Attempt ${attempt + 1}]`, errors);
      
      promptAttempt += `\n\nYour previous JSON response failed validation with these errors: ${errors}. Please fix these issues and return valid JSON.`;
    } catch (err) {
      console.warn(`[AI Parsing Error - Attempt ${attempt + 1}]`, err);
      promptAttempt += `\n\nYour previous response was not valid JSON. Ensure you return ONLY valid JSON.`;
    }
  }
  
  throw new Error("AI output validation failed after multiple retries");
}

// ─── Premium Prompt Templates ─────────────────────────────────────────────────

/**
 * Generate a structured Action Plan for a given opportunity.
 * Uses MiniMax M2.7 for synthesis (faster + cost-efficient for structured output).
 */
export async function generateActionPlan(
  query: string,
  page: string,
  actionType: string,
  context: {
    position: number;
    ctr: number;
    impressions: number;
    estimatedGain: number;
    cannibalisationPages?: string[];
    aiRiskScore?: number;
    ctrGap?: number;
  },
) {
  const { ActionPlanSchema } = await import('./ai-schemas');
  const system = `You are a senior SEO consultant generating precise, actionable instructions for website owners.
Your recommendations must be specific, time-bounded, and realistic. Avoid vague advice.
Return ONLY valid JSON — no prose, no markdown outside the JSON.`;

  const user = `Generate a detailed action plan for this SEO opportunity:

Query: "${query}"
Landing Page: ${page}
Action Type: ${actionType}
Current Position: ${context.position.toFixed(1)}
Current CTR: ${context.ctr.toFixed(2)}%
Monthly Impressions: ${context.impressions.toLocaleString()}
Estimated Traffic Gain: +${context.estimatedGain} clicks/month
${context.ctrGap ? `CTR Gap: ${context.ctrGap.toFixed(1)}% below benchmark` : ''}
${context.aiRiskScore && context.aiRiskScore > 40 ? `AI Overview Risk Score: ${context.aiRiskScore}/100 (high — AI likely absorbing clicks)` : ''}
${context.cannibalisationPages?.length ? `Competing Pages: ${context.cannibalisationPages.join(', ')}` : ''}

Create 3-5 numbered steps that specifically fix this issue. Be concrete — mention exact character counts, specific tactics, named tools where relevant.`;

  return callAIValidated(system, user, ActionPlanSchema);
}

/**
 * Generate 3-5 optimized title tag and meta description variants.
 * Uses MiniMax M2.7.
 */
export async function generateTitleVariants(
  query: string,
  currentTitle: string,
  intent: string,
  currentCTR: number,
  benchmarkCTR: number,
  position: number,
) {
  const { TitleVariantsSchema } = await import('./ai-schemas');
  const system = `You are a world-class conversion copywriter specializing in SEO title tag optimization.
Your titles must: (1) include the target keyword, (2) stay under 60 characters, (3) use proven CTR drivers.
Return ONLY valid JSON.`;

  const user = `Generate optimized title and meta description variants for this page:

Target Query: "${query}"
Current Title: "${currentTitle}"
Search Intent: ${intent}
Current CTR: ${currentCTR.toFixed(2)}%
Benchmark CTR: ${benchmarkCTR.toFixed(2)}%
Ranking Position: ${position.toFixed(1)}

Create 5 title variants using different psychological approaches:
1. Power word-led (use: "Ultimate", "Essential", "Proven", "Expert")
2. Number-led (e.g., "7 Ways to...")
3. Year/freshness ("2025 Guide to...")
4. Emotional hook (curiosity, urgency, or benefit)
5. Question format or comparison

For each: predict CTR lift in percentage points, list the key power words used, and explain why it will perform better.

Also provide 3 meta description variants (max 155 chars) with strong CTAs.`;

  return callAIValidated(system, user, TitleVariantsSchema);
}

/**
 * Generate a full content brief for a target query.
 * Uses MiniMax M2.7 for synthesis, optionally enriched with Gemini SERP data.
 */
export async function generateContentBrief(
  query: string,
  intent: string,
  impressions: number,
  competitorData?: {
    topDomains: string[];
    paaQuestions: string[];
    hasFeaturedSnippet: boolean;
  },
) {
  const { ContentBriefSchema } = await import('./ai-schemas');
  const system = `You are a senior content strategist and SEO expert. Generate comprehensive content briefs that help writers create content that outranks competitors.
Be specific about content angles, data requirements, and schema markup. Return ONLY valid JSON.`;

  const user = `Create a detailed content brief for:

Target Query: "${query}"
Search Intent: ${intent}
Monthly Impressions: ${impressions.toLocaleString()}
${competitorData?.topDomains.length ? `Top Ranking Competitors: ${competitorData.topDomains.join(', ')}` : ''}
${competitorData?.paaQuestions.length ? `People Also Ask Questions: ${competitorData.paaQuestions.join(', ')}` : ''}
${competitorData?.hasFeaturedSnippet ? 'Note: Featured snippet exists — target position 0 with direct answer in first 50 words' : ''}

The content brief must include:
1. Keyword-rich H1 recommendation
2. Target word count (realistic for this query's SERP)
3. Unique content angle (not just "comprehensive guide")
4. Recommended schema markup type
5. Detailed outline with H2s, H3s, and content notes for each section
6. Internal link anchor text suggestions
7. Topics competitors cover that we should also address
8. Clear call-to-action for the reader

Focus on creating content that could displace a featured snippet and earn AI citations.`;

  return callAIValidated(system, user, ContentBriefSchema);
}

