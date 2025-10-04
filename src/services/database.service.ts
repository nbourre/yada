/**
 * Mock Database service for testing purposes
 */

import { Project, Table, Field } from '../models';

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

  import(data: Uint8Array): void {
    // Mock import - does nothing
  }

  close(): void {
    this.initialized = false;
    this.mockProjects.clear();
    this.mockTables.clear();
    this.mockFields.clear();
  }
}

// Singleton instance
export const databaseService = new DatabaseService();