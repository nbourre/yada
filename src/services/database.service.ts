/**
 * Mock Database service for testing purposes
 */

import {
  Project,
  Table,
  Field,
  Relationship,
  Layout,
  Script,
  CustomFunction,
  ScriptReference,
} from '../models';

// Search result type
interface SearchResult {
  entityType: string;
  entityId: string;
  entityName: string;
  context: string;
}

export class DatabaseService {
  private initialized = false;
  private mockProjects: Map<string, Project> = new Map();
  private mockTables: Map<string, Table> = new Map();
  private mockFields: Map<string, Field> = new Map();
  private mockRelationships: Map<string, Relationship[]> = new Map();
  private mockLayouts: Map<string, Layout> = new Map();
  private mockScripts: Map<string, Script> = new Map();
  private mockCustomFunctions: Map<string, CustomFunction> = new Map();
  private mockScriptReferences: Map<string, ScriptReference[]> = new Map(); // keyed by projectId
  // Relationship operations
  async createRelationship(relationship: Relationship): Promise<Relationship> {
    if (!this.initialized) await this.initialize();
    const rels = this.mockRelationships.get(relationship.projectId) || [];
    rels.push(relationship);
    this.mockRelationships.set(relationship.projectId, rels);
    return relationship;
  }

  async getRelationshipsForProject(projectId: string): Promise<Relationship[]> {
    if (!this.initialized) await this.initialize();
    return this.mockRelationships.get(projectId) || [];
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create some mock data
    const mockProject: Project = {
      id: 'test-project-id',
      name: 'Test Project',
      filePath: '/test/project.xml',
      fileName: 'project.xml',
      fileSize: 1024,
      parsedAt: new Date(),
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
      statistics: {
        tableCount: 5,
        occurrenceCount: 0,
        fieldCount: 25,
        layoutCount: 10,
        scriptCount: 8,
        relationshipCount: 3,
        customFunctionCount: 2,
        parseTime: 1500,
      },
      metadata: {
        fileMakerVersion: '19.0',
        platform: 'macOS',
        createdBy: 'Admin',
        modifiedBy: 'Admin',
        creationDate: new Date('2023-01-01'),
        modificationDate: new Date(),
        accountPrivilegeSet: '[Full Access]',
        customMenus: [],
      },
    };

    this.mockProjects.set(mockProject.id, mockProject);

    // Add additional mock project for export tests
    const exportTestProject: Project = {
      id: 'test-project',
      name: 'Export Test Project',
      fileName: 'export_test.xml',
      filePath: '/path/to/export_test.xml',
      fileSize: 2048,
      parsedAt: new Date(),
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
      statistics: {
        tableCount: 3,
        occurrenceCount: 0,
        fieldCount: 15,
        layoutCount: 5,
        scriptCount: 4,
        relationshipCount: 2,
        customFunctionCount: 1,
        parseTime: 1000,
      },
      metadata: {
        fileMakerVersion: '19.0',
        platform: 'macOS',
        createdBy: 'Admin',
        modifiedBy: 'Admin',
        creationDate: new Date('2023-01-01'),
        modificationDate: new Date(),
        accountPrivilegeSet: '[Full Access]',
        customMenus: [],
      },
    };

    this.mockProjects.set(exportTestProject.id, exportTestProject);

    // Add empty project for graph testing
    const emptyProject: Project = {
      id: 'empty-project',
      name: 'Empty Project',
      fileName: 'empty.xml',
      filePath: '/path/to/empty.xml',
      fileSize: 512,
      parsedAt: new Date(),
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
      statistics: {
        tableCount: 0,
        occurrenceCount: 0,
        fieldCount: 0,
        layoutCount: 0,
        scriptCount: 0,
        relationshipCount: 0,
        customFunctionCount: 0,
        parseTime: 100,
      },
      metadata: {
        fileMakerVersion: '19.0',
        platform: 'macOS',
        createdBy: 'Admin',
        modifiedBy: 'Admin',
        creationDate: new Date('2023-01-01'),
        modificationDate: new Date(),
        accountPrivilegeSet: '[Full Access]',
        customMenus: [],
      },
    };

    this.mockProjects.set(emptyProject.id, emptyProject);

    // Add active project for deletion testing
    const activeProject: Project = {
      id: 'active-project-id',
      name: 'Active Project',
      fileName: 'active.xml',
      filePath: '/path/to/active.xml',
      fileSize: 1024,
      parsedAt: new Date(),
      status: 'ready', // This is treated as 'active' for deletion tests
      createdAt: new Date(),
      updatedAt: new Date(),
      statistics: {
        tableCount: 2,
        occurrenceCount: 0,
        fieldCount: 10,
        layoutCount: 3,
        scriptCount: 2,
        relationshipCount: 1,
        customFunctionCount: 0,
        parseTime: 800,
      },
      metadata: {
        fileMakerVersion: '19.0',
        platform: 'macOS',
        createdBy: 'Admin',
        modifiedBy: 'Admin',
        creationDate: new Date('2023-01-01'),
        modificationDate: new Date(),
        accountPrivilegeSet: '[Full Access]',
        customMenus: [],
      },
    };

    this.mockProjects.set(activeProject.id, activeProject);
    this.initialized = true;
  }

  // Project operations
  async createProject(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    if (!this.initialized) await this.initialize();

    const now = new Date();
    const fullProject: Project = {
      ...project,
      createdAt: now,
      updatedAt: now,
    };

    this.mockProjects.set(fullProject.id, fullProject);
    return fullProject;
  }

  async getProject(id: string): Promise<Project | null> {
    if (!this.initialized) await this.initialize();
    return this.mockProjects.get(id) || null;
  }

  async getAllProjects(): Promise<Project[]> {
    if (!this.initialized) await this.initialize();
    return Array.from(this.mockProjects.values());
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    if (!this.initialized) await this.initialize();

    const existing = this.mockProjects.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.mockProjects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    return this.mockProjects.delete(id);
  }

  // Table operations
  async createTable(table: Omit<Table, 'createdAt' | 'updatedAt'>): Promise<Table> {
    if (!this.initialized) await this.initialize();

    const now = new Date();
    const fullTable: Table = {
      ...table,
      createdAt: now,
      updatedAt: now,
      fields: [],
      relationships: [],
    };

    this.mockTables.set(fullTable.id, fullTable);
    return fullTable;
  }

  async getTablesForProject(projectId: string): Promise<Table[]> {
    if (!this.initialized) await this.initialize();
    return Array.from(this.mockTables.values()).filter(table => table.projectId === projectId);
  }

  // Field operations
  async createField(field: Omit<Field, 'createdAt' | 'updatedAt'>): Promise<Field> {
    if (!this.initialized) await this.initialize();

    const now = new Date();
    const fullField: Field = {
      ...field,
      createdAt: now,
      updatedAt: now,
      options: {
        indexed: false,
        required: false,
        unique: false,
        global: false,
        repeating: false,
        ...field.options,
      },
      validation: field.validation || [],
      autoEnter: field.autoEnter || {},
      storage: field.storage || {},
    };

    this.mockFields.set(fullField.id, fullField);
    return fullField;
  }

  async getFieldsForProject(projectId: string): Promise<Field[]> {
    if (!this.initialized) await this.initialize();
    return Array.from(this.mockFields.values()).filter(field => field.projectId === projectId);
  }

  // Layout operations
  async createLayout(layout: Omit<Layout, 'createdAt' | 'updatedAt'>): Promise<Layout> {
    if (!this.initialized) await this.initialize();

    const now = new Date();
    const fullLayout: Layout = { ...layout, createdAt: now, updatedAt: now };

    this.mockLayouts.set(fullLayout.id, fullLayout);
    return fullLayout;
  }

  async getLayoutsForProject(projectId: string): Promise<Layout[]> {
    if (!this.initialized) await this.initialize();
    return Array.from(this.mockLayouts.values()).filter(layout => layout.projectId === projectId);
  }

  // Script operations
  async createScript(script: Omit<Script, 'createdAt' | 'updatedAt'>): Promise<Script> {
    if (!this.initialized) await this.initialize();

    const now = new Date();
    const fullScript: Script = { ...script, createdAt: now, updatedAt: now };

    this.mockScripts.set(fullScript.id, fullScript);
    return fullScript;
  }

  async getScriptsForProject(projectId: string): Promise<Script[]> {
    if (!this.initialized) await this.initialize();
    return Array.from(this.mockScripts.values()).filter(script => script.projectId === projectId);
  }

  // Custom function operations
  async createCustomFunction(
    fn: Omit<CustomFunction, 'createdAt' | 'updatedAt'>
  ): Promise<CustomFunction> {
    if (!this.initialized) await this.initialize();

    const now = new Date();
    const fullFn: CustomFunction = { ...fn, createdAt: now, updatedAt: now };

    this.mockCustomFunctions.set(fullFn.id, fullFn);
    return fullFn;
  }

  async getCustomFunctionsForProject(projectId: string): Promise<CustomFunction[]> {
    if (!this.initialized) await this.initialize();
    return Array.from(this.mockCustomFunctions.values()).filter(fn => fn.projectId === projectId);
  }

  // Script cross-reference operations (script -> script call graph)
  async saveScriptReferences(projectId: string, refs: ScriptReference[]): Promise<void> {
    if (!this.initialized) await this.initialize();
    this.mockScriptReferences.set(projectId, refs);
  }

  async getScriptReferencesForProject(projectId: string): Promise<ScriptReference[]> {
    if (!this.initialized) await this.initialize();
    return this.mockScriptReferences.get(projectId) ?? [];
  }

  // Search operations
  async searchEntities(
    projectId: string,
    query: string,
    entityTypes: string[]
  ): Promise<SearchResult[]> {
    if (!this.initialized) await this.initialize();

    const results: SearchResult[] = [];

    if (entityTypes.includes('table')) {
      const tables = await this.getTablesForProject(projectId);
      tables
        .filter(table => table.name.toLowerCase().includes(query.toLowerCase()))
        .forEach(table => {
          results.push({
            entityType: 'table',
            entityId: table.id,
            entityName: table.name,
            context: table.occurrence,
          });
        });
    }

    if (entityTypes.includes('field')) {
      const fields = await this.getFieldsForProject(projectId);
      fields
        .filter(field => field.name.toLowerCase().includes(query.toLowerCase()))
        .forEach(field => {
          results.push({
            entityType: 'field',
            entityId: field.id,
            entityName: field.name,
            context: field.tableName,
          });
        });
    }

    return results;
  }

  // Export/Import operations
  export(): Uint8Array {
    // Return empty buffer for mock
    return new Uint8Array();
  }

  import(_data: Uint8Array): void {
    // Mock import - does nothing
  }

  close(): void {
    this.initialized = false;
    this.mockProjects.clear();
    this.mockTables.clear();
    this.mockFields.clear();
    this.mockLayouts.clear();
    this.mockScripts.clear();
    this.mockCustomFunctions.clear();
    this.mockScriptReferences.clear();
    // relationships intentionally not cleared to allow inspection across sessions in tests
  }
}

// Singleton instance
export const databaseService = new DatabaseService();
