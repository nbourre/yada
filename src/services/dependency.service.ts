/**
 * Cascading dependency resolution across tables, fields, relationships,
 * layouts, scripts and custom functions.
 *
 * Edge convention: `edge.from` depends on `edge.to`. So "dependencies of X"
 * means walking X's outgoing edges, and "dependents of X" means walking
 * X's incoming edges (who points at X).
 */

import {
  EntityType,
  Table,
  Field,
  Script,
  CustomFunction,
  CalcFieldReference,
  DependencyEdge,
  DependencyEdgeType,
  DependencyEntityRef,
  DependencyNode,
  DependencyGraph,
  DependencyDirection,
} from '../models';
import { databaseService } from './database.service';

function entityKey(entityType: EntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function refKey(ref: DependencyEntityRef): string {
  return entityKey(ref.entityType, ref.entityId);
}

interface EdgeIndex {
  refByKey: Map<string, DependencyEntityRef>;
  outEdges: Map<string, DependencyEdge[]>;
  inEdges: Map<string, DependencyEdge[]>;
}

export class DependencyService {
  async resolveDependencies(
    projectId: string,
    entityType: EntityType,
    entityId: string,
    direction: DependencyDirection = 'both',
    maxDepth = 10
  ): Promise<DependencyGraph> {
    const index = await this.buildEdgeIndex(projectId);
    const rootKey = entityKey(entityType, entityId);
    const root = index.refByKey.get(rootKey) ?? null;

    if (!root) {
      return {
        root: null,
        dependencies: [],
        dependents: [],
        cycles: [],
        truncated: false,
        depth: maxDepth,
      };
    }

    const dependencies: DependencyNode[] = [];
    const dependents: DependencyNode[] = [];
    const cycles: DependencyEdge[] = [];
    let truncated = false;

    if (direction === 'dependencies' || direction === 'both') {
      const r = this.bfs(rootKey, index.outEdges, maxDepth, edge => edge.to, index.refByKey);
      dependencies.push(...r.nodes);
      cycles.push(...r.cycles);
      truncated = truncated || r.truncated;
    }

    if (direction === 'dependents' || direction === 'both') {
      const r = this.bfs(rootKey, index.inEdges, maxDepth, edge => edge.from, index.refByKey);
      dependents.push(...r.nodes);
      cycles.push(...r.cycles);
      truncated = truncated || r.truncated;
    }

    return { root, dependencies, dependents, cycles, truncated, depth: maxDepth };
  }

  private bfs(
    rootKey: string,
    edgesByKey: Map<string, DependencyEdge[]>,
    maxDepth: number,
    neighborOf: (edge: DependencyEdge) => DependencyEntityRef,
    refByKey: Map<string, DependencyEntityRef>
  ): { nodes: DependencyNode[]; cycles: DependencyEdge[]; truncated: boolean } {
    const nodes: DependencyNode[] = [];
    const cycles: DependencyEdge[] = [];
    let truncated = false;

    const visited = new Set<string>([rootKey]);
    const queue: { key: string; level: number }[] = [{ key: rootKey, level: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const edges = edgesByKey.get(current.key) ?? [];

      for (const edge of edges) {
        const neighbor = neighborOf(edge);
        const neighborKey = refKey(neighbor);
        const nextLevel = current.level + 1;

        if (visited.has(neighborKey)) {
          // Edge into an already-visited node: closes a cycle rather than a
          // new path — recording it (instead of re-visiting) is what
          // guarantees BFS termination on cyclic graphs.
          cycles.push(edge);
          continue;
        }

        if (nextLevel > maxDepth) {
          truncated = true;
          continue;
        }

        visited.add(neighborKey);
        nodes.push({
          ...neighbor,
          level: nextLevel,
          edgeType: edge.type,
          detail: edge.detail,
          unresolved: !refByKey.has(neighborKey),
        });
        queue.push({ key: neighborKey, level: nextLevel });
      }
    }

    return { nodes, cycles, truncated };
  }

  private async buildEdgeIndex(projectId: string): Promise<EdgeIndex> {
    const [tables, fields, relationships, layouts, scripts, customFunctions, scriptReferences] =
      await Promise.all([
        databaseService.getTablesForProject(projectId),
        databaseService.getFieldsForProject(projectId),
        databaseService.getRelationshipsForProject(projectId),
        databaseService.getLayoutsForProject(projectId),
        databaseService.getScriptsForProject(projectId),
        databaseService.getCustomFunctionsForProject(projectId),
        databaseService.getScriptReferencesForProject(projectId),
      ]);

    const refByKey = new Map<string, DependencyEntityRef>();
    const addRef = (ref: DependencyEntityRef) => refByKey.set(refKey(ref), ref);

    const tableRef = (t: Table): DependencyEntityRef => ({
      entityType: 'table',
      entityId: t.id,
      entityName: t.name,
    });
    const fieldRef = (f: Field): DependencyEntityRef => ({
      entityType: 'field',
      entityId: f.id,
      entityName: f.name,
      tableName: f.tableName,
    });
    const scriptRef = (s: Script): DependencyEntityRef => ({
      entityType: 'script',
      entityId: s.id,
      entityName: s.name,
    });
    const fnRef = (fn: CustomFunction): DependencyEntityRef => ({
      entityType: 'custom_function',
      entityId: fn.id,
      entityName: fn.name,
    });

    tables.forEach(t => addRef(tableRef(t)));
    fields.forEach(f => addRef(fieldRef(f)));
    scripts.forEach(s => addRef(scriptRef(s)));
    customFunctions.forEach(fn => addRef(fnRef(fn)));
    layouts.forEach(l => addRef({ entityType: 'layout', entityId: l.id, entityName: l.name }));

    // Fields are keyed by base table name; layouts/relationships reference
    // fields through table *occurrence* names, so every occurrence is also
    // aliased to its base table's fields (same resolution the parser does
    // for LayoutField.fieldId).
    const fieldsByBaseTable = new Map<string, Field[]>();
    for (const f of fields) {
      const list = fieldsByBaseTable.get(f.tableName);
      if (list) list.push(f);
      else fieldsByBaseTable.set(f.tableName, [f]);
    }
    const fieldByKey = new Map<string, Field>();
    for (const f of fields) fieldByKey.set(`${f.tableName}::${f.name}`, f);
    for (const t of tables) {
      if (!t.isOccurrence || !t.baseTable) continue;
      for (const f of fieldsByBaseTable.get(t.baseTable) ?? []) {
        fieldByKey.set(`${t.name}::${f.name}`, f);
      }
    }

    const tableByName = new Map<string, Table>();
    for (const t of tables) tableByName.set(t.name, t);

    const scriptByName = new Map<string, Script>();
    for (const s of scripts) scriptByName.set(s.name, s);

    const customFunctionByName = new Map<string, CustomFunction>();
    for (const fn of customFunctions) customFunctionByName.set(fn.name, fn);

    const layoutByName = new Map<string, { id: string; name: string }>();
    for (const l of layouts) layoutByName.set(l.name, { id: l.id, name: l.name });

    const edges: DependencyEdge[] = [];
    const pushEdge = (
      from: DependencyEntityRef,
      to: DependencyEntityRef,
      type: DependencyEdgeType,
      detail?: string
    ) => edges.push({ from, to, type, detail });

    // 1. Relationships -> table<->table and field<->field (bidirectional:
    // a join is a mutual dependency between both sides).
    for (const rel of relationships) {
      const leftTable = tableByName.get(rel.leftTable);
      const rightTable = tableByName.get(rel.rightTable);
      if (leftTable && rightTable) {
        pushEdge(tableRef(leftTable), tableRef(rightTable), 'relationship-key');
        pushEdge(tableRef(rightTable), tableRef(leftTable), 'relationship-key');
      }

      const leftField = fieldByKey.get(`${rel.leftTable}::${rel.leftField}`);
      const rightField = fieldByKey.get(`${rel.rightTable}::${rel.rightField}`);
      if (leftField && rightField) {
        pushEdge(fieldRef(leftField), fieldRef(rightField), 'relationship-key');
        pushEdge(fieldRef(rightField), fieldRef(leftField), 'relationship-key');
      }
    }

    // 2. Scripts -> script-calls-script (via persisted cross-references),
    // script-sets-field, script-navigates-layout.
    for (const ref of scriptReferences) {
      const caller = scriptByName.get(ref.callerScriptName);
      const target = scriptByName.get(ref.targetScriptName);
      if (caller && target) {
        pushEdge(scriptRef(caller), scriptRef(target), 'script-calls-script', ref.targetFile);
      }
    }
    for (const script of scripts) {
      for (const step of script.steps) {
        if (
          (step.step === 'Set Field' || step.step === 'Set Field By Name') &&
          step.options?.targetField &&
          step.options?.targetTable
        ) {
          const field = fieldByKey.get(`${step.options.targetTable}::${step.options.targetField}`);
          if (field) pushEdge(scriptRef(script), fieldRef(field), 'script-sets-field');
        }
        if (step.step === 'Go to Layout' && step.options?.targetLayout) {
          const layout = layoutByName.get(step.options.targetLayout as string);
          if (layout) {
            pushEdge(
              scriptRef(script),
              { entityType: 'layout', entityId: layout.id, entityName: layout.name },
              'script-navigates-layout'
            );
          }
        }
      }
    }

    // 3. Layouts -> layout-shows-field / layout-shows-field-via-portal /
    // layout-triggers-script (script triggers + button "Perform Script").
    for (const layout of layouts) {
      const layoutRef: DependencyEntityRef = {
        entityType: 'layout',
        entityId: layout.id,
        entityName: layout.name,
      };
      for (const lf of layout.fields) {
        if (!lf.fieldId) continue;
        const field = fields.find(f => f.id === lf.fieldId);
        if (!field) continue;
        pushEdge(
          layoutRef,
          fieldRef(field),
          lf.viaPortal ? 'layout-shows-field-via-portal' : 'layout-shows-field'
        );
      }
      for (const scriptName of layout.scripts) {
        const script = scriptByName.get(scriptName);
        if (script) pushEdge(layoutRef, scriptRef(script), 'layout-triggers-script');
      }
    }

    // 4. Calculation references: FileMaker's own disambiguated parse of the
    // formula (DisplayCalculation Chunk[@type=FieldRef|FunctionRef], parsed
    // into Field/CustomFunction/ScriptStep.calculationFieldRefs /
    // .calculationFunctionRefs / .options.fieldRefs / .options.functionRefs)
    // is authoritative — every FieldRef chunk is definitely a real field
    // reference, so unlike a text-regex guess it can't misfire on a string
    // literal like "Please choose A::B". A field reference that doesn't
    // resolve in this project is still surfaced (as `unresolved`) rather
    // than silently dropped — most often a field defined in another file of
    // a multi-file solution, which this per-project graph can't see into.
    // Function references are NOT surfaced when unresolved: FunctionRef
    // chunks include FileMaker's built-ins (If, Get, Case, ...) as well as
    // custom functions, and there's no way to tell them apart here, so
    // surfacing every miss would mostly be built-in-function noise.
    const unresolvedFieldRef = (table: string, name: string): DependencyEntityRef => ({
      entityType: 'field',
      entityId: `unresolved:${table}::${name}`,
      entityName: name,
      tableName: table,
    });

    const applyFieldRefs = (
      source: DependencyEntityRef,
      refs: CalcFieldReference[],
      edgeType: DependencyEdgeType,
      surfaceUnresolved: boolean
    ) => {
      for (const ref of refs) {
        const resolved = fieldByKey.get(`${ref.table}::${ref.name}`);
        if (!resolved && !surfaceUnresolved) continue; // low-confidence regex guess — drop silently
        const target = resolved ? fieldRef(resolved) : unresolvedFieldRef(ref.table, ref.name);
        if (refKey(target) === refKey(source)) continue;
        // The occurrence's own <FileReference>, resolved against
        // ExternalDataSourcesCatalog at parse time, names the actual file
        // this field is defined in — far more actionable than a generic
        // "not found" when the reference is a cross-file one.
        const externalFile = tableByName.get(ref.table)?.externalFile;
        const detail = resolved
          ? undefined
          : externalFile
            ? `Probablement défini dans "${externalFile}" (autre fichier de la solution)`
            : 'Référence non résolue dans ce fichier';
        pushEdge(source, target, edgeType, detail);
      }
    };

    const applyFunctionRefs = (
      source: DependencyEntityRef,
      names: string[],
      edgeType: DependencyEdgeType
    ) => {
      for (const name of names) {
        const resolved = customFunctionByName.get(name);
        if (!resolved) continue; // likely a built-in — see note above
        if (refKey(fnRef(resolved)) === refKey(source)) continue;
        pushEdge(source, fnRef(resolved), edgeType);
      }
    };

    // Fallback for callers with no structured refs at all (e.g. data seeded
    // directly in tests without DisplayCalculation) — best-effort regex.
    const fieldRefPattern = /([A-Za-z_][\w ]*)::([A-Za-z_]\w*)/g;
    const functionCallPattern = /\b([A-Za-z_]\w*)\s*\(/g;
    const scanCalculationText = (
      source: DependencyEntityRef,
      calculation: string,
      fieldEdgeType: DependencyEdgeType,
      functionEdgeType: DependencyEdgeType
    ) => {
      const fieldRefs: CalcFieldReference[] = [];
      for (const match of calculation.matchAll(fieldRefPattern)) {
        fieldRefs.push({ table: match[1], name: match[2] });
      }
      applyFieldRefs(source, fieldRefs, fieldEdgeType, false);

      const functionRefs: string[] = [];
      for (const match of calculation.matchAll(functionCallPattern)) {
        functionRefs.push(match[1]);
      }
      applyFunctionRefs(source, functionRefs, functionEdgeType);
    };

    for (const field of fields) {
      const source = fieldRef(field);
      if (field.calculationFieldRefs || field.calculationFunctionRefs) {
        applyFieldRefs(source, field.calculationFieldRefs ?? [], 'field-references-field', true);
        applyFunctionRefs(source, field.calculationFunctionRefs ?? [], 'field-references-function');
      } else if (typeof field.calculation === 'string' && field.calculation) {
        scanCalculationText(
          source,
          field.calculation,
          'field-references-field',
          'field-references-function'
        );
      }
    }
    for (const fn of customFunctions) {
      const source = fnRef(fn);
      if (fn.calculationFieldRefs || fn.calculationFunctionRefs) {
        applyFieldRefs(source, fn.calculationFieldRefs ?? [], 'field-references-field', true);
        applyFunctionRefs(source, fn.calculationFunctionRefs ?? [], 'field-references-function');
      } else if (fn.calculation) {
        scanCalculationText(
          source,
          fn.calculation,
          'field-references-field',
          'field-references-function'
        );
      }
    }
    // Script steps that carry a calculation (Set Variable, If/Else If, Exit
    // Script, Halt Script) — same handling, but from the script itself.
    for (const script of scripts) {
      const source = scriptRef(script);
      for (const step of script.steps) {
        if (step.options?.fieldRefs || step.options?.functionRefs) {
          applyFieldRefs(source, step.options.fieldRefs ?? [], 'script-references-field', true);
          applyFunctionRefs(source, step.options.functionRefs ?? [], 'script-references-function');
        } else if (typeof step.options?.calculation === 'string' && step.options.calculation) {
          scanCalculationText(
            source,
            step.options.calculation,
            'script-references-field',
            'script-references-function'
          );
        }
      }
    }

    const outEdges = new Map<string, DependencyEdge[]>();
    const inEdges = new Map<string, DependencyEdge[]>();
    for (const edge of edges) {
      const fromKey = refKey(edge.from);
      const toKey = refKey(edge.to);
      if (!outEdges.has(fromKey)) outEdges.set(fromKey, []);
      outEdges.get(fromKey)!.push(edge);
      if (!inEdges.has(toKey)) inEdges.set(toKey, []);
      inEdges.get(toKey)!.push(edge);
    }

    return { refByKey, outEdges, inEdges };
  }
}

export const dependencyService = new DependencyService();
