/**
 * Search Service for FileMaker DDR entities
 */

import { SearchQuery, SearchResult, SearchMatch, EntityType } from '../models';
import { databaseService } from './database.service';

export class SearchService {
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const results = await databaseService.searchEntities(
      query.projectId,
      query.query,
      query.entityTypes
    );

    return results.map(result => ({
      entityType: result.entityType as EntityType,
      entityId: result.entityId,
      entityName: result.entityName,
      matches: this.findMatches(result.context || '', query.query),
      score: this.calculateScore(result.entityName, query.query),
    }));
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
