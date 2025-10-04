/**
 * XML Parser Service for FileMaker Database Design Report (DDR)
 * Uses saxes for streaming XML parsing
 */

import { SaxesParser } from 'saxes';
import { promises as fs } from 'fs';
import {
  Project,
  Table,
  Field,
  Layout,
  Script,
  Relationship,
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

  // Statistics counters
  private stats: ProjectStatistics = {
    tableCount: 0,
    fieldCount: 0,
    layoutCount: 0,
    scriptCount: 0,
    relationshipCount: 0,
    customFunctionCount: 0,
  };

  async parseFile(filePath: string): Promise<ParseResult> {
    this.startTime = Date.now();
    this.errors = [];
    this.resetState();

    try {
      // Read file content
      const xmlContent = await fs.readFile(filePath, 'utf-8');

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
      await this.parseXMLContent(xmlContent);

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
    return new Promise((resolve, reject) => {
      const parser = new SaxesParser({
        xmlns: false,
        position: false,
      });

      parser.on('opentag', node => {
        this.elementStack.push(node.name);
        this.currentElement = node.name;
        this.currentData = '';

        this.handleOpenTag(node.name, node.attributes);
      });

      parser.on('text', data => {
        this.currentData += data.trim();
      });

      parser.on('closetag', tagName => {
        this.handleCloseTag(typeof tagName === 'string' ? tagName : tagName.name, this.currentData);

        this.elementStack.pop();
        this.currentElement = this.elementStack[this.elementStack.length - 1] || '';
        this.currentData = '';
      });

      parser.on('error', error => {
        this.errors.push(`XML Parse Error: ${error.message}`);
        reject(error);
      });

      parser.on('end', () => {
        resolve();
      });

      try {
        parser.write(content);
        parser.close();
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleOpenTag(tagName: string, attributes: Record<string, string>): void {
    switch (tagName.toLowerCase()) {
      case 'fmpddr':
        // Root element - extract version info
        this.currentProject.metadata = {
          ...this.currentProject.metadata!,
          fileMakerVersion: attributes.version || 'Unknown',
          platform: attributes.platform || 'Unknown',
        };
        break;

      case 'table':
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
        if (this.currentTable) {
          try {
            await databaseService.createTable(this.currentTable as Table);
            this.stats.tableCount++;
          } catch (error) {
            this.errors.push(`Failed to save table ${this.currentTable.name}: ${error}`);
          }
          this.currentTable = null;
        }
        break;

      case 'field':
        if (this.currentField) {
          try {
            await databaseService.createField(this.currentField as Field);
            this.stats.fieldCount++;

            if (this.currentTable) {
              this.currentTable.fields = this.currentTable.fields || [];
              this.currentTable.fields.push(this.currentField as Field);
            }
          } catch (error) {
            this.errors.push(`Failed to save field ${this.currentField.name}: ${error}`);
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
    this.stats = {
      tableCount: 0,
      fieldCount: 0,
      layoutCount: 0,
      scriptCount: 0,
      relationshipCount: 0,
      customFunctionCount: 0,
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async validateXMLFile(filePath: string): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Basic XML validation
      if (!content.includes('<?xml')) {
        return { isValid: false, errors: ['Not a valid XML file'] };
      }

      if (!content.includes('<fmpddr') && !content.includes('<FMPDDRDocument')) {
        return { isValid: false, errors: ['Not a FileMaker DDR XML file'] };
      }

      // Try to parse a small portion to check validity
      const parser = new SaxesParser();
      const errors: string[] = [];

      parser.on('error', error => {
        errors.push(error.message);
      });

      // Parse first 1000 characters to check basic structure
      const testContent = content.substring(0, 1000);
      parser.write(testContent);

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
