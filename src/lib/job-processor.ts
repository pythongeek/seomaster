import { updateJobProgress } from "@/db/queries";

/**
 * Processes a large SEO analysis job by chunking the dataset and calling the analyze API.
 * This prevents Vercel serverless timeouts (usually 10s-60s) for large CSVs.
 */
export async function processAnalyzeJob(
  input: { type: string; data: any[]; options: any },
  onProgress: (progress: number, message: string) => void
): Promise<any> {
  const { type, data: rows, options } = input;
  const CHUNK_SIZE = 500;
  const totalRows = rows.length;
  
  if (totalRows <= CHUNK_SIZE) {
    onProgress(10, "Analyzing dataset...");
    return await fetchAnalysis(input);
  }

  // Chunking logic for large datasets
  onProgress(5, `Splitting ${totalRows} rows into chunks...`);
  
  const chunks = [];
  for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + CHUNK_SIZE));
  }

  const results = [];
  let completed = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    onProgress(10 + Math.round((completed / totalRows) * 80), `Analyzing chunk ${i + 1} of ${chunks.length}...`);
    
    const chunkResult = await fetchAnalysis({ type, data: chunk, options });
    results.push(chunkResult);
    completed += chunk.length;
  }

  onProgress(95, "Merging analysis results...");
  return mergeAnalysisResults(results);
}

/**
 * Helper to fetch analysis for a single chunk.
 */
async function fetchAnalysis(payload: any) {
  // In a real environment, you'd use absolute URL or directly invoke the logic.
  // Since we are in the Next.js backend, we can fetch our own API.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const resp = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Analysis failed with status ${resp.status}`);
  }
  
  const json = await resp.json();
  return json.result;
}

/**
 * Merges multiple AnalysisResult objects into one.
 */
function mergeAnalysisResults(results: any[]) {
  if (!results.length) return null;
  if (results.length === 1) return results[0];

  const merged = { ...results[0] };
  
  for (let i = 1; i < results.length; i++) {
    const r = results[i];
    
    // Merge Overview
    merged.overview.totalQueries += r.overview.totalQueries;
    merged.overview.totalClicks += r.overview.totalClicks;
    merged.overview.totalImpressions += r.overview.totalImpressions;
    merged.overview.potentialClicksGain += r.overview.potentialClicksGain;
    merged.overview.benchmarkClicks += r.overview.benchmarkClicks;
    merged.overview.cannibalizedQueries += r.overview.cannibalizedQueries;
    merged.overview.zeroClickQueries += r.overview.zeroClickQueries;
    
    // Average CTR & Position (Weighted)
    const tImp = merged.overview.totalImpressions;
    if (tImp > 0) {
      merged.overview.avgCTR = (merged.overview.totalClicks / tImp) * 100;
      merged.overview.benchmarkCTR = (merged.overview.benchmarkClicks / tImp) * 100;
    }
    
    // Append arrays
    merged.quickWins = [...merged.quickWins, ...r.quickWins].sort((a, b) => b.estimatedTrafficGain - a.estimatedTrafficGain).slice(0, 50);
    merged.contentGaps = [...merged.contentGaps, ...r.contentGaps].sort((a, b) => b.impressions - a.impressions).slice(0, 50);
    merged.cannibalization = [...merged.cannibalization, ...r.cannibalization].slice(0, 50);
    merged.pageHealth = [...merged.pageHealth, ...r.pageHealth].slice(0, 50);
    merged.priorityMatrix = [...merged.priorityMatrix, ...r.priorityMatrix].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 50);
    
    // Merge Intent
    for (const k in r.intentAnalysis.distribution) {
      merged.intentAnalysis.distribution[k] = (merged.intentAnalysis.distribution[k] || 0) + r.intentAnalysis.distribution[k];
      merged.intentAnalysis.clicksByIntent[k] = (merged.intentAnalysis.clicksByIntent[k] || 0) + r.intentAnalysis.clicksByIntent[k];
      merged.intentAnalysis.impressionsByIntent[k] = (merged.intentAnalysis.impressionsByIntent[k] || 0) + r.intentAnalysis.impressionsByIntent[k];
    }
  }

  return merged;
}
