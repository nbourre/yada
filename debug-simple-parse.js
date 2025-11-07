const fs = require('fs').promises;
const { SaxesParser } = require('saxes');

async function testSimpleParse() {
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
    console.log(`First 200 chars: ${content.substring(0, 200)}`);
    
    let elementCount = 0;
    let textCount = 0;
    let depth = 0;
    
    const parser = new SaxesParser({
      xmlns: false,
      position: false,
    });

    parser.on('opentag', node => {
      elementCount++;
      depth++;
      if (elementCount % 1000 === 0) {
        console.log(`Elements processed: ${elementCount}, depth: ${depth}`);
      }
    });

    parser.on('text', data => {
      textCount++;
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
      console.log(`Total text nodes: ${textCount}`);
    });

    console.log('Starting parse...');
    const startTime = Date.now();
    
    // Add timeout
    const timeout = setTimeout(() => {
      console.log('Parse timed out after 5 seconds');
      process.exit(1);
    }, 5000);
    
    parser.write(content);
    parser.close();
    
    clearTimeout(timeout);
    
    const duration = Date.now() - startTime;
    console.log(`Parse took: ${duration}ms`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSimpleParse();