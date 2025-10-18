#!/usr/bin/env npx tsx

/**
 * API Route Audit Script
 * 
 * Scans all API route files to identify:
 * - Missing error handlers
 * - Undefined function references
 * - Inconsistent error handling patterns
 * - Routes without try/catch blocks
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

interface RouteIssue {
  file: string;
  line?: number;
  type: 'missing_import' | 'undefined_reference' | 'missing_try_catch' | 'inconsistent_error' | 'missing_metricsService';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  suggestion: string;
}

interface AuditReport {
  totalRoutes: number;
  routesWithIssues: number;
  issues: RouteIssue[];
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
}

class APIRouteAuditor {
  private issues: RouteIssue[] = [];
  private routeFiles: string[] = [];

  /**
   * Main audit function
   */
  async auditRoutes(): Promise<AuditReport> {
    console.log('🔍 Starting API Route Audit...');
    console.log('=====================================');

    // Find all route files
    this.findRouteFiles('./app/api');
    console.log(`📁 Found ${this.routeFiles.length} route files`);

    // Audit each file
    for (const file of this.routeFiles) {
      this.auditRouteFile(file);
    }

    // Generate report
    const report = this.generateReport();
    this.printReport(report);

    return report;
  }

  /**
   * Recursively find all route.ts files
   */
  private findRouteFiles(dir: string): void {
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          this.findRouteFiles(fullPath);
        } else if (item === 'route.ts' || item === 'route.js') {
          this.routeFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}:`, error.message);
    }
  }

  /**
   * Audit a single route file
   */
  private auditRouteFile(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Check for common issues
      this.checkForUndefinedReferences(filePath, content, lines);
      this.checkForMissingImports(filePath, content, lines);
      this.checkForTryCatchCoverage(filePath, content, lines);
      this.checkForConsistentErrorHandling(filePath, content, lines);

    } catch (error) {
      this.addIssue(filePath, 0, 'critical', 'missing_import', 
        `Cannot read file: ${error.message}`, 
        'Ensure file exists and is readable');
    }
  }

  /**
   * Check for undefined function references
   */
  private checkForUndefinedReferences(filePath: string, content: string, lines: string[]): void {
    const undefinedPatterns = [
      { pattern: /\berrorHandler\b(?!\s*=|\s*:|\s*from)/, name: 'errorHandler' },
      { pattern: /\bhandleError\b(?!\s*=|\s*:|\s*from)/, name: 'handleError' },
      { pattern: /\blogError\b(?!\s*=|\s*:|\s*from)/, name: 'logError' },
      { pattern: /\bmetricsService\b(?!\s*=|\s*:|\s*from)/, name: 'metricsService' },
      { pattern: /\.withErrorHandling\s*\(/, name: 'withErrorHandling method' }
    ];

    lines.forEach((line, index) => {
      undefinedPatterns.forEach(({ pattern, name }) => {
        if (pattern.test(line)) {
          // Check if it's imported
          const importPattern = new RegExp(`import.*${name.split('.')[0]}.*from`, 'i');
          if (!importPattern.test(content)) {
            this.addIssue(filePath, index + 1, 'critical', 'undefined_reference',
              `Undefined reference to '${name}' on line ${index + 1}`,
              `Import ${name} from appropriate module or remove the reference`);
          }
        }
      });
    });
  }

  /**
   * Check for missing imports
   */
  private checkForMissingImports(filePath: string, content: string, lines: string[]): void {
    // Check if file uses error handling but doesn't import errorHandler
    const usesErrorHandling = /errorHandler|handleError|\.withErrorHandling/.test(content);
    const importsErrorHandler = /import.*errorHandler.*from/.test(content) || 
                               /import.*ErrorHandlingMiddleware.*from/.test(content);

    if (usesErrorHandling && !importsErrorHandler) {
      this.addIssue(filePath, 0, 'critical', 'missing_import',
        'Uses error handling functions but missing import',
        'Add: import { errorHandler } from \'@/lib/utils/errorHandler\'');
    }

    // Check for metricsService usage without import
    if (/\bmetricsService\b/.test(content) && !/import.*metricsService.*from/.test(content)) {
      this.addIssue(filePath, 0, 'critical', 'missing_metricsService',
        'Uses metricsService without importing it',
        'Add appropriate import for metricsService or remove the reference');
    }
  }

  /**
   * Check for try/catch coverage
   */
  private checkForTryCatchCoverage(filePath: string, content: string, lines: string[]): void {
    // Check if file has async functions without try/catch
    const hasAsyncHandler = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/.test(content) ||
                           /export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*=\s*async/.test(content);
    
    const hasTryCatch = /try\s*\{/.test(content);
    const hasErrorWrapper = /\.withErrorHandling\s*\(/.test(content) || /withErrorHandling\s*</.test(content);

    if (hasAsyncHandler && !hasTryCatch && !hasErrorWrapper) {
      this.addIssue(filePath, 0, 'warning', 'missing_try_catch',
        'Async handler without try/catch or error wrapper',
        'Wrap handler in try/catch or use withErrorHandling wrapper');
    }
  }

  /**
   * Check for consistent error handling
   */
  private checkForConsistentErrorHandling(filePath: string, content: string, lines: string[]): void {
    const catchBlocks = content.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/g) || [];
    
    catchBlocks.forEach((catchBlock, index) => {
      // Check if catch block returns proper JSON response
      if (!catchBlock.includes('NextResponse.json') && !catchBlock.includes('return ')) {
        this.addIssue(filePath, 0, 'warning', 'inconsistent_error',
          `Catch block ${index + 1} doesn't return proper response`,
          'Ensure catch blocks return NextResponse.json with error structure');
      }

      // Check if catch block has proper status codes
      if (catchBlock.includes('NextResponse.json') && !catchBlock.includes('status:')) {
        this.addIssue(filePath, 0, 'info', 'inconsistent_error',
          `Catch block ${index + 1} missing explicit status code`,
          'Add explicit status code to error responses');
      }
    });
  }

  /**
   * Add an issue to the list
   */
  private addIssue(
    file: string, 
    line: number, 
    severity: 'critical' | 'warning' | 'info', 
    type: RouteIssue['type'], 
    description: string, 
    suggestion: string
  ): void {
    this.issues.push({
      file: file.replace('./app/api/', ''),
      line: line || undefined,
      type,
      severity,
      description,
      suggestion
    });
  }

  /**
   * Generate audit report
   */
  private generateReport(): AuditReport {
    const routesWithIssues = new Set(this.issues.map(issue => issue.file)).size;
    
    const summary = this.issues.reduce((acc, issue) => {
      acc[issue.severity]++;
      return acc;
    }, { critical: 0, warning: 0, info: 0 });

    return {
      totalRoutes: this.routeFiles.length,
      routesWithIssues,
      issues: this.issues,
      summary
    };
  }

  /**
   * Print audit report
   */
  private printReport(report: AuditReport): void {
    console.log('\n📊 AUDIT REPORT');
    console.log('================');
    console.log(`📁 Total Routes: ${report.totalRoutes}`);
    console.log(`⚠️  Routes with Issues: ${report.routesWithIssues}`);
    console.log(`🔴 Critical Issues: ${report.summary.critical}`);
    console.log(`🟡 Warnings: ${report.summary.warning}`);
    console.log(`🔵 Info: ${report.summary.info}`);

    if (report.issues.length === 0) {
      console.log('\n✅ No issues found! All API routes look good.');
      return;
    }

    console.log('\n🔍 DETAILED ISSUES:');
    console.log('===================');

    // Group issues by file
    const issuesByFile = report.issues.reduce((acc, issue) => {
      if (!acc[issue.file]) acc[issue.file] = [];
      acc[issue.file].push(issue);
      return acc;
    }, {} as Record<string, RouteIssue[]>);

    Object.entries(issuesByFile).forEach(([file, issues]) => {
      console.log(`\n📄 ${file}:`);
      issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🔴' : 
                    issue.severity === 'warning' ? '🟡' : '🔵';
        const lineInfo = issue.line ? ` (line ${issue.line})` : '';
        console.log(`  ${icon} ${issue.type}${lineInfo}: ${issue.description}`);
        console.log(`     💡 ${issue.suggestion}`);
      });
    });

    console.log('\n🔧 NEXT STEPS:');
    console.log('===============');
    console.log('1. Fix critical issues first (undefined references, missing imports)');
    console.log('2. Address warnings (missing try/catch blocks)');
    console.log('3. Review info items for consistency improvements');
    console.log('4. Run the audit again after fixes');

    // Exit with error code if critical issues found
    if (report.summary.critical > 0) {
      console.log('\n🚨 Critical issues detected! CI builds may fail.');
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const auditor = new APIRouteAuditor();
  
  try {
    const report = await auditor.auditRoutes();
    
    // Write report to file for CI
    const fs = require('fs');
    fs.writeFileSync('./api-route-audit-report.json', JSON.stringify(report, null, 2));
    console.log('\n📝 Report saved to: api-route-audit-report.json');
    
  } catch (error) {
    console.error('🚨 Audit script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('audit-api-routes')
if (isMainModule) {
  main();
}

export { APIRouteAuditor, type RouteIssue, type AuditReport };