import * as fs from 'fs/promises';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

describe('Fast XML Parser Test', () => {
  test('parse simple XML', () => {
    const simpleXML = '<?xml version="1.0"?><root><item name="test">content</item></root>';
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    
    const result = parser.parse(simpleXML);
    
    console.log('Parsed result:', JSON.stringify(result, null, 2));
    
    expect(result).toBeDefined();
    expect(result.root).toBeDefined();
    expect(result.root.item).toBeDefined();
  });
  
  test('parse FileMaker DDR XML', async () => {
    const filePath = path.join(process.cwd(), 'tests', 'fixtures', 'small_database.xml');
    const buffer = await fs.readFile(filePath);
    
    // Decode UTF-16 LE
    let content = buffer.toString('utf16le');
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.substring(1);
    }
    content = content.replace(/\uFFFD/g, '').replace(/\0/g, '');
    
    console.log('Content length:', content.length);
    console.log('First 200 chars:', content.substring(0, 200));
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    
    console.log('\nParsing FileMaker XML...');
    const startTime = Date.now();
    
    const result = parser.parse(content);
    
    const parseTime = Date.now() - startTime;
    console.log(`✓ Parsed in ${parseTime}ms`);
    
    console.log('\nRoot keys:', Object.keys(result));
    
    if (result.FMPReport) {
      console.log('FMPReport keys:', Object.keys(result.FMPReport));
      
      if (result.FMPReport.File) {
        console.log('\nFile info:');
        console.log('- name:', result.FMPReport.File['@_name']);
        console.log('- path:', result.FMPReport.File['@_path']);
        
        if (result.FMPReport.File.BaseTableCatalog) {
          const tables = result.FMPReport.File.BaseTableCatalog.BaseTable;
          const tableArray = Array.isArray(tables) ? tables : [tables];
          
          console.log(`\nFound ${tableArray.length} tables:`);
          tableArray.slice(0, 5).forEach((table: any) => {
            console.log(`- ${table['@_name']} (id: ${table['@_id']})`);
            
            if (table.FieldCatalog?.Field) {
              const fields = Array.isArray(table.FieldCatalog.Field) 
                ? table.FieldCatalog.Field 
                : [table.FieldCatalog.Field];
              console.log(`  Fields: ${fields.length}`);
            }
          });
        }
      }
    }
    
    expect(result).toBeDefined();
    expect(result.FMPReport).toBeDefined();
  }, 10000);
});
