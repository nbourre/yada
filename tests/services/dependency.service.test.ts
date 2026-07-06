/**
 * Unit tests for dependency.service.ts — cascading dependency/dependent
 * resolution across tables, fields, relationships, layouts, scripts and
 * custom functions.
 *
 * Fixtures are seeded directly via databaseService (not through the XML
 * parser) to stay fast and deterministic. Each test uses its own unique
 * projectId so tests don't interfere with each other in the shared
 * in-memory mock store.
 */

import { databaseService } from '../../src/services/database.service';
import { dependencyService } from '../../src/services/dependency.service';
import { Table, Field, Layout, Script, CustomFunction, Relationship } from '../../src/models';

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function makeTable(projectId: string, overrides: Partial<Table> = {}): Table {
  return {
    id: id('table'),
    projectId,
    name: 'Table',
    occurrence: 'Table',
    isOccurrence: false,
    fields: [],
    relationships: [],
    ...overrides,
  };
}

function makeField(projectId: string, tableName: string, overrides: Partial<Field> = {}): Field {
  return {
    id: id('field'),
    projectId,
    tableId: id('tid'),
    tableName,
    name: 'Field',
    type: 'text',
    fieldKind: 'normal',
    options: {},
    ...overrides,
  };
}

function makeLayout(projectId: string, overrides: Partial<Layout> = {}): Layout {
  return {
    id: id('layout'),
    projectId,
    name: 'Layout',
    type: 'form',
    fields: [],
    parts: [],
    scripts: [],
    ...overrides,
  };
}

function makeScript(projectId: string, overrides: Partial<Script> = {}): Script {
  return {
    id: id('script'),
    projectId,
    name: 'Script',
    steps: [],
    ...overrides,
  };
}

function makeCustomFunction(
  projectId: string,
  overrides: Partial<CustomFunction> = {}
): CustomFunction {
  return {
    id: id('fn'),
    projectId,
    name: 'Fn',
    parameters: [],
    calculation: '',
    ...overrides,
  };
}

function makeRelationship(projectId: string, overrides: Partial<Relationship> = {}): Relationship {
  return {
    id: id('rel'),
    projectId,
    name: 'Rel',
    leftTable: 'A',
    leftField: 'id',
    rightTable: 'B',
    rightField: 'id',
    type: 'one-to-many',
    options: {},
    ...overrides,
  };
}

describe('dependencyService.resolveDependencies', () => {
  it('finds a direct dependent via a layout showing the field', async () => {
    const pid = id('proj');
    const table = makeTable(pid, { name: 'Contact' });
    const field = makeField(pid, 'Contact', { name: 'Email' });
    await databaseService.createTable(table);
    await databaseService.createField(field);

    const layout = makeLayout(pid, {
      name: 'ContactDetail',
      fields: [{ fieldId: field.id, fieldName: field.name, x: 0, y: 0, width: 10, height: 10 }],
    });
    await databaseService.createLayout(layout);

    const graph = await dependencyService.resolveDependencies(pid, 'field', field.id, 'dependents');

    expect(graph.root?.entityName).toBe('Email');
    expect(graph.dependents).toHaveLength(1);
    expect(graph.dependents[0]).toMatchObject({
      entityType: 'layout',
      entityId: layout.id,
      level: 1,
      edgeType: 'layout-shows-field',
    });
  });

  it('flags a field placed on a layout via a portal distinctly', async () => {
    const pid = id('proj');
    const table = makeTable(pid, { name: 'Address' });
    const field = makeField(pid, 'Address', { name: 'City' });
    await databaseService.createTable(table);
    await databaseService.createField(field);

    const layout = makeLayout(pid, {
      name: 'ContactDetail',
      fields: [
        {
          fieldId: field.id,
          fieldName: field.name,
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          viaPortal: true,
        },
      ],
    });
    await databaseService.createLayout(layout);

    const graph = await dependencyService.resolveDependencies(pid, 'field', field.id, 'dependents');

    expect(graph.dependents[0].edgeType).toBe('layout-shows-field-via-portal');
  });

  it('finds a direct dependent via a script Set Field step', async () => {
    const pid = id('proj');
    const table = makeTable(pid, { name: 'Invoice' });
    const field = makeField(pid, 'Invoice', { name: 'Total' });
    await databaseService.createTable(table);
    await databaseService.createField(field);

    const script = makeScript(pid, {
      name: 'RecalcTotal',
      steps: [
        {
          step: 'Set Field',
          enabled: true,
          options: { targetField: 'Total', targetTable: 'Invoice' },
        },
      ],
    });
    await databaseService.createScript(script);

    const graph = await dependencyService.resolveDependencies(pid, 'field', field.id, 'dependents');

    expect(graph.dependents).toHaveLength(1);
    expect(graph.dependents[0]).toMatchObject({
      entityType: 'script',
      entityId: script.id,
      edgeType: 'script-sets-field',
      level: 1,
    });
  });

  it('resolves a transitive script-calls-script chain in BFS level order', async () => {
    const pid = id('proj');
    const s1 = makeScript(pid, { name: 'S1' });
    const s2 = makeScript(pid, { name: 'S2' });
    const s3 = makeScript(pid, { name: 'S3' });
    await databaseService.createScript(s1);
    await databaseService.createScript(s2);
    await databaseService.createScript(s3);
    await databaseService.saveScriptReferences(pid, [
      { id: id('ref'), projectId: pid, callerScriptName: 'S1', targetScriptName: 'S2' },
      { id: id('ref'), projectId: pid, callerScriptName: 'S2', targetScriptName: 'S3' },
    ]);

    const graph = await dependencyService.resolveDependencies(pid, 'script', s1.id, 'dependencies');

    expect(graph.dependencies).toHaveLength(2);
    const byName = Object.fromEntries(graph.dependencies.map(n => [n.entityName, n]));
    expect(byName.S2.level).toBe(1);
    expect(byName.S3.level).toBe(2);
  });

  it('detects a cycle between two scripts calling each other and terminates', async () => {
    const pid = id('proj');
    const s1 = makeScript(pid, { name: 'Ping' });
    const s2 = makeScript(pid, { name: 'Pong' });
    await databaseService.createScript(s1);
    await databaseService.createScript(s2);
    await databaseService.saveScriptReferences(pid, [
      { id: id('ref'), projectId: pid, callerScriptName: 'Ping', targetScriptName: 'Pong' },
      { id: id('ref'), projectId: pid, callerScriptName: 'Pong', targetScriptName: 'Ping' },
    ]);

    const graph = await dependencyService.resolveDependencies(pid, 'script', s1.id, 'dependencies');

    expect(graph.dependencies).toHaveLength(1); // Pong at level 1
    expect(graph.dependencies[0].entityName).toBe('Pong');
    expect(graph.cycles.length).toBeGreaterThan(0); // the Pong -> Ping back-edge
  });

  it('resolves bidirectional table<->table dependencies from a relationship', async () => {
    const pid = id('proj');
    const a = makeTable(pid, { name: 'A' });
    const b = makeTable(pid, { name: 'B' });
    await databaseService.createTable(a);
    await databaseService.createTable(b);
    await databaseService.createRelationship(
      makeRelationship(pid, { leftTable: 'A', leftField: 'id', rightTable: 'B', rightField: 'aId' })
    );

    const graphA = await dependencyService.resolveDependencies(pid, 'table', a.id, 'both');
    const graphB = await dependencyService.resolveDependencies(pid, 'table', b.id, 'both');

    expect(graphA.dependencies.some(n => n.entityId === b.id)).toBe(true);
    expect(graphB.dependencies.some(n => n.entityId === a.id)).toBe(true);
  });

  it('detects a field-references-field dependency via the calculation heuristic (true positive)', async () => {
    const pid = id('proj');
    const table = makeTable(pid, { name: 'Line' });
    await databaseService.createTable(table);
    const price = makeField(pid, 'Line', { name: 'Price', type: 'number' });
    const qty = makeField(pid, 'Line', { name: 'Qty', type: 'number' });
    const total = makeField(pid, 'Line', {
      name: 'Total',
      type: 'calculation',
      calculation: 'Line::Price * Line::Qty',
    });
    await databaseService.createField(price);
    await databaseService.createField(qty);
    await databaseService.createField(total);

    const graph = await dependencyService.resolveDependencies(
      pid,
      'field',
      total.id,
      'dependencies'
    );

    const names = graph.dependencies.map(n => n.entityName).sort();
    expect(names).toEqual(['Price', 'Qty']);
    expect(graph.dependencies.every(n => n.edgeType === 'field-references-field')).toBe(true);
  });

  it('detects a field-references-function dependency via the calculation heuristic', async () => {
    const pid = id('proj');
    const table = makeTable(pid, { name: 'Line' });
    await databaseService.createTable(table);
    const fn = makeCustomFunction(pid, { name: 'RoundUp', calculation: 'Ceiling(x)' });
    await databaseService.createCustomFunction(fn);
    const total = makeField(pid, 'Line', {
      name: 'Total',
      type: 'calculation',
      calculation: 'RoundUp(1.2)',
    });
    await databaseService.createField(total);

    const graph = await dependencyService.resolveDependencies(
      pid,
      'field',
      total.id,
      'dependencies'
    );

    expect(graph.dependencies).toHaveLength(1);
    expect(graph.dependencies[0]).toMatchObject({
      entityType: 'custom_function',
      entityId: fn.id,
      edgeType: 'field-references-function',
    });
  });

  it('does not crash when a calculation comes back as a non-string value (fast-xml-parser numeric coercion)', async () => {
    // Regression test: fast-xml-parser converts purely-numeric tag content
    // (e.g. a calc formula that's literally "1") into a JS number, and the
    // parser's object-vs-text check doesn't catch that — the field's
    // `calculation` can end up as a number at runtime despite the `string`
    // type declaration. This must degrade gracefully, not throw.
    const pid = id('proj');
    const table = makeTable(pid, { name: 'Line' });
    await databaseService.createTable(table);
    const total = makeField(pid, 'Line', {
      name: 'Total',
      type: 'calculation',
      calculation: 1 as unknown as string,
    });
    await databaseService.createField(total);

    const graph = await dependencyService.resolveDependencies(
      pid,
      'field',
      total.id,
      'dependencies'
    );

    expect(graph.dependencies).toHaveLength(0);
  });

  it('does not create a spurious edge for a calculation referencing a nonexistent field (false-positive guard)', async () => {
    const pid = id('proj');
    const table = makeTable(pid, { name: 'Line' });
    await databaseService.createTable(table);
    const total = makeField(pid, 'Line', {
      name: 'Total',
      type: 'calculation',
      calculation: 'SomeRandomText::NotAField + 1',
    });
    await databaseService.createField(total);

    const graph = await dependencyService.resolveDependencies(
      pid,
      'field',
      total.id,
      'dependencies'
    );

    expect(graph.dependencies).toHaveLength(0);
  });

  it('truncates results at maxDepth and reports truncated: true', async () => {
    const pid = id('proj');
    const scripts = Array.from({ length: 6 }, (_, i) => makeScript(pid, { name: `S${i}` }));
    for (const s of scripts) await databaseService.createScript(s);
    const refs = scripts.slice(0, -1).map((s, i) => ({
      id: id('ref'),
      projectId: pid,
      callerScriptName: s.name,
      targetScriptName: scripts[i + 1].name,
    }));
    await databaseService.saveScriptReferences(pid, refs);

    const graph = await dependencyService.resolveDependencies(
      pid,
      'script',
      scripts[0].id,
      'dependencies',
      3
    );

    expect(graph.dependencies).toHaveLength(3);
    expect(graph.truncated).toBe(true);
  });

  it('returns a null root for an unknown entity', async () => {
    const pid = id('proj');
    const graph = await dependencyService.resolveDependencies(pid, 'field', 'does-not-exist');

    expect(graph.root).toBeNull();
    expect(graph.dependencies).toHaveLength(0);
    expect(graph.dependents).toHaveLength(0);
  });

  it('does not create dependents across unrelated projects', async () => {
    const pidA = id('proj');
    const pidB = id('proj');
    const fieldA = makeField(pidA, 'Contact', { name: 'Email' });
    await databaseService.createTable(makeTable(pidA, { name: 'Contact' }));
    await databaseService.createField(fieldA);
    // A layout in a *different* project referencing a field with the same name
    await databaseService.createLayout(
      makeLayout(pidB, {
        fields: [{ fieldId: fieldA.id, fieldName: 'Email', x: 0, y: 0, width: 1, height: 1 }],
      })
    );

    const graph = await dependencyService.resolveDependencies(
      pidA,
      'field',
      fieldA.id,
      'dependents'
    );
    expect(graph.dependents).toHaveLength(0);
  });
});
