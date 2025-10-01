# FileMaker DDR XML Parser & Explorer — Product Specification (v0.2)

**Decisions locked in (from user):**

* **UI Framework:** Electron (Node + React)
* **OS Targets:** Windows, macOS, Linux
* **Scale:** DDR up to ~100 MB across multiple XML files
* **Graphs:** Interactive (pan/zoom/filter/select)
* **Diffing:** Integrate third‑party tools (e.g., git, external diff) rather than homegrown first
* **Plugin Language:** Python
* **Key Report (MVP):** “Scripts with no callers” (note: may include dev-only scripts)
* **License:** MIT (future commercial option kept open)
* **CLI‑only mode:** Not in MVP (but architecture should allow adding later)
* **i18n:** English-only MVP, fully i18n‑ready
* **Other:** Architecture must allow multiple UI types later (CLI, native, web)

---

## 1) Vision & Goals

**Purpose:** Local-first, privacy-respecting, open tool to parse **FileMaker DDR (XML)**, normalize solution metadata, provide **cross-reference/impact analysis**, graph exploration, and basic **snapshot diffing** via third-party tools.

**Goals (MVP)**

1. Parse **large multi-file DDR XML** (streaming) → normalize into SQLite with FTS5.
2. Provide **global search** (names/comments/calcs) and **entity browsers** (Tables/Fields, Scripts, Layouts, TOs, Relationships, CFs, Value Lists).
3. Extract **cross-references** (Script→Script, Layout→Field, Calc→CF, TO→Table, etc.) and show **usage panels**.
4. Show **interactive graphs**: Relationship (TO graph) and Script call graph.
5. Generate **reports** including “Scripts with no callers”.
6. **Diff/snapshots** by delegating to git/external diff; show results inside the app.

**Non-goals (MVP)**

* No editing FileMaker solutions or reverse export to FM.
* No pixel-accurate layout rendering.
* No server/cloud dependency.

---

## 2) Target Users & Use Cases

* **FM Devs/DBAs/Consultants**: refactoring, dependency analysis, onboarding to legacy solutions.
* **Educators**: visualize architecture and dependencies.

**Core scenarios**

* “Where is **Field X** referenced?”
* “Which **scripts** call or are called by **Script Y**?”
* “Show **TO graph** filtered by context.”
* “List **scripts with no callers** (mark allowlisted dev scripts).”
* “Compare **snapshot A vs B** (via git) and show changed entities.”

---

## 3) Inputs & Outputs

**Inputs**

* One or more **FileMaker DDR XML** files (UI/Data split supported).
* **Project Manifest** (YAML/JSON) optional: assigns roles (ui/data), adds tags, dev-only script patterns, ignore lists.

**Outputs**

* **Project store**: SQLite DB (WAL, FTS5) + `/snapshots` folder for DDR source & metadata.
* **Exports**: CSV/JSON from saved queries and reports.
* **Graphs**: export current view as PNG/SVG.

---

## 4) Architecture Overview

**High-level:** Electron shell with a **React** front-end. **Node.js backend** orchestrates parsing and storage. **Python plug‑ins** run in isolated subprocesses via a bridge. All data stored locally in SQLite.

```
[Electron Renderer (React)]  ←→  [Electron Main/Node Services]
       ↑  IPC (contextBridge)         │  
       │                              ├─ Parsing/Store Service (Node)
       │                              ├─ Python Plugin Bridge (child_process, gRPC/stdio)
       │                              ├─ Git/Diff Integrations (simple CLI wrapper)
       │                              └─ Export/Report Service
                                   
[SQLite + FTS5]  (project_dir/.fmddr.sqlite)
[Snapshots dir]  (project_dir/snapshots/*)
```

**Rationale**

* **Electron** chosen for cross‑platform UI and dev velocity.
* **SQLite** for zero-config local DB and robust indexing; **FTS5** for full-text search.
* **Streaming XML parsing** to handle 100MB+ DDRs.
* **Python plugins** for analyzers (leverage existing FM community scripts, regex/calc parsing, etc.).
* **Git/external diff** lowers complexity and taps into proven tooling.

---

## 5) Modules & Responsibilities

1. **ingest/** (Node)

   * Streaming XML (sax-style) using `saxes` or `node-expat`.
   * Normalize entities into domain records; batch insert via better-sqlite3.
   * Maintain deterministic IDs (stable UUID v5 from (file, internal_id/name path)).

2. **store/** (Node)

   * SQLite schema migration (via `umzug` or custom). WAL mode on.
   * Indices for lookups; FTS5 virtual tables for text fields.

3. **domain/** (shared TS types)

   * Entity models & enums; reference edge model; type-safe query helpers.

4. **analyze/** (Node + Python plugins)

   * Cross-ref resolution passes.
   * Built-in analyzers (usage, orphan detection).
   * Plugin loader/registry (Python subprocess calls with JSON contracts).

5. **diff/** (Node)

   * Git repo init per project (optional) and `git add/commit` snapshots.
   * Compare two commits; map changed files to changed entities (heuristic).

6. **ui/** (React)

   * Views: Home, Search, Entities, Graphs, Reports, Diff.
   * Graphs with Cytoscape.js or Vis.js; virtualized tables for large datasets.

7. **export/** (Node)

   * CSV/JSON writers; graph export to PNG/SVG.

---

## 6) Data Model (Normalized)

**Tables (minimum MVP)**

* `files(id, name, path, role, hash, fm_version)`
* `tables(id, file_id, name, internal_id)`
* `fields(id, table_id, name, type, auto_enter, validation, calc_expr, is_stored, comments)`
* `table_occurrences(id, file_id, name, base_table_id, source)`
* `relationships(id, graph_name, from_to_id, to_to_id, predicates_json, options_json)`
* `layouts(id, file_id, name, table_context_to_id, folder_path)`
* `layout_objects(id, layout_id, object_type, bound_field_id, script_trigger_id, calc_expr)`
* `scripts(id, file_id, name, folder_path, steps_json, comments)`
* `custom_functions(id, file_id, name, params, expr, comments)`
* `value_lists(id, file_id, name, type, values_json)`
* `references(id, src_type, src_id, dst_type, dst_id, ref_type, detail_json)`
* `snapshots(id, created_at, source_hashes_json, metrics_json)`
* `fts_text(entity_type, entity_id, text)`  -- FTS5 virtual table

**Notes**

* `references` is the universal edge list powering usage/impact.
* All *_json columns store normalized arrays/objects.

---

## 7) Parsing & Cross-Ref Extraction

**Phases**

1. **Structure pass**: parse entities and primary keys.
2. **Text pass**: extract strings (calcs, comments, script steps) into FTS and for analysis.
3. **Resolution pass**: name→entity resolution with file/namespace context and disambiguation table.

**Edge Types (examples)**

* `Script→Script` (`Perform Script`, `Subscript`)
* `Layout→Field` (bound fields)
* `Calc→Field` / `Calc→CF` (identifier references)
* `TO→Table` (base table binding)
* `Relationship` edge across `TO`s with predicate metadata

**Disambiguation**

* Prefer internal IDs where present.
* When only names are available, resolve by nearest scope (file, table, TO) with deterministic tie-break.

---

## 8) UI Requirements (MVP)

**Home / Project**

* Create/open project; show snapshot list, entity counts, and warnings.

**Global Search**

* FTS across names/comments/calcs with filters; keyboard navigation; match highlighting.

**Entity Browsers**

* **Tables/Fields** grids; field detail + usage counts.
* **Scripts** tree (folders) with step viewer and call graph.
* **Layouts** list with context TO and objects.
* **Relationships** list and **interactive TO graph**.
* **Custom Functions** & **Value Lists** lists with usage.

**Graphs**

* Render via Cytoscape.js (pan/zoom/select).
* Filters: by file/graph name/entity type; expand/collapse neighbors; search within graph.
* Export graph as PNG/SVG.

**Reports**

* “Scripts with no callers” (with optional dev-only allowlist from Manifest).
* Export report as CSV/JSON.

**Diff**

* Connect project to git repo (optional). Create snapshot commits.
* Show list of changed entities between two snapshots (heuristic mapping from changed XML chunks to entities).
* Provide “Open in external diff” for raw XML.

---

## 9) Performance Targets

* **Parsing 100 MB** multi-file DDR: **≤ 12 minutes** on mid-range laptop (streaming + batch inserts).
* **Cold search latency:** ≤ 300 ms; **hot:** ≤ 150 ms.
* **Graph render:** ≤ 2 seconds for 2k nodes, 4k edges (progressive rendering, clustering).

**Techniques**

* Streaming SAX parse with backpressure; chunked transactions; prepared statements.
* FTS5 tokenization; precomputed usage counts; lazy graph layout.

---

## 10) Security & Privacy

* All processing is local; no telemetry by default.
* Optional diagnostic bundle creation (redacted).

---

## 11) Extensibility & Plugins (Python)

**Plugin model**

* Location: `project_dir/plugins` and global `%APPDATA%/fmddr/plugins`-style dir.
* Discovery via manifest (YAML) + entrypoint command.
* IPC: JSON over stdio by default; gRPC optional later.

**Plugin API (v0)**

* `analyze(request) → findings[]` where `request` includes project DB path, entity filters, and config.
* Findings carry `entity_type/id`, `severity`, `message`, `details`.

**Use cases**

* Custom linters (naming rules, security heuristics), governance checks, org-specific reports.

---

## 12) Diffing Strategy (External Tools)

* Initialize a git repo per project (`.git` in project dir) on opt-in.
* On snapshot: write canonicalized DDR sources to `snapshots/ts/…` and `git commit`.
* Compare any two commits: list changed XML files; map to entities using stored source→entity index.
* Provide buttons: “Open in external diff app”, copy patch, and in‑app summary (added/removed/changed counts).

---

## 13) Testing (Specification‑Driven)

**Contracts first:**

* JSON Schemas for entities, references, plugin requests/responses.
* Stable ID policy documented and unit‑tested.

**Acceptance (Gherkin samples)**

```gherkin
Feature: Parse DDR XML (Large)
  Scenario: Index a 100MB multi-file DDR
    Given DDR files "ui1.xml", "data1.xml"
    When I parse into a new project
    Then total fields > 1000
    And the operation completes within 12 minutes
```

```gherkin
Feature: Orphan scripts report
  Scenario: Detect scripts with no callers
    Given a project with scripts A, B where A performs B
    When I run the "Scripts with no callers" report
    Then B is not listed
    And scripts matching allowlist patterns are excluded
```

```gherkin
Feature: TO Graph
  Scenario: Explore relationships
    Given a project with 100 TOs and 200 relationships
    When I open the TO graph and filter by graph name
    Then render completes in under 2 seconds
    And selecting a node shows its predicates
```

**Other tests**

* Fuzz malformed XML; very long calc strings; duplicated names across files.
* Performance regression tests in CI using synthetic DDR fixtures.

---

## 14) Documentation

* **User Guide:** project creation, loading DDRs, search, graphs, diff, reports, exports.
* **Developer Guide:** architecture, data model, plugin API, coding standards, contribution flow.
* **Manifest Reference:** roles, allowlists, ignore patterns, i18n keys.

---

## 15) Packaging & Distribution

* **License:** MIT
* **Builds:** Electron Builder targets: nsis/win, dmg/mac (notarized), AppImage/deb/rpm for Linux.
* **Updates:** Manual “Check for updates” in MVP; auto‑update later.

---

## 16) Roadmap (Milestones)

**M1: Core ingest & browse (4–6 weeks)**

* SQLite schema + migrations; streaming parser; entity browsers; FTS search.

**M2: Cross‑refs & reports (3–5 weeks)**

* Reference extraction; usage panels; “Scripts with no callers” report; CSV/JSON exports.

**M3: Graphs (3–4 weeks)**

* TO graph and Script call graph; filters; export as PNG/SVG.

**M4: Snapshots & Diff (3–4 weeks)**

* Git integration (init/commit/compare); in‑app changed-entity summary; open external diff.

**M5: Plugins & i18n scaffolding (2–3 weeks)**

* Python plugin bridge v0; sample analyzer; i18n infra; docs pass.

---

## 17) Contracts (Initial Drafts)

**17.1 JSON Schema: Reference Edge**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://fmddr.dev/schemas/reference-edge.json",
  "type": "object",
  "required": ["id", "src_type", "src_id", "dst_type", "dst_id", "ref_type"],
  "properties": {
    "id": {"type": "string"},
    "src_type": {"type": "string", "enum": ["script","layout","calc","to","table","field","cf","valuelist"]},
    "src_id": {"type": "string"},
    "dst_type": {"type": "string"},
    "dst_id": {"type": "string"},
    "ref_type": {"type": "string"},
    "detail": {"type": "object"}
  }
}
```

**17.2 Plugin Request/Response**

```json
// request
{
  "version": "0",
  "project_db": "C:/path/project/.fmddr.sqlite",
  "config": {"filters": {"entity_types": ["script"]}},
  "params": {}
}

// response
{
  "version": "0",
  "findings": [
    {"entity_type": "script", "entity_id": "scr_123", "severity": "info", "message": "No callers", "details": {}}
  ]
}
```

---

## 18) i18n Strategy

* Use `react-intl` or `i18next` in the renderer.
* All user-visible strings in message catalogs; keys stable and documented.
* Manifest may map project-specific labels to i18n keys later.

---

## 19) Multi‑UI Strategy (Future‑proofing)

* **Electron** MVP now; keep **service layer** UI-agnostic with a **local HTTP/IPC API** (e.g., `fastify` inside main process on `localhost` bound to loopback only).
* Enables future **CLI** and **web UI** to reuse the same service endpoints and data contracts.
* Extract shared logic to a `core` package consumed by Electron and future frontends.

---

## 20) Open Items to Confirm (short)

1. **Graph library**: Cytoscape.js (default) vs Vis.js?  → *Default: Cytoscape.js*
2. **SAX parser lib**: `saxes` (pure JS) vs `node-expat` (native).  → *Default: saxes*
3. **Python env detection**: bundle Python (embeddable on Win) or require system Python?  → *Default: require system Python, add path checker + guidance.*
4. **Git dependency**: assume `git` in PATH or ship portable git (Win)?  → *Default: assume in PATH; show helper message if missing.*

---

## 21) Acceptance Criteria (MVP summary)

* Can parse a 100MB multi-file DDR into SQLite within the set performance budget.
* Search returns results under 300 ms (cold) with filters.
* TO graph interactive with filtering and exports.
* “Scripts with no callers” report produces CSV/JSON and respects allowlist patterns.
* Snapshots integrate with git; diff view lists changed entities and opens external diff.
* Plugin sample in Python runs and returns findings via JSON over stdio.
* App runs on Windows/macOS/Linux with signed/notarized mac build where feasible.
