#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning up for production deployment...\n');

// Files and directories to remove
const toRemove = [
  // Test pages
  'app/test-feed',
  'app/test-videos',
  'app/test-results',
  'app/test-display',
  'app/test-adaptive',
  'app/test-epic-intro',
  'app/test-cinematic',
  'app/test-animation',
  
  // Test API routes
  'app/api/test',
  
  // Test components
  'components/PlatformDisplayTest.tsx',
  'components/SizeDebugPanel.tsx',
  'components/DebugBorders.tsx',
  
  // Development database (only remove in production)
  ...(process.env.NODE_ENV === 'production' ? ['hotdog_diaries_dev.db', 'hotdog_diaries_dev.db-journal'] : []),
  
  // Temporary files
  'tmp',
  'temp',
  '.next/cache'
];

let removedCount = 0;
let errorCount = 0;

toRemove.forEach(item => {
  const itemPath = path.join(process.cwd(), item);
  
  try {
    if (fs.existsSync(itemPath)) {
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
        console.log(`✅ Removed directory: ${item}`);
      } else {
        fs.unlinkSync(itemPath);
        console.log(`✅ Removed file: ${item}`);
      }
      removedCount++;
    }
  } catch (error) {
    console.error(`❌ Error removing ${item}:`, error.message);
    errorCount++;
  }
});

// Clean up node_modules of dev dependencies in production
if (process.env.NODE_ENV === 'production') {
  console.log('\n📦 Pruning development dependencies...');
  const { execSync } = require('child_process');
  try {
    execSync('npm prune --production', { stdio: 'inherit' });
    console.log('✅ Development dependencies removed');
  } catch (error) {
    console.error('❌ Error pruning dependencies:', error.message);
  }
}

console.log(`\n✨ Cleanup complete!`);
console.log(`   Removed: ${removedCount} items`);
if (errorCount > 0) {
  console.log(`   Errors: ${errorCount} items couldn't be removed`);
}

// Check for remaining test files
console.log('\n🔍 Checking for remaining test files...');
const { execSync } = require('child_process');
try {
  const testFiles = execSync('find . -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" | grep -v node_modules | head -10', { encoding: 'utf-8' });
  if (testFiles.trim()) {
    console.log('⚠️  Found remaining test files:');
    console.log(testFiles);
  } else {
    console.log('✅ No test files found in source code');
  }
} catch (error) {
  // No test files found (find returns non-zero when no matches)
  console.log('✅ No test files found in source code');
}