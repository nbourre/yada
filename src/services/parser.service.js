"use strict";
/**
 * XML Parser Service for FileMaker Database Design Report (DDR)
 * Uses fast-xml-parser for XML parsing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.xmlParserService = exports.XMLParserService = void 0;
const fast_xml_parser_1 = require("fast-xml-parser");
const fs_1 = require("fs");
const database_service_1 = require("./database.service");
class XMLParserService {
    currentProject = {};
    currentElement = '';
    elementStack = [];
    currentData = '';
    errors = [];
    startTime = 0;
    // Tracking parsing state
    currentTable = null;
    currentField = null;
    currentLayout = null;
    currentScript = null;
    currentRelationship = null;
    // Collections for parsed entities
    tables = [];
    fields = [];
    layouts = [];
    scripts = [];
    relationships = [];
    // Statistics counters
    stats = {
        tableCount: 0,
        fieldCount: 0,
        layoutCount: 0,
        scriptCount: 0,
        relationshipCount: 0,
        customFunctionCount: 0,
    };
    async parseFile(filePath) {
        console.log('Parser: Starting parseFile...');
        this.startTime = Date.now();
        this.errors = [];
        this.resetState();
        try {
            // Read file content with BOM handling
            console.log('Parser: Reading file with BOM handling...');
            const xmlContent = await this.readFileWithBOMHandling(filePath);
            // Initialize project with basic info
            const fileName = filePath.split(/[/\\]/).pop() || 'unknown.xml';
            const fileStats = await fs_1.promises.stat(filePath);
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
            console.log('Parser: Starting XML parsing...');
            await this.parseXMLContent(xmlContent);
            console.log('Parser: XML parsing completed, saving to database...');
            // Save parsed data to database
            await this.saveParsedDataToDatabase();
            console.log('Parser: Database save completed');
            // Finalize project
            const parseTime = Date.now() - this.startTime;
            this.stats.parseTime = parseTime;
            const finalProject = {
                ...this.currentProject,
                status: this.errors.length > 0 ? 'error' : 'ready',
                statistics: this.stats,
            };
            // Save to database
            await database_service_1.databaseService.createProject(finalProject);
            return {
                project: finalProject,
                statistics: this.stats,
                parseTime,
                errors: this.errors,
            };
        }
        catch (error) {
            this.errors.push(`Parse error: ${error}`);
            const parseTime = Date.now() - this.startTime;
            const errorProject = {
                ...this.currentProject,
                status: 'error',
                statistics: this.stats,
            };
            return {
                project: errorProject,
                statistics: this.stats,
                parseTime,
                errors: this.errors,
            };
        }
    }
    async parseXMLContent(content) {
        console.log(`Parser: parseXMLContent called with ${content.length} chars`);
        try {
            // Parse XML using fast-xml-parser
            const parser = new fast_xml_parser_1.XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
                textNodeName: '#text',
                parseAttributeValue: true,
                trimValues: true,
            });
            console.log('Parser: Parsing XML with fast-xml-parser...');
            const parsed = parser.parse(content);
            console.log('Parser: XML parsed successfully');
            // Find the root element (FMPReport or FMPDDR)
            const root = parsed.FMPReport || parsed.FMPDDR || parsed.fmpreport || parsed.fmpddr;
            if (!root) {
                throw new Error('Could not find FMPReport or FMPDDR root element in XML');
            }
            console.log('Parser: Found root element, traversing...');
            // Extract metadata from root attributes
            if (root['@_version']) {
                this.currentProject.metadata = {
                    ...this.currentProject.metadata,
                    fileMakerVersion: root['@_version'],
                    platform: root['@_platform'] || 'Unknown',
                };
            }
            // Process File element
            if (root.File) {
                this.processFileElement(root.File);
            }
            console.log('Parser: XML parsing completed');
        }
        catch (error) {
            console.error('Parser: XML parser error:', error);
            this.errors.push(`XML Parse Error: ${error}`);
            throw error;
        }
    }
    processFileElement(fileElement) {
        // Extract file metadata
        if (fileElement['@_name']) {
            this.currentProject.name = fileElement['@_name'];
        }
        if (fileElement['@_path']) {
            this.currentProject.filePath = fileElement['@_path'];
        }
        // Process BaseTableCatalog
        if (fileElement.BaseTableCatalog) {
            this.processBaseTableCatalog(fileElement.BaseTableCatalog);
        }
        // Process LayoutCatalog
        if (fileElement.LayoutCatalog) {
            this.processLayoutCatalog(fileElement.LayoutCatalog);
        }
        // Process ScriptCatalog
        if (fileElement.ScriptCatalog) {
            this.processScriptCatalog(fileElement.ScriptCatalog);
        }
        // Process RelationshipGraph
        if (fileElement.RelationshipGraph) {
            this.processRelationshipGraph(fileElement.RelationshipGraph);
        }
    }
    processBaseTableCatalog(catalog) {
        const tables = catalog.BaseTable;
        if (!tables)
            return;
        const tableArray = Array.isArray(tables) ? tables : [tables];
        tableArray.forEach((tableData) => {
            const table = {
                id: this.generateId(),
                projectId: this.currentProject.id,
                name: tableData['@_name'] || 'Unnamed Table',
                occurrence: tableData['@_occurrence'] || tableData['@_name'] || 'Main',
                sourceTable: tableData['@_sourceTable'],
                recordCount: tableData['@_recordCount'] ? parseInt(tableData['@_recordCount']) : undefined,
                fields: [],
                relationships: [],
            };
            // Process fields
            if (tableData.FieldCatalog?.Field) {
                const fields = Array.isArray(tableData.FieldCatalog.Field)
                    ? tableData.FieldCatalog.Field
                    : [tableData.FieldCatalog.Field];
                fields.forEach((fieldData) => {
                    const field = {
                        id: this.generateId(),
                        projectId: this.currentProject.id,
                        tableId: table.id,
                        tableName: table.name,
                        name: fieldData['@_name'] || 'Unnamed Field',
                        type: this.mapFieldType(fieldData['@_dataType'] || fieldData['@_type'] || 'text'),
                        options: {},
                        calculation: fieldData.Calculation?.['#text'] || fieldData.Calculation,
                        comment: fieldData.Comment?.['#text'] || fieldData.Comment,
                    };
                    table.fields.push(field);
                    this.fields.push(field);
                    this.stats.fieldCount++;
                });
            }
            this.tables.push(table);
            this.stats.tableCount++;
        });
        console.log(`Parser: Processed ${tableArray.length} tables with ${this.fields.length} fields`);
    }
    processLayoutCatalog(catalog) {
        const layouts = catalog.Layout;
        if (!layouts)
            return;
        const layoutArray = Array.isArray(layouts) ? layouts : [layouts];
        layoutArray.forEach((layoutData) => {
            const layout = {
                id: this.generateId(),
                projectId: this.currentProject.id,
                name: layoutData['@_name'] || 'Unnamed Layout',
                type: 'form',
                fields: [],
                parts: [],
                scripts: [],
            };
            this.layouts.push(layout);
            this.stats.layoutCount++;
        });
        console.log(`Parser: Processed ${layoutArray.length} layouts`);
    }
    processScriptCatalog(catalog) {
        const scripts = catalog.Script;
        if (!scripts)
            return;
        const scriptArray = Array.isArray(scripts) ? scripts : [scripts];
        scriptArray.forEach((scriptData) => {
            const script = {
                id: this.generateId(),
                projectId: this.currentProject.id,
                name: scriptData['@_name'] || 'Unnamed Script',
                steps: [],
                comment: scriptData['@_comment'] || scriptData.Comment?.['#text'],
            };
            this.scripts.push(script);
            this.stats.scriptCount++;
        });
        console.log(`Parser: Processed ${scriptArray.length} scripts`);
    }
    processRelationshipGraph(graph) {
        const relationships = graph.Relationship;
        if (!relationships)
            return;
        const relationshipArray = Array.isArray(relationships) ? relationships : [relationships];
        relationshipArray.forEach((relData) => {
            const relationship = {
                id: this.generateId(),
                projectId: this.currentProject.id,
                name: relData['@_name'] || 'Unnamed Relationship',
                leftTable: relData['@_leftTable'] || relData['@_table1'],
                leftField: relData['@_leftField'] || relData['@_field1'] || '',
                rightTable: relData['@_rightTable'] || relData['@_table2'],
                rightField: relData['@_rightField'] || relData['@_field2'] || '',
                type: 'one-to-many',
                options: {},
            };
            this.relationships.push(relationship);
            this.stats.relationshipCount++;
        });
        console.log(`Parser: Processed ${relationshipArray.length} relationships`);
    }
    handleOpenTag(tagName, attributes) {
        switch (tagName.toLowerCase()) {
            case 'fmpddr':
            case 'fmpreport':
                // Root element - extract version info
                this.currentProject.metadata = {
                    ...this.currentProject.metadata,
                    fileMakerVersion: attributes.version || 'Unknown',
                    platform: attributes.platform || 'Unknown',
                };
                break;
            case 'table':
            case 'basetable':
                this.currentTable = {
                    id: this.generateId(),
                    projectId: this.currentProject.id,
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
                    projectId: this.currentProject.id,
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
                    projectId: this.currentProject.id,
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
                    projectId: this.currentProject.id,
                    name: attributes.name || 'Unnamed Script',
                    runWithFullAccess: attributes.runWithFullAccess === 'true',
                    includeInMenu: attributes.includeInMenu === 'true',
                    steps: [],
                };
                break;
            case 'relationship':
                this.currentRelationship = {
                    id: this.generateId(),
                    projectId: this.currentProject.id,
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
    async handleCloseTag(tagName, data) {
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
                    this.currentProject.metadata.creationDate = new Date(data);
                }
                break;
            case 'modified':
                if (data) {
                    this.currentProject.metadata.modificationDate = new Date(data);
                }
                break;
            case 'table':
            case 'basetable':
                if (this.currentTable) {
                    // Add to tables collection instead of saving to database
                    this.tables.push(this.currentTable);
                    this.stats.tableCount++;
                    this.currentTable = null;
                }
                break;
            case 'field':
                if (this.currentField) {
                    // Add to fields collection instead of saving to database
                    this.fields.push(this.currentField);
                    this.stats.fieldCount++;
                    if (this.currentTable) {
                        this.currentTable.fields = this.currentTable.fields || [];
                        this.currentTable.fields.push(this.currentField);
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
                }
                else if (this.currentScript) {
                    this.currentScript.comment = data;
                }
                break;
        }
    }
    mapFieldType(type) {
        const typeMap = {
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
    mapLayoutType(type) {
        const typeMap = {
            form: 'form',
            list: 'list',
            table: 'table',
            report: 'report',
            label: 'label',
            envelope: 'envelope',
        };
        return typeMap[type.toLowerCase()] || 'form';
    }
    mapRelationshipType(type) {
        const typeMap = {
            'one-to-one': 'one-to-one',
            'one-to-many': 'one-to-many',
            'many-to-one': 'many-to-one',
            'many-to-many': 'many-to-many',
        };
        return typeMap[type.toLowerCase()] || 'one-to-many';
    }
    resetState() {
        this.currentProject = {};
        this.currentTable = null;
        this.currentField = null;
        this.currentLayout = null;
        this.currentScript = null;
        this.currentRelationship = null;
        this.elementStack = [];
        this.currentElement = '';
        this.currentData = '';
        // Clear collections
        this.tables = [];
        this.fields = [];
        this.layouts = [];
        this.scripts = [];
        this.relationships = [];
        this.stats = {
            tableCount: 0,
            fieldCount: 0,
            layoutCount: 0,
            scriptCount: 0,
            relationshipCount: 0,
            customFunctionCount: 0,
        };
    }
    generateId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    async saveParsedDataToDatabase() {
        try {
            // Save tables
            for (const table of this.tables) {
                await database_service_1.databaseService.createTable(table);
            }
            // Save fields
            for (const field of this.fields) {
                await database_service_1.databaseService.createField(field);
            }
            // TODO: Implement createLayout, createScript, createRelationship in database service
            // For now, we'll just collect the data
            console.log(`Parsed ${this.layouts.length} layouts`);
            console.log(`Parsed ${this.scripts.length} scripts`);
            console.log(`Parsed ${this.relationships.length} relationships`);
        }
        catch (error) {
            this.errors.push(`Failed to save parsed data to database: ${error}`);
        }
    }
    async readFileWithBOMHandling(filePath) {
        try {
            // First, read as buffer to detect BOM
            const buffer = await fs_1.promises.readFile(filePath);
            // Check for UTF-16 BOM (ff fe or fe ff)
            if (buffer.length >= 2) {
                const bom = buffer.subarray(0, 2);
                // UTF-16 LE BOM (ff fe)
                if (bom[0] === 0xff && bom[1] === 0xfe) {
                    // Read as UTF-16 LE and clean replacement characters
                    let content = buffer.toString('utf16le');
                    // Remove BOM character if present
                    if (content.charCodeAt(0) === 0xfeff) {
                        content = content.substring(1);
                    }
                    // Clean replacement characters and null bytes
                    content = content.replace(/\uFFFD/g, '').replace(/\0/g, '');
                    return content;
                }
                // UTF-16 BE BOM (fe ff)
                if (bom[0] === 0xfe && bom[1] === 0xff) {
                    let content = buffer.toString('utf16le'); // Node.js uses 'utf16le' for both
                    if (content.charCodeAt(0) === 0xfeff) {
                        content = content.substring(1);
                    }
                    content = content.replace(/\uFFFD/g, '').replace(/\0/g, '');
                    return content;
                }
                // UTF-8 BOM (ef bb bf)
                if (buffer.length >= 3 && bom[0] === 0xef && buffer[2] === 0xbf && buffer[3] === 0xbf) {
                    return buffer.toString('utf-8').replace(/^\uFEFF/, '');
                }
            }
            // No BOM detected, assume UTF-8
            return buffer.toString('utf-8');
        }
        catch (error) {
            throw new Error(`Failed to read file with BOM handling: ${error}`);
        }
    }
    async validateXMLFile(filePath) {
        try {
            const content = await this.readFileWithBOMHandling(filePath);
            // Basic XML validation
            if (!content.includes('<?xml')) {
                return { isValid: false, errors: ['Not a valid XML file'] };
            }
            if (!content.includes('<fmpddr') &&
                !content.includes('<FMPDDRDocument') &&
                !content.includes('<FMPReport')) {
                return { isValid: false, errors: ['Not a FileMaker DDR XML file'] };
            }
            // Try to parse with fast-xml-parser to check validity
            const parser = new fast_xml_parser_1.XMLParser({
                ignoreAttributes: false,
            });
            const errors = [];
            try {
                // Parse first 5000 characters to check basic structure
                const testContent = content.substring(0, 5000);
                parser.parse(testContent);
            }
            catch (error) {
                errors.push(error instanceof Error ? error.message : String(error));
            }
            return {
                isValid: errors.length === 0,
                errors,
            };
        }
        catch (error) {
            return {
                isValid: false,
                errors: [`File validation error: ${error}`],
            };
        }
    }
    async getParseProgress(projectId) {
        // In a real implementation, this would track parsing progress
        // For now, we'll simulate with basic metrics
        const project = await database_service_1.databaseService.getProject(projectId);
        if (!project)
            return null;
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
exports.XMLParserService = XMLParserService;
// Export singleton instance
exports.xmlParserService = new XMLParserService();
