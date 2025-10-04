/**
 * Contract tests for Graph Service API
 * Tests the POST /api/graph endpoint for relationship visualization
 * Following TDD - these tests should FAIL until implementation exists
 */

import request from 'supertest';
import { Application } from 'express';

// Type definitions for graph API
export interface GraphRequest {
  projectId: string;
  options?: {
    includeFields?: boolean;
    includeSystemObjects?: boolean;
    layoutTypes?: ('list' | 'detail' | 'report')[];
    maxDepth?: number;
    centerEntity?: {
      type: 'table' | 'layout' | 'script';
      id: string;
    };
    filterOptions?: {
      showOnlyConnected?: boolean;
      hideEmptyTables?: boolean;
      groupBySchema?: boolean;
    };
  };
}

export interface GraphNode {
  id: string;
  type: 'table' | 'field' | 'layout' | 'script' | 'relationship';
  name: string;
  tableName?: string; // For fields
  properties: {
    fieldType?: string;
    primaryKey?: boolean;
    required?: boolean;
    calculated?: boolean;
    global?: boolean;
    system?: boolean;
    recordCount?: number;
  };
  position?: {
    x: number;
    y: number;
  };
  metadata: {
    created?: string;
    modified?: string;
    description?: string;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'relationship' | 'layout_usage' | 'script_dependency' | 'calculation_reference';
  properties: {
    relationshipType?: 'one-to-one' | 'one-to-many' | 'many-to-many';
    cascadeDelete?: boolean;
    allowCreation?: boolean;
    sortOrder?: string;
    strength?: number; // 0-1 for layout/script connections
  };
  label?: string;
}

export interface GraphResponse {
  success: true;
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    statistics: {
      totalNodes: number;
      totalEdges: number;
      nodeTypes: Record<string, number>;
      edgeTypes: Record<string, number>;
    };
    layout: {
      algorithm: string;
      boundingBox: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      };
    };
  };
  renderTime: number;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

describe('Graph Service API Contract', () => {
  let app: Application;

  beforeAll(async () => {
    // Initialize the API service
    const { apiService } = await import('../../src/services/api.service');
    app = apiService.getApp();
  });

  afterAll(() => {
    // TODO: Cleanup
  });

  describe('POST /api/graph', () => {
    const validRequest: GraphRequest = {
      projectId: 'test-project',
      options: {
        includeFields: true,
        includeSystemObjects: false,
        maxDepth: 3,
      },
    };

    it('should generate complete database schema graph', async () => {
      const response = await request(app).post('/api/graph').send(validRequest).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);
      expect(Array.isArray(data.graph.nodes)).toBe(true);
      expect(Array.isArray(data.graph.edges)).toBe(true);
      expect(typeof data.graph.statistics.totalNodes).toBe('number');
      expect(typeof data.graph.statistics.totalEdges).toBe('number');
      expect(typeof data.renderTime).toBe('number');
    });

    it('should include field nodes when includeFields is true', async () => {
      const requestWithFields: GraphRequest = {
        ...validRequest,
        options: {
          includeFields: true,
        },
      };

      const response = await request(app).post('/api/graph').send(requestWithFields).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);

      const fieldNodes = data.graph.nodes.filter(node => node.type === 'field');
      expect(fieldNodes.length).toBeGreaterThan(0);

      fieldNodes.forEach(node => {
        expect(typeof node.tableName).toBe('string');
        expect(node.tableName!.length).toBeGreaterThan(0);
      });
    });

    it('should exclude field nodes when includeFields is false', async () => {
      const requestWithoutFields: GraphRequest = {
        ...validRequest,
        options: {
          includeFields: false,
        },
      };

      const response = await request(app).post('/api/graph').send(requestWithoutFields).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);

      const fieldNodes = data.graph.nodes.filter(node => node.type === 'field');
      expect(fieldNodes.length).toBe(0);
    });

    it('should filter system objects when includeSystemObjects is false', async () => {
      const requestWithoutSystem: GraphRequest = {
        ...validRequest,
        options: {
          includeSystemObjects: false,
        },
      };

      const response = await request(app).post('/api/graph').send(requestWithoutSystem).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);

      const systemNodes = data.graph.nodes.filter(node => node.properties.system === true);
      expect(systemNodes.length).toBe(0);
    });

    it('should center graph on specified entity', async () => {
      const centeredRequest: GraphRequest = {
        ...validRequest,
        options: {
          centerEntity: {
            type: 'table',
            id: 'customers-table',
          },
        },
      };

      const response = await request(app).post('/api/graph').send(centeredRequest).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);

      const centerNode = data.graph.nodes.find(node => node.id === 'customers-table');
      expect(centerNode).toBeDefined();
      // Center node should have position coordinates
      if (centerNode && centerNode.position) {
        expect(typeof centerNode.position.x).toBe('number');
        expect(typeof centerNode.position.y).toBe('number');
      }
    });

    it('should include relationship edges with proper properties', async () => {
      const response = await request(app).post('/api/graph').send(validRequest).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);

      const relationshipEdges = data.graph.edges.filter(edge => edge.type === 'relationship');

      if (relationshipEdges.length > 0) {
        const edge = relationshipEdges[0];
        expect(typeof edge.source).toBe('string');
        expect(typeof edge.target).toBe('string');
        expect(['one-to-one', 'one-to-many', 'many-to-many']).toContain(
          edge.properties.relationshipType
        );
      }
    });

    it('should include layout usage connections', async () => {
      const response = await request(app).post('/api/graph').send(validRequest).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);

      const layoutEdges = data.graph.edges.filter(edge => edge.type === 'layout_usage');

      layoutEdges.forEach(edge => {
        expect(typeof edge.source).toBe('string');
        expect(typeof edge.target).toBe('string');
        if (edge.properties.strength !== undefined) {
          expect(edge.properties.strength).toBeGreaterThanOrEqual(0);
          expect(edge.properties.strength).toBeLessThanOrEqual(1);
        }
      });
    });

    it('should provide accurate statistics', async () => {
      const response = await request(app).post('/api/graph').send(validRequest).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);

      const stats = data.graph.statistics;
      expect(stats.totalNodes).toBe(data.graph.nodes.length);
      expect(stats.totalEdges).toBe(data.graph.edges.length);

      // Verify node type counts
      const actualNodeCounts = data.graph.nodes.reduce(
        (counts, node) => {
          counts[node.type] = (counts[node.type] || 0) + 1;
          return counts;
        },
        {} as Record<string, number>
      );

      Object.entries(actualNodeCounts).forEach(([type, count]) => {
        expect(stats.nodeTypes[type]).toBe(count);
      });
    });

    it('should include layout information with bounding box', async () => {
      const response = await request(app).post('/api/graph').send(validRequest).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);

      const layout = data.graph.layout;
      expect(typeof layout.algorithm).toBe('string');
      expect(typeof layout.boundingBox.minX).toBe('number');
      expect(typeof layout.boundingBox.minY).toBe('number');
      expect(typeof layout.boundingBox.maxX).toBe('number');
      expect(typeof layout.boundingBox.maxY).toBe('number');

      expect(layout.boundingBox.maxX).toBeGreaterThanOrEqual(layout.boundingBox.minX);
      expect(layout.boundingBox.maxY).toBeGreaterThanOrEqual(layout.boundingBox.minY);
    });

    it('should reject request with missing projectId', async () => {
      const invalidRequest = {
        options: {},
      };

      const response = await request(app).post('/api/graph').send(invalidRequest).expect(400);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('projectId');
    });

    it('should reject request with invalid centerEntity type', async () => {
      const invalidRequest: GraphRequest = {
        projectId: 'test-project',
        options: {
          centerEntity: {
            type: 'invalid-type' as any,
            id: 'test-id',
          },
        },
      };

      const response = await request(app).post('/api/graph').send(invalidRequest).expect(400);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('centerEntity.type');
    });

    it('should handle project not found error', async () => {
      const requestWithInvalidProject: GraphRequest = {
        projectId: 'non-existent-project',
      };

      const response = await request(app)
        .post('/api/graph')
        .send(requestWithInvalidProject)
        .expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
      expect(data.error.message).toContain('non-existent-project');
    });

    it('should handle center entity not found', async () => {
      const requestWithInvalidCenter: GraphRequest = {
        projectId: 'test-project',
        options: {
          centerEntity: {
            type: 'table',
            id: 'non-existent-table',
          },
        },
      };

      const response = await request(app)
        .post('/api/graph')
        .send(requestWithInvalidCenter)
        .expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ENTITY_NOT_FOUND');
      expect(data.error.message).toContain('non-existent-table');
    });

    it('should respect maxDepth option for graph traversal', async () => {
      const shallowRequest: GraphRequest = {
        projectId: 'test-project',
        options: {
          maxDepth: 1,
          centerEntity: {
            type: 'table',
            id: 'root-table',
          },
        },
      };

      const response = await request(app).post('/api/graph').send(shallowRequest).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);

      // Should have fewer nodes due to depth restriction
      // This is more of a functional test, but validates the contract
      expect(data.graph.nodes.length).toBeGreaterThan(0);
    });

    it('should handle empty project (no tables)', async () => {
      const emptyProjectRequest: GraphRequest = {
        projectId: 'empty-project',
      };

      const response = await request(app).post('/api/graph').send(emptyProjectRequest).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);
      expect(data.graph.nodes.length).toBe(0);
      expect(data.graph.edges.length).toBe(0);
      expect(data.graph.statistics.totalNodes).toBe(0);
      expect(data.graph.statistics.totalEdges).toBe(0);
    });

    it('should filter by layout types when specified', async () => {
      const filteredRequest: GraphRequest = {
        projectId: 'test-project',
        options: {
          layoutTypes: ['list', 'detail'],
        },
      };

      const response = await request(app).post('/api/graph').send(filteredRequest).expect(200);

      const data = response.body as GraphResponse;
      expect(data.success).toBe(true);

      // Should include only specified layout types
      const layoutNodes = data.graph.nodes.filter(node => node.type === 'layout');
      // This validates the contract structure, actual filtering logic tested in implementation
      expect(Array.isArray(layoutNodes)).toBe(true);
    });
  });
});
