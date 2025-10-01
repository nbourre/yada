# Research & Technical Decisions

## XML Streaming Parser Selection

### Decision: saxes (Pure JavaScript SAX Parser)

**Rationale**: 
- Pure JavaScript implementation ensures cross-platform compatibility without native dependencies
- Excellent performance for streaming large XML files (100MB+)
- Well-maintained with active community support
- TypeScript definitions available
- Handles malformed XML gracefully with configurable error recovery

**Alternatives Considered**:
- `node-expat`: Native C++ bindings, faster but complicates cross-platform builds
- `fast-xml-parser`: DOM-based, loads entire file into memory (unsuitable for 100MB files)
- `xml2js`: Also DOM-based, memory intensive for large files

**Implementation Pattern**:
```typescript
// Streaming approach to handle large DDR files without memory issues
const parser = new SaxesParser();
parser.on('opentag', handleElementStart);
parser.on('text', handleTextContent);
parser.on('closetag', handleElementEnd);
```

## SQLite Integration & Full-Text Search

### Decision: better-sqlite3 with FTS5

**Rationale**:
- Synchronous API is simpler and more performant for desktop apps
- Excellent TypeScript support with type-safe prepared statements
- WAL mode enables concurrent read operations during parsing
- FTS5 provides advanced full-text search with ranking and snippets
- Native compiled module with pre-built binaries for all platforms

**Alternatives Considered**:
- `sqlite3`: Async-only API, more complex error handling
- `node-sqlite3`: Legacy, less TypeScript support
- `sql.js`: WebAssembly-based, slower for large datasets

**Schema Strategy**:
```sql
-- Core entities with deterministic UUIDs for consistent references
CREATE TABLE entities (id TEXT PRIMARY KEY, type TEXT, name TEXT, file_id TEXT);
-- Universal reference table for all cross-references
CREATE TABLE references (from_id TEXT, to_id TEXT, ref_type TEXT, context JSON);
-- FTS5 virtual table for fast search across all text content
CREATE VIRTUAL TABLE search_fts USING fts5(entity_id, content, tokenize='porter');
```

## Graph Visualization Library

### Decision: Cytoscape.js

**Rationale**:
- Handles large graphs (2000+ nodes) with good performance
- Rich interaction capabilities (pan, zoom, filter, select)
- Extensive layout algorithms including force-directed (cose) and hierarchical
- Export capabilities (PNG, SVG, JSON)
- Active development and extensive documentation
- Works well in Electron renderer process

**Alternatives Considered**:
- `vis.js`: Good performance but less flexible styling
- `D3.js`: Most powerful but requires more custom development
- `sigma.js`: Fast rendering but limited layout options

**Performance Optimization Strategy**:
```typescript
// Progressive loading for large graphs
function loadGraphInChunks(elements: GraphElement[], chunkSize = 1000) {
  // Render graph incrementally to maintain UI responsiveness
}

// Clustering for very large graphs
const layout = {
  name: 'cose',
  nodeRepulsion: 400000,
  componentSpacing: 100,
  animate: false // Disable for large graphs
};
```

## Electron Architecture Patterns

### Decision: Main/Renderer with Local HTTP API

**Rationale**:
- Main process handles all file operations and database access (security)
- Renderer process focuses solely on UI (React components)
- Local HTTP API enables future CLI interface without code duplication
- IPC for real-time events (progress updates, notifications)
- Context bridge for secure communication between processes

**Security Model**:
```typescript
// preload.js - Secure bridge between main and renderer
contextBridge.exposeInMainWorld('electronAPI', {
  parseProject: (filePaths: string[]) => ipcRenderer.invoke('parse-project', filePaths),
  searchEntities: (query: string) => ipcRenderer.invoke('search-entities', query),
  // No direct file system or database access from renderer
});
```

## Cross-Platform Build & Distribution

### Decision: Electron Builder with Native Dependencies

**Rationale**:
- Handles code signing for macOS and Windows automatically
- Supports all target platforms from single build machine
- Native module rebuilding for better-sqlite3
- Auto-updater integration for future releases
- Configurable installers (NSIS, DMG, AppImage)

**Native Dependencies Strategy**:
- Use `electron-rebuild` to compile native modules for target platforms
- Bundle pre-built binaries when possible to speed up builds
- Separate dev dependencies to minimize bundle size

## Performance Benchmarking Strategy

### Parsing Performance Targets

**100MB DDR File Processing**:
- Target: ≤12 minutes total processing time
- Streaming XML parsing: ≤5 minutes
- Cross-reference analysis: ≤4 minutes  
- Database indexing & FTS: ≤3 minutes

**Search Performance Targets**:
- Cold search (no cache): ≤300ms
- Hot search (cached): ≤150ms
- Complex queries with filters: ≤500ms

**Graph Rendering Targets**:
- 2000 nodes, 4000 edges: ≤2 seconds initial render
- Interactive operations (pan/zoom): ≤16ms (60 FPS)
- Filter/search within graph: ≤200ms

### Measurement Strategy
```typescript
// Performance monitoring utilities
class PerformanceProfiler {
  static async measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`${operation}: ${duration.toFixed(2)}ms`);
    return result;
  }
}
```

## Error Handling & Recovery Patterns

### XML Parsing Error Recovery

**Strategy**: Multi-pass parsing with progressively relaxed validation
1. Strict XML validation first
2. If failed, attempt encoding detection and retry
3. If failed, clean common DDR XML issues and retry
4. If failed, provide partial results with error report

### Database Error Recovery

**Strategy**: Automatic backup and recovery
- Automatic database backup before major operations
- Transaction rollback on parsing failures  
- Schema migration with rollback capability
- Corruption detection and repair utilities

### User Error Communication

**Strategy**: Context-aware error messages
- Technical details for developers (logged to file)
- User-friendly messages with suggested actions
- Progress indication during long operations
- Graceful degradation when possible

## Testing Strategy Details

### Unit Testing Approach
- **Parser Components**: Test XML fragments with known outputs
- **Database Operations**: Use in-memory SQLite for fast tests
- **Cross-Reference Logic**: Test with synthetic entity graphs
- **Search Functions**: Verify FTS ranking and snippet generation

### Integration Testing Approach  
- **End-to-End Parsing**: Test with real DDR files of various sizes
- **Performance Regression**: Automated benchmarks in CI/CD
- **Cross-Platform**: Test builds on Windows, macOS, Linux
- **Memory Usage**: Monitor memory consumption during large file processing

### Test Data Strategy
```typescript
// Synthetic DDR generation for consistent testing
class TestDDRGenerator {
  static generateSyntheticDDR(options: {
    scriptCount: number;
    tableCount: number;
    complexityLevel: 'simple' | 'medium' | 'complex';
  }): string {
    // Generate predictable test DDR XML with known cross-references
  }
}
```

## Constitutional Compliance Analysis

### Installation Simplicity ✅
- Single installer per platform (Electron Builder)
- No manual dependency installation required
- Bundled SQLite and Node.js runtime

### Platform Independence ✅  
- Identical React UI across all platforms
- SQLite database format is cross-platform
- Electron handles OS-specific differences

### Multi-Interface Architecture ✅
- Local HTTP API enables CLI and web interfaces
- Business logic separated in service layer
- UI-agnostic data contracts

### Performance Excellence ✅
- Streaming parser prevents memory exhaustion
- SQLite with proper indexing and FTS5
- Progressive graph rendering for large datasets

### Code Quality ✅
- TypeScript for type safety
- ESLint and Prettier for code style
- Jest for comprehensive testing
- Automated performance benchmarks

### Technology Neutrality ✅
- SQLite can be replaced with other databases
- Graph library can be swapped (standard data format)
- Parser can support other XML libraries
- Export formats are standard (CSV, JSON)

## Implementation Priorities

### Phase 1: Core Foundation (Weeks 1-2)
1. Electron app scaffolding with TypeScript
2. Basic SQLite schema and migrations
3. Streaming XML parser with progress reporting
4. Simple React UI for file loading

### Phase 2: Data Processing (Weeks 3-4)  
1. Entity extraction and normalization
2. Cross-reference analysis algorithms
3. FTS5 integration for search
4. Basic entity browsing UI

### Phase 3: Visualization (Weeks 5-6)
1. Graph rendering with Cytoscape.js
2. Interactive filtering and search
3. Export capabilities (PNG, SVG, CSV, JSON)
4. Performance optimization for large graphs

### Phase 4: Advanced Features (Weeks 7-8)
1. Snapshot comparison functionality
2. Report generation (unused scripts, dependencies)
3. Advanced search with filters
4. Polish and cross-platform testing

## Risk Mitigation

### Large File Processing Risk
**Mitigation**: Implement backpressure and chunked processing, use streams throughout

### Graph Performance Risk  
**Mitigation**: Implement clustering and progressive loading, provide simplified view options

### Cross-Platform Compatibility Risk
**Mitigation**: Automated testing on all platforms, use only cross-platform dependencies

### Memory Usage Risk
**Mitigation**: Profile memory usage continuously, implement garbage collection hints

This research provides the technical foundation for implementing the FileMaker DDR XML Parser with confidence in architectural decisions and performance targets.