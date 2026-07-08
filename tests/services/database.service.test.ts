/**
 * Regression tests for a cross-project id collision in the in-memory
 * DatabaseService. FileMaker DDR ids (table/field/layout/script/custom
 * function `id` attributes) are only unique within a single exported DDR
 * file, not across a multi-file solution — so two different projects parsed
 * in the same server session very commonly reuse the same numeric id for
 * unrelated entities. The mock maps used to key entries by the bare `.id`
 * alone, so the later-created project's entity would silently overwrite the
 * earlier project's entry, making it vanish from `getXForProject()`.
 */

import { databaseService } from '../../src/services/database.service';

describe('DatabaseService — cross-project id collisions', () => {
  const projectA = 'project-a';
  const projectB = 'project-b';
  const collidingId = '1065095'; // same raw DDR id reused by two different files

  it('keeps a table from project A when project B creates a table with the same id', async () => {
    await databaseService.createTable({
      id: collidingId,
      name: 'PRJ__PROJETS',
      projectId: projectA,
      occurrence: 'PRJ__PROJETS',
      isOccurrence: true,
      fields: [],
      relationships: [],
    });

    await databaseService.createTable({
      id: collidingId,
      name: 'projets',
      projectId: projectB,
      occurrence: 'projets',
      isOccurrence: false,
      fields: [],
      relationships: [],
    });

    const tablesA = await databaseService.getTablesForProject(projectA);
    const tablesB = await databaseService.getTablesForProject(projectB);

    expect(tablesA.map(t => t.name)).toContain('PRJ__PROJETS');
    expect(tablesB.map(t => t.name)).toContain('projets');
  });

  it('keeps a field from project A when project B creates a field with the same id', async () => {
    await databaseService.createField({
      id: collidingId,
      name: 'id',
      projectId: projectA,
      tableId: 'table-a',
      tableName: 'PRJ__PROJETS',
      type: 'number',
      fieldKind: 'normal',
      options: { indexed: false, required: false, unique: false, global: false, repeating: false },
      validation: [],
      autoEnter: {},
      storage: {},
    });

    await databaseService.createField({
      id: collidingId,
      name: 'code',
      projectId: projectB,
      tableId: 'table-b',
      tableName: 'projets',
      type: 'text',
      fieldKind: 'normal',
      options: { indexed: false, required: false, unique: false, global: false, repeating: false },
      validation: [],
      autoEnter: {},
      storage: {},
    });

    const fieldsA = await databaseService.getFieldsForProject(projectA);
    const fieldsB = await databaseService.getFieldsForProject(projectB);

    expect(fieldsA.map(f => f.name)).toContain('id');
    expect(fieldsB.map(f => f.name)).toContain('code');
  });
});
