/**
 * Comprehensive test for fast-xml-parser integration with FileMaker DDR
 */

import { xmlParserService } from '../../src/services/parser.service';
import * as path from 'path';

describe('Fast XML Parser Integration', () => {
  test('should parse small_database.xml successfully', async () => {
    const xmlPath = path.join(__dirname, '../fixtures/small_database.xml');
    
    console.log('Parsing FileMaker DDR with fast-xml-parser...');
    
    const result = await xmlParserService.parseFile(xmlPath);
    
    console.log('\n=== PARSE RESULTS ===');
    console.log('Status:', result.project.status);
    console.log('Parse time:', result.parseTime, 'ms');
    console.log('Errors:', result.errors.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => console.log('-', err));
    }
    
    console.log('\n=== STATISTICS ===');
    console.log('Tables:', result.statistics.tableCount);
    console.log('Fields:', result.statistics.fieldCount);
    console.log('Layouts:', result.statistics.layoutCount);
    console.log('Scripts:', result.statistics.scriptCount);
    console.log('Relationships:', result.statistics.relationshipCount);
    
    // Verify parsing succeeded
    expect(result.project.status).toBe('ready');
    expect(result.statistics.tableCount).toBeGreaterThan(0);
    expect(result.statistics.fieldCount).toBeGreaterThan(0);
    expect(result.parseTime).toBeLessThan(5000); // Should parse in under 5 seconds
    
  }, 10000);
  
  test('should extract correct table and field information', async () => {
    const xmlPath = path.join(__dirname, '../fixtures/small_database.xml');
    
    const result = await xmlParserService.parseFile(xmlPath);
    
    console.log('\n=== EXTRACTED DATA ===');
    console.log('Project name:', result.project.name);
    console.log('File path:', result.project.filePath);
    console.log('Tables:', result.statistics.tableCount);
    
    // Should have found tables named "test" and "childTable"
    expect(result.statistics.tableCount).toBe(2);
    
    // Total fields should be 13 (6 in test + 7 in childTable)
    expect(result.statistics.fieldCount).toBe(13);
    
  }, 10000);
});
