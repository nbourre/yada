/**
 * Contract tests for Export Service API
 * Tests the POST /api/export endpoint for data export functionality
 * Following TDD - these tests should FAIL until implementation exists
 */

import request from 'supertest';
import { Application } from 'express';

// Type definitions for export API
export interface ExportRequest {
  projectId: string;
  format: 'json' | 'xml' | 'csv' | 'excel' | 'pdf' | 'html';
  options?: {
    includeSystemObjects?: boolean;
    includeFields?: boolean;
    includeData?: boolean;
    filterOptions?: {
      entityTypes?: ('table' | 'field' | 'layout' | 'script' | 'relationship')[];
      tableNames?: string[];
      scriptNames?: string[];
      layoutNames?: string[];
    };
    formatting?: {
      indent?: boolean;
      includeComments?: boolean;
      dateFormat?: string;
      encoding?: 'utf-8' | 'utf-16' | 'ascii';
    };
  };
}

export interface ExportResponse {
  success: true;
  export: {
    format: string;
    size: number;
    filename: string;
    downloadUrl: string;
    expires: string; // ISO date string
    metadata: {
      projectName: string;
      exportDate: string;
      version: string;
      entityCounts: Record<string, number>;
    };
  };
  processingTime: number;
}

export interface StreamExportResponse {
  success: true;
  stream: {
    contentType: string;
    contentLength?: number;
    filename: string;
    // Stream data would be in response body
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

describe('Export Service API Contract', () => {
  let app: Application;

  beforeAll(async () => {
    // Initialize the API service
    const { apiService } = await import('../../src/services/api.service');
    app = apiService.getApp();
  });

  afterAll(() => {
    // TODO: Cleanup
  });

  describe('POST /api/export', () => {
    const validRequest: ExportRequest = {
      projectId: 'test-project',
      format: 'json',
      options: {
        includeSystemObjects: false,
        includeFields: true,
        includeData: false,
      },
    };

    it('should export project as JSON format', async () => {
      const response = await request(app).post('/api/export').send(validRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);
      expect(data.export.format).toBe('json');
      expect(typeof data.export.size).toBe('number');
      expect(typeof data.export.filename).toBe('string');
      expect(typeof data.export.downloadUrl).toBe('string');
      expect(typeof data.export.expires).toBe('string');
      expect(typeof data.processingTime).toBe('number');
    });

    it('should export project as XML format', async () => {
      const xmlRequest: ExportRequest = {
        ...validRequest,
        format: 'xml',
      };

      const response = await request(app).post('/api/export').send(xmlRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);
      expect(data.export.format).toBe('xml');
      expect(data.export.filename.endsWith('.xml')).toBe(true);
    });

    it('should export project as CSV format', async () => {
      const csvRequest: ExportRequest = {
        ...validRequest,
        format: 'csv',
      };

      const response = await request(app).post('/api/export').send(csvRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);
      expect(data.export.format).toBe('csv');
      expect(data.export.filename.endsWith('.csv')).toBe(true);
    });

    it('should export project as Excel format', async () => {
      const excelRequest: ExportRequest = {
        ...validRequest,
        format: 'excel',
      };

      const response = await request(app).post('/api/export').send(excelRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);
      expect(data.export.format).toBe('excel');
      expect(data.export.filename.endsWith('.xlsx')).toBe(true);
    });

    it('should export project as PDF format', async () => {
      const pdfRequest: ExportRequest = {
        ...validRequest,
        format: 'pdf',
      };

      const response = await request(app).post('/api/export').send(pdfRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);
      expect(data.export.format).toBe('pdf');
      expect(data.export.filename.endsWith('.pdf')).toBe(true);
    });

    it('should export project as HTML format', async () => {
      const htmlRequest: ExportRequest = {
        ...validRequest,
        format: 'html',
      };

      const response = await request(app).post('/api/export').send(htmlRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);
      expect(data.export.format).toBe('html');
      expect(data.export.filename.endsWith('.html')).toBe(true);
    });

    it('should filter by entity types when specified', async () => {
      const filteredRequest: ExportRequest = {
        ...validRequest,
        options: {
          ...validRequest.options,
          filterOptions: {
            entityTypes: ['table', 'field'],
          },
        },
      };

      const response = await request(app).post('/api/export').send(filteredRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);

      // Should only include table and field counts in metadata
      const entityTypes = Object.keys(data.export.metadata.entityCounts);
      entityTypes.forEach(type => {
        expect(['table', 'field']).toContain(type);
      });
    });

    it('should filter by specific table names', async () => {
      const tableFilterRequest: ExportRequest = {
        ...validRequest,
        options: {
          ...validRequest.options,
          filterOptions: {
            tableNames: ['customers', 'orders'],
          },
        },
      };

      const response = await request(app).post('/api/export').send(tableFilterRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);
      // Should have smaller size due to filtering
      expect(typeof data.export.size).toBe('number');
    });

    it('should include system objects when requested', async () => {
      const systemRequest: ExportRequest = {
        ...validRequest,
        options: {
          ...validRequest.options,
          includeSystemObjects: true,
        },
      };

      const response = await request(app).post('/api/export').send(systemRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);
      // Should have larger size with system objects
      expect(data.export.size).toBeGreaterThan(0);
    });

    it('should include data when requested', async () => {
      const dataRequest: ExportRequest = {
        ...validRequest,
        options: {
          ...validRequest.options,
          includeData: true,
        },
      };

      const response = await request(app).post('/api/export').send(dataRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);
      // Should have much larger size with data
      expect(data.export.size).toBeGreaterThan(0);
    });

    it('should apply formatting options', async () => {
      const formattedRequest: ExportRequest = {
        ...validRequest,
        options: {
          ...validRequest.options,
          formatting: {
            indent: true,
            includeComments: true,
            dateFormat: 'YYYY-MM-DD',
            encoding: 'utf-8',
          },
        },
      };

      const response = await request(app).post('/api/export').send(formattedRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);
      // Indented format should be larger than compact
      expect(data.export.size).toBeGreaterThan(0);
    });

    it('should include proper metadata', async () => {
      const response = await request(app).post('/api/export').send(validRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);

      const metadata = data.export.metadata;
      expect(typeof metadata.projectName).toBe('string');
      expect(typeof metadata.exportDate).toBe('string');
      expect(typeof metadata.version).toBe('string');
      expect(typeof metadata.entityCounts).toBe('object');

      // Validate date format
      expect(new Date(metadata.exportDate).toISOString()).toBe(metadata.exportDate);
    });

    it('should provide valid download URL', async () => {
      const response = await request(app).post('/api/export').send(validRequest).expect(200);

      const data = response.body as ExportResponse;
      expect(data.success).toBe(true);

      expect(data.export.downloadUrl.startsWith('http')).toBe(true);
      expect(typeof data.export.expires).toBe('string');

      // Expires should be in the future
      const expiresDate = new Date(data.export.expires);
      const now = new Date();
      expect(expiresDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should reject request with missing projectId', async () => {
      const invalidRequest = {
        format: 'json',
      };

      const response = await request(app).post('/api/export').send(invalidRequest).expect(400);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('projectId');
    });

    it('should reject request with missing format', async () => {
      const invalidRequest = {
        projectId: 'test-project',
      };

      const response = await request(app).post('/api/export').send(invalidRequest).expect(400);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('format');
    });

    it('should reject request with invalid format', async () => {
      const invalidRequest: ExportRequest = {
        projectId: 'test-project',
        format: 'invalid-format' as any,
      };

      const response = await request(app).post('/api/export').send(invalidRequest).expect(400);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('format');
    });

    it('should handle project not found error', async () => {
      const requestWithInvalidProject: ExportRequest = {
        projectId: 'non-existent-project',
        format: 'json',
      };

      const response = await request(app)
        .post('/api/export')
        .send(requestWithInvalidProject)
        .expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
      expect(data.error.message).toContain('non-existent-project');
    });

    it('should handle large export timeout', async () => {
      const largeExportRequest: ExportRequest = {
        projectId: 'very-large-project',
        format: 'json',
        options: {
          includeData: true,
          includeFields: true,
          includeSystemObjects: true,
        },
      };

      const response = await request(app).post('/api/export').send(largeExportRequest).expect(408);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('EXPORT_TIMEOUT');
    });

    it('should handle export format not supported for data', async () => {
      const unsupportedRequest: ExportRequest = {
        projectId: 'test-project',
        format: 'pdf',
        options: {
          includeData: true,
        },
      };

      const response = await request(app).post('/api/export').send(unsupportedRequest).expect(400);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORMAT_NOT_SUPPORTED');
      expect(data.error.message).toContain('PDF format does not support data export');
    });
  });

  describe('POST /api/export/stream', () => {
    it('should stream export directly for large files', async () => {
      const streamRequest: ExportRequest = {
        projectId: 'test-project',
        format: 'json',
      };

      const response = await request(app)
        .post('/api/export/stream')
        .send(streamRequest)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
      // Response body would contain the actual file content
    });

    it('should set proper headers for different formats', async () => {
      const csvStreamRequest: ExportRequest = {
        projectId: 'test-project',
        format: 'csv',
      };

      const response = await request(app)
        .post('/api/export/stream')
        .send(csvStreamRequest)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('.csv');
    });
  });
});
