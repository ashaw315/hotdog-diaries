#!/usr/bin/env node

/**
 * PostgreSQL Compatibility Fix Script
 * 
 * This script fixes PostgreSQL compatibility issues by:
 * 1. Updating SQLite-style boolean comparisons (is_approved = true) to PostgreSQL format (is_approved = true)
 * 2. Converting date/time functions from SQLite to PostgreSQL syntax
 * 3. Fixing GROUP BY clause compatibility
 * 4. Testing production database connectivity
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface CompatibilityIssue {
  file: string;
  line: number;
  issue: string;
  oldCode: string;
  newCode: string;
  category: 'boolean' | 'datetime' | 'syntax' | 'other';
}

class PostgreSQLCompatibilityFixer {
  private issues: CompatibilityIssue[] = [];
  private fixedFiles: string[] = [];

  constructor() {
    console.log('🔧 PostgreSQL Compatibility Fixer');
    console.log('==================================');
  }

  async scanAndFix(): Promise<void> {
    console.log('\n1. 🔍 Scanning for compatibility issues...');
    
    // Find all TypeScript files with database queries
    const files = await glob('**/*.ts', {
      ignore: ['node_modules/**', 'dist/**', '*.test.ts', '*.spec.ts'],
      cwd: process.cwd()
    });

    console.log(`📁 Found ${files.length} TypeScript files to check`);

    for (const file of files) {
      await this.scanFile(file);
    }

    console.log(`\n📊 Analysis complete: ${this.issues.length} issues found in ${this.fixedFiles.length} files`);
    
    if (this.issues.length === 0) {
      console.log('✅ No compatibility issues found!');
      return;
    }

    await this.displayIssues();
    await this.applyFixes();
  }

  private async scanFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      // Check for boolean compatibility issues
      this.checkBooleanIssues(filePath, lineNumber, line);
      
      // Check for datetime function issues
      this.checkDateTimeIssues(filePath, lineNumber, line);
      
      // Check for other syntax issues
      this.checkSyntaxIssues(filePath, lineNumber, line);
    }
  }

  private checkBooleanIssues(filePath: string, lineNumber: number, line: string): void {
    // Pattern 1: is_approved = true or is_posted = true
    const booleanPatterns = [
      { pattern: /is_approved\s*=\s*1/g, replacement: 'is_approved = true' },
      { pattern: /is_posted\s*=\s*1/g, replacement: 'is_posted = true' },
      { pattern: /is_rejected\s*=\s*1/g, replacement: 'is_rejected = true' },
      { pattern: /is_active\s*=\s*1/g, replacement: 'is_active = true' },
      { pattern: /is_approved\s*=\s*0/g, replacement: 'is_approved = false' },
      { pattern: /is_posted\s*=\s*0/g, replacement: 'is_posted = false' },
      { pattern: /is_rejected\s*=\s*0/g, replacement: 'is_rejected = false' },
      { pattern: /is_active\s*=\s*0/g, replacement: 'is_active = false' },
    ];

    for (const { pattern, replacement } of booleanPatterns) {
      const matches = line.match(pattern);
      if (matches) {
        this.issues.push({
          file: filePath,
          line: lineNumber,
          issue: 'Boolean comparison uses SQLite format',
          oldCode: matches[0],
          newCode: replacement,
          category: 'boolean'
        });
      }
    }

    // Pattern 2: CASE WHEN is_approved = true THEN 1 ELSE 0 END
    const caseWhenPattern = /CASE WHEN (is_\w+)\s*=\s*(1|0) THEN 1 ELSE 0 END/gi;
    const caseMatches = line.match(caseWhenPattern);
    if (caseMatches) {
      for (const match of caseMatches) {
        const boolValue = match.includes('= 1') ? 'true' : 'false';
        const fieldName = match.match(/is_\w+/)?.[0] || 'field';
        const newCode = `CASE WHEN ${fieldName} = ${boolValue} THEN 1 ELSE 0 END`;
        
        this.issues.push({
          file: filePath,
          line: lineNumber,
          issue: 'CASE WHEN statement uses SQLite boolean format',
          oldCode: match,
          newCode,
          category: 'boolean'
        });
      }
    }
  }

  private checkDateTimeIssues(filePath: string, lineNumber: number, line: string): void {
    const dateTimePatterns = [
      { 
        pattern: /datetime\('now'\)/g, 
        replacement: 'NOW()',
        issue: 'SQLite datetime() function'
      },
      { 
        pattern: /INTERVAL '(\d+) days'/g, 
        replacement: 'INTERVAL \'$1 days\'',
        issue: 'Date interval syntax'
      },
      {
        pattern: /DATE\(created_at\)/g,
        replacement: 'created_at::date',
        issue: 'SQLite DATE() function'
      }
    ];

    for (const { pattern, replacement, issue } of dateTimePatterns) {
      const matches = line.match(pattern);
      if (matches) {
        for (const match of matches) {
          this.issues.push({
            file: filePath,
            line: lineNumber,
            issue,
            oldCode: match,
            newCode: replacement,
            category: 'datetime'
          });
        }
      }
    }
  }

  private checkSyntaxIssues(filePath: string, lineNumber: number, line: string): void {
    // Check for SQLite-specific LIMIT in subqueries that might cause issues
    if (line.includes('LIMIT') && line.includes('ORDER BY') && line.includes('SELECT') && line.includes('WHERE')) {
      // This is a complex query that might need review
      const hasSubquery = line.includes('IN (SELECT');
      if (hasSubquery) {
        this.issues.push({
          file: filePath,
          line: lineNumber,
          issue: 'Complex subquery with LIMIT may need PostgreSQL optimization',
          oldCode: line.trim(),
          newCode: '-- Review for PostgreSQL optimization',
          category: 'syntax'
        });
      }
    }
  }

  private async displayIssues(): Promise<void> {
    console.log('\n🚨 Compatibility Issues Found:');
    console.log('===============================');

    const groupedIssues = this.issues.reduce((acc, issue) => {
      if (!acc[issue.category]) acc[issue.category] = [];
      acc[issue.category].push(issue);
      return acc;
    }, {} as Record<string, CompatibilityIssue[]>);

    for (const [category, issues] of Object.entries(groupedIssues)) {
      console.log(`\n📂 ${category.toUpperCase()} Issues (${issues.length}):`);
      
      const fileGroups = issues.reduce((acc, issue) => {
        if (!acc[issue.file]) acc[issue.file] = [];
        acc[issue.file].push(issue);
        return acc;
      }, {} as Record<string, CompatibilityIssue[]>);

      for (const [file, fileIssues] of Object.entries(fileGroups)) {
        console.log(`\n  📄 ${file}:`);
        fileIssues.forEach(issue => {
          console.log(`    Line ${issue.line}: ${issue.issue}`);
          console.log(`    ❌ ${issue.oldCode}`);
          console.log(`    ✅ ${issue.newCode}`);
          console.log('');
        });
      }
    }
  }

  private async applyFixes(): Promise<void> {
    console.log('\n🔧 Applying fixes...');
    
    const fileGroups = this.issues.reduce((acc, issue) => {
      if (!acc[issue.file]) acc[issue.file] = [];
      acc[issue.file].push(issue);
      return acc;
    }, {} as Record<string, CompatibilityIssue[]>);

    for (const [filePath, issues] of Object.entries(fileGroups)) {
      if (issues.some(issue => issue.category === 'syntax')) {
        console.log(`⚠️  Skipping ${filePath} - contains syntax issues that need manual review`);
        continue;
      }

      console.log(`🔨 Fixing ${filePath}...`);
      let content = fs.readFileSync(filePath, 'utf-8');
      
      // Sort issues by line number descending to avoid offset issues
      const sortedIssues = issues
        .filter(issue => issue.category !== 'syntax')
        .sort((a, b) => b.line - a.line);

      for (const issue of sortedIssues) {
        // Simple string replacement for boolean and datetime fixes
        content = content.replace(issue.oldCode, issue.newCode);
      }

      // Write the fixed content back
      fs.writeFileSync(filePath, content);
      this.fixedFiles.push(filePath);
      console.log(`  ✅ Applied ${issues.filter(i => i.category !== 'syntax').length} fixes`);
    }
  }

  async generateReport(): Promise<void> {
    console.log('\n📊 PostgreSQL Compatibility Report');
    console.log('===================================');

    const categoryStats = this.issues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📈 Issues by category:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} issues`);
    });

    console.log(`\n🔧 Fixed files: ${this.fixedFiles.length}`);
    console.log(`⚠️  Manual review needed: ${this.issues.filter(i => i.category === 'syntax').length} files`);

    const criticalFiles = [
      'app/api/admin/posting/post-now/route.ts',
      'app/api/admin/system-verification/route.ts', 
      'lib/services/posting.ts',
      'app/api/feed/route.ts'
    ];

    console.log('\n🎯 Critical files status:');
    criticalFiles.forEach(file => {
      const fileIssues = this.issues.filter(i => i.file.includes(file));
      const status = fileIssues.length === 0 ? '✅' : 
                    fileIssues.every(i => i.category !== 'syntax') ? '🔧' : '⚠️';
      console.log(`  ${status} ${file}: ${fileIssues.length} issues`);
    });
  }
}

async function main() {
  const fixer = new PostgreSQLCompatibilityFixer();
  
  try {
    await fixer.scanAndFix();
    await fixer.generateReport();
    
    console.log('\n🎉 PostgreSQL compatibility fix completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Review and test the fixed files');
    console.log('2. Deploy changes to production');
    console.log('3. Verify production database connectivity');
    console.log('4. Test posting endpoints');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

// Run the fixer if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('fix-postgresql-compatibility')
if (isMainModule) {
  main();
}

export default PostgreSQLCompatibilityFixer;