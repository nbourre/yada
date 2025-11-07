import { XMLParserService } from '../src/services/parser.service';

async function testMinimalParse() {
  try {
    const parser = new XMLParserService();
    console.log('Starting parse...');
    
    const result = await Promise.race([
      parser.parseFile('./tests/fixtures/small_database.xml'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout after 5s')), 5000)
      )
    ]);
    
    console.log('Parse completed:', {
      projectName: result.project.name,
      tableCount: result.statistics.tableCount,
      fieldCount: result.statistics.fieldCount,
      parseTime: result.parseTime,
      errors: result.errors.length
    });
    
  } catch (error) {
    console.error('Parse failed:', error.message);
    
    // Let's also check if the database is causing issues
    console.log('Testing database service...');
    const { databaseService } = await import('../src/services/database.service');
    
    try {
      const testProject = {
        id: 'test-123',
        name: 'Test Project',
        filePath: './test.xml',
        fileName: 'test.xml',
        fileSize: 1000,
        parsedAt: new Date(),
        status: 'ready',
        statistics: {
          tableCount: 0,
          fieldCount: 0,
          layoutCount: 0,
          scriptCount: 0,
          relationshipCount: 0,
          customFunctionCount: 0,
          parseTime: 100
        },
        metadata: {
          fileMakerVersion: 'Test',
          platform: 'Test',
          createdBy: 'Test',
          modifiedBy: 'Test',
          creationDate: new Date(),
          modificationDate: new Date()
        }
      };
      
      await databaseService.createProject(testProject);
      console.log('Database service works');
      
      // Test table creation
      const testTable = {
        id: 'table-123',
        projectId: 'test-123',
        name: 'Test Table',
        occurrence: 'Main',
        fields: [],
        relationships: []
      };
      
      await databaseService.createTable(testTable);
      console.log('Table creation works');
      
    } catch (dbError) {
      console.error('Database error:', dbError.message);
    }
  }
}

testMinimalParse();