
# Implementation Plan: FileMaker DDR XML Parser & Explorer

**Branch**: `001-filemaker-ddr-xml` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-filemaker-ddr-xml/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Local-first desktop application built with Node.js + Electron to parse FileMaker DDR XML files, normalize solution metadata into SQLite with FTS5, provide cross-reference analysis through interactive graphs, and enable snapshot comparison. Multi-interface architecture supports desktop GUI with future CLI/API expansion. Performance targets: 12min parsing for 100MB files, 300ms search response, 2s graph rendering.

## Technical Context
**Language/Version**: Node.js 18+ LTS with TypeScript 5.0+  
**Primary Dependencies**: Electron 27+, React 18, better-sqlite3, saxes (XML parser), Cytoscape.js  
**Storage**: SQLite with WAL mode, FTS5 for full-text search, local file system  
**Testing**: Jest for unit tests, Playwright for E2E, custom performance benchmarks  
**Target Platform**: Windows 10+, macOS 12+, Linux (Ubuntu 20+)  
**Project Type**: desktop - Electron main/renderer architecture  
**Performance Goals**: 12min parse for 100MB DDR, 300ms search response, 2s graph render  
**Constraints**: Local-only processing, no telemetry, cross-platform identical behavior  
**Scale/Scope**: 100MB DDR files, 10k+ entities, 2k graph nodes, single-user desktop app

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Initial Check** ✅ PASS:
- [x] **Installation Simplicity**: Electron app distributed as single executable, npm install for dev
- [x] **Platform Independence**: Electron ensures identical behavior across Windows/macOS/Linux  
- [x] **Multi-Interface Architecture**: Services layer separated from UI, future CLI via local API
- [x] **Code Quality**: TypeScript + ESLint + Jest, 80%+ coverage target, complexity monitoring
- [x] **Performance Excellence**: Specific targets: 300ms search, 2s graph, 12min parse for 100MB
- [x] **Technology Neutrality**: SQLite (not vendor DB), abstract parsers, configurable storage

**Post-Design Re-Check** ✅ PASS:
- [x] **Installation Simplicity**: Maintained - single Electron executable
- [x] **Platform Independence**: Maintained - platform-agnostic Node.js/Electron stack
- [x] **Multi-Interface Architecture**: Enhanced - service contracts enable future interfaces
- [x] **Code Quality**: Enhanced - comprehensive API contracts with schema validation
- [x] **Performance Excellence**: Maintained - detailed performance targets in contracts
- [x] **Technology Neutrality**: Enhanced - service abstraction enables technology swapping

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->
```
src/
├── main/                    # Electron main process
│   ├── main.ts             # App entry point
│   ├── services/           # Core business logic
│   │   ├── ddr-parser.ts   # XML streaming parser
│   │   ├── database.ts     # SQLite operations
│   │   ├── analyzer.ts     # Cross-reference analysis
│   │   └── export.ts       # CSV/JSON export
│   ├── api/                # Local HTTP API server
│   └── ipc/                # IPC handlers
├── renderer/               # React frontend
│   ├── components/         # React UI components
│   │   ├── search/         # Search interface
│   │   ├── graph/          # Graph visualization
│   │   ├── reports/        # Report generation
│   │   └── common/         # Shared components
│   ├── pages/              # Main application views
│   ├── services/           # Frontend API client
│   └── styles/             # CSS/styling
├── shared/                 # Shared types/utilities
│   ├── types/              # TypeScript interfaces
│   ├── constants/          # Application constants
│   └── utils/              # Common utilities
└── cli/                    # Future CLI interface

tests/
├── unit/                   # Unit tests
│   ├── services/           # Service layer tests
│   ├── parsers/            # Parser logic tests
│   └── utils/              # Utility function tests
├── integration/            # Integration tests
│   ├── database/           # DB integration tests
│   ├── api/                # API contract tests
│   └── e2e/                # End-to-end tests
└── fixtures/               # Test data files
```

**Structure Decision**: Electron desktop application with TypeScript, following main/renderer separation. Main process (`src/main/`) handles file operations, XML parsing, SQLite database, and local API server. Renderer process (`src/renderer/`) contains React frontend for UI, graph visualization, and user interactions. Shared types and utilities in `src/shared/` enable type safety across processes. CLI interface in `src/cli/` will reuse main process services via local API.

## Phase 0: Outline & Research ✅ COMPLETE
1. **Extract unknowns from Technical Context** above:
   - ✅ XML parser selection (saxes vs alternatives)
   - ✅ SQLite schema design for entity storage
   - ✅ Graph visualization approach (Cytoscape.js)
   - ✅ Performance optimization strategies

2. **Generate and dispatch research agents**:
   - ✅ Research XMLHttpRequest streaming vs SAX parsing
   - ✅ Find best practices for SQLite FTS5 integration
   - ✅ Evaluate graph layout algorithms for relationship visualization
   - ✅ Performance benchmarking approach for large file parsing

3. **Consolidate findings** in `research.md`:
   - ✅ Decision: Saxes parser for streaming XML processing
   - ✅ Rationale: Performance and memory efficiency for large files  
   - ✅ Alternatives: Fast-xml-parser (rejected - not streaming)

**Output**: ✅ research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts ✅ COMPLETE
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - ✅ Universal entities table with type-specific properties
   - ✅ Cross-references table for relationship tracking
   - ✅ Snapshots table for version comparison
   - ✅ FTS5 virtual tables for full-text search

2. **Generate API contracts** from functional requirements:
   - ✅ Parser Service: POST /api/parse-project (FR-001, FR-002)
   - ✅ Search Service: POST /api/search, GET /api/entities/{id} (FR-003, FR-004)
   - ✅ Graph Service: POST /api/graph/generate (FR-005)
   - ✅ Export Service: POST /api/export (FR-007, FR-008)
   - ✅ Project Service: CRUD operations, snapshots, comparison (FR-006, FR-009)

3. **Generate contract tests** from contracts:
   - ✅ Parser service contract with request/response schemas
   - ✅ Search service contract with pagination and filtering
   - ✅ Graph service contract with layout options
   - ✅ Export service contract with multiple format support
   - ✅ Project service contract with snapshot comparison

4. **Extract test scenarios** from user stories:
   - ✅ Project setup and file parsing scenario (FR-001, FR-002)
   - ✅ Entity search and discovery scenario (FR-003, FR-004)
   - ✅ Relationship graph visualization scenario (FR-005)
   - ✅ Cross-reference analysis scenario (FR-004)
   - ✅ Export and reporting scenario (FR-007, FR-008)
   - ✅ Project comparison scenario (FR-006, FR-009)
   - ✅ Performance validation scenario (FR-NF-005)

5. **Update agent file incrementally** (O(1) operation):
   - ✅ COMPLETE: Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType copilot`
   - ✅ Added Node.js 18+ LTS + TypeScript 5.0+ + Electron 27+ stack
   - ✅ Added React 18, better-sqlite3, saxes, Cytoscape.js dependencies  
   - ✅ Preserved manual additions between markers
   - ✅ Updated with 001-filemaker-ddr-xml feature context

**Output**: ✅ data-model.md, ✅ /contracts/*, ✅ quickstart.md, ✅ .github/copilot-instructions.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - ✅ research.md created
- [x] Phase 1: Design complete (/plan command) - ✅ contracts/, data-model.md, quickstart.md created
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - ✅ strategy documented
- [ ] Phase 3: Tasks generated (/tasks command) - 📋 Ready for execution
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: ✅ PASS - All principles validated
- [x] Post-Design Constitution Check: ✅ PASS - Design enhances constitutional compliance
- [x] All NEEDS CLARIFICATION resolved - ✅ Complete via research.md
- [x] Complexity deviations documented - ✅ None required (no violations)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
