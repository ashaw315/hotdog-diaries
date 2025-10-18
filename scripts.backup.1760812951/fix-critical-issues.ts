#!/usr/bin/env npx tsx

/**
 * Critical Issues Fix Script
 * 
 * Focuses only on fixing the most critical issues that prevent builds:
 * - Missing imports for errorHandler
 * - Undefined errorHandler references
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

class CriticalIssueFixer {
  private fixedFiles: string[] = [];
  private criticalFiles: string[] = [];

  /**
   * Main fix function - focus only on critical build-breaking issues
   */
  async fixCriticalIssues(): Promise<void> {
    console.log('🚨 Fixing Critical Build-Breaking Issues...');
    console.log('==========================================');

    // Find all route files
    const routeFiles = this.findRouteFiles('./app/api');
    console.log(`📁 Scanning ${routeFiles.length} route files`);

    // Identify and fix only critical issues
    for (const file of routeFiles) {
      if (this.hasCriticalIssues(file)) {
        this.criticalFiles.push(file);
        this.fixCriticalFile(file);
      }
    }

    // Summary
    console.log('\n📊 CRITICAL ISSUES SUMMARY:');
    console.log(`🔴 Critical files found: ${this.criticalFiles.length}`);
    console.log(`✅ Critical files fixed: ${this.fixedFiles.length}`);

    if (this.fixedFiles.length > 0) {
      console.log('\n🔧 Files with critical fixes:');
      this.fixedFiles.forEach(file => console.log(`  ✅ ${file}`));
    }

    console.log('\n🎯 Critical fixes complete!');
  }

  /**
   * Check if file has critical build-breaking issues
   */
  private hasCriticalIssues(filePath: string): boolean {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Check for undefined errorHandler without import
      const usesErrorHandler = /\berrorHandler\s*\(/.test(content);
      const hasImport = content.includes("from '@/lib/utils/errorHandler'") || 
                       content.includes("from '@/lib/middleware/error-handler'");
      
      return usesErrorHandler && !hasImport;
    } catch {
      return false;
    }
  }

  /**
   * Fix only critical issues in a file
   */
  private fixCriticalFile(filePath: string): void {
    try {
      const originalContent = readFileSync(filePath, 'utf-8');
      let content = originalContent;

      // Find the position to add import (after existing imports)
      const lines = content.split('\n');
      let insertAfterLine = 0;

      // Find the last import line
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          insertAfterLine = i;
        }
      }

      // Add the import after the last import line
      if (insertAfterLine >= 0) {
        const beforeImport = lines.slice(0, insertAfterLine + 1);
        const afterImport = lines.slice(insertAfterLine + 1);
        
        const newImport = "import { errorHandler } from '@/lib/utils/errorHandler'";
        
        // Check if import already exists
        if (!content.includes(newImport)) {
          const newContent = [
            ...beforeImport,
            newImport,
            ...afterImport
          ].join('\n');

          writeFileSync(filePath, newContent);
          this.fixedFiles.push(filePath.replace('./app/api/', ''));
        }
      }
    } catch (error) {
      console.warn(`Failed to fix ${filePath}: ${error.message}`);
    }
  }

  /**
   * Find all route files
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
    } catch {
      // Ignore directory read errors
    }

    return files;
  }
}

// Main execution
async function main() {
  const fixer = new CriticalIssueFixer();
  
  try {
    await fixer.fixCriticalIssues();
  } catch (error) {
    console.error('🚨 Critical fix script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { CriticalIssueFixer };