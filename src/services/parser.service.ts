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
  Script,
  ScriptStep,
  Relationship,
  CustomFunction,
  FieldType,
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
interface DDRField {
  '@_name'?: string;
  '@_dataType'?: string;
  '@_type'?: string;
  Calculation?: { '#text'?: string } | string;
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

interface DDRLayout {
  '@_name'?: string;
  '@_type'?: string;
}
interface DDRLayoutCatalog {
  Layout: DDRLayout | DDRLayout[];
}

interface DDRScriptStep {
  '@_id'?: string;
  '@_name'?: string;
  '@_enable'?: string;
  Calculation?: { '#text'?: string } | string;
  // "Perform Script" target
  Script?: { '@_name'?: string; '@_id'?: string };
  FileReference?: { '@_name'?: string };
  // "Go to Layout"
  Layout?: { '@_name'?: string };
  // "Set Field"
  Field?: { '@_name'?: string; '@_table'?: string } | { '@_name'?: string; '@_table'?: string }[];
}

interface DDRScript {
  '@_name'?: string;
  '@_id'?: string;
  '@_comment'?: string;
  Comment?: { '#text'?: string } | string;
  StepList?: { Step?: DDRScriptStep | DDRScriptStep[] };
}
interface DDRScriptCatalog {
  Script: DDRScript | DDRScript[];
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

interface DDRTableOccurrence {
  '@_id'?: string;
  '@_name'?: string;
  '@_baseTable'?: string;
}
interface DDRRelationshipGraph {
  TableList?: { Table: DDRTableOccurrence | DDRTableOccurrence[] };
  RelationshipList?: { Relationship: DDRRelationship | DDRRelationship[] };
}

// Custom Functions
interface DDRCustomFunction {
  '@_id'?: string;
  '@_name'?: string;
  '@_parameters'?: string;
  Calculation?: { '#text'?: string } | string;
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

    // Process LayoutCatalog
    if (fileElement.LayoutCatalog) {
      this.processLayoutCatalog(fileElement.LayoutCatalog);
    }

    // Process ScriptCatalog
    if (fileElement.ScriptCatalog) {
      this.processScriptCatalog(fileElement.ScriptCatalog);
    }

    // Process RelationshipGraph
    if (fileElement.RelationshipGraph) {
      this.processRelationshipGraph(fileElement.RelationshipGraph);
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
            options: {},
            calculation:
              typeof fieldData.Calculation === 'object'
                ? fieldData.Calculation['#text']
                : fieldData.Calculation,
            comment:
              typeof fieldData.Comment === 'object'
                ? fieldData.Comment['#text']
                : fieldData.Comment,
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

  private processLayoutCatalog(catalog: DDRLayoutCatalog): void {
    const layouts = catalog.Layout;
    if (!layouts) return;

    const layoutArray = Array.isArray(layouts) ? layouts : [layouts];

    layoutArray.forEach((layoutData: DDRLayout) => {
      const layout: Layout = {
        id: this.generateId(),
        projectId: this.currentProject.id!,
        name: layoutData['@_name'] || 'Unnamed Layout',
        type: 'form' as LayoutType,
        fields: [],
        parts: [],
        scripts: [],
      };

      this.layouts.push(layout);
      this.stats.layoutCount++;
    });

    console.log(`Parser: Processed ${layoutArray.length} layouts`);
  }

  private processScriptCatalog(catalog: DDRScriptCatalog): void {
    const scripts = catalog.Script;
    if (!scripts) return;

    const scriptArray = Array.isArray(scripts) ? scripts : [scripts];

    scriptArray.forEach((scriptData: DDRScript) => {
      const steps = this.parseScriptSteps(scriptData);

      const script: Script = {
        id: this.generateId(),
        projectId: this.currentProject.id!,
        name: scriptData['@_name'] || 'Unnamed Script',
        steps,
        comment:
          scriptData['@_comment'] ||
          (typeof scriptData.Comment === 'object'
            ? scriptData.Comment?.['#text']
            : scriptData.Comment),
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
        case 'If':
        case 'Else If':
        case 'Exit Script':
        case 'Halt Script': {
          const calc = s.Calculation;
          step.options = {
            calculation: typeof calc === 'object' ? calc?.['#text'] || '' : calc || '',
          };
          break;
        }
      }

      steps.push(step);
    }

    return steps;
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
        calculation:
          typeof cf.Calculation === 'object'
            ? cf.Calculation?.['#text'] || ''
            : cf.Calculation || '',
        comment: typeof cf.Comment === 'object' ? cf.Comment?.['#text'] : cf.Comment,
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
            .map(v => v['#text'] || '')
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

      // TODO: persist layouts, scripts, relationships, custom functions, value lists, privileges to DB
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
