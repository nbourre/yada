/**
 * Integration tests for POST /api/dependencies.
 * Seeds data directly via databaseService (same approach as
 * tests/services/dependency.service.test.ts) and drives the real Express
 * route through supertest.
 */

import request from 'supertest';
import { apiService } from '../../src/services/api.service';
import { databaseService } from '../../src/services/database.service';

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

describe('POST /api/dependencies', () => {
  const app = apiService.getApp();

  async function seedProjectWithField() {
    const pid = id('proj');
    await databaseService.createProject({
      id: pid,
      name: 'Test',
      filePath: '/tmp/test.xml',
      fileName: 'test.xml',
      fileSize: 100,
      parsedAt: new Date(),
      status: 'ready',
      statistics: {
        tableCount: 1,
        occurrenceCount: 0,
        fieldCount: 1,
        layoutCount: 1,
        scriptCount: 0,
        relationshipCount: 0,
        customFunctionCount: 0,
        parseTime: 1,
      },
      metadata: {
        fileMakerVersion: '19.0',
        platform: 'macOS',
        createdBy: '',
        modifiedBy: '',
        creationDate: new Date(),
        modificationDate: new Date(),
      },
    });

    const table = await databaseService.createTable({
      id: id('table'),
      projectId: pid,
      name: 'Contact',
      occurrence: 'Contact',
      isOccurrence: false,
      fields: [],
      relationships: [],
    });

    const field = await databaseService.createField({
      id: id('field'),
      projectId: pid,
      tableId: table.id,
      tableName: table.name,
      name: 'Email',
      type: 'text',
      fieldKind: 'normal',
      options: {},
    });

    await databaseService.createLayout({
      id: id('layout'),
      projectId: pid,
      name: 'ContactDetail',
      type: 'form',
      fields: [{ fieldId: field.id, fieldName: field.name, x: 0, y: 0, width: 1, height: 1 }],
      parts: [],
      scripts: [],
    });

    return { pid, field };
  }

  it('400s when required fields are missing', async () => {
    const res = await request(app).post('/api/dependencies').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400s on an invalid entityType', async () => {
    const res = await request(app)
      .post('/api/dependencies')
      .send({ projectId: 'x', entityType: 'bogus', entityId: 'y' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400s on an invalid direction', async () => {
    const res = await request(app)
      .post('/api/dependencies')
      .send({ projectId: 'x', entityType: 'field', entityId: 'y', direction: 'sideways' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('404s when the project does not exist', async () => {
    const res = await request(app)
      .post('/api/dependencies')
      .send({ projectId: 'nonexistent', entityType: 'field', entityId: 'y' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('404s when the entity does not exist in an existing project', async () => {
    const { pid } = await seedProjectWithField();
    const res = await request(app)
      .post('/api/dependencies')
      .send({ projectId: pid, entityType: 'field', entityId: 'nonexistent' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ENTITY_NOT_FOUND');
  });

  it('200s with the expected shape for a valid request', async () => {
    const { pid, field } = await seedProjectWithField();
    const res = await request(app)
      .post('/api/dependencies')
      .send({ projectId: pid, entityType: 'field', entityId: field.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.entity).toMatchObject({ entityType: 'field', entityId: field.id });
    expect(Array.isArray(res.body.dependencies)).toBe(true);
    expect(Array.isArray(res.body.dependents)).toBe(true);
    expect(res.body.dependents).toHaveLength(1);
    expect(res.body.dependents[0].edgeType).toBe('layout-shows-field');
    expect(Array.isArray(res.body.cycles)).toBe(true);
    expect(typeof res.body.truncated).toBe('boolean');
    expect(typeof res.body.depth).toBe('number');
  });

  it('honors a custom maxDepth', async () => {
    const { pid, field } = await seedProjectWithField();
    const res = await request(app)
      .post('/api/dependencies')
      .send({ projectId: pid, entityType: 'field', entityId: field.id, maxDepth: 2 });

    expect(res.status).toBe(200);
    expect(res.body.depth).toBe(2);
  });
});
