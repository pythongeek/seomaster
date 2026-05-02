import { NextRequest, NextResponse } from 'next/server';
import { saveReport, initDB } from '@/db/queries';

export const runtime = 'nodejs';

interface GSCRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface TopicPillar {
  name: string;
  queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  totalImpressions: number;
  avgPosition: number;
  avgCTR: number;
  dominantFormat: string;
}

interface ContentBlueprint {
  niche: string;
  targetQuery: string;
  suggestedTitle: string;
  format: string;
  geoOptimizations: string[];
  aeoOptimizations: string[];
}

interface GEOMatrixResult {
  topPillars: TopicPillar[];
  momentumPatterns: Array<{ format: string; avgCTR: number; sampleQueries: string[] }>;
  programmaticGaps: Array<{ modifier: string; volume: number; ctr: number; recommendation: string }>;
  newContentBlueprints: ContentBlueprint[];
  geoRules: string[];
  aeoRules: string[];
  siteBaseline: { totalImpressions: number; avgPosition: number; avgCTR: number; totalClicks: number };
}

function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function extractModifiers(queries: string[]): Array<{ modifier: string; volume: number; ctrSum: number; count: number }> {
  const modifierMap: Record<string, { volume: number; ctrSum: number; count: number }> = {};
  const modifierPatterns = [
    /\b(best|top|leading|premier)\b/i,
    /\b(review|reviews|rating|rated)\b/i,
    /\b(compare|comparison|vs|versus)\b/i,
    /\b(free|cheap|affordable|budget)\b/i,
    /\b(alternative|alternative to|instead)\b/i,
    /\b(how to|guide|tutorial|steps?)\b/i,
    /\b(what is|what are|definition)\b/i,
    /\b(list|tips|ways|examples)\b/i,
    /\b(price|cost|pricing)\b/i,
    /\b(download|get|install)\b/i,
  ];

  for (const q of queries) {
    for (const pattern of modifierPatterns) {
      const match = q.match(pattern);
      if (match) {
        const modifier = match[1] || match[0];
        if (!modifierMap[modifier]) modifierMap[modifier] = { volume: 0, ctrSum: 0, count: 0 };
        modifierMap[modifier].count++;
      }
    }
  }

  return Object.entries(modifierMap)
    .map(([modifier, data]) => ({ modifier, volume: data.volume, ctrSum: data.ctrSum, count: data.count }))
    .filter(m => m.count >= 2)
    .sort((a, b) => b.count - a.count);
}

function detectContentFormat(query: string): string {
  const q = query.toLowerCase();
  if (/\b(list|tips|ways|examples|top \d+)\b/i.test(q)) return 'Listicle';
  if (/\b(how to|guide|tutorial|steps?|learn)\b/i.test(q)) return 'How-To Guide';
  if (/\b(review|tested|compared|vs)\b/i.test(q)) return 'Data Study / Comparison';
  if (/\b(what is|definition|means|explained)\b/i.test(q)) return 'Definitional';
  if (/\b(price|cost|pricing|buy|discount)\b/i.test(q)) return 'Commercial Intent';
  if (/\b(alternative|instead of|instead)\b/i.test(q)) return 'Alternatives Guide';
  return 'General';
}

function clusterQueriesIntoPillars(rows: GSCRow[], count = 4): TopicPillar[] {
  const wordFreq: Record<string, { clicks: number; impressions: number; ctr: number; position: number; count: number }> = {};

  for (const row of rows) {
    const words = normalizeQuery(row.query).split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
      if (!wordFreq[word]) wordFreq[word] = { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 };
      wordFreq[word].clicks += row.clicks;
      wordFreq[word].impressions += row.impressions;
      wordFreq[word].ctr += row.ctr;
      wordFreq[word].position += row.position;
      wordFreq[word].count++;
    }
  }

  // Find top words as pillar candidates
  const topWords = Object.entries(wordFreq)
    .filter(([, data]) => data.count >= 3)
    .sort((a, b) => b[1].impressions - a[1].impressions)
    .slice(0, count * 2)
    .map(([word]) => word);

  // Build pillars from top words
  const pillars: TopicPillar[] = [];
  const usedRows = new Set<number>();

  for (const seedWord of topWords) {
    if (pillars.length >= count) break;
    const pillarQueries = rows.filter(r =>
      normalizeQuery(r.query).includes(seedWord) && !usedRows.has(rows.indexOf(r))
    ).slice(0, 30);

    if (pillarQueries.length < 3) continue;

    const totalImpressions = pillarQueries.reduce((s, r) => s + r.impressions, 0);
    const avgPosition = pillarQueries.reduce((s, r) => s + r.position, 0) / pillarQueries.length;
    const avgCTR = pillarQueries.reduce((s, r) => s + r.ctr, 0) / pillarQueries.length;

    const formatCounts: Record<string, number> = {};
    pillarQueries.forEach(r => {
      const fmt = detectContentFormat(r.query);
      formatCounts[fmt] = (formatCounts[fmt] || 0) + r.clicks;
    });
    const dominantFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';

    pillars.push({
      name: seedWord,
      queries: pillarQueries.map(r => ({ query: r.query, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
      totalImpressions,
      avgPosition: parseFloat(avgPosition.toFixed(1)),
      avgCTR: parseFloat(avgCTR.toFixed(2)),
      dominantFormat,
    });

    pillarQueries.forEach(r => usedRows.add(rows.indexOf(r)));
  }

  return pillars.sort((a, b) => b.totalImpressions - a.totalImpressions);
}

function detectMomentumPatterns(pillars: TopicPillar[]) {
  return pillars.map(pillar => {
    const formatCTR: Record<string, { totalCTR: number; count: number; sampleQueries: string[] }> = {};
    for (const q of pillar.queries) {
      const fmt = detectContentFormat(q.query);
      if (!formatCTR[fmt]) formatCTR[fmt] = { totalCTR: 0, count: 0, sampleQueries: [] };
      formatCTR[fmt].totalCTR += q.ctr;
      formatCTR[fmt].count++;
      if (formatCTR[fmt].sampleQueries.length < 3) formatCTR[fmt].sampleQueries.push(q.query);
    }
    const best = Object.entries(formatCTR).sort((a, b) => (b[1].totalCTR / b[1].count) - (a[1].totalCTR / a[1].count))[0];
    return {
      format: best?.[0] || 'General',
      avgCTR: best ? parseFloat((best[1].totalCTR / best[1].count).toFixed(2)) : 0,
      sampleQueries: best?.[1].sampleQueries || [],
    };
  });
}

function identifyProgrammaticGaps(pillars: TopicPillar[], allQueries: string[]): Array<{ modifier: string; volume: number; ctr: number; recommendation: string }> {
  const modifiers = extractModifiers(allQueries);
  const gaps: Array<{ modifier: string; volume: number; ctr: number; recommendation: string }> = [];

  const recommendedModifiers = ['best', 'review', 'alternative', 'how to', 'price', 'vs'];
  for (const mod of recommendedModifiers) {
    const found = modifiers.find(m => m.modifier.toLowerCase() === mod);
    gaps.push({
      modifier: mod,
      volume: found?.volume || 0,
      ctr: found ? parseFloat((found.ctrSum / found.count).toFixed(2)) : 0,
      recommendation: `Build programmatic pages for "${mod}" modifier across top ${Math.min(3, pillars.length)} pillars. Example: "Best [Pillar] for [Use Case]" pages.`,
    });
  }

  return gaps;
}

function generateBlueprints(pillars: TopicPillar[], allQueries: string[]): ContentBlueprint[] {
  const blueprints: ContentBlueprint[] = [];
  const formats = ['Listicle', 'How-To Guide', 'Data Study / Comparison', 'Definitional', 'Alternatives Guide'];

  const existingFormats = pillars.map(p => p.dominantFormat);
  for (let i = 0; i < Math.min(5, pillars.length); i++) {
    const pillar = pillars[i];
    const suggestedFormat = formats[i % formats.length];

    blueprints.push({
      niche: pillar.name,
      targetQuery: `Best ${pillar.name} for small business`,
      suggestedTitle: `The ${new Date().getFullYear()} Best ${pillar.name} for Small Business — Complete Guide`,
      format: suggestedFormat,
      geoOptimizations: [
        'Use <h2> headers with the target keyword phrase',
        'Add a "Key Stats" summary box with numbers early in content',
        'Use unordered lists (<ul>) for feature comparisons',
        'Add FAQ schema with question/answer pairs',
        'Include a "How We Chose" methodology paragraph for E-E-A-T signals',
      ],
      aeoOptimizations: [
        'Lead with a direct answer sentence in the first 40 words',
        'Use the target keyword in the first <h2>',
        'Structure with clear <h2>/<h3> hierarchy for AI parsing',
        'Add "Jump to" anchor links for long sections',
        'Include a "tl;dr" summary box for quick answer extraction',
      ],
    });
  }

  // Add comparison blueprint
  if (pillars.length >= 2) {
    blueprints.push({
      niche: `${pillars[0].name} vs ${pillars[1].name}`,
      targetQuery: `${pillars[0].name} vs ${pillars[1].name}`,
      suggestedTitle: `${pillars[0].name} vs ${pillars[1].name}: Which Is Right for You?`,
      format: 'Data Study / Comparison',
      geoOptimizations: [
        'Use comparison table with checkmarks/X marks',
        'Add structured data: Product or Review schema',
        'Include "Winner" section with clear recommendation',
      ],
      aeoOptimizations: [
        'Start with a direct comparison table',
        'Use bullet points for pros/cons',
        'Add "Best for" persona-based recommendations',
      ],
    });
  }

  return blueprints;
}

function generateGEORules(): string[] {
  return [
    'Use <h2> and <h3> tags with target keywords — AI parsers rely on heading hierarchy',
    'Add bulleted and numbered lists — AI Overviews prefer scannable content',
    'Implement FAQ schema (application/ld+json) on informational pages',
    'Use the target keyword in the first 100 words of content',
    'Add a "Key Takeaway" box with 2-3 sentences summarizing the answer',
    'Include data points with specific numbers (e.g., "41% of users prefer")',
    'Add HowTo schema on step-by-step content',
    'Use short paragraphs (2-3 sentences) — AI summarization prefers concise units',
    'Mark author entity with Schema Person markup for E-E-A-T',
    'Add "Sources" section with outbound links to authoritative references',
  ];
}

function generateAEORules(): string[] {
  return [
    'Answer the primary query in the first sentence — AI extracts from top content',
    'Use question as <h2> for informational queries ("How to Install NPM")',
    'Add a direct answer box (40-60 words) before any elaboration',
    'Structure content with clear H2 section breaks — AI splits by heading',
    'Use <strong> for key terms within paragraphs (sparingly)',
    'Add "In Brief" or "tl;dr" summary at article top for quick extraction',
    'Implement Q&A pairs using <h3>Question</h3> then Answer pattern',
    'Include a related questions section based on "People Also Ask" data',
    'Use JSON-LD Question/Answer schema for FAQ pages',
    'Keep answer sentences under 30 words for clarity in AI responses',
  ];
}

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const { globalDataset } = await req.json() as { globalDataset: GSCRow[] };

    if (!globalDataset || !Array.isArray(globalDataset)) {
      return NextResponse.json({ error: 'globalDataset is required and must be an array of GSC rows' }, { status: 400 });
    }

    const top500 = globalDataset
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 500);

    const totalImpressions = top500.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = top500.reduce((s, r) => s + r.clicks, 0);
    const avgPosition = top500.length ? top500.reduce((s, r) => s + r.position, 0) / top500.length : 0;
    const avgCTR = top500.length ? top500.reduce((s, r) => s + r.ctr, 0) / top500.length : 0;

    const siteBaseline = {
      totalImpressions,
      avgPosition: parseFloat(avgPosition.toFixed(1)),
      avgCTR: parseFloat(avgCTR.toFixed(2)),
      totalClicks,
    };

    const pillars = clusterQueriesIntoPillars(top500, 4);
    const momentumPatterns = detectMomentumPatterns(pillars);
    const programmaticGaps = identifyProgrammaticGaps(pillars, top500.map(r => r.query));
    const newContentBlueprints = generateBlueprints(pillars, top500.map(r => r.query));
    const geoRules = generateGEORules();
    const aeoRules = generateAEORules();

    const result: GEOMatrixResult = {
      topPillars: pillars,
      momentumPatterns,
      programmaticGaps,
      newContentBlueprints,
      geoRules,
      aeoRules,
      siteBaseline,
    };

    try {
      await saveReport({
        report_type: 'geo_matrix',
        title: `GEO Matrix — ${siteBaseline.totalImpressions.toLocaleString()} impr`,
        data: { globalDataset },
        summary: { totalImpressions, avgCTR: siteBaseline.avgCTR, pillars: pillars.length },
      });
    } catch {}

    return NextResponse.json({ result, reportTitle: `GEO Matrix — ${siteBaseline.totalImpressions.toLocaleString()} impressions` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
