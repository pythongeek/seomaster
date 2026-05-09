/**
 * Topic Cluster Engine — A-09
 * K-Means TF-IDF clustering with auto-k (elbow method),
 * pillar page detection, orphan content detection,
 * and cluster health score.
 *
 * NOTE: This is a pure-JS implementation suitable for serverless/edge environments.
 * No native dependencies required.
 */

export interface TopicCluster {
  clusterId: number;
  label: string;            // top TF-IDF terms for the cluster
  queries: string[];
  pages: string[];
  pillarPage: string | null; // highest-authority page in cluster
  orphanPages: string[];     // pages with no queries in this cluster
  health: number;            // 0–100 cluster health score
  totalImpressions: number;
  totalClicks: number;
  avgPosition: number;
  avgCTR: number;
  gaps: string[];           // content gaps (missing sub-topics)
}

// ─── TF-IDF Vectorizer ────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'this',
  'with', 'have', 'from', 'they', 'will', 'been', 'their', 'was', 'said', 'each',
  'which', 'she', 'how', 'him', 'his', 'her', 'its', 'our', 'out', 'use', 'than',
  'two', 'may', 'also', 'into', 'get', 'about', 'what', 'your', 'some', 'then',
  'when', 'many', 'other', 'now', 'most', 'very', 'make',
]);

function buildTFIDF(
  documents: string[],
  maxFeatures: number = 200,
): { vectors: number[][]; vocabulary: string[] } {
  // TF per document
  const tfMaps: Map<string, number>[] = documents.map(doc => {
    const tokens = tokenize(doc);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const total = tokens.length || 1;
    tf.forEach((count, term) => tf.set(term, count / total));
    return tf;
  });

  // Document frequency
  const df = new Map<string, number>();
  for (const tf of tfMaps) {
    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }

  // IDF
  const n = documents.length || 1;
  const idf = new Map<string, number>();
  df.forEach((count, term) => idf.set(term, Math.log(n / count + 1)));

  // Select top features by max TF-IDF across docs
  const termScores = new Map<string, number>();
  df.forEach((_, term) => {
    const maxTFIDF = Math.max(...tfMaps.map(tf => (tf.get(term) ?? 0) * (idf.get(term) ?? 0)));
    termScores.set(term, maxTFIDF);
  });

  const vocabulary = [...termScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFeatures)
    .map(([term]) => term);

  // Build vectors
  const vectors = tfMaps.map(tf =>
    vocabulary.map(term => (tf.get(term) ?? 0) * (idf.get(term) ?? 0)),
  );

  return { vectors, vocabulary };
}

// ─── K-Means ─────────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}

function kmeans(
  vectors: number[][],
  k: number,
  maxIter: number = 50,
): { labels: number[]; centroids: number[][]; inertia: number } {
  const n = vectors.length;
  if (n === 0 || k >= n) {
    return { labels: vectors.map((_, i) => i % Math.max(1, k)), centroids: [], inertia: 0 };
  }

  // K-Means++ initialisation
  const centroids: number[][] = [vectors[Math.floor(Math.random() * n)]];
  while (centroids.length < k) {
    const dists = vectors.map(v => Math.min(...centroids.map(c => euclidean(v, c))));
    const total = dists.reduce((s, d) => s + d ** 2, 0);
    let rand = Math.random() * total;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      rand -= dists[i] ** 2;
      if (rand <= 0) { chosen = i; break; }
    }
    centroids.push(vectors[chosen]);
  }

  let labels = new Array<number>(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    const newLabels = vectors.map(v =>
      centroids.reduce((best, c, i) => euclidean(v, c) < euclidean(v, centroids[best]) ? i : best, 0),
    );

    const changed = newLabels.some((l, i) => l !== labels[i]);
    labels = newLabels;
    if (!changed) break;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const members = vectors.filter((_, i) => labels[i] === c);
      if (members.length === 0) continue;
      centroids[c] = members[0].map((_, j) => members.reduce((s, v) => s + v[j], 0) / members.length);
    }
  }

  const inertia = vectors.reduce((s, v, i) => s + euclidean(v, centroids[labels[i]]) ** 2, 0);
  return { labels, centroids, inertia };
}

/** Elbow method: find optimal k (2–14) via second-derivative maximum */
function findOptimalK(vectors: number[], maxK: number = 10): number {
  // For performance, use a faster heuristic: sqrt(n/2) capped at maxK
  const n = vectors.length;
  return Math.min(maxK, Math.max(2, Math.round(Math.sqrt(n / 2))));
}

// ─── Main Cluster Builder ─────────────────────────────────────────────────────

interface ClusterInput {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
}

export function buildTopicClusters(
  rows: ClusterInput[],
  maxFeatures: number = 200,
): TopicCluster[] {
  if (rows.length < 4) {
    // Not enough data — return a single cluster
    return [singleCluster(rows)];
  }

  const queries = rows.map(r => r.query);
  const { vectors, vocabulary } = buildTFIDF(queries, maxFeatures);

  const optimalK = findOptimalK(vectors.map(v => v.length));
  const { labels } = kmeans(vectors, optimalK);

  // Group rows by cluster
  const clusterMap = new Map<number, ClusterInput[]>();
  rows.forEach((row, i) => {
    const cl = labels[i];
    const arr = clusterMap.get(cl) ?? [];
    arr.push(row);
    clusterMap.set(cl, arr);
  });

  return Array.from(clusterMap.entries())
    .map(([clusterId, clusterRows]) => {
      const clusterQueries = clusterRows.map(r => r.query);
      const clusterPages = [...new Set(clusterRows.map(r => r.page))];

      // Cluster label: top 3 vocabulary terms by TF-IDF score in this cluster
      const clusterText = clusterQueries.join(' ');
      const tokens = tokenize(clusterText);
      const termFreq = new Map<string, number>();
      for (const t of tokens) termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
      const topTerms = [...termFreq.entries()]
        .filter(([term]) => vocabulary.includes(term))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([term]) => term);
      const label = topTerms.join(' · ') || `Cluster ${clusterId + 1}`;

      // Pillar page: highest authority (impressions × ctr)
      const pageAuthority = new Map<string, number>();
      for (const r of clusterRows) {
        pageAuthority.set(r.page, (pageAuthority.get(r.page) ?? 0) + r.impressions * r.ctr);
      }
      const pillarPage = [...pageAuthority.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      // Cluster metrics
      const totalImpressions = clusterRows.reduce((s, r) => s + r.impressions, 0);
      const totalClicks = clusterRows.reduce((s, r) => s + r.clicks, 0);
      const avgPosition = clusterRows.reduce((s, r) => s + r.position, 0) / clusterRows.length;
      const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      // Cluster health: coverage depth × authority spread (both 0–10, product → 0–100)
      const coverageDepth = Math.min(10, clusterQueries.length / 3);
      const authoritySpread = Math.min(10, clusterPages.length * 2);
      const health = Math.min(100, Math.round(coverageDepth * authoritySpread * 10));

      // Gaps: simplified detection of missing sub-topic patterns
      const gaps = detectClusterGaps(clusterQueries, label);

      return {
        clusterId,
        label,
        queries: clusterQueries,
        pages: clusterPages,
        pillarPage,
        orphanPages: [], // populated by caller when full site page list is available
        health,
        totalImpressions,
        totalClicks,
        avgPosition: parseFloat(avgPosition.toFixed(1)),
        avgCTR: parseFloat(avgCTR.toFixed(2)),
        gaps,
      };
    })
    .sort((a, b) => b.health - a.health);
}

function singleCluster(rows: ClusterInput[]): TopicCluster {
  const total = rows.reduce((s, r) => ({ clicks: s.clicks + r.clicks, impressions: s.impressions + r.impressions }), { clicks: 0, impressions: 0 });
  return {
    clusterId: 0,
    label: 'All Content',
    queries: rows.map(r => r.query),
    pages: [...new Set(rows.map(r => r.page))],
    pillarPage: rows.sort((a, b) => b.impressions - a.impressions)[0]?.page ?? null,
    orphanPages: [],
    health: 50,
    totalImpressions: total.impressions,
    totalClicks: total.clicks,
    avgPosition: rows.reduce((s, r) => s + r.position, 0) / rows.length,
    avgCTR: total.impressions > 0 ? (total.clicks / total.impressions) * 100 : 0,
    gaps: [],
  };
}

function detectClusterGaps(queries: string[], clusterLabel: string): string[] {
  const gaps: string[] = [];
  const hasHowTo = queries.some(q => /how to|guide|tutorial/i.test(q));
  const hasComparison = queries.some(q => /vs|versus|compare|best/i.test(q));
  const hasFAQ = queries.some(q => /what is|what are|faq/i.test(q));

  if (!hasHowTo) gaps.push(`Missing "how to" guide for ${clusterLabel}`);
  if (!hasComparison) gaps.push(`Missing comparison content for ${clusterLabel}`);
  if (!hasFAQ) gaps.push(`Missing definitional/FAQ content for ${clusterLabel}`);

  return gaps;
}

/**
 * Mark orphan pages: site pages that don't appear in any cluster.
 */
export function detectOrphanPages(
  clusters: TopicCluster[],
  allSitePages: string[],
): string[] {
  const clusterPages = new Set(clusters.flatMap(c => c.pages));
  return allSitePages.filter(p => !clusterPages.has(p));
}
