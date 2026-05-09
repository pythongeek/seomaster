/**
 * Trend Analyser — A-04
 * OLS linear regression over position time series.
 * Produces: slope, r², p-value, momentum score (−15 to +20),
 * volatility (CV-based), trend direction, YoY seasonality flag.
 */

export interface TrendResult {
  slope: number;          // negative = improving (positions going lower = better rank)
  intercept: number;
  r2: number;             // coefficient of determination 0–1
  pValue: number;         // statistical significance (< 0.10 = significant)
  momentum: number;       // −15 to +20 (feeds Opportunity Scorer D-component)
  volatility: 'stable' | 'unstable' | 'volatile';
  direction: 'strong_rise' | 'moderate_rise' | 'stable' | 'moderate_fall' | 'strong_fall';
  seasonalFlag: boolean;
  forecastedPosition: number; // 14-day linear extrapolation
  cv: number;             // coefficient of variation
  dataPoints: number;
}

// ─── OLS Regression ──────────────────────────────────────────────────────────

function olsRegression(ys: number[]): { slope: number; intercept: number; r2: number; pValue: number } {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0, pValue: 1 };

  // xs = [0, 1, 2, ..., n-1] (day index)
  const xs = ys.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let ssxy = 0;
  let ssxx = 0;
  let ssyy = 0;
  for (let i = 0; i < n; i++) {
    ssxy += (xs[i] - xMean) * (ys[i] - yMean);
    ssxx += (xs[i] - xMean) ** 2;
    ssyy += (ys[i] - yMean) ** 2;
  }

  if (ssxx === 0) return { slope: 0, intercept: yMean, r2: 0, pValue: 1 };

  const slope = ssxy / ssxx;
  const intercept = yMean - slope * xMean;
  const r2 = ssyy > 0 ? (ssxy ** 2) / (ssxx * ssyy) : 0;

  // Approximate p-value via t-distribution (df = n-2)
  const df = n - 2;
  const sse = ssyy - slope * ssxy;
  const se = df > 0 ? Math.sqrt(sse / df / ssxx) : Infinity;
  const tStat = se > 0 ? Math.abs(slope / se) : 0;
  // Approximate two-tailed p-value using Cornish-Fisher approximation
  const pValue = df > 0 ? approximatePValue(tStat, df) : 1;

  return { slope, intercept, r2, pValue };
}

/** Approximate two-tailed p-value from t-statistic using numerical integration */
function approximatePValue(t: number, df: number): number {
  // Simple approximation using the formula for p-value from t-stat
  // For df >= 30, t ~ z, so use normal approximation
  if (df >= 30) {
    const z = t;
    return 2 * (1 - normalCDF(z));
  }
  // For smaller df, use a more conservative estimate
  const x = df / (df + t * t);
  return incompleteBeta(df / 2, 0.5, x);
}

function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Regularized incomplete beta function approximation */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x === 0 || x === 1) return x;
  // Simple numerical integration for small cases
  const steps = 100;
  const dx = x / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const xi = (i + 0.5) * dx;
    sum += Math.pow(xi, a - 1) * Math.pow(1 - xi, b - 1);
  }
  // Beta function approximation
  const beta = Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b));
  return Math.min(1, (sum * dx) / beta);
}

function logGamma(z: number): number {
  // Stirling approximation
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// ─── Statistics Helpers ───────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// ─── Main Analyser ────────────────────────────────────────────────────────────

/**
 * Analyse a position time series (28-day or any length).
 * @param positionTimeSeries Array of daily position values (1 = best)
 * @param priorYearSeries Optional: same window from prior year (for YoY seasonality)
 */
export function analyseTrend(
  positionTimeSeries: number[],
  priorYearSeries?: number[],
): TrendResult {
  const series = positionTimeSeries.filter(v => typeof v === 'number' && isFinite(v));
  if (series.length < 2) {
    return {
      slope: 0, intercept: series[0] ?? 10, r2: 0, pValue: 1,
      momentum: 0, volatility: 'stable', direction: 'stable',
      seasonalFlag: false, forecastedPosition: series[0] ?? 10,
      cv: 0, dataPoints: series.length,
    };
  }

  const { slope, intercept, r2, pValue } = olsRegression(series);

  // ── Momentum score (−15 to +20) — note: negative slope = improving rank ──
  // Significant threshold: p < 0.10
  let momentum: number;
  if (pValue >= 0.10) {
    momentum = 0; // not statistically significant
  } else if (slope < -0.20) {
    momentum = +20; // strong rise (rank improving fast)
  } else if (slope < -0.08) {
    momentum = +12;
  } else if (slope < +0.05) {
    momentum = +6;  // stable
  } else if (slope < +0.15) {
    momentum = -5;  // moderate fall
  } else {
    momentum = -15; // strong fall
  }

  // ── Volatility (coefficient of variation) ──
  const cv = series.length > 0 ? stdDev(series) / Math.max(mean(series), 0.01) : 0;
  let volatility: TrendResult['volatility'];
  if (cv > 0.35) {
    volatility = 'volatile';
    momentum = 0; // suppress for volatile queries
  } else if (cv > 0.20) {
    volatility = 'unstable';
    momentum = Math.round(momentum * 0.5); // dampen
  } else {
    volatility = 'stable';
  }

  // ── Direction label ──
  let direction: TrendResult['direction'];
  if (slope < -0.20) direction = 'strong_rise';
  else if (slope < -0.08) direction = 'moderate_rise';
  else if (slope < +0.05) direction = 'stable';
  else if (slope < +0.15) direction = 'moderate_fall';
  else direction = 'strong_fall';

  // ── YoY Seasonality ──
  let seasonalFlag = false;
  if (priorYearSeries && priorYearSeries.length >= 3) {
    const prior = priorYearSeries.filter(v => isFinite(v));
    const currentMean = mean(series);
    const priorMean = mean(prior);
    seasonalFlag = Math.abs(currentMean - priorMean) > 5.0;
  }

  // ── 14-day forecast ──
  const forecastedPosition = Math.max(1, intercept + slope * (series.length + 14));

  return {
    slope: parseFloat(slope.toFixed(4)),
    intercept: parseFloat(intercept.toFixed(2)),
    r2: parseFloat(r2.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    momentum,
    volatility,
    direction,
    seasonalFlag,
    forecastedPosition: parseFloat(forecastedPosition.toFixed(1)),
    cv: parseFloat(cv.toFixed(4)),
    dataPoints: series.length,
  };
}

/**
 * Build a synthetic time series from a set of GSC rows with data_date.
 * Groups by query, averages position per day.
 */
export function buildPositionSeries(
  rows: Array<{ query: string; position: number; data_date?: string }>,
  targetQuery: string,
): number[] {
  const queryRows = rows.filter(r => r.query === targetQuery && r.data_date);
  if (queryRows.length === 0) return [];

  const byDate = new Map<string, number[]>();
  for (const r of queryRows) {
    const d = r.data_date!;
    const arr = byDate.get(d) ?? [];
    arr.push(r.position);
    byDate.set(d, arr);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, positions]) => positions.reduce((s, v) => s + v, 0) / positions.length);
}
