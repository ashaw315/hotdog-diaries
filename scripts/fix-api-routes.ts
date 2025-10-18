#!/usr/bin/env npx tsx

/**
 * API Route Auto-Fix Script
 * 
 * Automatically fixes common critical issues identified by the audit:
 * - Adds missing errorHandler imports
 * - Fixes undefined references
 * - Replaces problematic error handling patterns
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

class APIRouteFixer {
  private fixedFiles: string[] = [];
  private skippedFiles: string[] = [];

  /**
   * Main fix function
   */
  async fixRoutes(): Promise<void> {
    console.log('🔧 Starting API Route Auto-Fix...');
    console.log('==================================');

    // Find all route files
    const routeFiles = this.findRouteFiles('./app/api');
    console.log(`📁 Found ${routeFiles.length} route files`);

    // Fix each file
    for (const file of routeFiles) {
      try {
        this.fixRouteFile(file);
      } catch (error) {
        console.warn(`⚠️  Skipped ${file}: ${error.message}`);
        this.skippedFiles.push(file);
      }
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`✅ Fixed: ${this.fixedFiles.length} files`);
    console.log(`⚠️  Skipped: ${this.skippedFiles.length} files`);

    if (this.fixedFiles.length > 0) {
      console.log('\n🔧 Fixed files:');
      this.fixedFiles.forEach(file => console.log(`  ✅ ${file}`));
    }

    if (this.skippedFiles.length > 0) {
      console.log('\n⚠️  Skipped files (manual review needed):');
      this.skippedFiles.forEach(file => console.log(`  ⚠️  ${file}`));
    }

    console.log('\n🎉 Auto-fix complete! Run audit again to verify.');
  }

  /**
   * Recursively find all route.ts files
   */
  private findRouteFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.findRouteFiles(fullPath));
        } else if (item === 'route.ts') {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}`);
    }

    return files;
  }

  /**
   * Fix a single route file
   */
  private fixRouteFile(filePath: string): void {
    const originalContent = readFileSync(filePath, 'utf-8');
    let content = originalContent;
    let hasChanges = false;

    // Skip files that already import our error handler
    if (content.includes("from '@/lib/utils/errorHandler'")) {
      return;
    }

    // Fix 1: Replace old errorHandler imports
    if (content.includes("from '@/lib/middleware/error-handler'")) {
      content = content.replace(
        /import\s*\{\s*errorHandler\s*\}\s*from\s*'@\/lib\/middleware\/error-handler'/g,
        "import { errorHandler, withErrorHandling } from '@/lib/utils/errorHandler'"
      );
      
      // Also replace any .withErrorHandling calls to use the function directly
      content = content.replace(/errorHandler\.withErrorHandling/g, 'withErrorHandling');
      
      hasChanges = true;
    }

    // Fix 2: Add errorHandler import if used but not imported
    const usesErrorHandling = /errorHandler|handleError/.test(content);
    const hasErrorImport = /import.*errorHandler.*from/.test(content);
    
    if (usesErrorHandling && !hasErrorImport) {
      // Add import after other imports
      const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
      const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1]) + importLines[importLines.length - 1].length;
      
      content = content.slice(0, lastImportIndex) + 
                "\nimport { errorHandler } from '@/lib/utils/errorHandler'" +
                content.slice(lastImportIndex);
      
      hasChanges = true;
    }

    // Fix 3: Replace standalone errorHandler.withErrorHandling references
    if (content.includes('errorHandler.withErrorHandling') && !content.includes('withErrorHandling')) {
      // Add withErrorHandling to import
      content = content.replace(
        /import\s*\{\s*errorHandler\s*\}/g,
        'import { errorHandler, withErrorHandling }'
      );
      
      // Replace usage
      content = content.replace(/errorHandler\.withErrorHandling/g, 'withErrorHandling');
      
      hasChanges = true;
    }

    // Fix 4: Remove metricsService references if not imported
    if (content.includes('metricsService') && !content.includes('import.*metricsService')) {
      // Comment out metricsService calls
      content = content.replace(
        /await\s+metricsService\.[^;]+;/g,
        '// TODO: Implement metricsService - temporarily disabled'
      );
      
      hasChanges = true;
    }

    // Fix 5: Wrap try/catch blocks that don't return proper responses
    content = this.fixCatchBlocks(content);
    if (content !== originalContent) {
      hasChanges = true;
    }

    // Write changes if any were made
    if (hasChanges) {
      writeFileSync(filePath, content);
      this.fixedFiles.push(filePath.replace('./app/api/', ''));
    }
  }

  /**
   * Fix catch blocks that don't return proper responses
   */
  private fixCatchBlocks(content: string): string {
    // Find catch blocks that don't have NextResponse.json
    const catchBlockPattern = /catch\s*\([^)]*\)\s*\{([^}]*)\}/g;
    
    return content.replace(catchBlockPattern, (match, catchBody) => {
      // If catch block doesn't return NextResponse.json and doesn't use errorHandler
      if (!catchBody.includes('NextResponse.json') && 
          !catchBody.includes('errorHandler') &&
          !catchBody.includes('return ')) {
        
        // Extract error variable name
        const errorVarMatch = match.match(/catch\s*\(\s*([^)]*)\s*\)/);
        const errorVar = errorVarMatch ? errorVarMatch[1].trim() || 'error' : 'error';
        
        // Replace the catch block
        return `catch (${errorVar}) {
    console.error('API Error:', ${errorVar});
    return errorHandler(${errorVar});
  }`;
      }
      
      return match;
    });
  }
}

// Main execution
async function main() {
  const fixer = new APIRouteFixer();
  
  try {
    await fixer.fixRoutes();
  } catch (error) {
    console.error('🚨 Auto-fix script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('fix-api-routes')
if (isMainModule) {
  main();
}

export { APIRouteFixer };