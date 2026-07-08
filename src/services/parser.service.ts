/**
 * XML Parser Service for FileMaker Database Design Report (DDR)
 * Uses fast-xml-parser for XML parsing
 */

import { XMLParser } from 'fast-xml-parser';
import { promises as fs } from 'fs';
import {
  Project,
  Table,
  Field,
  Layout,
  LayoutField,
  Script,
  ScriptStep,
  Relationship,
  CustomFunction,
  FieldType,
  FieldKind,
  CalcFieldReference,
  LayoutType,
  RelationshipType,
  ProjectStatistics,
  PerformanceMetrics,
} from '../models';
import { databaseService } from './database.service';

export interface ParseResult {
  project: Project;
  statistics: ProjectStatistics;
  parseTime: number;
  errors: string[];
}

// Minimal DDR XML type definitions used for parsing (subset of full schema)

// FileMaker's own disambiguated parse of a calculation formula: a flat list
// of "chunks" where FieldRef/FunctionRef chunks are unambiguous (unlike a
// text-regex guess over the raw formula, which can misfire on string
// literals such as "Please choose A::B").
interface DDRChunk {
  '@_type'?: string; // 'FieldRef' | 'FunctionRef' | 'NoRef' | ...
  Field?: { '@_table'?: string; '@_name'?: string; '@_id'?: string };
  '#text'?: string;
}
interface DDRDisplayCalculation {
  Chunk?: DDRChunk | DDRChunk[];
}

interface DDRField {
  '@_name'?: string;
  '@_dataType'?: string;
  '@_type'?: string;
  '@_fieldType'?: string;
  Calculation?: { '#text'?: string } | string;
  DisplayCalculation?: DDRDisplayCalculation;
  Comment?: { '#text'?: string } | string;
}

interface DDRFieldCatalog {
  Field: DDRField | DDRField[];
}

interface DDRBaseTable {
  '@_name'?: string;
  '@_occurrence'?: string;
  '@_sourceTable'?: string;
  '@_baseTable'?: string;
  '@_recordCount'?: string;
  FieldCatalog?: DDRFieldCatalog;
}

interface DDRBaseTableCatalog {
  BaseTable: DDRBaseTable | DDRBaseTable[];
}

interface DDRBounds {
  '@_top'?: string;
  '@_left'?: string;
  '@_bottom'?: string;
  '@_right'?: string;
}

interface DDRDDRInfoFieldRef {
  '@_name'?: string;
  '@_id'?: string;
  '@_table'?: string;
}

interface DDRFieldObj {
  Name?: string; // fallback "Table::field"
  DDRInfo?: { Field?: DDRDDRInfoFieldRef };
}

interface DDRPortalFieldList {
  Field?: DDRDDRInfoFieldRef | DDRDDRInfoFieldRef[];
}

interface DDRPortalObj {
  FieldList?: DDRPortalFieldList;
}

interface DDRButtonStep {
  '@_name'?: string;
  Script?: { '@_name'?: string; '@_id'?: string };
}

// Layout objects nest arbitrarily deep (fields inside portals inside tab
// panels/groups), so this type only pins down the parts we read directly —
// everything else is walked generically as unknown nested container data.
interface DDRLayoutObject {
  '@_type'?: string;
  Bounds?: DDRBounds;
  FieldObj?: DDRFieldObj;
  PortalObj?: DDRPortalObj;
  // A button's own "Perform Script" step (ButtonObj > Step), reached by the
  // same generic recursive walk used for fields/portals.
  Step?: DDRButtonStep | DDRButtonStep[];
  [key: string]: unknown;
}

interface DDRScriptTrigger {
  '@_event'?: string;
  Script?: { '@_name'?: string; '@_id'?: string };
}

interface DDRScriptTriggers {
  Trigger?: DDRScriptTrigger | DDRScriptTrigger[];
}

interface DDRLayout {
  '@_name'?: string;
  '@_type'?: string;
  Object?: DDRLayoutObject | DDRLayoutObject[];
  ScriptTriggers?: DDRScriptTriggers;
}
interface DDRLayoutGroup {
  Layout?: DDRLayout | DDRLayout[];
  Group?: DDRLayoutGroup | DDRLayoutGroup[];
}

interface DDRLayoutCatalog {
  Layout?: DDRLayout | DDRLayout[];
  // Layouts organized into folders are nested under Group instead of being
  // direct children of LayoutCatalog; groups can themselves nest.
  Group?: DDRLayoutGroup | DDRLayoutGroup[];
}

interface DDRScriptStep {
  '@_id'?: string;
  '@_name'?: string;
  '@_enable'?: string;
  // FileMaker's own pre-rendered human-readable text for this step (e.g.
  // "Set Variable [ $x; Value:1 ]") — covers every step type uniformly,
  // without needing a hand-written renderer per FileMaker step kind.
  StepText?: { '#text'?: string } | string;
  Text?: { '#text'?: string } | string;
  Calculation?: { '#text'?: string } | string;
  // Sibling of Calculation for If/Else If/Exit Script/Halt Script steps.
  DisplayCalculation?: DDRDisplayCalculation;
  // "Perform Script" target
  Script?: { '@_name'?: string; '@_id'?: string };
  FileReference?: { '@_name'?: string };
  // "Go to Layout"
  Layout?: { '@_name'?: string };
  // "Set Field"
  Field?: { '@_name'?: string; '@_table'?: string } | { '@_name'?: string; '@_table'?: string }[];
  // "Set Variable"
  Value?: {
    Calculation?: { '#text'?: string } | string;
    DisplayCalculation?: DDRDisplayCalculation;
  };
  Name?: { '#text'?: string } | string;
}

interface DDRScript {
  '@_name'?: string;
  '@_id'?: string;
  '@_comment'?: string;
  '@_runFullAccess'?: string;
  '@_includeInMenu'?: string;
  Comment?: { '#text'?: string } | string;
  StepList?: { Step?: DDRScriptStep | DDRScriptStep[] };
}

interface DDRScriptGroup {
  Script?: DDRScript | DDRScript[];
  Group?: DDRScriptGroup | DDRScriptGroup[];
}

interface DDRScriptCatalog {
  Script?: DDRScript | DDRScript[];
  // Scripts organized into folders are nested under Group, same as layouts.
  Group?: DDRScriptGroup | DDRScriptGroup[];
}

interface DDRJoinPredicate {
  '@_type'?: string;
  LeftField?: { Field?: { '@_name'?: string } };
  RightField?: { Field?: { '@_name'?: string } };
}

interface DDRRelationship {
  '@_id'?: string;
  LeftTable?: { '@_name'?: string; '@_cascadeCreate'?: string; '@_cascadeDelete'?: string };
  RightTable?: { '@_name'?: string };
  JoinPredicateList?: { JoinPredicate: DDRJoinPredicate | DDRJoinPredicate[] };
}

interface DDRFileReference {
  '@_id'?: string;
  '@_name'?: string;
  '@_link'?: string; // only present in ExternalDataSourcesCatalog entries
}

// A TO carries <FileReference id="X"/> only when its base table lives in
// another file of the solution — a purely local TO has no FileReference at
// all (confirmed against real multi-file fixtures).
interface DDRTableOccurrence {
  '@_id'?: string;
  '@_name'?: string;
  '@_baseTable'?: string;
  FileReference?: DDRFileReference;
}
interface DDRRelationshipGraph {
  TableList?: { Table: DDRTableOccurrence | DDRTableOccurrence[] };
  RelationshipList?: { Relationship: DDRRelationship | DDRRelationship[] };
}

// Maps a FileReference id (as used on a TO) to the actual external DDR
// filename, e.g. id="1" -> link="gip_data_fmp12.xml".
interface DDRExternalDataSourcesCatalog {
  FileReference?: DDRFileReference | DDRFileReference[];
}

// Custom Functions
interface DDRCustomFunction {
  '@_id'?: string;
  '@_name'?: string;
  '@_parameters'?: string;
  Calculation?: { '#text'?: string } | string;
  DisplayCalculation?: DDRDisplayCalculation;
  Comment?: { '#text'?: string } | string;
}
interface DDRCustomFunctionCatalog {
  CustomFunction?: DDRCustomFunction | DDRCustomFunction[];
}

// Value Lists
interface DDRValueListItem {
  '#text'?: string;
}
interface DDRValueList {
  '@_id'?: string;
  '@_name'?: string;
  '@_source'?: string; // "Custom" | "Field"
  ValueListItems?: { Value?: DDRValueListItem | DDRValueListItem[] };
  SourceField?: { '@_table'?: string; '@_field'?: string };
}
interface DDRValueListCatalog {
  ValueList?: DDRValueList | DDRValueList[];
}

// Privileges
interface DDRPrivilegeSet {
  '@_id'?: string;
  '@_name'?: string;
  '@_allAccess'?: string;
}
interface DDRPrivilegeCatalog {
  PrivilegeSet?: DDRPrivilegeSet | DDRPrivilegeSet[];
}

interface DDRFileElement {
  '@_name'?: string;
  '@_path'?: string;
  BaseTableCatalog?: DDRBaseTableCatalog;
  LayoutCatalog?: DDRLayoutCatalog;
  ScriptCatalog?: DDRScriptCatalog;
  RelationshipGraph?: DDRRelationshipGraph;
  CustomFunctionCatalog?: DDRCustomFunctionCatalog;
  ValueListCatalog?: DDRValueListCatalog;
  PrivilegeCatalog?: DDRPrivilegeCatalog;
  ExternalDataSourcesCatalog?: DDRExternalDataSourcesCatalog;
}

export class XMLParserService {
  private currentProject: Partial<Project> = {};
  private currentElement: string = '';
  private elementStack: string[] = [];
  private currentData: string = '';
  private errors: string[] = [];
  private startTime: number = 0;

  // Tracking parsing state
  private currentTable: Partial<Table> | null = null;
  private currentField: Partial<Field> | null = null;
  private currentLayout: Partial<Layout> | null = null;
  private currentScript: Partial<Script> | null = null;
  private currentRelationship: Partial<Relationship> | null = null;

  // Collections for parsed entities
  private tables: Table[] = [];
  // FileReference id -> external DDR filename (e.g. "1" -> "gip_data_fmp12.xml"),
  // from ExternalDataSourcesCatalog. Used to tag table occurrences whose base
  // table lives in another file of a multi-file solution.
  private externalDataSources: Map<string, string> = new Map();
  private fields: Field[] = [];
  private layouts: Layout[] = [];
  private scripts: Script[] = [];
  private relationships: Relationship[] = [];
  private customFunctions: CustomFunction[] = [];
  private valueLists: {
    id: string;
    name: string;
    source: string;
    items: string[];
    sourceTable?: string;
    sourceField?: string;
  }[] = [];
  private privilegeSets: { id: string; name: string; fullAccess: boolean }[] = [];
  // Cross-references: script → script calls
  private scriptReferences: {
    callerScriptName: string;
    targetScriptName: string;
    targetFile?: string;
  }[] = [];

  // Statistics counters
  private stats: ProjectStatistics = {
    tableCount: 0,
    occurrenceCount: 0,
    fieldCount: 0,
    layoutCount: 0,
    scriptCount: 0,
    relationshipCount: 0,
    customFunctionCount: 0,
    valueListCount: 0,
    privilegeSetCount: 0,
    scriptReferenceCount: 0,
  };

  async parseFile(filePath: string): Promise<ParseResult> {
    console.log('Parser: Starting parseFile...');
    this.startTime = Date.now();
    this.errors = [];
    this.resetState();

    try {
      // Read file content with BOM handling
      console.log('Parser: Reading file with BOM handling...');
      const xmlContent = await this.readFileWithBOMHandling(filePath);

      // Initialize project with basic info
      const fileName = filePath.split(/[/\\]/).pop() || 'unknown.xml';
      const fileStats = await fs.stat(filePath);

      this.currentProject = {
        id: this.generateId(),
        name: fileName.replace('.xml', ''),
        filePath,
        fileName,
        fileSize: fileStats.size,
        parsedAt: new Date(),
        status: 'parsing',
        statistics: this.stats,
        metadata: {
          fileMakerVersion: '',
          platform: '',
          createdBy: '',
          modifiedBy: '',
          creationDate: new Date(),
          modificationDate: new Date(),
        },
      };

      // Parse XML content
      console.log('Parser: Starting XML parsing...');
      await this.parseXMLContent(xmlContent);
      console.log('Parser: XML parsing completed, saving to database...');

      // Save parsed data to database
      await this.saveParsedDataToDatabase();
      // Save relationships to database
      for (const rel of this.relationships) {
        await databaseService.createRelationship(rel);
      }
      console.log('Parser: Database save completed');

      // Finalize project
      const parseTime = Date.now() - this.startTime;
      this.stats.parseTime = parseTime;

      const finalProject: Project = {
        ...this.currentProject,
        status: this.errors.length > 0 ? 'error' : 'ready',
        statistics: this.stats,
      } as Project;

      // Save to database
      await databaseService.createProject(finalProject);

      return {
        project: finalProject,
        statistics: this.stats,
        parseTime,
        errors: this.errors,
      };
    } catch (error) {
      this.errors.push(`Parse error: ${error}`);

      const parseTime = Date.now() - this.startTime;
      const errorProject: Project = {
        ...this.currentProject,
        status: 'error',
        statistics: this.stats,
      } as Project;

      return {
        project: errorProject,
        statistics: this.stats,
        parseTime,
        errors: this.errors,
      };
    }
  }

  private async parseXMLContent(content: string): Promise<void> {
    console.log(`Parser: parseXMLContent called with ${content.length} chars`);

    try {
      // Parse XML using fast-xml-parser
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: true,
        trimValues: true,
      });

      console.log('Parser: Parsing XML with fast-xml-parser...');
      const parsed = parser.parse(content);
      console.log('Parser: XML parsed successfully');

      // Find the root element (varies by FileMaker version)
      const root =
        parsed.FMSaveAsXML || // FileMaker Pro 19+
        parsed.FMPReport || // FileMaker Pro 12–18
        parsed.FMPDDR ||
        parsed.FMPDDRDocument ||
        parsed.fmpreport ||
        parsed.fmpddr ||
        parsed.fmpddrDocument;

      if (!root) {
        throw new Error(
          `Could not find FileMaker DDR root element in XML. Found keys: ${Object.keys(parsed).join(', ')}`
        );
      }

      console.log('Parser: Found root element, traversing...');

      // Extract metadata from root attributes
      if (root['@_version']) {
        this.currentProject.metadata = {
          ...this.currentProject.metadata!,
          fileMakerVersion: root['@_version'],
          platform: root['@_platform'] || 'Unknown',
        };
      }

      // Process File element
      if (root.File) {
        this.processFileElement(root.File);
      }

      console.log('Parser: XML parsing completed');
    } catch (error) {
      console.error('Parser: XML parser error:', error);
      this.errors.push(`XML Parse Error: ${error}`);
      throw error;
    }
  }

  private processFileElement(fileElement: DDRFileElement): void {
    // Extract file metadata
    if (fileElement['@_name']) {
      this.currentProject.name = fileElement['@_name'];
    }

    if (fileElement['@_path']) {
      this.currentProject.filePath = fileElement['@_path'];
    }

    // Process BaseTableCatalog
    if (fileElement.BaseTableCatalog) {
      this.processBaseTableCatalog(fileElement.BaseTableCatalog);
    }

    // Process ExternalDataSourcesCatalog before RelationshipGraph: it maps
    // FileReference ids to actual external filenames, which RelationshipGraph
    // needs to resolve which file an external table occurrence points to.
    if (fileElement.ExternalDataSourcesCatalog) {
      this.processExternalDataSourcesCatalog(fileElement.ExternalDataSourcesCatalog);
    }

    // Process RelationshipGraph before LayoutCatalog: it resolves table
    // occurrence -> base table names, which layout field extraction needs
    // (layouts reference fields through occurrence names, not base tables).
    if (fileElement.RelationshipGraph) {
      this.processRelationshipGraph(fileElement.RelationshipGraph);
    }

    // Process LayoutCatalog
    if (fileElement.LayoutCatalog) {
      this.processLayoutCatalog(fileElement.LayoutCatalog);
    }

    // Process ScriptCatalog
    if (fileElement.ScriptCatalog) {
      this.processScriptCatalog(fileElement.ScriptCatalog);
    }

    // Process CustomFunctionCatalog
    if (fileElement.CustomFunctionCatalog) {
      this.processCustomFunctionCatalog(fileElement.CustomFunctionCatalog);
    }

    // Process ValueListCatalog
    if (fileElement.ValueListCatalog) {
      this.processValueListCatalog(fileElement.ValueListCatalog);
    }

    // Process PrivilegeCatalog
    if (fileElement.PrivilegeCatalog) {
      this.processPrivilegeCatalog(fileElement.PrivilegeCatalog);
    }

    // Extract script cross-references after all scripts are parsed
    this.extractScriptReferences();
  }

  private processBaseTableCatalog(catalog: DDRBaseTableCatalog): void {
    const tables = catalog.BaseTable;
    if (!tables) return;

    const tableArray = Array.isArray(tables) ? tables : [tables];

    tableArray.forEach((tableData: DDRBaseTable) => {
      const table: Table = {
        id: this.generateId(),
        projectId: this.currentProject.id!,
        name: tableData['@_name'] || 'Unnamed Table',
        occurrence: tableData['@_occurrence'] || tableData['@_name'] || 'Main',
        sourceTable: tableData['@_sourceTable'],
        baseTable: tableData['@_baseTable'] || '',
        isOccurrence: false,
        recordCount: tableData['@_recordCount'] ? parseInt(tableData['@_recordCount']) : undefined,
        fields: [],
        relationships: [],
      };

      // Process fields
      if (tableData.FieldCatalog?.Field) {
        const fields = Array.isArray(tableData.FieldCatalog.Field)
          ? tableData.FieldCatalog.Field
          : [tableData.FieldCatalog.Field];

        fields.forEach((fieldData: DDRField) => {
          const field: Field = {
            id: this.generateId(),
            projectId: this.currentProject.id!,
            tableId: table.id,
            tableName: table.name,
            name: fieldData['@_name'] || 'Unnamed Field',
            type: this.mapFieldType(fieldData['@_dataType'] || fieldData['@_type'] || 'text'),
            fieldKind: this.mapFieldKind(fieldData['@_fieldType']),
            options: {},
            calculation: this.extractDDRText(fieldData.Calculation),
            ...this.namedCalcRefs(fieldData.DisplayCalculation),
            comment: this.extractDDRText(fieldData.Comment),
          };

          table.fields.push(field);
          this.fields.push(field);
          this.stats.fieldCount++;
        });
      }

      this.tables.push(table);
      this.stats.tableCount++;
    });

    console.log(`Parser: Processed ${tableArray.length} tables with ${this.fields.length} fields`);
  }

  /**
   * LayoutCatalog and ScriptCatalog both organize their items into optional
   * nested `Group` folders instead of listing them flatly — this walks
   * either shape uniformly. `itemKey` is `'Layout'` or `'Script'`.
   */
  private collectGrouped<T>(node: object, itemKey: string): T[] {
    const result: T[] = [];
    const rec = node as Record<string, unknown>;
    const items = rec[itemKey] as T | T[] | undefined;
    if (items) {
      result.push(...(Array.isArray(items) ? items : [items]));
    }
    if (rec.Group) {
      const groups = Array.isArray(rec.Group) ? rec.Group : [rec.Group];
      for (const g of groups) {
        result.push(...this.collectGrouped<T>(g as object, itemKey));
      }
    }
    return result;
  }

  private processLayoutCatalog(catalog: DDRLayoutCatalog): void {
    const layoutArray = this.collectGrouped<DDRLayout>(catalog, 'Layout');
    if (layoutArray.length === 0) return;

    // "Table::field" -> field id, built once and reused for every layout in
    // this catalog. Fields are keyed by base table name (BaseTableCatalog
    // runs first), but layouts reference fields through the table
    // *occurrence* they're viewed via — so every occurrence name is also
    // aliased to its base table's fields (RelationshipGraph runs before
    // LayoutCatalog specifically to make this resolution possible).
    const fieldIndex = new Map<string, string>();
    const fieldsByBaseTable = new Map<string, Field[]>();
    for (const f of this.fields) {
      fieldIndex.set(`${f.tableName}::${f.name}`, f.id);
      const list = fieldsByBaseTable.get(f.tableName);
      if (list) list.push(f);
      else fieldsByBaseTable.set(f.tableName, [f]);
    }
    for (const occ of this.tables) {
      if (!occ.isOccurrence || !occ.baseTable) continue;
      for (const f of fieldsByBaseTable.get(occ.baseTable) ?? []) {
        fieldIndex.set(`${occ.name}::${f.name}`, f.id);
      }
    }

    layoutArray.forEach((layoutData: DDRLayout) => {
      const { fields, scriptNames } = this.extractLayoutFieldsAndScripts(layoutData, fieldIndex);
      const layout: Layout = {
        id: this.generateId(),
        projectId: this.currentProject.id!,
        name: layoutData['@_name'] || 'Unnamed Layout',
        type: 'form' as LayoutType,
        fields,
        parts: [],
        scripts: scriptNames,
      };

      this.layouts.push(layout);
      this.stats.layoutCount++;
    });

    console.log(`Parser: Processed ${layoutArray.length} layouts`);
  }

  /**
   * Layout objects nest arbitrarily deep — a field (or a button's own
   * "Perform Script" step) can sit directly on the layout, or inside a
   * portal, itself inside a tab panel or group. Neither is otherwise
   * exposed by the DDR anywhere else, so a single walk recurses into every
   * nested object and collects both in one pass rather than assuming a
   * flat top-level `Object` list (or re-walking the tree twice).
   */
  private extractLayoutFieldsAndScripts(
    layoutData: DDRLayout,
    fieldIndex: Map<string, string>
  ): { fields: LayoutField[]; scriptNames: string[] } {
    const fields: LayoutField[] = [];
    const scriptNames = new Set<string>();
    this.walkLayoutObjects(layoutData.Object, fields, fieldIndex, scriptNames);

    // Script triggers are declared once, directly on the layout (not nested
    // inside Object/ButtonObj like a button's action).
    const triggers = layoutData.ScriptTriggers?.Trigger;
    if (triggers) {
      const arr = Array.isArray(triggers) ? triggers : [triggers];
      for (const t of arr) {
        const name = t.Script?.['@_name'];
        if (name) scriptNames.add(name);
      }
    }

    return { fields, scriptNames: Array.from(scriptNames) };
  }

  private walkLayoutObjects(
    node: unknown,
    sink: LayoutField[],
    fieldIndex: Map<string, string>,
    scriptNames: Set<string>
  ): void {
    if (node === null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) this.walkLayoutObjects(item, sink, fieldIndex, scriptNames);
      return;
    }

    const obj = node as DDRLayoutObject;

    if (obj['@_type'] === 'Field') {
      const lf = this.buildDirectLayoutField(obj, fieldIndex);
      if (lf) sink.push(lf);
    } else if (obj['@_type'] === 'Portal') {
      this.extractPortalFields(obj, sink, fieldIndex);
    }

    // A button's own step (or any object carrying one) — collect its
    // "Perform Script" target regardless of the enclosing object's type.
    if (obj.Step) {
      const steps = Array.isArray(obj.Step) ? obj.Step : [obj.Step];
      for (const step of steps) {
        if (
          (step['@_name'] === 'Perform Script' || step['@_name'] === 'Perform Script on Server') &&
          step.Script?.['@_name']
        ) {
          scriptNames.add(step.Script['@_name']);
        }
      }
    }

    // Recurse into every nested property to reach objects buried inside
    // portals, tab panels, groups, etc. (own Field/Portal objects were
    // already handled above; this also finds objects nested further down).
    for (const key of Object.keys(obj)) {
      if (key.startsWith('@_')) continue;
      this.walkLayoutObjects(obj[key], sink, fieldIndex, scriptNames);
    }
  }

  private buildDirectLayoutField(
    obj: DDRLayoutObject,
    fieldIndex: Map<string, string>
  ): LayoutField | null {
    const ddrField = obj.FieldObj?.DDRInfo?.Field;
    let table = ddrField?.['@_table'];
    let name = ddrField?.['@_name'];

    if (!table || !name) {
      const fallback = obj.FieldObj?.Name; // "Table::field"
      const parts = fallback?.split('::');
      if (parts && parts.length === 2) {
        table = table || parts[0];
        name = name || parts[1];
      }
    }

    if (!name) return null;

    return {
      fieldId: (table && fieldIndex.get(`${table}::${name}`)) || '',
      fieldName: name,
      ...this.boundsToRect(obj.Bounds),
    };
  }

  private extractPortalFields(
    obj: DDRLayoutObject,
    sink: LayoutField[],
    fieldIndex: Map<string, string>
  ): void {
    const rawFields = obj.PortalObj?.FieldList?.Field;
    if (!rawFields) return;

    const fieldArray = Array.isArray(rawFields) ? rawFields : [rawFields];
    const rect = this.boundsToRect(obj.Bounds); // no per-field bounds inside a portal

    for (const f of fieldArray) {
      const table = f['@_table'];
      const name = f['@_name'];
      if (!name) continue;

      sink.push({
        fieldId: (table && fieldIndex.get(`${table}::${name}`)) || '',
        fieldName: name,
        ...rect,
        viaPortal: true,
      });
    }
  }

  private boundsToRect(bounds?: DDRBounds): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const top = parseFloat(bounds?.['@_top'] || '0');
    const left = parseFloat(bounds?.['@_left'] || '0');
    const bottom = parseFloat(bounds?.['@_bottom'] || '0');
    const right = parseFloat(bounds?.['@_right'] || '0');
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  private processScriptCatalog(catalog: DDRScriptCatalog): void {
    const scriptArray = this.collectGrouped<DDRScript>(catalog, 'Script');
    if (scriptArray.length === 0) return;

    scriptArray.forEach((scriptData: DDRScript) => {
      const steps = this.parseScriptSteps(scriptData);

      const script: Script = {
        id: this.generateId(),
        projectId: this.currentProject.id!,
        name: scriptData['@_name'] || 'Unnamed Script',
        steps,
        runWithFullAccess: scriptData['@_runFullAccess'] === 'True',
        includeInMenu: scriptData['@_includeInMenu'] === 'True',
        comment: scriptData['@_comment'] || this.extractDDRText(scriptData.Comment),
      };

      this.scripts.push(script);
      this.stats.scriptCount++;
    });

    console.log(`Parser: Processed ${scriptArray.length} scripts`);
  }

  private parseScriptSteps(scriptData: DDRScript): ScriptStep[] {
    const rawSteps = scriptData.StepList?.Step;
    if (!rawSteps) return [];

    const stepArray = Array.isArray(rawSteps) ? rawSteps : [rawSteps];
    const steps: ScriptStep[] = [];

    for (const s of stepArray) {
      const stepName = s['@_name'] || '';
      const enabled = s['@_enable'] !== 'False';

      const step: ScriptStep = {
        step: stepName,
        enabled,
        // FileMaker's own rendering of the step, e.g. "Set Variable [ $x; Value:1 ]" —
        // falls back to <Text> (used by comment steps) when <StepText> is empty/absent.
        text: this.extractDDRText(s.StepText) || this.extractDDRText(s.Text) || stepName,
        options: {},
      };

      // Extract step-specific data
      switch (stepName) {
        case 'Perform Script':
        case 'Perform Script on Server': {
          const targetScript = s.Script?.['@_name'] || '';
          const targetFile = s.FileReference?.['@_name'] || '';
          step.options = { targetScript, targetFile };
          break;
        }
        case 'Go to Layout': {
          step.options = { targetLayout: s.Layout?.['@_name'] || '' };
          break;
        }
        case 'Set Field':
        case 'Set Field By Name': {
          const field = Array.isArray(s.Field) ? s.Field[0] : s.Field;
          step.options = {
            targetField: field?.['@_name'] || '',
            targetTable: field?.['@_table'] || '',
          };
          break;
        }
        case 'Set Variable': {
          const { fieldRefs, functionRefs } = this.extractCalcRefs(s.Value?.DisplayCalculation);
          step.options = {
            variableName: this.extractDDRText(s.Name) || '',
            calculation: this.extractDDRText(s.Value?.Calculation) || '',
            fieldRefs,
            functionRefs,
          };
          break;
        }
        case 'If':
        case 'Else If':
        case 'Exit Script':
        case 'Halt Script': {
          const { fieldRefs, functionRefs } = this.extractCalcRefs(s.DisplayCalculation);
          step.options = {
            calculation: this.extractDDRText(s.Calculation) || '',
            fieldRefs,
            functionRefs,
          };
          break;
        }
      }

      steps.push(step);
    }

    return steps;
  }

  private processExternalDataSourcesCatalog(catalog: DDRExternalDataSourcesCatalog): void {
    const refs = catalog.FileReference;
    if (!refs) return;

    const arr = Array.isArray(refs) ? refs : [refs];
    for (const ref of arr) {
      const id = ref['@_id'];
      const link = ref['@_link'];
      if (id && link) this.externalDataSources.set(id, link);
    }
  }

  private processRelationshipGraph(graph: DDRRelationshipGraph): void {
    // First, process TableList to get table occurrences
    const tableList = graph.TableList?.Table;
    const tableOccurrences: Record<string, { id: string; name: string; baseTable: string }> = {};
    if (tableList) {
      const tableArray = Array.isArray(tableList) ? tableList : [tableList];
      tableArray.forEach((tableData: DDRTableOccurrence) => {
        const name = tableData['@_name'] || '';
        const baseTable = tableData['@_baseTable'] || '';
        tableOccurrences[name] = {
          id: tableData['@_id'] || this.generateId(),
          name,
          baseTable,
        };

        // Create a Table object for this occurrence if not already in tables
        const existingTable = this.tables.find(t => t.name === name);
        if (!existingTable) {
          const baseTableEntity = this.tables.find(t => !t.isOccurrence && t.name === baseTable);
          const fileRefId = tableData.FileReference?.['@_id'];
          const externalFile = fileRefId ? this.externalDataSources.get(fileRefId) : undefined;
          const table: Table = {
            id: tableData['@_id'] || this.generateId(),
            projectId: this.currentProject.id!,
            name,
            occurrence: name,
            baseTable,
            sourceTable: baseTable,
            baseTableId: baseTableEntity?.id,
            isOccurrence: true,
            recordCount: 0,
            externalFile,
            fields: [],
            relationships: [],
          };
          this.tables.push(table);
          this.stats.occurrenceCount++;
        }
      });
    }

    // FileMaker DDR RelationshipGraph structure
    const relList = graph.RelationshipList?.Relationship;
    if (!relList) return;
    const relationshipArray = Array.isArray(relList) ? relList : [relList];

    relationshipArray.forEach((relData: DDRRelationship) => {
      // Extract left/right table names
      const leftTable = relData.LeftTable?.['@_name'] || '';
      const rightTable = relData.RightTable?.['@_name'] || '';
      // Extract join predicates
      const joinList = relData.JoinPredicateList?.JoinPredicate;
      const joinPredicates = Array.isArray(joinList) ? joinList : joinList ? [joinList] : [];
      joinPredicates.forEach((jp: DDRJoinPredicate) => {
        const leftField = jp.LeftField?.Field?.['@_name'] || '';
        const rightField = jp.RightField?.Field?.['@_name'] || '';
        const relationship: Relationship = {
          id: relData['@_id'] || this.generateId(),
          projectId: this.currentProject.id!,
          name: `${leftTable} → ${rightTable}`,
          leftTable,
          leftField,
          rightTable,
          rightField,
          type: jp['@_type'] ? this.mapRelationshipType(jp['@_type']) : 'one-to-many',
          options: {
            allowCreation: relData.LeftTable?.['@_cascadeCreate'] === 'True',
            allowDeletion: relData.LeftTable?.['@_cascadeDelete'] === 'True',
            sortRecords: false,
          },
        };
        this.relationships.push(relationship);
        this.stats.relationshipCount++;
      });
    });
    console.log(`Parser: Processed ${this.relationships.length} relationships`);
  }

  private handleOpenTag(tagName: string, attributes: Record<string, string>): void {
    switch (tagName.toLowerCase()) {
      case 'fmpddr':
      case 'fmpreport':
        // Root element - extract version info
        this.currentProject.metadata = {
          ...this.currentProject.metadata!,
          fileMakerVersion: attributes.version || 'Unknown',
          platform: attributes.platform || 'Unknown',
        };
        break;

      case 'table':
      case 'basetable':
        this.currentTable = {
          id: this.generateId(),
          projectId: this.currentProject.id!,
          name: attributes.name || 'Unnamed Table',
          occurrence: attributes.occurrence || attributes.name || 'Main',
          sourceTable: attributes.sourceTable,
          recordCount: attributes.recordCount ? parseInt(attributes.recordCount) : undefined,
          fields: [],
          relationships: [],
        };
        break;

      case 'field':
        this.currentField = {
          id: this.generateId(),
          projectId: this.currentProject.id!,
          tableId: this.currentTable?.id || '',
          tableName: this.currentTable?.name || '',
          name: attributes.name || 'Unnamed Field',
          type: this.mapFieldType(attributes.dataType || attributes.type || 'text'),
          comment: attributes.comment,
          options: {
            indexed: attributes.indexed === 'true',
            required: attributes.notEmpty === 'true',
            unique: attributes.unique === 'true',
            global: attributes.global === 'true',
            repeating: attributes.maxRepeat ? parseInt(attributes.maxRepeat) > 1 : false,
            repetitions: attributes.maxRepeat ? parseInt(attributes.maxRepeat) : undefined,
          },
        };
        break;

      case 'layout':
        this.currentLayout = {
          id: this.generateId(),
          projectId: this.currentProject.id!,
          name: attributes.name || 'Unnamed Layout',
          type: this.mapLayoutType(attributes.type || 'form'),
          theme: attributes.theme,
          fields: [],
          parts: [],
          scripts: [],
        };
        break;

      case 'script':
        this.currentScript = {
          id: this.generateId(),
          projectId: this.currentProject.id!,
          name: attributes.name || 'Unnamed Script',
          runWithFullAccess: attributes.runWithFullAccess === 'true',
          includeInMenu: attributes.includeInMenu === 'true',
          steps: [],
        };
        break;

      case 'relationship':
        this.currentRelationship = {
          id: this.generateId(),
          projectId: this.currentProject.id!,
          name: attributes.name || 'Unnamed Relationship',
          leftTable: attributes.leftTable || '',
          leftField: attributes.leftField || '',
          rightTable: attributes.rightTable || '',
          rightField: attributes.rightField || '',
          type: this.mapRelationshipType(attributes.type || 'one-to-many'),
          options: {
            allowCreation: attributes.allowCreation === 'true',
            allowDeletion: attributes.allowDeletion === 'true',
            sortRecords: attributes.sortRecords === 'true',
          },
        };
        break;
    }
  }

  private async handleCloseTag(tagName: string, data: string): Promise<void> {
    switch (tagName.toLowerCase()) {
      case 'file':
        // File metadata
        if (this.elementStack.includes('FileReference')) {
          if (this.currentElement === 'name') {
            this.currentProject.name = data || this.currentProject.name;
          }
        }
        break;

      case 'created':
        if (data) {
          this.currentProject.metadata!.creationDate = new Date(data);
        }
        break;

      case 'modified':
        if (data) {
          this.currentProject.metadata!.modificationDate = new Date(data);
        }
        break;

      case 'table':
      case 'basetable':
        if (this.currentTable) {
          // Add to tables collection instead of saving to database
          this.tables.push(this.currentTable as Table);
          this.stats.tableCount++;
          this.currentTable = null;
        }
        break;

      case 'field':
        if (this.currentField) {
          // Add to fields collection instead of saving to database
          this.fields.push(this.currentField as Field);
          this.stats.fieldCount++;

          if (this.currentTable) {
            this.currentTable.fields = this.currentTable.fields || [];
            this.currentTable.fields.push(this.currentField as Field);
          }
          this.currentField = null;
        }
        break;

      case 'layout':
        if (this.currentLayout) {
          // Note: Layout creation would be implemented here
          this.stats.layoutCount++;
          this.currentLayout = null;
        }
        break;

      case 'script':
        if (this.currentScript) {
          // Note: Script creation would be implemented here
          this.stats.scriptCount++;
          this.currentScript = null;
        }
        break;

      case 'relationship':
        if (this.currentRelationship) {
          // Note: Relationship creation would be implemented here
          this.stats.relationshipCount++;
          this.currentRelationship = null;
        }
        break;

      case 'calculation':
        if (this.currentField) {
          this.currentField.calculation = data;
        }
        break;

      case 'comment':
        if (this.currentField) {
          this.currentField.comment = data;
        } else if (this.currentScript) {
          this.currentScript.comment = data;
        }
        break;
    }
  }

  // ─── Custom Functions ─────────────────────────────────────────────────────

  private processCustomFunctionCatalog(catalog: DDRCustomFunctionCatalog): void {
    const items = catalog.CustomFunction;
    if (!items) return;
    const arr = Array.isArray(items) ? items : [items];

    arr.forEach((cf: DDRCustomFunction) => {
      const fn: CustomFunction = {
        id: cf['@_id'] || this.generateId(),
        projectId: this.currentProject.id!,
        name: cf['@_name'] || 'Unnamed Function',
        parameters: (cf['@_parameters'] || '')
          .split(',')
          .map(p => p.trim())
          .filter(Boolean)
          .map(p => ({ name: p })),
        calculation: this.extractDDRText(cf.Calculation) || '',
        ...this.namedCalcRefs(cf.DisplayCalculation),
        comment: this.extractDDRText(cf.Comment),
      };
      this.customFunctions.push(fn);
      this.stats.customFunctionCount++;
    });

    console.log(`Parser: Processed ${arr.length} custom functions`);
  }

  // ─── Value Lists ──────────────────────────────────────────────────────────

  private processValueListCatalog(catalog: DDRValueListCatalog): void {
    const items = catalog.ValueList;
    if (!items) return;
    const arr = Array.isArray(items) ? items : [items];

    arr.forEach((vl: DDRValueList) => {
      const rawValues = vl.ValueListItems?.Value;
      const values: string[] = rawValues
        ? (Array.isArray(rawValues) ? rawValues : [rawValues])
            .map(v => this.extractDDRText(v) || '')
            .filter(Boolean)
        : [];

      this.valueLists.push({
        id: vl['@_id'] || this.generateId(),
        name: vl['@_name'] || 'Unnamed Value List',
        source: vl['@_source'] || 'Custom',
        items: values,
        sourceTable: vl.SourceField?.['@_table'],
        sourceField: vl.SourceField?.['@_field'],
      });
      this.stats.valueListCount = (this.stats.valueListCount || 0) + 1;
    });

    console.log(`Parser: Processed ${arr.length} value lists`);
  }

  // ─── Privileges ───────────────────────────────────────────────────────────

  private processPrivilegeCatalog(catalog: DDRPrivilegeCatalog): void {
    const items = catalog.PrivilegeSet;
    if (!items) return;
    const arr = Array.isArray(items) ? items : [items];

    arr.forEach((ps: DDRPrivilegeSet) => {
      this.privilegeSets.push({
        id: ps['@_id'] || this.generateId(),
        name: ps['@_name'] || 'Unnamed Privilege Set',
        fullAccess: ps['@_allAccess'] === 'True',
      });
      this.stats.privilegeSetCount = (this.stats.privilegeSetCount || 0) + 1;
    });

    console.log(`Parser: Processed ${arr.length} privilege sets`);
  }

  // ─── Script Cross-References ──────────────────────────────────────────────

  private extractScriptReferences(): void {
    for (const script of this.scripts) {
      for (const step of script.steps) {
        if (
          (step.step === 'Perform Script' || step.step === 'Perform Script on Server') &&
          step.options?.targetScript
        ) {
          this.scriptReferences.push({
            callerScriptName: script.name,
            targetScriptName: step.options.targetScript as string,
            targetFile: step.options.targetFile as string | undefined,
          });
          this.stats.scriptReferenceCount = (this.stats.scriptReferenceCount || 0) + 1;
        }
      }
    }

    console.log(`Parser: Extracted ${this.scriptReferences.length} script cross-references`);
  }

  private mapFieldType(type: string): FieldType {
    const typeMap: Record<string, FieldType> = {
      text: 'text',
      number: 'number',
      date: 'date',
      time: 'time',
      timestamp: 'timestamp',
      container: 'container',
      calculation: 'calculation',
      summary: 'summary',
      global: 'global',
    };

    return typeMap[type.toLowerCase()] || 'text';
  }

  private mapFieldKind(fieldType: string | undefined): FieldKind {
    const kindMap: Record<string, FieldKind> = {
      normal: 'normal',
      calculated: 'calculated',
      summary: 'summary',
    };

    return kindMap[(fieldType || '').toLowerCase()] || 'normal';
  }

  private mapLayoutType(type: string): LayoutType {
    const typeMap: Record<string, LayoutType> = {
      form: 'form',
      list: 'list',
      table: 'table',
      report: 'report',
      label: 'label',
      envelope: 'envelope',
    };

    return typeMap[type.toLowerCase()] || 'form';
  }

  private mapRelationshipType(type: string): RelationshipType {
    const typeMap: Record<string, RelationshipType> = {
      'one-to-one': 'one-to-one',
      'one-to-many': 'one-to-many',
      'many-to-one': 'many-to-one',
      'many-to-many': 'many-to-many',
    };

    return typeMap[type.toLowerCase()] || 'one-to-many';
  }

  private resetState(): void {
    this.currentProject = {};
    this.currentTable = null;
    this.currentField = null;
    this.currentLayout = null;
    this.currentScript = null;
    this.currentRelationship = null;
    this.elementStack = [];
    this.currentElement = '';
    this.currentData = '';

    // Clear collections
    this.tables = [];
    this.externalDataSources = new Map();
    this.fields = [];
    this.layouts = [];
    this.scripts = [];
    this.relationships = [];
    this.customFunctions = [];
    this.valueLists = [];
    this.privilegeSets = [];
    this.scriptReferences = [];

    this.stats = {
      tableCount: 0,
      occurrenceCount: 0,
      fieldCount: 0,
      layoutCount: 0,
      scriptCount: 0,
      relationshipCount: 0,
      customFunctionCount: 0,
      valueListCount: 0,
      privilegeSetCount: 0,
      scriptReferenceCount: 0,
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Extracts a text node's value as a string. fast-xml-parser's default
   * value-parsing turns purely-numeric or boolean-looking tag content (e.g.
   * a calculation formula that's just "1") into a JS number/boolean instead
   * of a string, and `typeof x === 'object'` doesn't catch that — so every
   * caller needs this instead of trusting the raw parsed value's type.
   */
  private extractDDRText(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'object') {
      const text = (value as { '#text'?: unknown })['#text'];
      return text === undefined || text === null ? undefined : String(text);
    }
    return String(value);
  }

  /**
   * Reads FileMaker's own disambiguated parse of a calculation formula
   * (<DisplayCalculation><Chunk type="FieldRef|FunctionRef">) instead of
   * guessing from the raw formula text — every FieldRef chunk is definitely
   * a real field reference, so this can't misfire on a string literal like
   * "Please choose A::B" the way a text-regex heuristic could.
   */
  private extractCalcRefs(displayCalc: DDRDisplayCalculation | undefined): {
    fieldRefs: CalcFieldReference[];
    functionRefs: string[];
  } {
    const fieldRefs: CalcFieldReference[] = [];
    const functionRefs: string[] = [];
    const chunks = displayCalc?.Chunk;
    if (!chunks) return { fieldRefs, functionRefs };

    const arr = Array.isArray(chunks) ? chunks : [chunks];
    for (const c of arr) {
      if (c['@_type'] === 'FieldRef') {
        const table = c.Field?.['@_table'];
        const name = c.Field?.['@_name'];
        if (table && name) fieldRefs.push({ table, name });
      } else if (c['@_type'] === 'FunctionRef') {
        const name = this.extractDDRText(c);
        if (name) functionRefs.push(name);
      }
    }

    return { fieldRefs, functionRefs };
  }

  private namedCalcRefs(displayCalc: DDRDisplayCalculation | undefined): {
    calculationFieldRefs: CalcFieldReference[];
    calculationFunctionRefs: string[];
  } {
    const { fieldRefs, functionRefs } = this.extractCalcRefs(displayCalc);
    return { calculationFieldRefs: fieldRefs, calculationFunctionRefs: functionRefs };
  }

  private async saveParsedDataToDatabase(): Promise<void> {
    try {
      // Save tables
      for (const table of this.tables) {
        await databaseService.createTable(table);
      }

      // Save fields
      for (const field of this.fields) {
        await databaseService.createField(field);
      }

      // Save layouts
      for (const layout of this.layouts) {
        await databaseService.createLayout(layout);
      }

      // Save scripts
      for (const script of this.scripts) {
        await databaseService.createScript(script);
      }

      // Save custom functions
      for (const fn of this.customFunctions) {
        await databaseService.createCustomFunction(fn);
      }

      // Save script -> script cross-references (already computed by extractScriptReferences)
      await databaseService.saveScriptReferences(
        this.currentProject.id!,
        this.scriptReferences.map(r => ({
          id: this.generateId(),
          projectId: this.currentProject.id!,
          ...r,
        }))
      );

      // TODO: persist value lists, privilege sets to DB
      console.log(`Parsed ${this.layouts.length} layouts`);
      console.log(
        `Parsed ${this.scripts.length} scripts (${this.scriptReferences.length} cross-references)`
      );
      console.log(`Parsed ${this.relationships.length} relationships`);
      console.log(`Parsed ${this.customFunctions.length} custom functions`);
      console.log(`Parsed ${this.valueLists.length} value lists`);
      console.log(`Parsed ${this.privilegeSets.length} privilege sets`);
    } catch (error) {
      this.errors.push(`Failed to save parsed data to database: ${error}`);
    }
  }

  private async readFileWithBOMHandling(filePath: string): Promise<string> {
    try {
      // First, read as buffer to detect BOM
      const buffer = await fs.readFile(filePath);

      if (buffer.length >= 2) {
        // UTF-16 LE BOM (FF FE)
        if (buffer[0] === 0xff && buffer[1] === 0xfe) {
          let content = buffer.toString('utf16le');
          // Remove BOM character (U+FEFF) if present
          if (content.charCodeAt(0) === 0xfeff) {
            content = content.substring(1);
          }
          // Clean replacement characters and null bytes
          content = content.replace(/\uFFFD/g, '').replace(/\0/g, '');
          return content;
        }

        // UTF-16 BE BOM (FE FF) \u2014 swap bytes to convert to LE, then decode
        if (buffer[0] === 0xfe && buffer[1] === 0xff) {
          const swapped = Buffer.alloc(buffer.length);
          for (let i = 0; i + 1 < buffer.length; i += 2) {
            swapped[i] = buffer[i + 1];
            swapped[i + 1] = buffer[i];
          }
          let content = swapped.toString('utf16le');
          if (content.charCodeAt(0) === 0xfeff) {
            content = content.substring(1);
          }
          content = content.replace(/\uFFFD/g, '').replace(/\0/g, '');
          return content;
        }

        // UTF-8 BOM (EF BB BF)
        if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
          return buffer.toString('utf-8').replace(/^\uFEFF/, '');
        }
      }

      // No BOM detected, assume UTF-8
      return buffer.toString('utf-8');
    } catch (error) {
      throw new Error(`Failed to read file with BOM handling: ${error}`);
    }
  }

  async validateXMLFile(filePath: string): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const content = await this.readFileWithBOMHandling(filePath);

      // Basic XML validation
      if (!content.includes('<?xml')) {
        return { isValid: false, errors: ['Not a valid XML file'] };
      }

      if (
        !content.includes('<fmpddr') &&
        !content.includes('<FMPDDRDocument') &&
        !content.includes('<FMPReport')
      ) {
        return { isValid: false, errors: ['Not a FileMaker DDR XML file'] };
      }

      // Try to parse with fast-xml-parser to check validity
      const parser = new XMLParser({
        ignoreAttributes: false,
      });
      const errors: string[] = [];

      try {
        // Parse first 5000 characters to check basic structure
        const testContent = content.substring(0, 5000);
        parser.parse(testContent);
      } catch (error: unknown) {
        errors.push(error instanceof Error ? error.message : String(error));
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`File validation error: ${error}`],
      };
    }
  }

  async getParseProgress(projectId: string): Promise<PerformanceMetrics | null> {
    // In a real implementation, this would track parsing progress
    // For now, we'll simulate with basic metrics
    const project = await databaseService.getProject(projectId);

    if (!project) return null;

    return {
      operation: 'parse',
      duration: project.statistics.parseTime || 0,
      memoryUsage: process.memoryUsage().heapUsed,
      timestamp: new Date(),
      metadata: {
        projectId,
        status: project.status,
        entityCount: project.statistics.tableCount + project.statistics.fieldCount,
      },
    };
  }
}

// Export singleton instance
export const xmlParserService = new XMLParserService();
