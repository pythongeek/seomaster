import { getHistoricalCTR, saveSerpData } from "@/db/queries";

export const GENERIC_BENCHMARKS: Record<number, number> = {
  1: 28.5, 2: 15.2, 3: 9.8, 4: 6.8, 5: 4.5,
  6: 3.2, 7: 2.1, 8: 1.5, 9: 1.1, 10: 0.8,
  11: 0.5, 12: 0.4, 13: 0.3, 14: 0.2, 15: 0.1,
  16: 0.1, 17: 0.1, 18: 0.1, 19: 0.1, 20: 0.1,
};

export function getGenericBenchmark(position: number): number {
  if (position <= 0) return 0;
  const pos = Math.min(Math.round(position), 20);
  return GENERIC_BENCHMARKS[pos] ?? 0.1;
}

export interface SERPFeatures {
  hasFeaturedSnippet: boolean;
  hasLocalPack: boolean;
  hasImagePack: boolean;
  hasVideoCarousel: boolean;
  hasShopping: boolean;
  hasPeopleAlsoAsk: boolean;
  hasTopStories: boolean;
}

export interface SERPIntelligence {
  query: string;
  position: number;
  intent: string;
  predictedCTR: number;
  features: SERPFeatures;
  dataSource: "historical_gsc" | "ai_prediction" | "generic_benchmark" | "google_cse";
  confidenceScore: number; // 0-100
}

/**
 * Predicts SERP features based on query characteristics without needing paid APIs.
 */
function predictSERPFeatures(query: string, intent: string): SERPFeatures {
  const q = query.toLowerCase();
  const words = q.split(" ");
  const isQuestion = /^(how|what|why|where|when|who|is|can|do|does)/.test(q);
  
  return {
    hasFeaturedSnippet: isQuestion || intent === "Informational",
    hasLocalPack: intent === "Navigational" || /near me|city|state/.test(q) || words.length <= 3,
    hasImagePack: /image|picture|photo|template|design|diagram/.test(q),
    hasVideoCarousel: /how to|tutorial|review|trailer|video/.test(q),
    hasShopping: intent === "Transactional" || /buy|price|cheap|best|vs/.test(q),
    hasPeopleAlsoAsk: isQuestion || words.length > 2,
    hasTopStories: /news|today|update|latest/.test(q) || intent === "Navigational",
  };
}

/**
 * Adjusts base CTR based on predicted SERP features (which steal clicks).
 */
function adjustCTRForFeatures(baseCTR: number, position: number, features: SERPFeatures): number {
  let adjusted = baseCTR;
  
  // Featured snippets steal massive clicks from organic #1
  if (features.hasFeaturedSnippet) {
    if (position === 1) adjusted *= 0.6; // #1 loses 40%
    else if (position > 1) adjusted *= 0.9;
  }
  
  // Local pack pushes organic down
  if (features.hasLocalPack && position <= 3) adjusted *= 0.7;
  
  // Shopping ads steal commercial clicks
  if (features.hasShopping && position <= 3) adjusted *= 0.65;
  
  // PAA steals middle clicks
  if (features.hasPeopleAlsoAsk && position >= 2 && position <= 5) adjusted *= 0.85;

  return Math.max(0.1, adjusted); // Floor at 0.1%
}

/**
 * Core engine to determine the most accurate CTR benchmark for a query.
 */
export async function getDynamicBenchmark(
  query: string, 
  position: number, 
  intent: string, 
  actualCtr?: number, 
  siteUrl?: string,
  skipSave = false
): Promise<SERPIntelligence> {
  const posBucket = Math.round(position);
  if (posBucket > 20) {
    return {
      query, position, intent, predictedCTR: 0, dataSource: "generic_benchmark", confidenceScore: 10,
      features: predictSERPFeatures(query, intent),
    };
  }

  const features = predictSERPFeatures(query, intent);
  const genericBase = GENERIC_BENCHMARKS[posBucket] || 0.5;
  const featureAdjustedBase = adjustCTRForFeatures(genericBase, posBucket, features);

  // Layer 1 & 4: Check historical self-learning database
  const historical = await getHistoricalCTR(posBucket, intent);
  
  let finalCTR = featureAdjustedBase;
  let source: SERPIntelligence["dataSource"] = "ai_prediction";
  let confidence = 50;

  if (historical && historical.dataPoints >= 5) {
    // We have enough historical data to trust it
    finalCTR = historical.avgCtr;
    source = "historical_gsc";
    confidence = Math.min(95, 50 + (historical.dataPoints * 2)); // Up to 95% confident
  }

  // Self-learning: If we have an actual CTR from the current GSC upload, learn from it
  if (!skipSave && actualCtr !== undefined && actualCtr > 0 && actualCtr < 100) {
    // Only learn if the CTR isn't absurd (e.g. 1 impression, 1 click = 100%)
    await saveSerpData({
      query,
      positionBucket: posBucket,
      intent,
      actualCtr,
      predictedCtr: finalCTR,
      predictedFeatures: features,
      siteUrl
    });
  }

  return {
    query,
    position,
    intent,
    predictedCTR: Number(finalCTR.toFixed(2)),
    features,
    dataSource: source,
    confidenceScore: confidence,
  };
}
