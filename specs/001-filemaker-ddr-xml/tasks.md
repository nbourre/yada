# Tasks: FileMaker DDR XML Parser & Explorer

**Input**: Design documents from `/specs/001-filemaker-ddr-xml/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory ✅
   → Tech stack: Node.js 18+ + TypeScript 5.0+ + Electron 27+
   → Libraries: React 18, better-sqlite3, saxes, Cytoscape.js
   → Structure: Electron main/renderer architecture
2. Load optional design documents: ✅
   → data-model.md: 5 entities (projects, files, entities, references, snapshots)
   → contracts/: 5 service contracts → 12 API endpoints
   → research.md: saxes parser, SQLite FTS5, performance decisions
3. Generate tasks by category: ✅
   → Setup: Electron + TypeScript project, dependencies, linting
   → Tests: 12 contract tests, 7 integration tests
   → Core: 5 models, 5 services, 12 API endpoints
   → Integration: SQLite DB, IPC handlers, local API server
   → Polish: unit tests, performance validation, E2E tests
4. Apply task rules: ✅
   → Different files = [P] for parallel execution
   → Tests before implementation (TDD approach)
   → Dependencies: Setup → Tests → Models → Services → APIs → Integration → Polish
5. Generated: 34 numbered, ordered tasks (T001-T034)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup ✅ COMPLETE
- [x] T001 Create Electron + TypeScript project structure with package.json, tsconfig.json, main/renderer separation
- [x] T002 Install dependencies: Electron 27+, React 18, sql.js (SQLite), saxes, Cytoscape.js, Jest, Playwright
- [x] T003 [P] Configure ESLint + Prettier for TypeScript/React in .eslintrc.js and .prettierrc
- [x] T004 [P] Configure Jest for unit testing in jest.config.js with TypeScript support
- [x] T005 [P] Configure Playwright for E2E testing in playwright.config.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoints)
- [ ] T006 [P] Contract test POST /api/parse-project in tests/api/parser-service.test.ts
- [ ] T007 [P] Contract test POST /api/search in tests/api/search-service.test.ts
- [ ] T008 [P] Contract test GET /api/entities/{id} in tests/api/search-service.test.ts
- [ ] T009 [P] Contract test POST /api/graph/generate in tests/api/graph-service.test.ts
- [ ] T010 [P] Contract test POST /api/graph/layout in tests/api/graph-service.test.ts
- [ ] T011 [P] Contract test POST /api/export in tests/api/export-service.test.ts
- [ ] T012 [P] Contract test GET /api/export/{id}/status in tests/api/export-service.test.ts
- [ ] T013 [P] Contract test GET /api/projects in tests/api/project-service.test.ts
- [ ] T014 [P] Contract test GET /api/projects/{id} in tests/api/project-service.test.ts
- [ ] T015 [P] Contract test POST /api/projects/{id}/snapshots in tests/api/project-service.test.ts
- [ ] T016 [P] Contract test POST /api/projects/{id}/compare in tests/api/project-service.test.ts
- [ ] T017 [P] Contract test DELETE /api/projects/{id} in tests/api/project-service.test.ts

### Integration Tests (User Scenarios)
- [ ] T018 [P] Integration test: Initial project setup and file parsing in tests/integration/project-parsing.test.ts
- [ ] T019 [P] Integration test: Entity search and discovery in tests/integration/entity-search.test.ts
- [ ] T020 [P] Integration test: Relationship graph visualization in tests/integration/graph-visualization.test.ts
- [ ] T021 [P] Integration test: Cross-reference analysis in tests/integration/cross-reference.test.ts
- [ ] T022 [P] Integration test: Data export and reporting in tests/integration/data-export.test.ts
- [ ] T023 [P] Integration test: Project comparison and change analysis in tests/integration/project-comparison.test.ts
- [ ] T024 [P] Integration test: Performance validation with large files in tests/integration/performance-validation.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models
- [ ] T025 [P] Project model with SQLite schema in src/shared/types/project.ts
- [ ] T026 [P] File model with DDR metadata in src/shared/types/file.ts
- [ ] T027 [P] Entity model with universal properties in src/shared/types/entity.ts
- [ ] T028 [P] Reference model for cross-references in src/shared/types/reference.ts
- [ ] T029 [P] Snapshot model for version comparison in src/shared/types/snapshot.ts

### Core Services (Main Process)
- [ ] T030 Database service with SQLite + FTS5 setup in src/main/services/database.ts
- [ ] T031 DDR parser service using saxes streaming in src/main/services/ddr-parser.ts
- [ ] T032 Cross-reference analyzer service in src/main/services/analyzer.ts
- [ ] T033 Export service for CSV/JSON/Excel formats in src/main/services/export.ts
- [ ] T034 Graph generator service with Cytoscape data in src/main/services/graph.ts

### API Endpoints
- [ ] T035 Parser service API endpoints in src/main/api/parser-routes.ts
- [ ] T036 Search service API endpoints in src/main/api/search-routes.ts
- [ ] T037 Graph service API endpoints in src/main/api/graph-routes.ts
- [ ] T038 Export service API endpoints in src/main/api/export-routes.ts
- [ ] T039 Project service API endpoints in src/main/api/project-routes.ts

## Phase 3.4: Integration
- [ ] T040 SQLite database initialization with schema migration in src/main/services/database.ts
- [ ] T041 Local HTTP API server setup with Express in src/main/api/server.ts
- [ ] T042 IPC handlers for main/renderer communication in src/main/ipc/handlers.ts
- [ ] T043 Electron main process entry point in src/main/main.ts

### Frontend (Renderer Process)
- [ ] T044 React app setup with TypeScript in src/renderer/App.tsx
- [ ] T045 [P] Search components for entity discovery in src/renderer/components/search/
- [ ] T046 [P] Graph visualization with Cytoscape.js in src/renderer/components/graph/
- [ ] T047 [P] Report generation components in src/renderer/components/reports/
- [ ] T048 [P] Common UI components (buttons, forms, modals) in src/renderer/components/common/
- [ ] T049 API client service for backend communication in src/renderer/services/api-client.ts

## Phase 3.5: Polish
- [ ] T050 [P] Unit tests for database service in tests/unit/services/database.test.ts
- [ ] T051 [P] Unit tests for DDR parser logic in tests/unit/services/ddr-parser.test.ts
- [ ] T052 [P] Unit tests for analyzer service in tests/unit/services/analyzer.test.ts
- [ ] T053 [P] Unit tests for utility functions in tests/unit/utils/
- [ ] T054 Performance benchmarking: 12min parse for 100MB, 300ms search, 2s graph rendering
- [ ] T055 [P] Cross-platform testing (Windows, macOS, Linux) using GitHub Actions
- [ ] T056 [P] E2E testing with Playwright covering full user workflows in tests/e2e/
- [ ] T057 [P] Installation procedure testing (npm install + npm start ≤3 commands)
- [ ] T058 [P] Code quality gates: ESLint, TypeScript checks, Jest coverage 80%+
- [ ] T059 [P] Update README.md with installation and usage instructions
- [ ] T060 Performance optimization and memory leak detection
- [ ] T061 Execute quickstart.md validation scenarios

## Dependencies
```
Setup (T001-T005) 
  ↓
Contract Tests (T006-T017) + Integration Tests (T018-T024)
  ↓  
Models (T025-T029) → Services (T030-T034) → API Routes (T035-T039)
  ↓
Integration (T040-T043) + Frontend (T044-T049)
  ↓
Polish (T050-T061)
```

## Parallel Execution Examples
```bash
# Phase 3.2: Launch contract tests together (different files):
Task: "Contract test POST /api/parse-project in tests/api/parser-service.test.ts"
Task: "Contract test POST /api/search in tests/api/search-service.test.ts"
Task: "Contract test POST /api/graph/generate in tests/api/graph-service.test.ts"
Task: "Contract test POST /api/export in tests/api/export-service.test.ts"

# Phase 3.3: Launch model creation together (different files):
Task: "Project model with SQLite schema in src/shared/types/project.ts"
Task: "Entity model with universal properties in src/shared/types/entity.ts"
Task: "Reference model for cross-references in src/shared/types/reference.ts"

# Phase 3.5: Launch unit tests together (different test files):
Task: "Unit tests for database service in tests/unit/services/database.test.ts"
Task: "Unit tests for DDR parser in tests/unit/services/ddr-parser.test.ts"
Task: "Cross-platform testing with GitHub Actions"
```

## Critical Success Path
1. **Setup Complete** (T001-T005): Project builds and lints successfully
2. **Tests Failing** (T006-T024): All contract and integration tests written and failing
3. **Models Complete** (T025-T029): TypeScript interfaces and validation ready
4. **Services Complete** (T030-T034): Core business logic implemented, tests passing
5. **APIs Complete** (T035-T039): HTTP endpoints implemented, contract tests passing
6. **Integration Complete** (T040-T049): Full application stack functional
7. **Quality Gates** (T050-T061): Performance targets met, cross-platform validated

## Validation Checklist
*GATE: All items must pass before declaring implementation complete*

- [x] All 5 service contracts have corresponding test files (T006-T017)
- [x] All 5 entities have model creation tasks (T025-T029)
- [x] All 12 API endpoints have implementation tasks (T035-T039)
- [x] All 7 quickstart scenarios have integration tests (T018-T024)
- [x] Tests are scheduled before implementation (TDD workflow)
- [x] Parallel tasks target different files (no conflicts)
- [x] Each task specifies exact file path
- [x] Performance requirements explicitly tested (T054)
- [x] Constitutional principles validated in polish phase (T055-T058)

## Notes
- Electron architecture requires main/renderer separation - tasks respect this boundary
- SQLite + FTS5 setup is critical for performance targets (T030, T040)
- Saxes streaming parser essential for 100MB file handling (T031)
- Graph visualization performance depends on Cytoscape.js integration (T034, T046)
- Cross-platform testing validates constitutional platform independence principle (T055)
- Performance benchmarking validates constitutional performance excellence (T054)

## Task Generation Rules Applied
1. **From Contracts**: 5 contract files → 12 endpoint tests (T006-T017)
2. **From Data Model**: 5 entities → 5 model tasks (T025-T029)  
3. **From Quickstart**: 7 scenarios → 7 integration tests (T018-T024)
4. **Ordering**: Setup → Tests → Models → Services → APIs → Integration → Polish
5. **Parallel**: Different files = [P], same files = sequential dependencies