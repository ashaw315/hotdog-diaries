import fs from 'node:fs/promises';

// Read the malformed JSON file
const content = await fs.readFile('ci_audit/runs.json', 'utf8');

// Split by workflow objects and clean them
const lines = content.split('\n');
const validJsonObjects = [];
let currentObject = '';
let braceCount = 0;
let inObject = false;

for (const line of lines) {
  const trimmed = line.trim();
  
  // Skip empty lines and lone commas
  if (!trimmed || trimmed === ',' || trimmed === '[' || trimmed === ']') {
    continue;
  }
  
  // Start tracking object when we see opening brace
  if (trimmed.startsWith('{')) {
    inObject = true;
    currentObject = '';
    braceCount = 0;
  }
  
  if (inObject) {
    currentObject += line + '\n';
    
    // Count braces to know when object is complete
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    
    // When braces are balanced, we have a complete object
    if (braceCount === 0) {
      try {
        // Try to parse the object to validate it
        const obj = JSON.parse(currentObject.trim());
        validJsonObjects.push(obj);
      } catch (e) {
        console.log('Skipping invalid JSON object:', e.message);
      }
      inObject = false;
      currentObject = '';
    }
  }
}

// Write the clean JSON array
await fs.writeFile('ci_audit/runs.json', JSON.stringify(validJsonObjects, null, 2));
console.log(`✅ Fixed JSON array with ${validJsonObjects.length} valid objects`);