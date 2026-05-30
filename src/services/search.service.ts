/**
 * Search Service for FileMaker DDR entities
 */

import { SearchQuery, SearchResult, SearchMatch, EntityType } from '../models';
import { databaseService } from './database.service';

interface PendingSearch {
  timer: NodeJS.Timeout;
  resolve: (value: SearchResult[] | PromiseLike<SearchResult[]>) => void;
  reject: (reason?: unknown) => void;
  query: SearchQuery;
  cancelled: boolean;
}

export class SearchService {
  private pending: Map<string, PendingSearch> = new Map();
  private debounceMs = 300;

  /**
   * Perform a debounced search. A token can be supplied to allow cancellation of a pending search.
   * If the same token is reused before the debounce fires, the previous pending search is cancelled.
   */
  async searchWithDebounce(query: SearchQuery, token?: string): Promise<SearchResult[]> {
    const key = token || this.generateToken();
    // Cancel existing pending search with same key
    const existing = this.pending.get(key);
    if (existing) {
      existing.cancelled = true;
      clearTimeout(existing.timer);
      existing.reject(new Error('Search cancelled (superseded by new request)'));
      this.pending.delete(key);
    }

    return new Promise<SearchResult[]>((resolve, reject) => {
      const timer = setTimeout(async () => {
        const entry = this.pending.get(key);
        if (!entry || entry.cancelled) {
          return; // Already cancelled
        }
        try {
          const raw = await databaseService.searchEntities(
            query.projectId,
            query.query,
            query.entityTypes
          );
          const mapped = raw.map(result => ({
            entityType: result.entityType as EntityType,
            entityId: result.entityId,
            entityName: result.entityName,
            matches: this.findMatches(result.context || '', query.query),
            score: this.calculateScore(result.entityName, query.query),
          }));
          resolve(mapped);
        } catch (err) {
          reject(err);
        } finally {
          this.pending.delete(key);
        }
      }, this.debounceMs);

      this.pending.set(key, {
        timer,
        resolve,
        reject,
        query,
        cancelled: false,
      });
    });
  }

  /** Cancel a pending search by token. Returns true if a search was cancelled. */
  cancel(token: string): boolean {
    const pending = this.pending.get(token);
    if (!pending) return false;
    pending.cancelled = true;
    clearTimeout(pending.timer);
    pending.reject(new Error('Search cancelled'));
    this.pending.delete(token);
    return true;
  }

  generateToken(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  private findMatches(text: string, query: string): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    let index = lowerText.indexOf(lowerQuery);
    while (index !== -1) {
      matches.push({
        field: 'name',
        value: text.substring(index, index + query.length),
        startIndex: index,
        endIndex: index + query.length,
        context: this.getContext(text, index, query.length),
      });

      index = lowerText.indexOf(lowerQuery, index + 1);
    }

    return matches;
  }

  private getContext(text: string, startIndex: number, matchLength: number): string {
    const contextLength = 50;
    const start = Math.max(0, startIndex - contextLength);
    const end = Math.min(text.length, startIndex + matchLength + contextLength);

    return text.substring(start, end);
  }

  private calculateScore(entityName: string, query: string): number {
    const lowerName = entityName.toLowerCase();
    const lowerQuery = query.toLowerCase();

    if (lowerName === lowerQuery) return 1.0;
    if (lowerName.startsWith(lowerQuery)) return 0.9;
    if (lowerName.includes(lowerQuery)) return 0.7;

    return 0.5;
  }
}

export const searchService = new SearchService();
