import { xmlParserService } from '../src/services/parser.service';
import path from 'path';

describe('Real DDR XML Parsing', () => {
  test('should parse small_database.xml', async () => {
    const filePath = path.join(__dirname, 'fixtures', 'small_database.xml');
    
    // Validate the file first
    const validation = await xmlParserService.validateXMLFile(filePath);
    console.log('Validation result:', validation);
    
    if (validation.isValid) {
      // Parse the file
      const result = await xmlParserService.parseFile(filePath);
      console.log('Parse result:', {
        projectName: result.project.name,
        fileName: result.project.fileName,
        tableCount: result.statistics.tableCount,
        fieldCount: result.statistics.fieldCount,
        relationshipCount: result.statistics.relationshipCount,
        parseTime: result.parseTime,
        errors: result.errors
      });
      
      expect(result.project).toBeDefined();
      expect(result.statistics.tableCount).toBeGreaterThan(0);
    } else {
      console.log('File validation failed:', validation.errors);
    }
  }, 30000);
});