import { xmlParserService } from '../src/services/parser.service';
import path from 'path';
import { promises as fs } from 'fs';

describe('Debug XML Parser', () => {
  test('should read and validate XML file', async () => {
    // Check various path combinations
    const paths = [
      path.join(__dirname, 'fixtures', 'small_database.xml'),
      path.join(process.cwd(), 'tests', 'fixtures', 'small_database.xml'),
      'tests/fixtures/small_database.xml',
      'tests\\fixtures\\small_database.xml',
    ];

    for (const filePath of paths) {
      try {
        console.log(`Trying path: ${filePath}`);
        const exists = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);
        console.log(`Exists: ${exists}`);

        if (exists) {
          const content = await fs.readFile(filePath, 'utf-8');
          console.log(`First 100 chars: ${content.substring(0, 100)}`);

          const validation = await xmlParserService.validateXMLFile(filePath);
          console.log(`Validation: ${JSON.stringify(validation)}`);

          if (validation.isValid) {
            expect(validation.isValid).toBe(true);
            return; // Success!
          }
        }
      } catch (error) {
        console.log(`Error with ${filePath}: ${error}`);
      }
    }

    fail('No valid path found');
  });
});
