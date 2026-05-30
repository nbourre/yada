/**
 * PerformanceMetricsService
 * Simple in-memory aggregation of parse and search timings per project.
 * Not persisted; resets on process restart. Suitable for initial Task 7.
 */
export interface ProjectPerformanceMetrics {
  projectId: string;
  parseEvents: number[]; // ms durations
  searchEvents: number[]; // ms durations
  firstParseAt?: Date;
  lastParseAt?: Date;
  lastSearchAt?: Date;
}

export interface AggregatedPerformanceMetrics {
  projectId: string;
  parse: {
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    lastMs: number | null;
    lastAt?: Date;
  };
  search: {
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    lastMs: number | null;
    lastAt?: Date;
  };
}

class PerformanceMetricsService {
  private metrics: Map<string, ProjectPerformanceMetrics> = new Map();

  recordParse(projectId: string, durationMs: number): void {
    const entry = this.metrics.get(projectId) || {
      projectId,
      parseEvents: [],
      searchEvents: [],
    };
    entry.parseEvents.push(durationMs);
    entry.lastParseAt = new Date();
    if (!entry.firstParseAt) entry.firstParseAt = entry.lastParseAt;
    this.metrics.set(projectId, entry);
  }

  recordSearch(projectId: string, durationMs: number): void {
    const entry = this.metrics.get(projectId) || {
      projectId,
      parseEvents: [],
      searchEvents: [],
    };
    entry.searchEvents.push(durationMs);
    entry.lastSearchAt = new Date();
    this.metrics.set(projectId, entry);
  }

  getAggregated(projectId: string): AggregatedPerformanceMetrics | null {
    const entry = this.metrics.get(projectId);
    if (!entry) return null;
    const agg = (values: number[], lastAt?: Date) => {
      if (values.length === 0) {
        return { count: 0, avgMs: 0, minMs: 0, maxMs: 0, lastMs: null, lastAt };
      }
      const sum = values.reduce((a, b) => a + b, 0);
      return {
        count: values.length,
        avgMs: sum / values.length,
        minMs: Math.min(...values),
        maxMs: Math.max(...values),
        lastMs: values[values.length - 1],
        lastAt,
      };
    };
    return {
      projectId,
      parse: agg(entry.parseEvents, entry.lastParseAt),
      search: agg(entry.searchEvents, entry.lastSearchAt),
    };
  }
}

export const performanceMetricsService = new PerformanceMetricsService();
