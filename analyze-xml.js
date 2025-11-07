const fs = require('fs').promises;
const { SaxesParser } = require('saxes');

async function analyzeXMLStructure() {
  try {
    console.log('Reading file...');
    const buffer = await fs.readFile('./tests/fixtures/small_database.xml');
    
    // Handle BOM
    let content;
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      content = buffer.toString('utf16le');
      if (content.charCodeAt(0) === 0xfeff) {
        content = content.substring(1);
      }
      content = content.replace(/\uFFFD/g, '').replace(/\0/g, '');
    } else {
      content = buffer.toString('utf-8');
    }
    
    console.log(`Content length: ${content.length}`);
    console.log(`First 500 chars:\n${content.substring(0, 500)}\n`);
    
    const elementCounts = {};
    const elementHierarchy = [];
    let depth = 0;
    let elementCount = 0;
    
    const parser = new SaxesParser({
      xmlns: false,
      position: false,
    });

    parser.on('opentag', node => {
      elementCount++;
      const tagName = node.name.toLowerCase();
      
      elementCounts[tagName] = (elementCounts[tagName] || 0) + 1;
      depth++;
      
      if (elementCount <= 50) {
        console.log(`${'  '.repeat(depth-1)}<${node.name}> (${Object.keys(node.attributes || {}).length} attrs)`);
      }
      
      if (elementCount === 50) {
        console.log('... (showing first 50 elements only)\n');
      }
    });

    parser.on('closetag', tagName => {
      depth--;
    });

    parser.on('error', error => {
      console.error('Parse error:', error.message);
    });

    parser.on('end', () => {
      console.log('Parse completed!');
      console.log(`Total elements: ${elementCount}`);
      console.log('\nElement counts:');
      
      const sortedElements = Object.entries(elementCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20);
      
      for (const [element, count] of sortedElements) {
        console.log(`  ${element}: ${count}`);
      }
    });

    console.log('Starting parse...');
    parser.write(content);
    parser.close();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeXMLStructure();