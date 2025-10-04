/**
 * Core data models for FileMaker DDR analysis
 * Based on FileMaker Database Design Report (DDR) structure
 */

export interface BaseEntity {
  id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Project extends BaseEntity {
  filePath: string;
  fileName: string;
  fileSize: number;
  parsedAt: Date;
  status: 'parsing' | 'ready' | 'error';
  statistics: ProjectStatistics;
  metadata: ProjectMetadata;
}

export interface ProjectStatistics {
  tableCount: number;
  fieldCount: number;
  layoutCount: number;
  scriptCount: number;
  relationshipCount: number;
  customFunctionCount: number;
  parseTime?: number; // milliseconds
}

export interface ProjectMetadata {
  fileMakerVersion: string;
  platform: string;
  createdBy: string;
  modifiedBy: string;
  creationDate: Date;
  modificationDate: Date;
  accountPrivilegeSet?: string;
  customMenus?: string[];
}

export interface Table extends BaseEntity {
  projectId: string;
  occurrence: string;
  sourceTable?: string;
  recordCount?: number;
  fields: Field[];
  relationships: Relationship[];
}

export interface Field extends BaseEntity {
  projectId: string;
  tableId: string;
  tableName: string;
  type: FieldType;
  options: FieldOptions;
  calculation?: string;
  comment?: string;
  validation?: ValidationRule[];
  autoEnter?: AutoEnterOptions;
  storage?: StorageOptions;
}

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'time'
  | 'timestamp'
  | 'container'
  | 'calculation'
  | 'summary'
  | 'global';

export interface FieldOptions {
  indexed?: boolean;
  required?: boolean;
  unique?: boolean;
  global?: boolean;
  repeating?: boolean;
  repetitions?: number;
}

export interface ValidationRule {
  type: 'required' | 'unique' | 'existing' | 'range' | 'calculation';
  value?: string | number;
  message?: string;
  strict?: boolean;
}

export interface AutoEnterOptions {
  creationDate?: boolean;
  creationTime?: boolean;
  creationTimestamp?: boolean;
  modificationDate?: boolean;
  modificationTime?: boolean;
  modificationTimestamp?: boolean;
  serialNumber?: boolean;
  accountName?: boolean;
  calculation?: string;
  lookupFromField?: string;
}

export interface StorageOptions {
  global?: boolean;
  repeating?: boolean;
  indexLanguage?: string;
  indexType?: 'none' | 'minimal' | 'all';
}

export interface Layout extends BaseEntity {
  projectId: string;
  type: LayoutType;
  theme?: string;
  fields: LayoutField[];
  parts: LayoutPart[];
  scripts: string[];
}

export type LayoutType = 'form' | 'list' | 'table' | 'report' | 'label' | 'envelope';

export interface LayoutField {
  fieldId: string;
  fieldName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  formatting?: FieldFormatting;
}

export interface FieldFormatting {
  font?: string;
  size?: number;
  style?: ('bold' | 'italic' | 'underline')[];
  color?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

export interface LayoutPart {
  type: 'header' | 'body' | 'footer' | 'leading' | 'trailing' | 'title';
  height: number;
}

export interface Script extends BaseEntity {
  projectId: string;
  steps: ScriptStep[];
  runWithFullAccess?: boolean;
  includeInMenu?: boolean;
  comment?: string;
}

export interface ScriptStep {
  step: string;
  options?: Record<string, any>;
  comment?: string;
  enabled: boolean;
}

export interface Relationship extends BaseEntity {
  projectId: string;
  leftTable: string;
  leftField: string;
  rightTable: string;
  rightField: string;
  type: RelationshipType;
  options: RelationshipOptions;
}

export type RelationshipType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

export interface RelationshipOptions {
  allowCreation?: boolean;
  allowDeletion?: boolean;
  sortRecords?: boolean;
  sortField?: string;
  sortOrder?: 'ascending' | 'descending';
}

export interface CustomFunction extends BaseEntity {
  projectId: string;
  parameters: FunctionParameter[];
  calculation: string;
  comment?: string;
}

export interface FunctionParameter {
  name: string;
  type?: string;
}

export interface Privilege extends BaseEntity {
  projectId: string;
  type: 'account' | 'privilege_set';
  fullAccess?: boolean;
  dataAccess?: DataAccessLevel;
  designAccess?: DesignAccessLevel;
  extendedPrivileges?: string[];
}

export type DataAccessLevel = 'all' | 'view_only' | 'data_entry_only' | 'none' | 'custom';
export type DesignAccessLevel = 'all' | 'modify_only' | 'view_only' | 'none';

// Search and Analysis Types
export interface SearchQuery {
  projectId: string;
  query: string;
  entityTypes: EntityType[];
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

export type EntityType =
  | 'table'
  | 'field'
  | 'layout'
  | 'script'
  | 'relationship'
  | 'custom_function'
  | 'privilege';

export interface SearchResult {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  matches: SearchMatch[];
  score: number;
}

export interface SearchMatch {
  field: string;
  value: string;
  startIndex: number;
  endIndex: number;
  context?: string;
}

// Graph and Visualization Types
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout?: GraphLayout;
}

export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
  data: Record<string, any>;
  position?: { x: number; y: number };
  style?: NodeStyle;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label?: string;
  style?: EdgeStyle;
}

export interface NodeStyle {
  color?: string;
  size?: number;
  shape?: 'ellipse' | 'rectangle' | 'diamond' | 'triangle';
}

export interface EdgeStyle {
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface GraphLayout {
  algorithm: 'force' | 'hierarchical' | 'circular' | 'grid';
  options?: Record<string, any>;
}

// Export Types
export interface ExportOptions {
  format: ExportFormat;
  entities: EntityType[];
  includeMetadata?: boolean;
  includeRelationships?: boolean;
  filters?: ExportFilter[];
}

export type ExportFormat = 'json' | 'csv' | 'xml' | 'pdf' | 'html';

export interface ExportFilter {
  entity: EntityType;
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  value: string;
}

export interface ExportResult {
  format: ExportFormat;
  data: string | Buffer;
  filename: string;
  size: number;
  generatedAt: Date;
}

// Database Schema Types for sql.js
export interface DatabaseSchema {
  projects: Project[];
  tables: Table[];
  fields: Field[];
  layouts: Layout[];
  scripts: Script[];
  relationships: Relationship[];
  custom_functions: CustomFunction[];
  privileges: Privilege[];
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string | { code: string; message: string };
  timestamp: Date;
  requestId?: string;
  warnings?: string[];
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Performance Monitoring
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}
