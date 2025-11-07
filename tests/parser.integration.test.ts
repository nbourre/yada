/**
 * Integration tests for XMLParserService with real FileMaker DDR files
 */

import { XMLParserService } from '../src/services/parser.service';
import { promises as fs } from 'fs';
import path from 'path';

describe('XMLParserService Integration Tests', () => {
  let parser: XMLParserService;
  const fixturesPath = path.join(__dirname, 'fixtures');

  beforeEach(() => {
    parser = new XMLParserService();
  });

  describe('Real FileMaker DDR File Parsing', () => {
    test('should validate small DDR file', async () => {
      const filePath = path.join(fixturesPath, 'small_database.xml');
      
      // Check if file exists
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const validation = await parser.validateXMLFile(filePath);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should parse small DDR file and extract tables', async () => {
      const filePath = path.join(fixturesPath, 'small_database.xml');
      
      const result = await parser.parseFile(filePath);
      
      expect(result.project).toBeDefined();
      expect(result.project.name).toBe('test'); // From file name="test.fmp12"
      expect(result.project.status).toBe('ready');
      expect(result.errors).toHaveLength(0);
      
      // Should have parsed tables
      expect(result.statistics.tableCount).toBeGreaterThan(0);
      expect(result.statistics.fieldCount).toBeGreaterThan(0);
      
      // Should have found the two tables: "test" and "childTable"
      expect(result.statistics.tableCount).toBe(2);
    });

    test('should parse table fields correctly', async () => {
      const filePath = path.join(fixturesPath, 'small_database.xml');
      
      const result = await parser.parseFile(filePath);
      
      // Each table should have multiple fields
      expect(result.statistics.fieldCount).toBeGreaterThanOrEqual(10); // Both tables have several fields
      
      // Parse time should be reasonable
      expect(result.parseTime).toBeLessThan(5000); // Should parse in under 5 seconds
    });

    test('should handle relationships', async () => {
      const filePath = path.join(fixturesPath, 'small_database.xml');
      
      const result = await parser.parseFile(filePath);
      
      // Should find relationships between tables
      expect(result.statistics.relationshipCount).toBeGreaterThan(0);
    });

    test('should extract file metadata', async () => {
      const filePath = path.join(fixturesPath, 'small_database.xml');
      
      const result = await parser.parseFile(filePath);
      
      expect(result.project.metadata).toBeDefined();
      expect(result.project.metadata!.fileMakerVersion).toBeDefined();
      expect(result.project.fileName).toBe('test.fmp12');
    });

    test('should handle larger DDR files', async () => {
      // Test with one of the larger files if available
      const largeFiles = ['CRM_fmp12.xml', 'Gestionnaire iPlus.xml'];
      
      for (const fileName of largeFiles) {
        const filePath = path.join(fixturesPath, fileName);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        
        if (exists) {
          const validation = await parser.validateXMLFile(filePath);
          expect(validation.isValid).toBe(true);
          
          const result = await parser.parseFile(filePath);
          expect(result.project).toBeDefined();
          expect(result.project.status).toBe('ready');
          expect(result.statistics.tableCount).toBeGreaterThan(0);
          
          // Log performance for larger files
          console.log(`${fileName}: ${result.statistics.tableCount} tables, ${result.statistics.fieldCount} fields, ${result.parseTime}ms`);
          
          // Should complete within reasonable time (30 seconds for large files)
          expect(result.parseTime).toBeLessThan(30000);
        }
      }
    }, 60000); // 60 second timeout for large files

    test('should reject non-DDR XML files', async () => {
      // Create a simple XML file that's not a DDR
      const tempPath = path.join(fixturesPath, 'temp_invalid.xml');
      await fs.writeFile(tempPath, '<?xml version="1.0"?><root><item>test</item></root>');
      
      const validation = await parser.validateXMLFile(tempPath);
      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('Not a FileMaker DDR XML file');
      
      // Clean up
      await fs.unlink(tempPath);
    });

    test('should handle malformed XML gracefully', async () => {
      // Create a malformed XML file
      const tempPath = path.join(fixturesPath, 'temp_malformed.xml');
      await fs.writeFile(tempPath, '<?xml version="1.0"?><FMPReport><BaseTable><Field name="test">');
      
      const validation = await parser.validateXMLFile(tempPath);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      
      // Clean up
      await fs.unlink(tempPath);
    });
  });

  describe('Performance Tests', () => {
    test('should track parsing progress metrics', async () => {
      const filePath = path.join(fixturesPath, 'small_database.xml');
      
      const result = await parser.parseFile(filePath);
      
      expect(result.parseTime).toBeGreaterThan(0);
      expect(result.statistics.parseTime).toBe(result.parseTime);
      
      // Should be able to get progress metrics
      const metrics = await parser.getParseProgress(result.project.id);
      expect(metrics).toBeDefined();
      expect(metrics!.operation).toBe('parse');
      expect(metrics!.duration).toBe(result.parseTime);
    });
  });
});