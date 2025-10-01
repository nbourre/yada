# Data Model: FileMaker DDR Entities

## Entity Relationship Overview

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Project   │────│    Files     │────│  Entities   │
└─────────────┘    └──────────────┘    └─────────────┘
                           │                    │
                           │                    │
                   ┌───────────────┐    ┌─────────────┐
                   │   Snapshots   │    │ References  │
                   └───────────────┘    └─────────────┘
                                               │
                                       ┌─────────────┐
                                       │ Search FTS  │
                                       └─────────────┘
```

## Core Tables

### projects
**Purpose**: Root container for each DDR analysis project

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v4 identifier |
| name | TEXT | NOT NULL | User-friendly project name |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last modification |
| settings | JSON | | User preferences, filters, etc. |

### files  
**Purpose**: Track source DDR XML files within a project

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v4 identifier |
| project_id | TEXT | FOREIGN KEY(projects.id) | Parent project |
| name | TEXT | NOT NULL | Original filename |
| path | TEXT | NOT NULL | Full file path |
| role | TEXT | CHECK(role IN ('ui', 'data', 'mixed')) | FileMaker file type |
| hash | TEXT | NOT NULL | SHA-256 for change detection |
| filemaker_version | TEXT | | FM version (e.g., "19.6.1") |
| parsed_at | DATETIME | | When file was last parsed |
| size_bytes | INTEGER | | File size in bytes |

### entities
**Purpose**: Universal table for all FileMaker solution components

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v5 (deterministic) |
| file_id | TEXT | FOREIGN KEY(files.id) | Source file |
| type | TEXT | NOT NULL | Entity type (see enum below) |
| name | TEXT | NOT NULL | Entity name/identifier |
| internal_id | TEXT | | FileMaker internal ID |
| parent_id | TEXT | FOREIGN KEY(entities.id) | Hierarchical parent |
| folder_path | TEXT | | Organizational folder |
| description | TEXT | | Comments, calculations, etc. |
| properties | JSON | | Type-specific attributes |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Parse timestamp |

**Entity Types Enum**:
- `table` - Base tables
- `field` - Table fields  
- `table_occurrence` - Table occurrences (TOs)
- `relationship` - TO relationships
- `script` - Scripts
- `script_step` - Individual script steps
- `layout` - Layouts
- `layout_object` - Layout objects
- `custom_function` - Custom functions
- `value_list` - Value lists
- `privilege_set` - Security privileges
- `account` - User accounts

### references
**Purpose**: Cross-references between entities (universal edge table)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v4 identifier |
| from_entity_id | TEXT | FOREIGN KEY(entities.id) | Source entity |
| to_entity_id | TEXT | FOREIGN KEY(entities.id) | Target entity |
| reference_type | TEXT | NOT NULL | Type of relationship |
| context | JSON | | Additional metadata |
| confidence | REAL | DEFAULT 1.0 | Parsing confidence (0-1) |
| line_number | INTEGER | | Source line for debugging |

**Reference Types**:
- `script_calls` - Script performs another script
- `field_usage` - Script/layout uses field
- `layout_reference` - Script goes to layout
- `table_reference` - Script/layout references table
- `calculation_dependency` - Calculation uses field/function
- `relationship_link` - TO to TO via relationship
- `value_list_usage` - Field uses value list
- `privilege_grants` - Account has privilege set

### snapshots
**Purpose**: Versioned captures of project state for comparison

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v4 identifier |
| project_id | TEXT | FOREIGN KEY(projects.id) | Parent project |
| name | TEXT | NOT NULL | User-provided snapshot name |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation time |
| file_hashes | JSON | NOT NULL | Hash of each file at snapshot time |
| entity_count | JSON | | Count by entity type |
| metrics | JSON | | Performance/analysis metrics |
| git_commit | TEXT | | Git commit hash if available |

### search_fts
**Purpose**: Full-text search index (FTS5 virtual table)

| Column | Type | Description |
|--------|------|-------------|
| entity_id | TEXT | Foreign key to entities.id |
| content | TEXT | Searchable text content |
| entity_type | TEXT | For filtering searches |
| entity_name | TEXT | For result display |

## Type-Specific Properties Schema

### Table Entity Properties
```json
{
  "occurrence_count": 12,
  "field_count": 45,
  "has_serial_field": true,
  "has_calculation_fields": true,
  "has_container_fields": false
}
```

### Field Entity Properties  
```json
{
  "field_type": "text|number|date|time|timestamp|container|calculation",
  "max_length": 255,
  "auto_enter": {
    "type": "serial|calculation|creation_timestamp|modification_timestamp",
    "calculation": "Get(CurrentTimestamp)"
  },
  "validation": {
    "required": true,
    "unique": false,
    "range": {"min": 0, "max": 100}
  },
  "indexing": "none|minimal|all",
  "storage": "calculated|stored"
}
```

### Script Entity Properties
```json
{
  "step_count": 25,
  "has_parameters": true,
  "has_loops": true,
  "has_conditionals": true,
  "calls_subscripts": ["script_uuid_1", "script_uuid_2"],
  "execution_privilege": "full_access|data_entry_only|accounts_only"
}
```

### Layout Entity Properties
```json
{
  "table_occurrence_id": "to_uuid_here",
  "layout_type": "form|list|table|report|labels",
  "object_count": 150,
  "has_portals": true,
  "has_charts": false,
  "has_web_viewers": true,
  "theme": "Enlightened"
}
```

## Indexing Strategy

### Primary Indexes
```sql
-- Entity lookups
CREATE INDEX idx_entities_file_type ON entities(file_id, type);
CREATE INDEX idx_entities_name ON entities(name);
CREATE INDEX idx_entities_parent ON entities(parent_id);

-- Reference lookups  
CREATE INDEX idx_references_from ON references(from_entity_id);
CREATE INDEX idx_references_to ON references(to_entity_id);
CREATE INDEX idx_references_type ON references(reference_type);
CREATE INDEX idx_references_from_type ON references(from_entity_id, reference_type);

-- File tracking
CREATE INDEX idx_files_project ON files(project_id);
CREATE INDEX idx_files_hash ON files(hash);

-- Snapshot queries
CREATE INDEX idx_snapshots_project_created ON snapshots(project_id, created_at);
```

### Full-Text Search Setup
```sql
-- FTS5 virtual table with custom tokenizer
CREATE VIRTUAL TABLE search_fts USING fts5(
  entity_id UNINDEXED,
  content,
  entity_type UNINDEXED,
  entity_name UNINDEXED,
  tokenize='porter unicode61'
);

-- Triggers to maintain FTS index
CREATE TRIGGER entities_fts_insert AFTER INSERT ON entities BEGIN
  INSERT INTO search_fts(entity_id, content, entity_type, entity_name)
  VALUES (NEW.id, NEW.description || ' ' || COALESCE(NEW.properties, ''), NEW.type, NEW.name);
END;

CREATE TRIGGER entities_fts_update AFTER UPDATE ON entities BEGIN
  UPDATE search_fts SET
    content = NEW.description || ' ' || COALESCE(NEW.properties, ''),
    entity_type = NEW.type,
    entity_name = NEW.name
  WHERE entity_id = NEW.id;
END;

CREATE TRIGGER entities_fts_delete AFTER DELETE ON entities BEGIN
  DELETE FROM search_fts WHERE entity_id = OLD.id;
END;
```

## Data Normalization Rules

### Deterministic Entity IDs
```typescript
// Consistent UUID generation for cross-session references
function generateEntityId(fileId: string, entityType: string, internalId: string, name: string): string {
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID v5 namespace
  const seed = `${fileId}:${entityType}:${internalId || name}`;
  return uuidv5(seed, namespace);
}
```

### Name Collision Resolution
```typescript
interface EntityIdentifier {
  name: string;
  fileId: string;
  parentId?: string;
  internalId?: string;
}

// Disambiguation strategy for entities with same names
function resolveEntityReference(name: string, context: EntityIdentifier): string {
  // 1. Try exact match with internal ID
  // 2. Try match within same file
  // 3. Try match within same parent (for fields, scripts in folders)
  // 4. Use first alphabetically if multiple matches
  // 5. Create unresolved reference marker
}
```

### Cross-Reference Confidence Scoring
```typescript
interface ReferenceConfidence {
  EXACT_ID_MATCH: 1.0;        // FileMaker internal ID matched
  NAME_AND_CONTEXT: 0.9;      // Name + file/parent context
  NAME_ONLY_UNIQUE: 0.8;      // Name match, only one possibility  
  NAME_MULTIPLE_CANDIDATES: 0.6; // Name match, multiple possibilities
  FUZZY_MATCH: 0.4;           // Similar name, uncertain
  UNRESOLVED: 0.0;            // Could not resolve
}
```

## Migration Schema

### Version 1.0.0 - Initial Schema
```sql
-- Core tables with basic relationships
-- FTS5 integration
-- Basic indexing strategy
```

### Version 1.1.0 - Performance Optimizations  
```sql
-- Additional composite indexes
-- Materialized view for common queries
-- Partitioning for large datasets
```

### Version 1.2.0 - Extended Metadata
```sql
-- Custom function parameter details
-- Layout object positioning
-- Script step parameter parsing
-- Value list source tracking
```

## Query Patterns

### Common Entity Queries
```sql
-- Find all scripts that call a specific script
SELECT s1.name as caller, s2.name as called
FROM entities s1
JOIN references r ON s1.id = r.from_entity_id  
JOIN entities s2 ON r.to_entity_id = s2.id
WHERE s2.name = ? AND r.reference_type = 'script_calls';

-- Find all fields used by a layout
SELECT f.name, f.type, f.properties
FROM entities f
JOIN references r ON f.id = r.to_entity_id
JOIN entities l ON l.id = r.from_entity_id  
WHERE l.name = ? AND l.type = 'layout' AND r.reference_type = 'field_usage';

-- Search across all entity types
SELECT entity_type, entity_name, snippet(search_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
FROM search_fts
WHERE search_fts MATCH ?
ORDER BY rank
LIMIT 50;
```

### Performance Analytics Queries
```sql
-- Scripts with no callers (orphaned scripts)
SELECT e.name, e.folder_path
FROM entities e
LEFT JOIN references r ON e.id = r.to_entity_id AND r.reference_type = 'script_calls'
WHERE e.type = 'script' AND r.to_entity_id IS NULL;

-- Most referenced fields
SELECT e.name, COUNT(r.id) as reference_count
FROM entities e
JOIN references r ON e.id = r.to_entity_id
WHERE e.type = 'field'
GROUP BY e.id, e.name
ORDER BY reference_count DESC
LIMIT 20;

-- Complex calculations (potential performance impact)
SELECT name, LENGTH(description) as calc_length
FROM entities
WHERE type = 'field' AND properties->>'$.field_type' = 'calculation'
ORDER BY calc_length DESC;
```

This data model provides a normalized, performant foundation for analyzing FileMaker solutions while maintaining flexibility for future enhancements and supporting real-time search and cross-reference analysis.