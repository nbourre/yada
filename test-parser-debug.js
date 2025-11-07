import path from 'path';
import { XMLParserService } from '../src/services/parser.service';

async function testParserWithDebugging() {
  try {
    const parser = new XMLParserService();
    const filePath = path.join(__dirname, 'fixtures', 'small_database.xml');
    
    console.log('Starting parser test...');
    
    // Add timeout and logging
    const parsePromise = parser.parseFile(filePath);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Parser timeout after 10s')), 10000);
    });
    
    const result = await Promise.race([parsePromise, timeoutPromise]);
    
    console.log('Parse completed successfully:', {
      projectName: result.project.name,
      tableCount: result.statistics.tableCount,
      fieldCount: result.statistics.fieldCount,
      parseTime: result.parseTime,
      errors: result.errors.length
    });
    
  } catch (error) {
    console.error('Parse failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testParserWithDebugging();