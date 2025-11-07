import { promises as fs } from 'fs';
import path from 'path';

describe('BOM Analysis', () => {
  test('analyze BOM characters', async () => {
    const filePath = path.join(process.cwd(), 'tests', 'fixtures', 'small_database.xml');
    const content = await fs.readFile(filePath, 'utf-8');
    
    console.log('First 10 character codes:');
    for (let i = 0; i < Math.min(10, content.length); i++) {
      console.log(`Pos ${i}: ${content.charCodeAt(i)} (0x${content.charCodeAt(i).toString(16)}) '${content[i]}'`);
    }
    
    // Try different approaches to clean
    console.log('\nOriginal starts with:', content.substring(0, 20));
    
    // Method 1: Remove BOM by character code
    let clean1 = content;
    if (clean1.charCodeAt(0) === 0xfeff) {
      clean1 = clean1.substring(1);
    }
    console.log('Method 1 (BOM removal):', clean1.substring(0, 20));
    
    // Method 2: Remove by regex
    const clean2 = content.replace(/^\uFEFF/, '');
    console.log('Method 2 (regex):', clean2.substring(0, 20));
    
    // Method 3: Skip first few characters
    const clean3 = content.substring(2);
    console.log('Method 3 (skip 2):', clean3.substring(0, 20));
    
    // Method 4: Find <?xml position
    const xmlPos = content.indexOf('<?xml');
    console.log('<?xml position:', xmlPos);
    if (xmlPos > 0) {
      const clean4 = content.substring(xmlPos);
      console.log('Method 4 (from <?xml):', clean4.substring(0, 20));
      
      // This should work!
      expect(clean4.startsWith('<?xml')).toBe(true);
    }
    
    expect(true).toBe(true); // Pass test
  });
});