import { JWT } from 'google-auth-library';

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS & CONSTANTS (mirrors Abromeit/GscApiClient Enums)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GSC API Dimensions
 * @see https://developers.google.com/webmaster-tools/v3/searchanalytics/query
 */
export const GSC_DIMENSIONS = {
  DATE: 'date',
  QUERY: 'query',
  PAGE: 'page',
  COUNTRY: 'country',
  DEVICE: 'device',
  SEARCH_APPEARANCE: 'searchAppearance',
} as const;

export type GSCDimension = typeof GSC_DIMENSIONS[keyof typeof GSC_DIMENSIONS];

/**
 * GSC Metrics (clicks, impressions, ctr, position are from API;
 * keys/count are derived internally)
 */
export const GSC_METRICS = {
  CLICKS: 'clicks',
  IMPRESSIONS: 'impressions',
  CTR: 'ctr',
  POSITION: 'position',
  DATE: 'date',
  KEYS: 'keys',      // Internal: dimension key values
  COUNT: 'count',    // Internal: aggregation count
} as const;

export type GSCMetric = typeof GSC_METRICS[keyof typeof GSC_METRICS];

/**
 * Filter operators for dimension filters
 */
export const GSC_OPERATORS = {
  EQUALS: 'equals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'notContains',
  INCLUDING_REGEX: 'includingRegex',
  EXCLUDING_REGEX: 'excludingRegex',
} as const;

export type GSCOperator = typeof GSC_OPERATORS[keyof typeof GSC_OPERATORS];

/**
 * Aggregation type controls how data is aggregated
 */
export const GSC_AGGREGATION_TYPE = {
  AUTO: 'auto',
  BY_PAGE: 'byPage',
  BY_PROPERTY: 'byProperty',
  BY_NEWS_SHOWCASE_PANEL: 'byNewsShowcasePanel',
} as const;

export type GSCAggregationType = typeof GSC_AGGREGATION_TYPE[keyof typeof GSC_AGGREGATION_TYPE];

/**
 * Data state controls whether to include fresh/incomplete data
 */
export const GSC_DATA_STATE = {
  FINAL: 'final',       // Only complete/final data (default)
  ALL: 'all',           // Include fresh/incomplete data
  HOURLY_ALL: 'hourly_all', // Fresh data with hourly breakdown (use with HOUR dimension)
} as const;

export type GSCDataState = typeof GSC_DATA_STATE[keyof typeof GSC_DATA_STATE];

/**
 * Device types for device dimension filter
 */
export const GSC_DEVICE_TYPE = {
  DESKTOP: 'DESKTOP',
  MOBILE: 'MOBILE',
  TABLET: 'TABLET',
} as const;

export type GSCDeviceType = typeof GSC_DEVICE_TYPE[keyof typeof GSC_DEVICE_TYPE];

/**
 * Date format patterns for request building
 */
export const GSC_DATE_FORMAT = {
  DAILY: 'yyyy-MM-dd',
  WEEKLY: "yyyy-'W'ww",
  MONTHLY: 'yyyy-MM',
  ALLOVER: 'allover',
} as const;

export type GSCDateFormat = typeof GSC_DATE_FORMAT[keyof typeof GSC_DATE_FORMAT];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — mirrors PHP class data structures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw API response row structure
 */
export interface GscApiRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Processed row returned to clients
 */
export interface GSCRow {
  data_date?: string;
  site_url?: string;
  url?: string;
  query?: string;
  country?: string;
  device?: string;
  impressions: number;
  clicks: number;
  position: number;
  ctr?: number;
  sum_top_position?: number;
}

/**
 * Dimension filter for a single dimension
 */
export interface GscDimensionFilter {
  dimension: GSCDimension;
  operator: GSCOperator;
  expression: string;
}

/**
 * A group of filters (AND logic within group)
 */
export interface GscFilterGroup {
  groupType: 'and' | 'or';
  filters: GscDimensionFilter[];
}

/**
 * Search Analytics Query Request parameters
 * Mirrors SearchAnalyticsQueryRequest from PHP
 */
export interface GscQueryRequest {
  startDate: string;          // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
  dimensions?: GSCDimension[];
  dimensionFilterGroups?: GscFilterGroup[];
  aggregationType?: GSCAggregationType;
  rowLimit?: number;
  startRow?: number;
  dataState?: GSCDataState;
  searchType?: string;
}

/**
 * GSC Property info from listSites response
 */
export interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
}

/**
 * Service account configuration
 */
export interface GscServiceConfig {
  serviceAccountEmail: string;
  serviceAccountKey: string;
}

/**
 * Date range for queries
 */
export interface GscDateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Configuration for batch processing
 */
export interface GscBatchConfig {
  batchSize: number;          // Requests per batch (max 1000, default 10)
  maxRetries: number;         // Max retries for failed items (default 3)
  retryDelayMs: number;       // Base delay between retries (default 64000ms)
}

/**
 * Performance by date response
 */
export interface GscPerformanceByDate extends GSCRow {
  data_date: string;
  site_url: string;
}

/**
 * Performance by URL response (full dimension set)
 */
export interface GscPerformanceByUrl extends GSCRow {
  data_date: string;
  site_url: string;
  url: string;
  query?: string;
  country?: string;
  device?: string;
}

/**
 * Top keywords by day response
 */
export interface GscKeywordByDay extends GSCRow {
  data_date: string;
  site_url: string;
  query: string;
}

/**
 * Top URLs by day response
 */
export interface GscUrlByDay extends GSCRow {
  data_date: string;
  site_url: string;
  url: string;
}

/**
 * Top URLs with keywords by day response
 */
export interface GscUrlWithKeywordByDay extends GSCRow {
  data_date: string;
  site_url: string;
  url?: string;
  query?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GSC SERVICE — mirrors Abromeit/GscApiClient architecture
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_PROPERTY_PREFIX = 'sc-domain:';
const MAX_ROWS_PER_REQUEST = 25000;
const DEFAULT_ROWS_PER_REQUEST = 5000;
const MAX_BATCH_SIZE = 1000;
const DEFAULT_BATCH_SIZE = 10;
const GSC_API_TIMEOUT_MS = 60000;

export class GscService {
  private readonly config: GscServiceConfig;
  private property: string | null = null;
  private startDate: Date | null = null;
  private endDate: Date | null = null;
  private countryCode: string | null = null;
  private deviceType: string | null = null;
  private searchType: string | null = null;
  private dataState: GSCDataState | null = null;
  private batchConfig: GscBatchConfig = {
    batchSize: DEFAULT_BATCH_SIZE,
    maxRetries: 3,
    retryDelayMs: 64000,
  };

  // Request metrics
  private totalRequests = 0;
  private requestStartTime: number;

  constructor(config: GscServiceConfig) {
    this.validateConfig(config);
    this.config = config;
    this.requestStartTime = Date.now();
  }

  private validateConfig(config: GscServiceConfig): void {
    if (!config.serviceAccountEmail || !config.serviceAccountKey) {
      throw new Error('GSC Service Account email and key are required');
    }
  }

  // ── Property Management ──────────────────────────────────────────────────────

  /**
   * Set the GSC property URL to query
   */
  async setProperty(siteUrl: string): Promise<this> {
    let normalizedUrl = siteUrl;

    // Normalize URL format
    if (!normalizedUrl.startsWith(DOMAIN_PROPERTY_PREFIX) && !normalizedUrl.endsWith('/')) {
      normalizedUrl += '/';
    }

    // Verify property is accessible
    const properties = await this.getProperties();
    const hasAccess = properties.some(p => p.siteUrl === normalizedUrl);

    if (!hasAccess) {
      throw new Error(`Property '${normalizedUrl}' is not accessible or does not exist`);
    }

    this.property = normalizedUrl;
    return this;
  }

  getProperty(): string | null {
    return this.property;
  }

  hasProperty(): boolean {
    return this.property !== null;
  }

  isDomainProperty(siteUrl?: string): boolean {
    const url = siteUrl ?? this.property;
    if (!url) return false;
    return url.startsWith(DOMAIN_PROPERTY_PREFIX);
  }

  // ── Date Management ─────────────────────────────────────────────────────────

  /**
   * Set start date for queries
   */
  setStartDate(date: Date): this {
    if (this.endDate && date > this.endDate) {
      throw new Error('Start date cannot be after end date');
    }
    this.startDate = date;
    return this;
  }

  /**
   * Set end date for queries
   */
  setEndDate(date: Date): this {
    if (this.startDate && date < this.startDate) {
      throw new Error('End date cannot be before start date');
    }
    this.endDate = date;
    return this;
  }

  /**
   * Set both start and end dates
   */
  setDates(startDate: Date, endDate: Date): this {
    if (endDate < startDate) {
      throw new Error('End date cannot be before start date');
    }
    this.startDate = startDate;
    this.endDate = endDate;
    return this;
  }

  clearStartDate(): this { this.startDate = null; return this; }
  clearEndDate(): this { this.endDate = null; return this; }
  clearDates(): this { this.startDate = null; this.endDate = null; return this; }

  getStartDate(): Date | null { return this.startDate; }
  getEndDate(): Date | null { return this.endDate; }
  getDates(): { start: Date | null; end: Date | null } {
    return { start: this.startDate, end: this.endDate };
  }

  hasStartDate(): boolean { return this.startDate !== null; }
  hasEndDate(): boolean { return this.endDate !== null; }
  hasDates(): boolean { return this.hasStartDate() && this.hasEndDate(); }

  // ── Dimension Filters ───────────────────────────────────────────────────────

  setCountry(countryCode: string | null): this {
    if (countryCode === null) {
      this.countryCode = null;
      return this;
    }
    if (countryCode.length !== 3) {
      throw new Error('Country code must be a valid ISO-3166-1-Alpha-3 code');
    }
    this.countryCode = countryCode.toUpperCase();
    return this;
  }

  getCountry(): string | null { return this.countryCode; }
  hasCountry(): boolean { return this.countryCode !== null; }

  setDevice(deviceType: GSCDeviceType | null): this {
    if (deviceType === null) {
      this.deviceType = null;
      return this;
    }
    this.deviceType = deviceType;
    return this;
  }

  getDevice(): string | null { return this.deviceType; }
  hasDevice(): boolean { return this.deviceType !== null; }

  setSearchType(searchType: string | null): this {
    this.searchType = searchType?.toUpperCase() ?? null;
    return this;
  }

  getSearchType(): string | null { return this.searchType; }

  setDataState(dataState: GSCDataState | null): this {
    this.dataState = dataState;
    return this;
  }

  getDataState(): GSCDataState | null { return this.dataState; }

  // ── Batch Configuration ─────────────────────────────────────────────────────

  setBatchSize(size: number): this {
    this.batchConfig.batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, size));
    return this;
  }

  getBatchSize(): number { return this.batchConfig.batchSize; }

  // ── Authentication ──────────────────────────────────────────────────────────

  /**
   * Create authenticated JWT client for GSC API
   */
  private async getAuthenticatedClient(): Promise<JWT> {
    const privateKey = this.config.serviceAccountKey.replace(/\\n/g, '\n');

    const client = new JWT({
      email: this.config.serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmaster-tools.readonly'],
    });

    await client.authorize();
    return client;
  }

  /**
   * Get access token for API calls
   */
  private async getAccessToken(): Promise<string> {
    const client = await this.getAuthenticatedClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) {
      throw new Error('Failed to obtain GSC access token');
    }
    return tokenResponse.token;
  }

  // ── API Methods ────────────────────────────────────────────────────────────

  /**
   * List all accessible GSC properties
   */
  async getProperties(): Promise<GscProperty[]> {
    const accessToken = await this.getAccessToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GSC_API_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(
        'https://searchconsole.googleapis.com/webmaster-tools/v3/sites',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Failed to list properties: ${response.statusText}`);
    }

    const data = await response.json() as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> };
    return data.siteEntry ?? [];
  }

  /**
   * Find first date that has data in a date range
   */
  async getFirstDateWithData(startDate?: Date, endDate?: Date): Promise<Date | null> {
    if (!this.property) throw new Error('Property must be set');

    const start = startDate ?? this.startDate;
    const end = endDate ?? this.endDate ?? new Date();

    if (!start) {
      const effectiveStart = new Date(end);
      effectiveStart.setMonth(effectiveStart.getMonth() - 18);
      return this.getFirstDateWithData(effectiveStart, end);
    }

    const request: GscQueryRequest = {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end),
      dimensions: [GSC_DIMENSIONS.DATE],
      rowLimit: 1,
    };

    const rows = await this.executeQuery(request);
    if (!rows.length) return null;

    return new Date(rows[0].keys?.[0] ?? '');
  }

  /**
   * Build a dimension filter group (mirrors PHP getNewApiDimensionFilterGroup)
   */
  private buildDimensionFilterGroup(
    dimension: GSCDimension,
    expression: string,
    operator: GSCOperator = GSC_OPERATORS.EQUALS
  ): GscFilterGroup {
    return {
      groupType: 'and',
      filters: [{
        dimension,
        operator,
        expression,
      }],
    };
  }

  /**
   * Build the complete query request object
   * Mirrors PHP getNewSearchAnalyticsQueryRequest()
   */
  private buildQueryRequest(params: {
    dimensions: GSCDimension[];
    startDate?: Date;
    endDate?: Date;
    rowLimit?: number;
    startRow?: number;
    filters?: GscDimensionFilter[];
    aggregationType?: GSCAggregationType;
    dataState?: GSCDataState;
  }): GscQueryRequest {
    const {
      dimensions,
      startDate,
      endDate,
      rowLimit,
      startRow,
      filters = [],
      aggregationType,
      dataState,
    } = params;

    if (dimensions.length === 0) {
      throw new Error('At least one dimension must be provided');
    }

    const effectiveStartDate = startDate ?? this.startDate;
    const effectiveEndDate = endDate ?? this.endDate;

    if (!effectiveStartDate || !effectiveEndDate) {
      throw new Error('Both start and end dates must be set');
    }

    // Normalize row limit
    const normalizedRowLimit = this.normalizeRowLimit(rowLimit);

    // Build request
    const request: GscQueryRequest = {
      startDate: this.formatDate(effectiveStartDate),
      endDate: this.formatDate(effectiveEndDate),
      dimensions,
      rowLimit: normalizedRowLimit,
    };

    if (startRow !== undefined) {
      request.startRow = startRow;
    }

    if (aggregationType) {
      request.aggregationType = aggregationType;
    }

    // Apply implicit filters from instance state
    const dimensionFilterGroups: GscFilterGroup[] = [];

    // Country filter
    if (!filters.find(f => f.dimension === GSC_DIMENSIONS.COUNTRY)) {
      if (this.countryCode) {
        dimensionFilterGroups.push(
          this.buildDimensionFilterGroup(GSC_DIMENSIONS.COUNTRY, this.countryCode)
        );
      }
    }

    // Device filter
    if (!filters.find(f => f.dimension === GSC_DIMENSIONS.DEVICE)) {
      if (this.deviceType) {
        dimensionFilterGroups.push(
          this.buildDimensionFilterGroup(GSC_DIMENSIONS.DEVICE, this.deviceType)
        );
      }
    }

    // Custom filters
    for (const filter of filters) {
      dimensionFilterGroups.push(this.buildDimensionFilterGroup(
        filter.dimension,
        filter.expression,
        filter.operator
      ));
    }

    if (dimensionFilterGroups.length > 0) {
      request.dimensionFilterGroups = dimensionFilterGroups;
    }

    // Search type (not a filter group, it's a separate field)
    if (this.searchType) {
      request.searchType = this.searchType;
    }

    // Data state
    if (dataState ?? this.dataState) {
      request.dataState = dataState ?? this.dataState ?? undefined;
    }

    return request;
  }

  /**
   * Execute a search analytics query and return rows
   */
  async executeQuery(params: GscQueryRequest): Promise<GscApiRow[]> {
    if (!this.property) {
      throw new Error('Property must be set before querying');
    }

    const accessToken = await this.getAccessToken();

    const body: Record<string, unknown> = {
      startDate: params.startDate,
      endDate: params.endDate,
    };

    if (params.dimensions && params.dimensions.length > 0) {
      body.dimensions = params.dimensions;
    }

    if (params.dimensionFilterGroups && params.dimensionFilterGroups.length > 0) {
      body.dimensionFilterGroups = params.dimensionFilterGroups.map(group => ({
        groupType: group.groupType,
        filters: group.filters.map(f => ({
          dimension: f.dimension,
          operator: f.operator,
          expression: f.expression,
        })),
      }));
    }

    if (params.aggregationType) {
      body.aggregationType = params.aggregationType;
    }

    if (params.rowLimit !== undefined) {
      body.rowLimit = params.rowLimit;
    }

    if (params.startRow !== undefined) {
      body.startRow = params.startRow;
    }

    if (params.dataState) {
      body.dataState = params.dataState;
    }

    if (params.searchType) {
      body.type = params.searchType;
    }

    this.totalRequests++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GSC_API_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(
        `https://searchconsole.googleapis.com/webmaster-tools/v3/sites/${encodeURIComponent(this.property)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GSC API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as { rows?: GscApiRow[] };
    return data.rows ?? [];
  }

  /**
   * Get all dates in a range (mirrors PHP getAllDatesInRange)
   */
  private getAllDatesInRange(startDate?: Date, endDate?: Date): Date[] {
    const start = startDate ?? this.startDate;
    const end = endDate ?? this.endDate;

    if (!start || !end) {
      throw new Error('Both start and end dates must be set');
    }

    const dates: Date[] = [];
    const current = new Date(this.formatDate(start));

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  // ── High-Level Query Methods (mirrors PHP generators) ───────────────────────

  /**
   * Get top keywords by day (mirrors PHP getTopKeywordsByDay)
   * Uses generator pattern for memory efficiency
   */
  async *getTopKeywordsByDay(maxRowsPerDay?: number): AsyncGenerator<GscKeywordByDay> {
    const dates = this.getAllDatesInRange();

    for (const date of dates) {
      const request = this.buildQueryRequest({
        dimensions: [GSC_DIMENSIONS.DATE, GSC_DIMENSIONS.QUERY],
        startDate: date,
        endDate: date,
        aggregationType: GSC_AGGREGATION_TYPE.BY_PROPERTY,
        rowLimit: maxRowsPerDay,
      });

      const rows = await this.executeQuery(request);

      for (const row of rows) {
        yield this.convertRowToKeywordByDay(row, date);
      }
    }
  }

  /**
   * Get top URLs by day (mirrors PHP getTopUrlsByDay)
   */
  async *getTopUrlsByDay(maxRowsPerDay?: number): AsyncGenerator<GscUrlByDay> {
    const dates = this.getAllDatesInRange();

    for (const date of dates) {
      const request = this.buildQueryRequest({
        dimensions: [GSC_DIMENSIONS.DATE, GSC_DIMENSIONS.PAGE],
        startDate: date,
        endDate: date,
        aggregationType: GSC_AGGREGATION_TYPE.BY_PAGE,
        rowLimit: maxRowsPerDay,
      });

      const rows = await this.executeQuery(request);

      for (const row of rows) {
        yield this.convertRowToUrlByDay(row, date);
      }
    }
  }

  /**
   * Get top URLs with keywords by day (mirrors PHP getTopUrlsWithKeywordsByDay)
   */
  async *getTopUrlsWithKeywordsByDay(maxRowsPerDay?: number): AsyncGenerator<GscUrlWithKeywordByDay> {
    const dates = this.getAllDatesInRange();

    for (const date of dates) {
      const request = this.buildQueryRequest({
        dimensions: [GSC_DIMENSIONS.DATE, GSC_DIMENSIONS.PAGE, GSC_DIMENSIONS.QUERY],
        startDate: date,
        endDate: date,
        aggregationType: GSC_AGGREGATION_TYPE.BY_PAGE,
        rowLimit: maxRowsPerDay,
      });

      const rows = await this.executeQuery(request);

      for (const row of rows) {
        yield this.convertRowToUrlWithKeywordByDay(row, date);
      }
    }
  }

  /**
   * Get search performance aggregated by date (mirrors PHP getSearchPerformanceByDate)
   */
  async *getSearchPerformanceByDate(): AsyncGenerator<GscPerformanceByDate> {
    const dates = this.getAllDatesInRange();

    for (const date of dates) {
      const request = this.buildQueryRequest({
        dimensions: [GSC_DIMENSIONS.DATE],
        startDate: date,
        endDate: date,
        aggregationType: GSC_AGGREGATION_TYPE.BY_PROPERTY,
        rowLimit: 1,
      });

      const rows = await this.executeQuery(request);

      for (const row of rows) {
        yield this.convertRowToPerformanceByDate(row, date);
      }
    }
  }

  /**
   * Get full search performance by URL with pagination (mirrors PHP getSearchPerformanceByUrl)
   */
  async *getSearchPerformanceByUrl(): AsyncGenerator<GscPerformanceByUrl> {
    const dates = this.getAllDatesInRange();
    let currentStartRow = 0;
    const maxRowsPerRequest = MAX_ROWS_PER_REQUEST;

    while (dates.length > 0) {
      const dateResults: Record<string, number> = {};

      for (const date of dates) {
        const request = this.buildQueryRequest({
          dimensions: [
            GSC_DIMENSIONS.DATE,
            GSC_DIMENSIONS.PAGE,
            GSC_DIMENSIONS.QUERY,
            GSC_DIMENSIONS.COUNTRY,
            GSC_DIMENSIONS.DEVICE,
          ],
          startDate: date,
          endDate: date,
          aggregationType: GSC_AGGREGATION_TYPE.BY_PAGE,
          rowLimit: maxRowsPerRequest,
          startRow: currentStartRow,
        });

        const rows = await this.executeQuery(request);

        for (const row of rows) {
          yield this.convertRowToFullPerformance(row);

          // Track how many rows returned per date
          const dateKey = row.keys[0];
          dateResults[dateKey] = (dateResults[dateKey] ?? 0) + 1;
        }
      }

      // Filter dates that returned full quota (may need another page)
      dates.splice(0, dates.length,
        ...dates.filter(d => {
          const dateStr = this.formatDate(d);
          return dateResults[dateStr] === maxRowsPerRequest;
        })
      );

      currentStartRow += maxRowsPerRequest;
    }
  }

  // ── Batch Processing (mirrors PHP BatchProcessor) ─────────────────────────

  /**
   * Execute queries in batches with automatic pagination
   * Mirrors PHP BatchProcessor::processInBatches
   */
  async *executeQueryInBatches<T>(
    items: Date[],
    requestBuilder: (date: Date) => GscQueryRequest,
    rowConverter: (row: GscApiRow, date: Date) => T,
    options?: {
      batchSize?: number;
      maxRetries?: number;
      onError?: (error: Error, item: Date) => void;
    }
  ): AsyncGenerator<T> {
    const batchSize = options?.batchSize ?? this.batchConfig.batchSize;
    const maxRetries = options?.maxRetries ?? this.batchConfig.maxRetries;
    const onError = options?.onError;

    // Process in chunks
    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);

      try {
        for (const itemDate of chunk) {
          const request = requestBuilder(itemDate);
          const rows = await this.executeQuery(request);

          for (const row of rows) {
            yield rowConverter(row, itemDate);
          }
        }
      } catch (error) {
        if (chunk.length > 1 && maxRetries > 0) {
          // Retry with half batch size
          const halfBatch = Math.floor(chunk.length / 2);
          for (let j = 0; j < chunk.length; j += halfBatch) {
            const subChunk = chunk.slice(j, j + halfBatch);
            try {
              for (const retryDate of subChunk) {
                const request = requestBuilder(retryDate);
                const rows = await this.executeQuery(request);
                for (const row of rows) {
                  yield rowConverter(row, retryDate);
                }
              }
            } catch (retryError) {
              if (onError) {
                for (const failedDate of subChunk) {
                  onError(retryError as Error, failedDate);
                }
              }
            }
          }
        } else if (onError) {
          for (const errDate of chunk) {
            onError(error as Error, errDate);
          }
        }
      }
    }
  }

  // ── Row Converters (mirrors PHP conversion methods) ────────────────────────

  private convertRowToKeywordByDay(row: GscApiRow, date: Date): GscKeywordByDay {
    return {
      data_date: row.keys[0],
      site_url: this.property ?? '',
      query: row.keys[1] ?? '',
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      sum_top_position: (row.position - 1) * row.impressions,
    };
  }

  private convertRowToUrlByDay(row: GscApiRow, date: Date): GscUrlByDay {
    return {
      data_date: row.keys[0],
      site_url: this.property ?? '',
      url: row.keys[1] ?? '',
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      sum_top_position: (row.position - 1) * row.impressions,
    };
  }

  private convertRowToUrlWithKeywordByDay(row: GscApiRow, date: Date): GscUrlWithKeywordByDay {
    return {
      data_date: row.keys[0],
      site_url: this.property ?? '',
      url: row.keys[1] ?? null,
      query: row.keys[2] ?? null,
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      sum_top_position: (row.position - 1) * row.impressions,
    };
  }

  private convertRowToPerformanceByDate(row: GscApiRow, date: Date): GscPerformanceByDate {
    return {
      data_date: row.keys[0],
      site_url: this.property ?? '',
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      sum_top_position: (row.position - 1) * row.impressions,
    };
  }

  private convertRowToFullPerformance(row: GscApiRow): GscPerformanceByUrl {
    return {
      data_date: row.keys[0],
      site_url: this.property ?? '',
      url: row.keys[1] ?? '',
      query: row.keys[2] ?? null,
      country: row.keys[3] ?? null,
      device: row.keys[4] ?? null,
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      sum_top_position: (row.position - 1) * row.impressions,
    };
  }

  // ── Utility Methods ─────────────────────────────────────────────────────────

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeRowLimit(rowLimit?: number): number {
    if (rowLimit === undefined || rowLimit === null) {
      return DEFAULT_ROWS_PER_REQUEST;
    }
    if (rowLimit <= 0) return 0;
    return Math.min(rowLimit, MAX_ROWS_PER_REQUEST);
  }

  /**
   * Get request metrics
   */
  getRequestsPerSecond(): number {
    const runtime = Math.max(0.001, (Date.now() - this.requestStartTime) / 1000);
    return this.totalRequests / runtime;
  }

  getTotalRequests(): number {
    return this.totalRequests;
  }

  /**
   * Reset request counter
   */
  resetRequestCounter(): void {
    this.totalRequests = 0;
    this.requestStartTime = Date.now();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION — creates configured GscService instance
// ─────────────────────────────────────────────────────────────────────────────

export interface GscServiceOptions {
  serviceAccountEmail: string;
  serviceAccountKey: string;
}

/**
 * Create a new GscService instance from environment variables
 */
export function createGscService(): GscService {
  const email = process.env.GSC_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GSC_SERVICE_ACCOUNT_KEY;

  if (!email || !key) {
    throw new Error(
      'GSC Service Account not configured. Set GSC_SERVICE_ACCOUNT_EMAIL and GSC_SERVICE_ACCOUNT_KEY environment variables.'
    );
  }

  return new GscService({
    serviceAccountEmail: email,
    serviceAccountKey: key,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS for convenience
// ─────────────────────────────────────────────────────────────────────────────

export {
  MAX_ROWS_PER_REQUEST,
  DEFAULT_ROWS_PER_REQUEST,
  MAX_BATCH_SIZE,
  DEFAULT_BATCH_SIZE,
  DOMAIN_PROPERTY_PREFIX,
};
