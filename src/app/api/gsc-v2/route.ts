import { NextRequest, NextResponse } from 'next/server';
import {
  GscService,
  createGscService,
  GSC_DIMENSIONS,
  GSC_AGGREGATION_TYPE,
  GSC_DATA_STATE,
  GSC_OPERATORS,
  GSCDimension,
  GSCAggregationType,
  GSCDataState,
  GSCOperator,
  GscDimensionFilter,
  GscQueryRequest,
  GSCRow,
} from '@/lib/gsc-fetcher';

export const runtime = 'nodejs';

const ROUTE_TIMEOUT_MS = 120000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await promise;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

interface QueryRequestBody {
  siteUrl?: string;
  startDate?: string;
  endDate?: string;
  dimensions?: GSCDimension[];
  rowLimit?: number;
  startRow?: number;
  filters?: {
    dimension: GSCDimension;
    operator?: GSCOperator;
    expression: string;
  }[];
  aggregationType?: GSCAggregationType;
  dataState?: GSCDataState;
  country?: string;
  device?: string;
  searchType?: string;
  mode?: 'query' | 'keywordsByDay' | 'urlsByDay' | 'urlsWithKeywordsByDay' | 'performanceByDate' | 'performanceByUrl';
}

function validateInput(body: QueryRequestBody): { error?: string; status: number } {
  if (!body.siteUrl) {
    return { error: 'siteUrl is required', status: 400 };
  }

  if (body.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
    return { error: 'startDate must be in YYYY-MM-DD format', status: 400 };
  }

  if (body.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) {
    return { error: 'endDate must be in YYYY-MM-DD format', status: 400 };
  }

  if (body.startDate && body.endDate && body.startDate > body.endDate) {
    return { error: 'startDate cannot be after endDate', status: 400 };
  }

  if (body.rowLimit !== undefined && (body.rowLimit < 1 || body.rowLimit > 25000)) {
    return { error: 'rowLimit must be between 1 and 25000', status: 400 };
  }

  if (body.filters) {
    for (const filter of body.filters) {
      if (!Object.values(GSC_DIMENSIONS).includes(filter.dimension)) {
        return { error: `Invalid dimension: ${filter.dimension}`, status: 400 };
      }
      if (filter.operator && !Object.values(GSC_OPERATORS).includes(filter.operator)) {
        return { error: `Invalid operator: ${filter.operator}`, status: 400 };
      }
    }
  }

  return { status: 200 };
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: QueryRequestBody = await req.json();

    const validation = validateInput(body);
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const gsc = createGscService();
    await gsc.setProperty(body.siteUrl!);

    if (body.startDate && body.endDate) {
      gsc.setDates(new Date(body.startDate), new Date(body.endDate));
    } else {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 28);
      gsc.setDates(startDate, endDate);
    }

    if (body.country) {
      gsc.setCountry(body.country);
    }
    if (body.device) {
      gsc.setDevice(body.device as 'DESKTOP' | 'MOBILE' | 'TABLET');
    }
    if (body.searchType) {
      gsc.setSearchType(body.searchType);
    }
    if (body.dataState) {
      gsc.setDataState(body.dataState);
    }

    const mode = body.mode || 'query';
    let rows: GSCRow[] = [];

    switch (mode) {
      case 'keywordsByDay': {
        const generator = gsc.getTopKeywordsByDay(body.rowLimit);
        for await (const row of generator) {
          rows.push(row);
        }
        break;
      }

      case 'urlsByDay': {
        const generator = gsc.getTopUrlsByDay(body.rowLimit);
        for await (const row of generator) {
          rows.push(row);
        }
        break;
      }

      case 'urlsWithKeywordsByDay': {
        const generator = gsc.getTopUrlsWithKeywordsByDay(body.rowLimit);
        for await (const row of generator) {
          rows.push(row);
        }
        break;
      }

      case 'performanceByDate': {
        const generator = gsc.getSearchPerformanceByDate();
        for await (const row of generator) {
          rows.push(row);
        }
        break;
      }

      case 'performanceByUrl': {
        const generator = gsc.getSearchPerformanceByUrl();
        for await (const row of generator) {
          rows.push(row);
        }
        break;
      }

      case 'query':
      default: {
        const filters: GscDimensionFilter[] = (body.filters || []).map(f => ({
          dimension: f.dimension,
          operator: f.operator || GSC_OPERATORS.EQUALS,
          expression: f.expression,
        }));

        const request: GscQueryRequest = {
          startDate: body.startDate!,
          endDate: body.endDate!,
          dimensions: body.dimensions || [GSC_DIMENSIONS.QUERY, GSC_DIMENSIONS.PAGE],
          dimensionFilterGroups: filters.length > 0 ? filters.map(f => ({
            groupType: 'and' as const,
            filters: [f],
          })) : undefined,
          aggregationType: body.aggregationType || GSC_AGGREGATION_TYPE.BY_PAGE,
          rowLimit: body.rowLimit || 5000,
          startRow: body.startRow,
          dataState: body.dataState,
        };

        const apiRows = await gsc.executeQuery(request);

        rows = apiRows.map((row, idx) => {
          const result: GSCRow = {
            impressions: row.impressions,
            clicks: row.clicks,
            position: row.position,
            ctr: row.ctr * 100,
            sum_top_position: (row.position - 1) * row.impressions,
          };

          const dims = body.dimensions || [GSC_DIMENSIONS.QUERY, GSC_DIMENSIONS.PAGE];
          dims.forEach((dim, i) => {
            switch (dim) {
              case GSC_DIMENSIONS.DATE:
                result.data_date = row.keys[i];
                break;
              case GSC_DIMENSIONS.QUERY:
                result.query = row.keys[i];
                break;
              case GSC_DIMENSIONS.PAGE:
                result.url = row.keys[i];
                break;
              case GSC_DIMENSIONS.COUNTRY:
                result.country = row.keys[i];
                break;
              case GSC_DIMENSIONS.DEVICE:
                result.device = row.keys[i];
                break;
            }
          });

          return result;
        });
        break;
      }
    }

    return NextResponse.json({
      rows,
      meta: {
        property: gsc.getProperty(),
        startDate: body.startDate,
        endDate: body.endDate,
        rowCount: rows.length,
        mode,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    return NextResponse.json({ error: isAbort ? `Request timeout after ${ROUTE_TIMEOUT_MS}ms` : message }, { status: isAbort ? 504 : 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: List accessible properties
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const gsc = createGscService();
    const properties = await gsc.getProperties();

    return NextResponse.json({
      properties: properties.map(p => ({
        siteUrl: p.siteUrl,
        permissionLevel: p.permissionLevel,
        isDomain: p.siteUrl.startsWith('sc-domain:'),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    return NextResponse.json({ error: isAbort ? `Request timeout after ${ROUTE_TIMEOUT_MS}ms` : message }, { status: isAbort ? 504 : 500 });
  }
}