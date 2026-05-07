import { z } from "zod";

const AI_TIMEOUT_MS = 90000;

// MiniMax Token Plan API — requires BOTH Authorization and x-api-key headers
const BASE_URL = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/anthropic/v1/messages";
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
