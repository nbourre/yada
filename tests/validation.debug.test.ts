import { xmlParserService } from '../src/services/parser.service';
import { promises as fs } from 'fs';
import path from 'path';

describe('Validation Debug', () => {
  test('debug validation process', async () => {
    const filePath = path.join(process.cwd(), 'tests', 'fixtures', 'small_database.xml');
    let content = await fs.readFile(filePath, 'utf-8');
    
    console.log('Original length:', content.length);
    console.log('First chars:', content.substring(0, 20));
    
    // Apply same cleaning as validation method
    if (content.charCodeAt(0) === 0xfffd && content.charCodeAt(1) === 0xfffd) {
      content = content.substring(2);
    }
    
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.substring(1);
    }
    
    if (content.charCodeAt(0) === 0xfffe) {
      content = content.substring(1);
    }
    
    content = content.replace(/\0/g, '');
    
    const xmlStart = content.indexOf('<?xml');
    if (xmlStart > 0) {
      content = content.substring(xmlStart);
    }
    
    console.log('Cleaned length:', content.length);
    console.log('Cleaned first chars:', content.substring(0, 50));
    console.log('Contains FMPReport:', content.includes('<FMPReport'));
    console.log('Contains File:', content.includes('<File'));
    console.log('Contains BaseTableCatalog:', content.includes('<BaseTableCatalog'));
    console.log('Contains BaseTable:', content.includes('<BaseTable'));
    
    // Now test actual validation
    const validation = await xmlParserService.validateXMLFile(filePath);
    console.log('Validation result:', validation);
    
    expect(validation.isValid).toBe(true);
  });
});