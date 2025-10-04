/**
 * Contract tests for Search Service API
 * Tests the POST /api/search endpoint for entity searching functionality
 * Following TDD - these tests should FAIL until implementation exists
 */

import request from 'supertest';
import { Application } from 'express';

// Type definitions for search API
export interface SearchRequest {
  projectId: string;
  query: string;
  entityTypes?: ('table' | 'field' | 'layout' | 'script' | 'relationship')[];
  options?: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    includeSystemObjects?: boolean;
    maxResults?: number;
  };
}

export interface SearchResult {
  entityType: 'table' | 'field' | 'layout' | 'script' | 'relationship';
  entityId: string;
  entityName: string;
  tableName?: string; // For fields
  matches: Array<{
    field: string;
    value: string;
    highlightStart: number;
    highlightEnd: number;
  }>;
  relevanceScore: number;
}

export interface SearchResponse {
  success: true;
  results: SearchResult[];
  totalCount: number;
  searchTime: number;
  query: {
    original: string;
    normalized: string;
    entityTypes: string[];
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

describe('Search Service API Contract', () => {
  let app: Application;

  beforeAll(async () => {
    // Initialize the API service
    const { apiService } = await import('../../src/services/api.service');
    app = apiService.getApp();
  });

  afterAll(() => {
    // TODO: Cleanup
  });

  describe('POST /api/search', () => {
    const validRequest: SearchRequest = {
      projectId: 'test-project',
      query: 'customer',
      entityTypes: ['table', 'field'],
      options: {
        caseSensitive: false,
        wholeWord: false,
        maxResults: 100,
      },
    };

    it('should perform basic text search across entities', async () => {
      const response = await request(app).post('/api/search').send(validRequest).expect(200);

      const data = response.body as SearchResponse;
      expect(data.success).toBe(true);
      expect(Array.isArray(data.results)).toBe(true);
      expect(typeof data.totalCount).toBe('number');
      expect(typeof data.searchTime).toBe('number');
      expect(data.query.original).toBe('customer');
      expect(Array.isArray(data.query.entityTypes)).toBe(true);
    });

    it('should filter by entity types when specified', async () => {
      const tableOnlyRequest: SearchRequest = {
        ...validRequest,
        entityTypes: ['table'],
      };

      const response = await request(app).post('/api/search').send(tableOnlyRequest).expect(200);

      const data = response.body as SearchResponse;
      expect(data.success).toBe(true);
      data.results.forEach(result => {
        expect(result.entityType).toBe('table');
      });
    });

    it('should handle case sensitive search option', async () => {
      const caseSensitiveRequest: SearchRequest = {
        ...validRequest,
        query: 'Customer',
        options: {
          caseSensitive: true,
        },
      };

      const response = await request(app)
        .post('/api/search')
        .send(caseSensitiveRequest)
        .expect(200);

      const data = response.body as SearchResponse;
      expect(data.success).toBe(true);
      // Results should only include exact case matches
    });

    it('should handle whole word search option', async () => {
      const wholeWordRequest: SearchRequest = {
        ...validRequest,
        query: 'name',
        options: {
          wholeWord: true,
        },
      };

      const response = await request(app).post('/api/search').send(wholeWordRequest).expect(200);

      const data = response.body as SearchResponse;
      expect(data.success).toBe(true);
      // Results should only include whole word matches, not partial matches like "filename"
    });

    it('should limit results when maxResults is specified', async () => {
      const limitedRequest: SearchRequest = {
        ...validRequest,
        options: {
          maxResults: 5,
        },
      };

      const response = await request(app).post('/api/search').send(limitedRequest).expect(200);

      const data = response.body as SearchResponse;
      expect(data.success).toBe(true);
      expect(data.results.length).toBeLessThanOrEqual(5);
    });

    it('should include highlight information in matches', async () => {
      const response = await request(app).post('/api/search').send(validRequest).expect(200);

      const data = response.body as SearchResponse;
      expect(data.success).toBe(true);

      if (data.results.length > 0) {
        const result = data.results[0];
        expect(Array.isArray(result.matches)).toBe(true);
        if (result.matches.length > 0) {
          const match = result.matches[0];
          expect(typeof match.field).toBe('string');
          expect(typeof match.value).toBe('string');
          expect(typeof match.highlightStart).toBe('number');
          expect(typeof match.highlightEnd).toBe('number');
          expect(match.highlightStart).toBeLessThan(match.highlightEnd);
        }
      }
    });

    it('should reject request with missing projectId', async () => {
      const invalidRequest = {
        query: 'test',
      };

      const response = await request(app).post('/api/search').send(invalidRequest).expect(400);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('projectId');
    });

    it('should reject request with empty query', async () => {
      const invalidRequest: SearchRequest = {
        projectId: 'test-project',
        query: '',
      };

      const response = await request(app).post('/api/search').send(invalidRequest).expect(400);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('query');
    });

    it('should reject request with invalid entity type', async () => {
      const invalidRequest = {
        projectId: 'test-project',
        query: 'test',
        entityTypes: ['invalid-type'],
      };

      const response = await request(app).post('/api/search').send(invalidRequest).expect(400);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('entityTypes');
    });

    it('should handle project not found error', async () => {
      const requestWithInvalidProject: SearchRequest = {
        projectId: 'non-existent-project',
        query: 'test',
      };

      const response = await request(app)
        .post('/api/search')
        .send(requestWithInvalidProject)
        .expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
      expect(data.error.message).toContain('non-existent-project');
    });

    it('should return empty results for no matches', async () => {
      const noMatchRequest: SearchRequest = {
        projectId: 'test-project',
        query: 'xyz_nonexistent_term_xyz',
      };

      const response = await request(app).post('/api/search').send(noMatchRequest).expect(200);

      const data = response.body as SearchResponse;
      expect(data.success).toBe(true);
      expect(data.results).toEqual([]);
      expect(data.totalCount).toBe(0);
    });

    it('should sort results by relevance score', async () => {
      const response = await request(app).post('/api/search').send(validRequest).expect(200);

      const data = response.body as SearchResponse;
      expect(data.success).toBe(true);

      if (data.results.length > 1) {
        for (let i = 1; i < data.results.length; i++) {
          expect(data.results[i - 1].relevanceScore).toBeGreaterThanOrEqual(
            data.results[i].relevanceScore
          );
        }
      }
    });

    it('should include field context for field matches', async () => {
      const fieldSearchRequest: SearchRequest = {
        projectId: 'test-project',
        query: 'field_name',
        entityTypes: ['field'],
      };

      const response = await request(app).post('/api/search').send(fieldSearchRequest).expect(200);

      const data = response.body as SearchResponse;
      expect(data.success).toBe(true);

      const fieldResults = data.results.filter(r => r.entityType === 'field');
      fieldResults.forEach(result => {
        expect(typeof result.tableName).toBe('string');
        expect(result.tableName!.length).toBeGreaterThan(0);
      });
    });
  });
});
