/**
 * Contract tests for Project Management Service APIs
 * Tests GET, DELETE, PUT, and other project management endpoints
 * Following TDD - these tests should FAIL until implementation exists
 */

import request from 'supertest';
import { Application } from 'express';

// Type definitions for project management APIs
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'processing';
  metadata: {
    created: string;
    modified: string;
    version: string;
    fileCount: number;
    size: number;
    author?: string;
    tags?: string[];
  };
  statistics: {
    tables: number;
    fields: number;
    layouts: number;
    scripts: number;
    relationships: number;
  };
  settings: {
    includeSystemObjects: boolean;
    autoBackup: boolean;
    compressionEnabled: boolean;
  };
}

export interface ProjectListResponse {
  success: true;
  projects: Project[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

export interface ProjectResponse {
  success: true;
  project: Project;
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'archived';
  settings?: {
    includeSystemObjects?: boolean;
    autoBackup?: boolean;
    compressionEnabled?: boolean;
  };
  metadata?: {
    author?: string;
    tags?: string[];
  };
}

export interface ProjectBackupResponse {
  success: true;
  backup: {
    id: string;
    filename: string;
    size: number;
    created: string;
    downloadUrl: string;
    expires: string;
  };
}

export interface BackupListResponse {
  success: true;
  backups: Array<{
    id: string;
    filename: string;
    size: number;
    created: string;
    type: 'manual' | 'automatic';
  }>;
}

export interface ProjectStatsResponse {
  success: true;
  statistics: {
    overview: {
      totalProjects: number;
      activeProjects: number;
      archivedProjects: number;
      totalSize: number;
    };
    recentActivity: Array<{
      projectId: string;
      projectName: string;
      action: string;
      timestamp: string;
    }>;
    topProjects: Array<{
      projectId: string;
      projectName: string;
      accessCount: number;
      lastAccessed: string;
    }>;
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

describe('Project Management Service APIs Contract', () => {
  let app: Application;

  beforeAll(async () => {
    // Initialize the API service
    const { apiService } = await import('../../src/services/api.service');
    app = apiService.getApp();
  });

  beforeEach(async () => {
    // Reset database state between tests to prevent isolation issues
    const { databaseService } = await import('../../src/services/database.service');
    databaseService.close();
    await databaseService.initialize();
  });

  afterAll(() => {
    // TODO: Cleanup
  });

  describe('GET /api/projects', () => {
    it('should list all projects with pagination', async () => {
      const response = await request(app).get('/api/projects').expect(200);

      const data = response.body as ProjectListResponse;
      expect(data.success).toBe(true);
      expect(Array.isArray(data.projects)).toBe(true);
      expect(typeof data.pagination.total).toBe('number');
      expect(typeof data.pagination.page).toBe('number');
      expect(typeof data.pagination.pageSize).toBe('number');
      expect(typeof data.pagination.hasMore).toBe('boolean');
    });

    it('should support pagination parameters', async () => {
      const response = await request(app).get('/api/projects?page=2&pageSize=5').expect(200);

      const data = response.body as ProjectListResponse;
      expect(data.success).toBe(true);
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.pageSize).toBe(5);
    });

    it('should support filtering by status', async () => {
      const response = await request(app).get('/api/projects?status=active').expect(200);

      const data = response.body as ProjectListResponse;
      expect(data.success).toBe(true);
      data.projects.forEach(project => {
        expect(project.status).toBe('active');
      });
    });

    it('should support search by name', async () => {
      const response = await request(app).get('/api/projects?search=test').expect(200);

      const data = response.body as ProjectListResponse;
      expect(data.success).toBe(true);
      // Should return projects with 'test' in name
    });

    it('should support sorting by different fields', async () => {
      const response = await request(app)
        .get('/api/projects?sortBy=modified&sortOrder=desc')
        .expect(200);

      const data = response.body as ProjectListResponse;
      expect(data.success).toBe(true);
      // Should return projects sorted by modification date descending
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get a specific project by id', async () => {
      const response = await request(app).get('/api/projects/test-project-id').expect(200);

      const data = response.body as ProjectResponse;
      expect(data.success).toBe(true);
      expect(data.project.id).toBe('test-project-id');
      expect(typeof data.project.name).toBe('string');
      expect(typeof data.project.status).toBe('string');
      expect(['active', 'archived', 'processing']).toContain(data.project.status);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app).get('/api/projects/non-existent-id').expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should include complete project metadata', async () => {
      const response = await request(app).get('/api/projects/test-project-id').expect(200);

      const data = response.body as ProjectResponse;
      const project = data.project;

      expect(typeof project.metadata.created).toBe('string');
      expect(typeof project.metadata.modified).toBe('string');
      expect(typeof project.metadata.version).toBe('string');
      expect(typeof project.metadata.fileCount).toBe('number');
      expect(typeof project.metadata.size).toBe('number');

      expect(typeof project.statistics.tables).toBe('number');
      expect(typeof project.statistics.fields).toBe('number');
      expect(typeof project.statistics.layouts).toBe('number');
      expect(typeof project.statistics.scripts).toBe('number');
      expect(typeof project.statistics.relationships).toBe('number');
    });
  });

  describe('PUT /api/projects/:id', () => {
    const updateRequest: ProjectUpdateRequest = {
      name: 'Updated Project Name',
      description: 'Updated description',
      settings: {
        autoBackup: true,
        compressionEnabled: false,
      },
    };

    it('should update a project', async () => {
      const response = await request(app)
        .put('/api/projects/test-project-id')
        .send(updateRequest)
        .expect(200);

      const data = response.body as ProjectResponse;
      expect(data.success).toBe(true);
      expect(data.project.name).toBe('Updated Project Name');
      expect(data.project.description).toBe('Updated description');
    });

    it('should update project settings', async () => {
      const settingsUpdate: ProjectUpdateRequest = {
        settings: {
          includeSystemObjects: false,
          autoBackup: true,
          compressionEnabled: true,
        },
      };

      const response = await request(app)
        .put('/api/projects/test-project-id')
        .send(settingsUpdate)
        .expect(200);

      const data = response.body as ProjectResponse;
      expect(data.success).toBe(true);
      expect(data.project.settings.autoBackup).toBe(true);
      expect(data.project.settings.compressionEnabled).toBe(true);
    });

    it('should update project status', async () => {
      const statusUpdate: ProjectUpdateRequest = {
        status: 'archived',
      };

      const response = await request(app)
        .put('/api/projects/test-project-id')
        .send(statusUpdate)
        .expect(200);

      const data = response.body as ProjectResponse;
      expect(data.success).toBe(true);
      expect(data.project.status).toBe('archived');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .put('/api/projects/non-existent-id')
        .send(updateRequest)
        .expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should validate update data', async () => {
      const invalidUpdate = {
        status: 'invalid-status',
      };

      const response = await request(app)
        .put('/api/projects/test-project-id')
        .send(invalidUpdate)
        .expect(400);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      const response = await request(app).delete('/api/projects/test-project-id').expect(200);

      const data = response.body;
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app).delete('/api/projects/non-existent-id').expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should handle delete with cascade option', async () => {
      const response = await request(app)
        .delete('/api/projects/test-project-id?cascade=true')
        .expect(200);

      const data = response.body;
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
    });

    it('should prevent deletion of active projects without confirmation', async () => {
      const response = await request(app).delete('/api/projects/active-project-id').expect(409);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_ACTIVE');
    });
  });

  describe('POST /api/projects/:id/backup', () => {
    it('should create a project backup', async () => {
      const response = await request(app).post('/api/projects/test-project-id/backup').expect(200);

      const data = response.body as ProjectBackupResponse;
      expect(data.success).toBe(true);
      expect(typeof data.backup.id).toBe('string');
      expect(typeof data.backup.filename).toBe('string');
      expect(typeof data.backup.size).toBe('number');
      expect(typeof data.backup.downloadUrl).toBe('string');
    });

    it('should create backup with custom description', async () => {
      const backupRequest = {
        description: 'Manual backup before major changes',
      };

      const response = await request(app)
        .post('/api/projects/test-project-id/backup')
        .send(backupRequest)
        .expect(200);

      const data = response.body as ProjectBackupResponse;
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app).post('/api/projects/non-existent-id/backup').expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('GET /api/projects/:id/backups', () => {
    it('should list project backups', async () => {
      const response = await request(app).get('/api/projects/test-project-id/backups').expect(200);

      const data = response.body as BackupListResponse;
      expect(data.success).toBe(true);
      expect(Array.isArray(data.backups)).toBe(true);
    });

    it('should include backup metadata', async () => {
      const response = await request(app).get('/api/projects/test-project-id/backups').expect(200);

      const data = response.body as BackupListResponse;
      if (data.backups.length > 0) {
        const backup = data.backups[0];
        expect(typeof backup.id).toBe('string');
        expect(typeof backup.filename).toBe('string');
        expect(typeof backup.size).toBe('number');
        expect(typeof backup.created).toBe('string');
        expect(['manual', 'automatic']).toContain(backup.type);
      }
    });
  });

  describe('POST /api/projects/:id/restore/:backupId', () => {
    it('should restore project from backup', async () => {
      const response = await request(app)
        .post('/api/projects/test-project-id/restore/backup-123')
        .expect(200);

      const data = response.body;
      expect(data.success).toBe(true);
      expect(data.message).toContain('restored');
    });

    it('should return 404 for non-existent backup', async () => {
      const response = await request(app)
        .post('/api/projects/test-project-id/restore/non-existent-backup')
        .expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('BACKUP_NOT_FOUND');
    });
  });

  describe('DELETE /api/projects/:id/backups/:backupId', () => {
    it('should delete a specific backup', async () => {
      const response = await request(app)
        .delete('/api/projects/test-project-id/backups/backup-123')
        .expect(200);

      const data = response.body;
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
    });

    it('should return 404 for non-existent backup', async () => {
      const response = await request(app)
        .delete('/api/projects/test-project-id/backups/non-existent-backup')
        .expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('BACKUP_NOT_FOUND');
    });
  });

  describe('GET /api/statistics', () => {
    it('should get overall project statistics', async () => {
      const response = await request(app).get('/api/statistics').expect(200);

      const data = response.body as ProjectStatsResponse;
      expect(data.success).toBe(true);

      const stats = data.statistics;
      expect(typeof stats.overview.totalProjects).toBe('number');
      expect(typeof stats.overview.activeProjects).toBe('number');
      expect(typeof stats.overview.archivedProjects).toBe('number');
      expect(typeof stats.overview.totalSize).toBe('number');

      expect(Array.isArray(stats.recentActivity)).toBe(true);
      expect(Array.isArray(stats.topProjects)).toBe(true);
    });

    it('should include recent activity data', async () => {
      const response = await request(app).get('/api/statistics').expect(200);

      const data = response.body as ProjectStatsResponse;
      if (data.statistics.recentActivity.length > 0) {
        const activity = data.statistics.recentActivity[0];
        expect(typeof activity.projectId).toBe('string');
        expect(typeof activity.projectName).toBe('string');
        expect(typeof activity.action).toBe('string');
        expect(typeof activity.timestamp).toBe('string');
      }
    });

    it('should include top projects data', async () => {
      const response = await request(app).get('/api/statistics').expect(200);

      const data = response.body as ProjectStatsResponse;
      if (data.statistics.topProjects.length > 0) {
        const topProject = data.statistics.topProjects[0];
        expect(typeof topProject.projectId).toBe('string');
        expect(typeof topProject.projectName).toBe('string');
        expect(typeof topProject.accessCount).toBe('number');
        expect(typeof topProject.lastAccessed).toBe('string');
      }
    });
  });

  describe('POST /api/projects/:id/duplicate', () => {
    it('should duplicate a project', async () => {
      const duplicateRequest = {
        name: 'Duplicated Project Name',
      };

      const response = await request(app)
        .post('/api/projects/test-project-id/duplicate')
        .send(duplicateRequest)
        .expect(201);

      const data = response.body as ProjectResponse;
      expect(data.success).toBe(true);
      expect(data.project.name).toBe('Duplicated Project Name');
      expect(data.project.id).not.toBe('test-project-id');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .post('/api/projects/non-existent-id/duplicate')
        .send({ name: 'Duplicate' })
        .expect(404);

      const data = response.body as ErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });
});
