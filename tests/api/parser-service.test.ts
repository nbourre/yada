/**
 * Contract Tests for Parser Service API
 * Tests POST /api/parse-project endpoint
 *
 * These tests validate the API contract defined in contracts/parser-service.md
 * They must FAIL initially (TDD approach) until implementation exists
 */

import request from 'supertest';
import { Application } from 'express';

describe('Parser Service API Contract', () => {
  let app: Application;
  const baseURL = '/api';

  beforeAll(async () => {
    // Initialize the API service
    const { apiService } = await import('../../src/services/api.service');
    app = apiService.getApp();
  });

  afterAll(() => {
    // Cleanup test server
  });

  describe('POST /api/parse-project', () => {
    it('should accept valid project parsing request', async () => {
      const validRequest = {
        projectName: 'Sample CRM Analysis',
        files: [
          {
            path: '/path/to/CRM_UI.xml',
            role: 'ui' as const,
          },
          {
            path: '/path/to/CRM_Data.xml',
            role: 'data' as const,
          },
        ],
        options: {
          overwriteExisting: false,
          enableProgressUpdates: true,
        },
      };

      const response = await request(app)
        .post(`${baseURL}/parse-project`)
        .send(validRequest)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate response schema matches contract
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('projectId');
      expect(response.body.projectId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      // Validate metrics object structure
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('parseTimeMs');
      expect(response.body.metrics).toHaveProperty('entitiesCreated');
      expect(response.body.metrics).toHaveProperty('referencesCreated');
      expect(response.body.metrics).toHaveProperty('filesProcessed');

      expect(typeof response.body.metrics.parseTimeMs).toBe('number');
      expect(typeof response.body.metrics.referencesCreated).toBe('number');
      expect(Array.isArray(response.body.metrics.filesProcessed)).toBe(true);
    });

    it('should reject request with missing projectName', async () => {
      const invalidRequest = {
        files: [
          {
            path: '/path/to/test.xml',
            role: 'ui' as const,
          },
        ],
      };

      const response = await request(app)
        .post(`${baseURL}/parse-project`)
        .send(invalidRequest)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should reject request with empty files array', async () => {
      const invalidRequest = {
        projectName: 'Test Project',
        files: [],
      };

      const response = await request(app)
        .post(`${baseURL}/parse-project`)
        .send(invalidRequest)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should reject request with too many files', async () => {
      const invalidRequest = {
        projectName: 'Test Project',
        files: Array(15).fill({
          path: '/path/to/test.xml',
          role: 'ui' as const,
        }),
      };

      const response = await request(app)
        .post(`${baseURL}/parse-project`)
        .send(invalidRequest)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should reject request with invalid file role', async () => {
      const invalidRequest = {
        projectName: 'Test Project',
        files: [
          {
            path: '/path/to/test.xml',
            role: 'invalid_role',
          },
        ],
      };

      const response = await request(app)
        .post(`${baseURL}/parse-project`)
        .send(invalidRequest)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should handle file not found error', async () => {
      const requestWithMissingFile = {
        projectName: 'Test Project',
        files: [
          {
            path: '/nonexistent/file.xml',
            role: 'ui' as const,
          },
        ],
      };

      const response = await request(app)
        .post(`${baseURL}/parse-project`)
        .send(requestWithMissingFile)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('FILE_NOT_FOUND');
    });

    it('should handle invalid XML error', async () => {
      const requestWithInvalidXML = {
        projectName: 'Test Project',
        files: [
          {
            path: '/path/to/invalid.xml',
            role: 'ui' as const,
          },
        ],
      };

      const response = await request(app)
        .post(`${baseURL}/parse-project`)
        .send(requestWithInvalidXML)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('INVALID_XML');
    });

    it('should handle project already exists error when overwrite is false', async () => {
      const duplicateProjectRequest = {
        projectName: 'Existing Project',
        files: [
          {
            path: '/path/to/test.xml',
            role: 'ui' as const,
          },
        ],
        options: {
          overwriteExisting: false,
        },
      };

      const response = await request(app)
        .post(`${baseURL}/parse-project`)
        .send(duplicateProjectRequest)
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('PROJECT_EXISTS');
    });

    it('should include warnings in successful response', async () => {
      const requestThatGeneratesWarnings = {
        projectName: 'Project With Warnings',
        files: [
          {
            path: '/path/to/malformed.xml',
            role: 'ui' as const,
          },
        ],
      };

      const response = await request(app)
        .post(`${baseURL}/parse-project`)
        .send(requestThatGeneratesWarnings)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('warnings');
      expect(Array.isArray(response.body.warnings)).toBe(true);

      if (response.body.warnings.length > 0) {
        const warning = response.body.warnings[0];
        expect(warning).toHaveProperty('type');
        expect(warning).toHaveProperty('message');
        expect([
          'malformed_xml',
          'missing_references',
          'encoding_issue',
          'version_mismatch',
        ]).toContain(warning.type);
      }
    });
  });
});

// Type definitions for contract validation
export interface ParseProjectRequest {
  projectName: string;
  files: Array<{
    path: string;
    role: 'ui' | 'data' | 'mixed';
  }>;
  options?: {
    overwriteExisting?: boolean;
    enableProgressUpdates?: boolean;
  };
}

export interface ParseProjectResponse {
  success: boolean;
  projectId: string;
  metrics: {
    parseTimeMs: number;
    entitiesCreated: Record<string, number>;
    referencesCreated: number;
    filesProcessed: Array<{
      filename: string;
      sizeBytes: number;
      parseTimeMs: number;
      entitiesExtracted: number;
    }>;
  };
  warnings?: Array<{
    type: 'malformed_xml' | 'missing_references' | 'encoding_issue' | 'version_mismatch';
    message: string;
    filename?: string;
    lineNumber?: number;
  }>;
}

export interface ErrorResponse {
  success: false;
  error: {
    code:
      | 'FILE_NOT_FOUND'
      | 'INVALID_XML'
      | 'PARSING_ERROR'
      | 'DATABASE_ERROR'
      | 'PROJECT_EXISTS'
      | 'INSUFFICIENT_PERMISSIONS'
      | 'INVALID_INPUT';
    message: string;
    details?: Record<string, unknown>;
  };
}
