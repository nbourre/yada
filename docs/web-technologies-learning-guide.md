# Web Technologies Learning Guide for FileMaker DDR Parser

*A practical guide to understand the web technologies used in this Node.js + Electron project*

## Table of Contents
1. [Project Architecture Overview](#project-architecture-overview)
2. [Node.js Fundamentals](#nodejs-fundamentals)
3. [Electron Desktop Framework](#electron-desktop-framework)
4. [React Frontend Framework](#react-frontend-framework)
5. [Modern JavaScript/TypeScript](#modern-javascripttypescript)
6. [Database Integration (SQLite)](#database-integration-sqlite)
7. [XML Processing](#xml-processing)
8. [Graph Visualization](#graph-visualization)
9. [Build Tools & Development Workflow](#build-tools--development-workflow)
10. [Testing Strategies](#testing-strategies)
11. [Packaging & Distribution](#packaging--distribution)
12. [Common Patterns & Best Practices](#common-patterns--best-practices)

---

## Project Architecture Overview

### What We're Building
```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                     │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Frontend (React)  │    │     Backend (Node.js)       │ │
│  │   - User Interface  │◄──►│   - XML Parser Service      │ │
│  │   - Graph Display   │    │   - SQLite Database         │ │
│  │   - Search UI       │    │   - Cross-ref Analysis      │ │
│  │   - Reports View    │    │   - Local HTTP API          │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Local Files       │
                    │ - SQLite Database   │
                    │ - DDR XML Files     │
                    │ - Export Results    │
                    └─────────────────────┘
```

### Key Concepts to Understand

**Frontend vs Backend**:
- **Frontend**: What the user sees and interacts with (UI, buttons, graphs)
- **Backend**: The "engine" that processes data, talks to databases, handles files

**Client-Server Model** (even though it's all local):
- React frontend makes **requests** to Node.js backend
- Node.js backend sends **responses** with data
- Communication happens via HTTP API calls (like web browsers talking to websites)

---

## Node.js Fundamentals

### What is Node.js?
Node.js lets you run JavaScript **outside** the web browser - on your computer like any other program (Python, Java, etc.).

### Key Concepts

#### 1. **Modules & Require/Import**
```javascript
// Old way (CommonJS)
const fs = require('fs');           // File system operations
const path = require('path');       // Path manipulation

// Modern way (ES Modules)  
import fs from 'fs';
import { readFile } from 'fs/promises';
```

**Think of it like**: Including libraries in other languages
- `#include <stdio.h>` in C
- `import sys` in Python
- `using System.IO;` in C#

#### 2. **Asynchronous Programming**
Node.js doesn't wait for slow operations (file reading, database queries).

```javascript
// BAD: Blocks everything until file is read
const data = fs.readFileSync('huge-file.xml');  // Freezes app

// GOOD: Continues running, calls function when done
fs.readFile('huge-file.xml', (error, data) => {
  if (error) console.log('Failed!');
  else console.log('Got data:', data);
});

// MODERN: Using async/await (easier to read)
async function readHugeFile() {
  try {
    const data = await fs.promises.readFile('huge-file.xml');
    console.log('Got data:', data);
  } catch (error) {
    console.log('Failed!', error);
  }
}
```

**Why this matters**: Parsing 100MB XML files can't freeze the user interface.

#### 3. **Package Management with npm**
```bash
npm install express          # Install a web server library
npm install sqlite3         # Install database library
npm install --save-dev jest  # Install testing library (dev only)
```

**Think of it like**: 
- NuGet packages in .NET
- pip install in Python
- Maven dependencies in Java

### Common Node.js Libraries We'll Use

| Library | Purpose | Example |
|---------|---------|---------|
| `express` | Web server/API | Handle HTTP requests from React |
| `better-sqlite3` | SQLite database | Store parsed DDR data |
| `saxes` | XML parser | Parse large DDR XML files |
| `fs-extra` | File operations | Read DDR files, create exports |

---

## Electron Desktop Framework

### What is Electron?
Electron lets you build **desktop applications** using **web technologies** (HTML, CSS, JavaScript).

**Famous Electron Apps**: Visual Studio Code, Discord, Slack, WhatsApp Desktop

### How Electron Works
```
┌──────────────────────────────────────────┐
│           Electron Application           │
│  ┌─────────────────────────────────────┐ │
│  │        Main Process (Node.js)       │ │  ← Backend
│  │     - File system access            │ │
│  │     - Database operations           │ │
│  │     - Window management             │ │
│  └─────────────────────────────────────┘ │
│              │                           │
│              ▼                           │
│  ┌─────────────────────────────────────┐ │
│  │    Renderer Process (Chromium)      │ │  ← Frontend
│  │     - React UI                      │ │
│  │     - User interactions             │ │
│  │     - Graph visualization           │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Key Electron Concepts

#### 1. **Main Process vs Renderer Process**
- **Main Process**: The Node.js backend (file operations, database)
- **Renderer Process**: The web page frontend (React UI)
- They communicate via **IPC** (Inter-Process Communication)

#### 2. **IPC Communication**
```javascript
// Main Process (backend)
ipcMain.handle('parse-ddr', async (event, filePath) => {
  const result = await parseDDRFile(filePath);
  return result;
});

// Renderer Process (frontend)
const result = await ipcRenderer.invoke('parse-ddr', '/path/to/file.xml');
```

**Think of it like**: Function calls between different programs

#### 3. **Security Context Bridge**
Modern Electron uses a "bridge" for security:
```javascript
// preload.js - Safe bridge between main and renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  parseDDR: (filePath) => ipcRenderer.invoke('parse-ddr', filePath),
  openFile: () => ipcRenderer.invoke('open-file-dialog')
});

// React components can then use:
const result = await window.electronAPI.parseDDR(filePath);
```

---

## React Frontend Framework

### What is React?
React is a library for building **user interfaces** using **components** (reusable UI pieces).

### Key React Concepts

#### 1. **Components**
Think of components like custom HTML elements:

```jsx
// A simple component
function SearchBox({ onSearch }) {
  const [searchText, setSearchText] = useState('');
  
  return (
    <div>
      <input 
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search scripts, fields..."
      />
      <button onClick={() => onSearch(searchText)}>
        Search
      </button>
    </div>
  );
}

// Use it like HTML
function App() {
  return (
    <div>
      <h1>FileMaker DDR Explorer</h1>
      <SearchBox onSearch={(text) => console.log('Searching for:', text)} />
    </div>
  );
}
```

#### 2. **State** (Data that Changes)
```jsx
function ScriptsList() {
  const [scripts, setScripts] = useState([]);      // Empty array initially
  const [loading, setLoading] = useState(false);   // Not loading initially
  
  async function loadScripts() {
    setLoading(true);
    const scriptData = await window.electronAPI.getScripts();
    setScripts(scriptData);
    setLoading(false);
  }
  
  return (
    <div>
      {loading ? (
        <p>Loading scripts...</p>
      ) : (
        <ul>
          {scripts.map(script => (
            <li key={script.id}>{script.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Think of state like**: Variables that automatically update the UI when changed

#### 3. **Props** (Passing Data Between Components)
```jsx
// Parent component
function App() {
  const [selectedScript, setSelectedScript] = useState(null);
  
  return (
    <div>
      <ScriptsList onSelect={setSelectedScript} />
      <ScriptDetails script={selectedScript} />
    </div>
  );
}

// Child components
function ScriptsList({ onSelect }) {
  // When user clicks a script, tell parent
  return (
    <ul>
      {scripts.map(script => (
        <li onClick={() => onSelect(script)}>
          {script.name}
        </li>
      ))}
    </ul>
  );
}

function ScriptDetails({ script }) {
  if (!script) return <p>Select a script to view details</p>;
  
  return (
    <div>
      <h2>{script.name}</h2>
      <p>{script.description}</p>
    </div>
  );
}
```

### JSX Syntax
JSX lets you write HTML-like code in JavaScript:

```jsx
// Instead of creating elements manually:
const element = React.createElement('h1', null, 'Hello World');

// You can write:
const element = <h1>Hello World</h1>;

// With variables:
const name = 'FileMaker';
const element = <h1>Hello {name}</h1>;

// With conditions:
const element = (
  <div>
    {loading ? <p>Loading...</p> : <p>Ready!</p>}
    {error && <p>Error: {error.message}</p>}
  </div>
);
```

---

## Modern JavaScript/TypeScript

### ES6+ Features You'll See

#### 1. **Arrow Functions**
```javascript
// Old way
function add(a, b) {
  return a + b;
}

// Arrow function
const add = (a, b) => a + b;

// With array methods
const scripts = data.filter(item => item.type === 'script');
const names = scripts.map(script => script.name);
```

#### 2. **Destructuring**
```javascript
// Extract values from objects/arrays
const { name, id, type } = script;           // Instead of script.name, script.id...
const [first, second] = searchResults;       // Get first two results

// In function parameters
function displayScript({ name, description, steps }) {
  console.log(`Script: ${name} - ${description}`);
}
```

#### 3. **Template Literals**
```javascript
// Old way
const message = "Script " + name + " has " + count + " steps";

// Template literal
const message = `Script ${name} has ${count} steps`;

// Multi-line
const sql = `
  SELECT s.name, s.description 
  FROM scripts s 
  WHERE s.name LIKE ?
`;
```

#### 4. **Async/Await**
```javascript
// Handle asynchronous operations cleanly
async function parseAndAnalyze(filePath) {
  try {
    const xmlData = await readFile(filePath);
    const parsed = await parseXML(xmlData);
    const analyzed = await analyzeReferences(parsed);
    return analyzed;
  } catch (error) {
    console.error('Failed to process:', error);
    throw error;
  }
}
```

### TypeScript Benefits
TypeScript adds **type checking** to JavaScript:

```typescript
// Define interfaces for your data
interface Script {
  id: string;
  name: string;
  description?: string;    // Optional property
  steps: ScriptStep[];
}

interface ScriptStep {
  type: 'perform_script' | 'set_field' | 'if_condition';
  parameters: Record<string, any>;
}

// Functions with type checking
function findScriptById(scripts: Script[], id: string): Script | null {
  return scripts.find(s => s.id === id) || null;
}

// React components with types
interface SearchBoxProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

const SearchBox: React.FC<SearchBoxProps> = ({ onSearch, placeholder }) => {
  // Component implementation
};
```

**Benefits**:
- Catches errors before runtime
- Better autocomplete in editors
- Self-documenting code
- Easier refactoring

---

## Database Integration (SQLite)

### Why SQLite?
- **File-based**: No server needed, just a file on disk
- **Cross-platform**: Works identically everywhere
- **Full-text search**: Built-in FTS5 for searching text
- **Fast**: Optimized for read-heavy workloads

### Key Database Concepts

#### 1. **Schema Design**
```sql
-- Tables for DDR entities
CREATE TABLE scripts (
  id TEXT PRIMARY KEY,
  file_id TEXT,
  name TEXT NOT NULL,
  folder_path TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE script_steps (
  id TEXT PRIMARY KEY,
  script_id TEXT,
  step_number INTEGER,
  step_type TEXT,
  parameters JSON,
  FOREIGN KEY(script_id) REFERENCES scripts(id)
);

-- Cross-references between entities
CREATE TABLE references (
  id TEXT PRIMARY KEY,
  from_type TEXT,    -- 'script', 'layout', 'field'
  from_id TEXT,
  to_type TEXT,
  to_id TEXT,
  ref_type TEXT,     -- 'calls', 'uses', 'displays'
  context JSON
);

-- Full-text search
CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type, entity_id, name, content
);
```

#### 2. **Using better-sqlite3**
```javascript
const Database = require('better-sqlite3');

class DDRDatabase {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');  // Better concurrency
  }
  
  // Prepared statements for performance
  insertScript = this.db.prepare(`
    INSERT INTO scripts (id, name, description, file_id)
    VALUES (?, ?, ?, ?)
  `);
  
  findScriptsByName = this.db.prepare(`
    SELECT * FROM scripts WHERE name LIKE ?
  `);
  
  // Transactions for bulk operations
  insertManyScripts(scripts) {
    const insert = this.db.transaction((scripts) => {
      for (const script of scripts) {
        this.insertScript.run(script.id, script.name, script.description, script.fileId);
      }
    });
    
    insert(scripts);
  }
  
  // Full-text search
  searchAll(query) {
    return this.db.prepare(`
      SELECT entity_type, entity_id, name, 
             snippet(search_index, 2, '<mark>', '</mark>', '...', 32) as snippet
      FROM search_index 
      WHERE search_index MATCH ?
      ORDER BY rank
    `).all(query);
  }
}
```

#### 3. **Migration Strategy**
```javascript
// Database versioning for updates
class DatabaseMigrations {
  static migrations = [
    {
      version: 1,
      up: (db) => {
        db.exec(`CREATE TABLE scripts (...)`);
        db.exec(`CREATE TABLE references (...)`);
      }
    },
    {
      version: 2,
      up: (db) => {
        db.exec(`ALTER TABLE scripts ADD COLUMN folder_path TEXT`);
        db.exec(`CREATE INDEX idx_scripts_folder ON scripts(folder_path)`);
      }
    }
  ];
  
  static migrate(db) {
    const currentVersion = db.pragma('user_version', { simple: true });
    
    for (const migration of this.migrations) {
      if (migration.version > currentVersion) {
        migration.up(db);
        db.pragma(`user_version = ${migration.version}`);
      }
    }
  }
}
```

---

## XML Processing

### Streaming vs DOM Parsing

#### **DOM Parsing** (loads everything into memory):
```javascript
const xml2js = require('xml2js');

// BAD for large files - loads entire 100MB into memory
const xmlContent = fs.readFileSync('huge-ddr.xml', 'utf8');
const result = await xml2js.parseStringPromise(xmlContent);
```

#### **Streaming Parsing** (processes piece by piece):
```javascript
const { SaxesParser } = require('saxes');

class DDRStreamParser {
  constructor() {
    this.parser = new SaxesParser();
    this.currentElement = null;
    this.elementStack = [];
    
    this.parser.on('opentag', (tag) => this.handleOpenTag(tag));
    this.parser.on('text', (text) => this.handleText(text));
    this.parser.on('closetag', (tag) => this.handleCloseTag(tag));
  }
  
  handleOpenTag(tag) {
    switch (tag.name) {
      case 'Script':
        this.currentScript = {
          id: tag.attributes.id,
          name: tag.attributes.name,
          steps: []
        };
        break;
      case 'Step':
        this.currentStep = {
          type: tag.attributes.type,
          parameters: {}
        };
        break;
    }
  }
  
  handleCloseTag(tagName) {
    switch (tagName) {
      case 'Script':
        // Process complete script immediately
        this.processScript(this.currentScript);
        this.currentScript = null;
        break;
    }
  }
  
  processScript(script) {
    // Insert into database immediately
    // Don't keep in memory
    this.database.insertScript(script);
  }
  
  parseFile(filePath) {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      
      stream.on('data', (chunk) => {
        this.parser.write(chunk);
      });
      
      stream.on('end', () => {
        this.parser.close();
        resolve();
      });
      
      stream.on('error', reject);
    });
  }
}
```

### Error Handling for Real-World XML
```javascript
class RobustXMLParser {
  parseWithFallback(filePath) {
    try {
      return this.parseStrict(filePath);
    } catch (error) {
      if (error.message.includes('encoding')) {
        // Try different encoding
        return this.parseWithEncoding(filePath, 'utf16le');
      } else if (error.message.includes('malformed')) {
        // Try cleaning the XML first
        return this.parseWithCleaning(filePath);
      }
      throw error;
    }
  }
  
  async parseWithCleaning(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf8');
    
    // Common DDR XML issues
    const cleaned = content
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // Remove control chars
      .replace(/&(?![a-zA-Z]{1,8};)/g, '&amp;')           // Escape unescaped &
      .replace(/<!\[CDATA\[.*?(?=<)/gs, (match) =>        // Fix broken CDATA
        match.includes(']]>') ? match : match + ']]>'
      );
    
    return this.parseString(cleaned);
  }
}
```

---

## Graph Visualization

### Cytoscape.js for Interactive Graphs

#### 1. **Basic Setup**
```javascript
import cytoscape from 'cytoscape';

const cy = cytoscape({
  container: document.getElementById('graph-container'),
  
  elements: [
    // Nodes (scripts, tables, etc.)
    { data: { id: 'script1', label: 'Initialize System', type: 'script' } },
    { data: { id: 'script2', label: 'Create User', type: 'script' } },
    { data: { id: 'table1', label: 'Users', type: 'table' } },
    
    // Edges (relationships)
    { data: { source: 'script1', target: 'script2', type: 'calls' } },
    { data: { source: 'script2', target: 'table1', type: 'uses' } }
  ],
  
  style: [
    {
      selector: 'node[type="script"]',
      style: {
        'background-color': '#3498db',
        'label': 'data(label)',
        'text-valign': 'center',
        'color': 'white',
        'text-outline-width': 2,
        'text-outline-color': '#3498db'
      }
    },
    {
      selector: 'node[type="table"]',
      style: {
        'background-color': '#e74c3c',
        'shape': 'rectangle'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier'
      }
    }
  ],
  
  layout: {
    name: 'cose',  // Force-directed layout
    nodeRepulsion: 400000,
    nodeOverlap: 10,
    idealEdgeLength: 100
  }
});
```

#### 2. **Interactive Features**
```javascript
// Click handling
cy.on('tap', 'node', function(event) {
  const node = event.target;
  const nodeData = node.data();
  
  // Show details panel
  showEntityDetails(nodeData.type, nodeData.id);
  
  // Highlight connected nodes
  const connected = node.connectedEdges().connectedNodes();
  cy.elements().removeClass('highlighted');
  connected.addClass('highlighted');
});

// Search and filter
function filterGraph(searchTerm, entityType) {
  cy.elements().show();  // Show all first
  
  if (searchTerm) {
    const matching = cy.nodes().filter(node => 
      node.data('label').toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const toShow = matching.union(matching.connectedEdges());
    cy.elements().not(toShow).hide();
  }
  
  if (entityType && entityType !== 'all') {
    cy.nodes(`[type != "${entityType}"]`).hide();
  }
}

// Performance for large graphs
function loadGraphInChunks(elements, chunkSize = 1000) {
  const chunks = [];
  for (let i = 0; i < elements.length; i += chunkSize) {
    chunks.push(elements.slice(i, i + chunkSize));
  }
  
  let chunkIndex = 0;
  function loadNextChunk() {
    if (chunkIndex < chunks.length) {
      cy.add(chunks[chunkIndex]);
      chunkIndex++;
      setTimeout(loadNextChunk, 50);  // Give UI time to update
    } else {
      cy.layout({ name: 'cose' }).run();  // Apply layout when done
    }
  }
  
  loadNextChunk();
}
```

#### 3. **Export Capabilities**
```javascript
// Export as image
function exportGraph(format = 'png') {
  const options = {
    output: 'blob',
    bg: 'white',
    full: true,
    scale: 2
  };
  
  if (format === 'png') {
    return cy.png(options);
  } else if (format === 'jpg') {
    return cy.jpg(options);
  } else if (format === 'svg') {
    return cy.svg(options);
  }
}

// Export graph data
function exportGraphData() {
  return {
    elements: cy.elements().jsons(),
    style: cy.style().json(),
    layout: currentLayoutOptions
  };
}
```

---

## Build Tools & Development Workflow

### Package.json Structure
```json
{
  "name": "filemaker-ddr-explorer",
  "version": "1.0.0",
  "main": "dist/main.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:main\" \"npm run dev:renderer\"",
    "dev:main": "webpack --config webpack.main.js --mode development --watch",
    "dev:renderer": "webpack serve --config webpack.renderer.js --mode development",
    "build": "npm run build:main && npm run build:renderer",
    "build:main": "webpack --config webpack.main.js --mode production",
    "build:renderer": "webpack --config webpack.renderer.js --mode production",
    "package": "electron-builder",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.{js,jsx,ts,tsx}",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "electron": "^latest",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "better-sqlite3": "^8.0.0",
    "saxes": "^6.0.0",
    "cytoscape": "^3.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0",
    "webpack": "^5.0.0",
    "electron-builder": "^24.0.0",
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  }
}
```

### Webpack Configuration (Build Tool)
```javascript
// webpack.main.js - For Electron main process
module.exports = {
  target: 'electron-main',
  entry: './src/main/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  node: {
    __dirname: false,
    __filename: false
  }
};

// webpack.renderer.js - For React frontend
module.exports = {
  target: 'electron-renderer',
  entry: './src/renderer/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'renderer.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader'
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx']
  }
};
```

### Development vs Production

#### Development Mode:
- **Hot reload**: Changes appear immediately without restart
- **Source maps**: See original code in debugger, not compiled
- **Verbose errors**: Detailed error messages
- **Fast builds**: Optimized for quick feedback

#### Production Mode:
- **Minification**: Smaller file sizes
- **Optimization**: Faster runtime performance
- **Source map removal**: Hide internal structure
- **Asset optimization**: Compressed images, etc.

---

## Testing Strategies

### Types of Tests

#### 1. **Unit Tests** (Individual functions)
```javascript
// tests/xml-parser.test.js
import { DDRParser } from '../src/services/ddr-parser';

describe('DDRParser', () => {
  let parser;
  
  beforeEach(() => {
    parser = new DDRParser();
  });
  
  test('should parse script element correctly', () => {
    const xmlFragment = `
      <Script id="123" name="Test Script">
        <Step type="comment">This is a test</Step>
      </Script>
    `;
    
    const result = parser.parseScriptElement(xmlFragment);
    
    expect(result).toEqual({
      id: '123',
      name: 'Test Script',
      steps: [{
        type: 'comment',
        content: 'This is a test'
      }]
    });
  });
  
  test('should handle malformed XML gracefully', () => {
    const badXML = '<Script><unclosed>';
    
    expect(() => {
      parser.parseScriptElement(badXML);
    }).toThrow('Malformed XML');
  });
});
```

#### 2. **Integration Tests** (Multiple components working together)
```javascript
// tests/database-integration.test.js
import { DDRDatabase } from '../src/services/database';
import { DDRParser } from '../src/services/ddr-parser';

describe('DDR Parsing and Storage', () => {
  let db;
  let parser;
  
  beforeEach(async () => {
    // Use in-memory database for testing
    db = new DDRDatabase(':memory:');
    parser = new DDRParser(db);
  });
  
  test('should parse DDR file and store in database', async () => {
    const testDDRPath = path.join(__dirname, 'fixtures/sample-ddr.xml');
    
    await parser.parseFile(testDDRPath);
    
    const scripts = db.getAllScripts();
    expect(scripts.length).toBeGreaterThan(0);
    
    const firstScript = scripts[0];
    expect(firstScript).toHaveProperty('id');
    expect(firstScript).toHaveProperty('name');
  });
  
  test('should create cross-references between entities', async () => {
    // Test that script calls are detected and stored
    await parser.parseFile('tests/fixtures/script-with-calls.xml');
    
    const references = db.getReferencesFromScript('main-script-id');
    expect(references).toContainEqual({
      fromType: 'script',
      toType: 'script',
      refType: 'calls'
    });
  });
});
```

#### 3. **End-to-End Tests** (Full user workflows)
```javascript
// tests/e2e/app.test.js
import { Application } from 'spectron';

describe('FileMaker DDR Explorer E2E', () => {
  let app;
  
  beforeEach(async () => {
    app = new Application({
      path: './dist/FileMaker DDR Explorer.exe'
    });
    await app.start();
  });
  
  afterEach(async () => {
    if (app && app.isRunning()) {
      await app.stop();
    }
  });
  
  test('should load DDR file and display scripts', async () => {
    // Open file dialog
    await app.client.click('#open-ddr-button');
    
    // Simulate file selection (in real test, use test files)
    // This would be mocked in actual implementation
    
    // Wait for parsing to complete
    await app.client.waitForExist('#scripts-list', 10000);
    
    // Verify scripts are displayed
    const scriptCount = await app.client.elements('#scripts-list .script-item').length;
    expect(scriptCount).toBeGreaterThan(0);
  });
  
  test('should perform search and show results', async () => {
    // Load test DDR first
    await loadTestDDR(app);
    
    // Enter search term
    await app.client.setValue('#search-input', 'Initialize');
    await app.client.click('#search-button');
    
    // Verify results
    await app.client.waitForExist('#search-results');
    const results = await app.client.elements('#search-results .result-item');
    expect(results.length).toBeGreaterThan(0);
  });
});
```

### Test Data Management
```javascript
// tests/fixtures/test-data-generator.js
export class TestDataGenerator {
  static generateDDRXML(options = {}) {
    const {
      scriptCount = 10,
      tableCount = 5,
      complexReferences = true
    } = options;
    
    let xml = '<?xml version="1.0"?><fmSummary>';
    
    // Generate test scripts
    for (let i = 1; i <= scriptCount; i++) {
      xml += `
        <Script id="script_${i}" name="Test Script ${i}">
          <Step type="comment">Script ${i} step 1</Step>
          ${complexReferences && i > 1 ? 
            `<Step type="perform_script">
               <Calculation><![CDATA["Test Script ${i-1}"]]></Calculation>
             </Step>` : ''
          }
        </Script>
      `;
    }
    
    // Generate test tables
    for (let i = 1; i <= tableCount; i++) {
      xml += `
        <BaseTable id="table_${i}" name="Test Table ${i}">
          <Field id="field_${i}_1" name="ID" type="Number"/>
          <Field id="field_${i}_2" name="Name" type="Text"/>
        </BaseTable>
      `;
    }
    
    xml += '</fmSummary>';
    return xml;
  }
  
  static async createTestDDRFile(filePath, options) {
    const xml = this.generateDDRXML(options);
    await fs.promises.writeFile(filePath, xml, 'utf8');
  }
}
```

---

## Packaging & Distribution

### Electron Builder Configuration
```javascript
// electron-builder.json
{
  "appId": "com.yourcompany.filemaker-ddr-explorer",
  "productName": "FileMaker DDR Explorer",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "node_modules/**/*",
    "package.json"
  ],
  "extraResources": [
    {
      "from": "resources",
      "to": "resources",
      "filter": ["**/*"]
    }
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64", "ia32"]
      }
    ],
    "icon": "assets/icon.ico"
  },
  "mac": {
    "target": "dmg",
    "icon": "assets/icon.icns",
    "category": "public.app-category.developer-tools"
  },
  "linux": {
    "target": [
      "AppImage",
      "deb",
      "rpm"
    ],
    "icon": "assets/icon.png",
    "category": "Development"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  }
}
```

### Code Signing & Distribution
```javascript
// For Mac App Store or direct distribution
"mac": {
  "hardenedRuntime": true,
  "entitlements": "assets/entitlements.mac.plist",
  "entitlementsInherit": "assets/entitlements.mac.plist",
  "gatekeeperAssess": false
}

// For Windows code signing
"win": {
  "certificateFile": "path/to/certificate.p12",
  "certificatePassword": process.env.CSC_KEY_PASSWORD,
  "publisherName": "Your Company Name"
}
```

### Auto-Updater Setup
```javascript
// main.js
import { autoUpdater } from 'electron-updater';

app.whenReady().then(() => {
  // Check for updates after app starts
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update available',
    message: 'A new version is available. It will be downloaded in the background.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update ready',
    message: 'Update downloaded. The application will restart to apply the update.',
    buttons: ['Restart', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
```

---

## Common Patterns & Best Practices

### 1. **Error Handling Patterns**
```javascript
// Centralized error handling
class ErrorHandler {
  static handle(error, context = {}) {
    console.error('Error:', error, 'Context:', context);
    
    // Log to file for debugging
    this.logError(error, context);
    
    // Show user-friendly message
    this.showUserError(error);
    
    // Report to crash reporting service (optional)
    if (process.env.NODE_ENV === 'production') {
      this.reportError(error, context);
    }
  }
  
  static showUserError(error) {
    let message = 'An unexpected error occurred.';
    
    if (error.code === 'ENOENT') {
      message = 'File not found. Please check the file path.';
    } else if (error.message.includes('XML')) {
      message = 'Invalid DDR file format. Please ensure the file is a valid FileMaker DDR export.';
    } else if (error.message.includes('SQLITE')) {
      message = 'Database error. The project file may be corrupted.';
    }
    
    dialog.showErrorBox('Error', message);
  }
}

// Use in async functions
async function parseDefinitionFile(filePath) {
  try {
    return await parser.parseFile(filePath);
  } catch (error) {
    ErrorHandler.handle(error, { filePath, operation: 'parseFile' });
    throw error;  // Re-throw if caller needs to handle it
  }
}
```

### 2. **Progress Reporting for Long Operations**
```javascript
// For parsing large files
class ProgressReporter {
  constructor() {
    this.listeners = [];
  }
  
  onProgress(callback) {
    this.listeners.push(callback);
  }
  
  report(current, total, message = '') {
    const percentage = Math.round((current / total) * 100);
    this.listeners.forEach(callback => {
      callback({ current, total, percentage, message });
    });
  }
}

// Use in main process
async function parseWithProgress(filePath, progressReporter) {
  const fileSize = (await fs.promises.stat(filePath)).size;
  let bytesProcessed = 0;
  
  const stream = fs.createReadStream(filePath);
  
  stream.on('data', (chunk) => {
    bytesProcessed += chunk.length;
    progressReporter.report(bytesProcessed, fileSize, 'Parsing DDR...');
  });
  
  // Process the stream...
}

// Display in renderer
function showProgressDialog(operation) {
  const progressWindow = new BrowserWindow({
    width: 400,
    height: 200,
    parent: mainWindow,
    modal: true
  });
  
  operation.onProgress(({ percentage, message }) => {
    progressWindow.webContents.send('progress-update', { percentage, message });
  });
}
```

### 3. **State Management Patterns**
```javascript
// Simple state management for React
import { createContext, useContext, useReducer } from 'react';

// Define app state structure
const initialState = {
  currentProject: null,
  scripts: [],
  searchResults: [],
  selectedEntity: null,
  loading: false,
  error: null
};

// Define actions
const actions = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  LOAD_PROJECT: 'LOAD_PROJECT',
  SET_SCRIPTS: 'SET_SCRIPTS',
  SET_SEARCH_RESULTS: 'SET_SEARCH_RESULTS',
  SELECT_ENTITY: 'SELECT_ENTITY'
};

// Reducer function
function appReducer(state, action) {
  switch (action.type) {
    case actions.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case actions.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    
    case actions.LOAD_PROJECT:
      return { ...state, currentProject: action.payload, error: null };
    
    case actions.SET_SCRIPTS:
      return { ...state, scripts: action.payload };
    
    case actions.SET_SEARCH_RESULTS:
      return { ...state, searchResults: action.payload };
    
    case actions.SELECT_ENTITY:
      return { ...state, selectedEntity: action.payload };
    
    default:
      return state;
  }
}

// Context provider
const AppContext = createContext();

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use app state
export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
}

// Action creators
export const appActions = {
  setLoading: (loading) => ({ type: actions.SET_LOADING, payload: loading }),
  setError: (error) => ({ type: actions.SET_ERROR, payload: error }),
  loadProject: (project) => ({ type: actions.LOAD_PROJECT, payload: project }),
  // ... more actions
};
```

### 4. **Performance Optimization**
```javascript
// Debounce search input
import { useMemo, useState, useEffect } from 'react';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

// Use in search component
function SearchBox({ onSearch }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  useEffect(() => {
    if (debouncedSearchTerm) {
      onSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, onSearch]);
  
  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  );
}

// Memoize expensive calculations
function ScriptsList({ scripts, searchTerm, selectedType }) {
  const filteredScripts = useMemo(() => {
    return scripts.filter(script => {
      const matchesSearch = !searchTerm || 
        script.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = !selectedType || script.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [scripts, searchTerm, selectedType]);
  
  return (
    <ul>
      {filteredScripts.map(script => (
        <ScriptItem key={script.id} script={script} />
      ))}
    </ul>
  );
}
```

### 5. **Configuration Management**
```javascript
// config/app-config.js
const path = require('path');
const os = require('os');

class AppConfig {
  static getConfigPath() {
    const configDir = path.join(os.homedir(), '.filemaker-ddr-explorer');
    return path.join(configDir, 'config.json');
  }
  
  static getDefaultConfig() {
    return {
      recentProjects: [],
      preferences: {
        theme: 'light',
        maxRecentProjects: 10,
        autoSave: true,
        graphLayout: 'cose'
      },
      performance: {
        maxGraphNodes: 2000,
        batchSize: 1000,
        searchDelay: 300
      }
    };
  }
  
  static async load() {
    try {
      const configPath = this.getConfigPath();
      const configData = await fs.promises.readFile(configPath, 'utf8');
      return { ...this.getDefaultConfig(), ...JSON.parse(configData) };
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
      return this.getDefaultConfig();
    }
  }
  
  static async save(config) {
    const configPath = this.getConfigPath();
    const configDir = path.dirname(configPath);
    
    // Ensure config directory exists
    await fs.promises.mkdir(configDir, { recursive: true });
    
    await fs.promises.writeFile(
      configPath, 
      JSON.stringify(config, null, 2), 
      'utf8'
    );
  }
}
```

---

## Summary & Learning Path

### Recommended Learning Sequence

1. **Start with Node.js basics** - Learn modules, async/await, file operations
2. **Learn React fundamentals** - Components, state, props, hooks
3. **Understand Electron architecture** - Main vs renderer process, IPC
4. **Database integration** - SQLite, SQL basics, better-sqlite3 library
5. **Build tools** - Basic Webpack understanding, npm scripts
6. **Testing** - Start with unit tests, gradually add integration tests

### Key Resources

- **Node.js**: Official documentation, "You Don't Know JS" book series
- **React**: Official tutorial, React documentation, "React Hooks" guides
- **Electron**: Official guides, Electron Fiddle for experimentation
- **SQLite**: SQLite documentation, SQL tutorial websites
- **Modern JavaScript**: MDN Web Docs, javascript.info

### Development Environment Setup

1. **Install Node.js** (LTS version)
2. **Code Editor**: VS Code with extensions:
   - TypeScript and JavaScript Language Features
   - ES7+ React/Redux/React-Native snippets
   - SQLite Viewer
   - Electron Debug
3. **Browser Dev Tools**: Chrome/Edge DevTools for debugging renderer process
4. **Database Tool**: DB Browser for SQLite for examining database structure

### Common Beginner Pitfalls to Avoid

1. **Don't mix main and renderer process code** - Use IPC for communication
2. **Handle async operations properly** - Always use async/await or .catch()
3. **Don't block the main thread** - Use workers for heavy processing
4. **Validate user inputs** - Especially file paths and search queries
5. **Plan your state management** - Don't let React state grow too complex
6. **Test early and often** - Write tests as you build features

This guide should give you a solid foundation for understanding the technologies used in your FileMaker DDR Explorer project. Refer back to specific sections as you encounter these concepts during development!