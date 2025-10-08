#!/usr/bin/env tsx
/**
 * Build Diagnostics Module
 * 
 * Advanced build failure analysis system that:
 * - Captures comprehensive build logs with debug information
 * - Parses common error patterns and categorizes failures
 * - Generates actionable diagnostic reports with fix recommendations
 * - Integrates with the CI auto-healing pipeline
 * - Provides structured data for automated remediation
 * 
 * Usage: tsx scripts/analyzeBuildFailure.ts [--verbose] [--save-logs]
 */

import { execSync } from 'child_process'
import { writeFile, mkdir, pathExists } from 'fs-extra'
import { join } from 'path'
import chalk from 'chalk'

interface BuildError {
  type: 'typescript' | 'webpack' | 'dependency' | 'memory' | 'syntax' | 'import' | 'unknown'
  severity: 'critical' | 'high' | 'moderate' | 'low'
  message: string
  file?: string
  line?: number
  column?: number
  code?: string
  suggestion?: string
}

interface BuildDiagnosticResult {
  timestamp: string
  buildSucceeded: boolean
  buildTime?: number
  errors: BuildError[]
  warnings: string[]
  environmentInfo: {
    nodeVersion: string
    npmVersion: string
    nextjsVersion: string
    memoryUsage: string
    diskSpace: string
  }
  errorCategories: {
    typescript: number
    webpack: number
    dependency: number
    memory: number
    syntax: number
    import: number
    unknown: number
  }
  recommendations: string[]
  quickFixes: Array<{
    issue: string
    command: string
    description: string
    risk: 'low' | 'medium' | 'high'
  }>
  logExcerpts: {
    firstErrors: string[]
    lastErrors: string[]
    criticalLines: string[]
  }
}

interface ErrorPattern {
  pattern: RegExp
  type: BuildError['type']
  severity: BuildError['severity']
  suggestionTemplate: string
}

class BuildFailureAnalyzer {
  private reportsPath: string
  private projectRoot: string
  private verbose: boolean
  private saveLogs: boolean
  private buildLog: string = ''

  private errorPatterns: ErrorPattern[] = [
    // TypeScript Errors
    {
      pattern: /error TS(\d+):\s*(.*?)\s*(?:in\s*'([^']+)'\s*\((\d+),(\d+)\))?/gi,
      type: 'typescript',
      severity: 'high',
      suggestionTemplate: 'Fix TypeScript error: {message}'
    },
    {
      pattern: /Type\s+error.*?cannot find module/gi,
      type: 'typescript',
      severity: 'high',
      suggestionTemplate: 'Install missing module or fix import path'
    },
    {
      pattern: /Property '.*?' does not exist on type/gi,
      type: 'typescript',
      severity: 'moderate',
      suggestionTemplate: 'Check property name or add type declaration'
    },

    // Webpack Errors
    {
      pattern: /Module not found.*?Can't resolve '([^']+)'/gi,
      type: 'webpack',
      severity: 'high',
      suggestionTemplate: 'Install missing dependency: {match1} or fix import path'
    },
    {
      pattern: /Module build failed.*?Unexpected token/gi,
      type: 'syntax',
      severity: 'high',
      suggestionTemplate: 'Fix syntax error in the specified file'
    },
    {
      pattern: /webpack.*?out of memory/gi,
      type: 'memory',
      severity: 'critical',
      suggestionTemplate: 'Increase Node.js memory limit or optimize build'
    },

    // Dependency Errors
    {
      pattern: /Cannot resolve dependency/gi,
      type: 'dependency',
      severity: 'high',
      suggestionTemplate: 'Run npm install or check package.json'
    },
    {
      pattern: /ERESOLVE.*?dependency/gi,
      type: 'dependency',
      severity: 'moderate',
      suggestionTemplate: 'Resolve dependency conflicts with npm install --legacy-peer-deps'
    },
    {
      pattern: /peer dep missing/gi,
      type: 'dependency',
      severity: 'moderate',
      suggestionTemplate: 'Install missing peer dependencies'
    },

    // Import/Export Errors
    {
      pattern: /import.*?has no exported member/gi,
      type: 'import',
      severity: 'moderate',
      suggestionTemplate: 'Check export name or update import statement'
    },
    {
      pattern: /Cannot find module.*?or its corresponding type declarations/gi,
      type: 'import',
      severity: 'moderate',
      suggestionTemplate: 'Install missing types package or add module declaration'
    },

    // Next.js/Path-specific Errors
    {
      pattern: /Can not repeat "path" without a prefix and suffix/gi,
      type: 'syntax',
      severity: 'high',
      suggestionTemplate: 'Replace .repeat() usage with path.join() or fix variable naming conflict with "path" module'
    },
    {
      pattern: /repeat.*?path/gi,
      type: 'syntax',
      severity: 'moderate',
      suggestionTemplate: 'Check for .repeat() method usage on path-related variables - consider using proper path manipulation'
    },

    // Memory Errors
    {
      pattern: /JavaScript heap out of memory/gi,
      type: 'memory',
      severity: 'critical',
      suggestionTemplate: 'Increase Node.js memory: NODE_OPTIONS="--max-old-space-size=4096"'
    },
    {
      pattern: /EMFILE.*?too many open files/gi,
      type: 'memory',
      severity: 'high',
      suggestionTemplate: 'Increase file descriptor limit or reduce concurrent operations'
    }
  ]

  constructor(options: { verbose?: boolean; saveLogs?: boolean } = {}) {
    this.reportsPath = join(process.cwd(), 'reports')
    this.projectRoot = process.cwd()
    this.verbose = options.verbose || false
    this.saveLogs = options.saveLogs || false
  }

  async execute(): Promise<BuildDiagnosticResult> {
    console.log(chalk.blue('🏗️ Build Failure Diagnostics System'))
    console.log(chalk.blue('=' .repeat(38)))

    try {
      // Ensure reports directory exists
      await this.ensureReportsDirectory()

      // Step 1: Gather environment information
      console.log(chalk.cyan('\n📊 Step 1: Environment Analysis...'))
      const environmentInfo = await this.gatherEnvironmentInfo()

      // Step 2: Attempt build with comprehensive logging
      console.log(chalk.cyan('\n🔧 Step 2: Build Execution & Log Capture...'))
      const buildResult = await this.attemptBuildWithLogging()

      // Step 3: Parse and categorize errors
      console.log(chalk.cyan('\n🔍 Step 3: Error Analysis & Categorization...'))
      const errors = this.parseErrorsFromLog(this.buildLog)
      const warnings = this.parseWarningsFromLog(this.buildLog)

      // Step 4: Generate recommendations
      console.log(chalk.cyan('\n💡 Step 4: Generating Recommendations...'))
      const recommendations = this.generateRecommendations(errors, environmentInfo)
      const quickFixes = this.generateQuickFixes(errors)

      // Step 5: Create diagnostic result
      const result: BuildDiagnosticResult = {
        timestamp: new Date().toISOString(),
        buildSucceeded: buildResult.success,
        buildTime: buildResult.duration,
        errors,
        warnings,
        environmentInfo,
        errorCategories: this.categorizeErrors(errors),
        recommendations,
        quickFixes,
        logExcerpts: this.extractLogExcerpts(this.buildLog, errors)
      }

      // Step 6: Save logs if requested
      if (this.saveLogs || !buildResult.success) {
        await this.saveBuildLog()
      }

      // Step 7: Generate diagnostic report
      await this.generateDiagnosticReport(result)

      this.displaySummary(result)

      return result

    } catch (error) {
      console.error(chalk.red('❌ Build diagnostics failed:'), error.message)
      throw error
    }
  }

  private async ensureReportsDirectory(): Promise<void> {
    if (!(await pathExists(this.reportsPath))) {
      await mkdir(this.reportsPath, { recursive: true })
    }
  }

  private async gatherEnvironmentInfo(): Promise<BuildDiagnosticResult['environmentInfo']> {
    const nodeVersion = process.version
    
    let npmVersion = 'unknown'
    try {
      npmVersion = execSync('npm --version', { encoding: 'utf8', stdio: 'pipe' }).trim()
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Could not determine npm version'))
    }

    let nextjsVersion = 'unknown'
    try {
      const packageJson = require(join(this.projectRoot, 'package.json'))
      nextjsVersion = packageJson.dependencies?.next || packageJson.devDependencies?.next || 'not found'
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Could not determine Next.js version'))
    }

    const memoryUsage = this.getMemoryUsage()
    const diskSpace = this.getDiskSpace()

    return {
      nodeVersion,
      npmVersion,
      nextjsVersion,
      memoryUsage,
      diskSpace
    }
  }

  private getMemoryUsage(): string {
    const used = process.memoryUsage()
    const heapUsed = Math.round(used.heapUsed / 1024 / 1024 * 100) / 100
    const heapTotal = Math.round(used.heapTotal / 1024 / 1024 * 100) / 100
    return `${heapUsed}MB / ${heapTotal}MB`
  }

  private getDiskSpace(): string {
    try {
      const output = execSync('df -h .', { encoding: 'utf8', stdio: 'pipe' })
      const lines = output.split('\n')
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/)
        return `${parts[3]} available of ${parts[1]}`
      }
    } catch (error) {
      // Fallback for non-Unix systems
    }
    return 'unknown'
  }

  private async attemptBuildWithLogging(): Promise<{ success: boolean; duration?: number }> {
    const startTime = Date.now()
    
    try {
      console.log(chalk.white('  Running Next.js build with debug logging...'))
      
      const buildOutput = execSync('npx next build', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          DEBUG: 'next:*'
        }
      })

      this.buildLog = buildOutput
      const duration = Date.now() - startTime

      console.log(chalk.green('  ✅ Build completed successfully'))
      return { success: true, duration }

    } catch (error) {
      const duration = Date.now() - startTime
      this.buildLog = error.stdout || error.stderr || error.message || 'No build output captured'
      
      console.log(chalk.red(`  ❌ Build failed after ${duration}ms`))
      if (this.verbose) {
        console.log(chalk.gray('  First 500 chars of error output:'))
        console.log(chalk.gray(this.buildLog.substring(0, 500) + '...'))
      }
      
      return { success: false, duration }
    }
  }

  private parseErrorsFromLog(log: string): BuildError[] {
    const errors: BuildError[] = []
    const lines = log.split('\n')

    // Phase 4.1: Special diagnostic for "repeat path" error
    if (log.includes('repeat "path"')) {
      console.log(chalk.yellow('💡 Likely cause: malformed template or .repeat() misuse in cleanup-prod.js or next.config.js'))
      console.log(chalk.yellow('🔧 Suggested fix: replace .repeat() with path.join() or ensure variable not named "path"'))
      
      errors.push({
        type: 'syntax',
        severity: 'high',
        message: 'Next.js path repeat error detected',
        suggestion: 'Check for .repeat() method conflicts with Node.js path module - likely in config files or cleanup scripts'
      })
    }

    for (const line of lines) {
      for (const pattern of this.errorPatterns) {
        const match = pattern.pattern.exec(line)
        if (match) {
          const error: BuildError = {
            type: pattern.type,
            severity: pattern.severity,
            message: match[0],
            suggestion: this.formatSuggestion(pattern.suggestionTemplate, match)
          }

          // Try to extract file and line information for TypeScript errors
          if (pattern.type === 'typescript') {
            const fileMatch = line.match(/([^(\s]+)\((\d+),(\d+)\)/)
            if (fileMatch) {
              error.file = fileMatch[1]
              error.line = parseInt(fileMatch[2])
              error.column = parseInt(fileMatch[3])
            }
          }

          errors.push(error)
          pattern.pattern.lastIndex = 0 // Reset regex for global patterns
        }
      }
    }

    // If no specific patterns matched but build failed, create generic error
    if (errors.length === 0 && log.includes('failed')) {
      errors.push({
        type: 'unknown',
        severity: 'high',
        message: 'Build failed with unknown error',
        suggestion: 'Check the full build log for more details'
      })
    }

    return errors
  }

  private parseWarningsFromLog(log: string): string[] {
    const warnings: string[] = []
    const lines = log.split('\n')

    for (const line of lines) {
      if (line.toLowerCase().includes('warning') || 
          line.includes('⚠️') || 
          line.toLowerCase().includes('deprecated')) {
        warnings.push(line.trim())
      }
    }

    return warnings.slice(0, 10) // Limit to first 10 warnings
  }

  private formatSuggestion(template: string, match: RegExpExecArray): string {
    let suggestion = template
    
    // Replace placeholders with match groups
    for (let i = 0; i < match.length; i++) {
      suggestion = suggestion.replace(`{match${i}}`, match[i] || '')
    }
    
    suggestion = suggestion.replace('{message}', match[2] || match[1] || match[0])
    
    return suggestion
  }

  private categorizeErrors(errors: BuildError[]): BuildDiagnosticResult['errorCategories'] {
    const categories = {
      typescript: 0,
      webpack: 0,
      dependency: 0,
      memory: 0,
      syntax: 0,
      import: 0,
      unknown: 0
    }

    for (const error of errors) {
      categories[error.type]++
    }

    return categories
  }

  private generateRecommendations(
    errors: BuildError[], 
    environmentInfo: BuildDiagnosticResult['environmentInfo']
  ): string[] {
    const recommendations: string[] = []

    // Memory-related recommendations
    const memoryErrors = errors.filter(e => e.type === 'memory')
    if (memoryErrors.length > 0) {
      recommendations.push('Increase Node.js memory limit: NODE_OPTIONS="--max-old-space-size=4096"')
      recommendations.push('Consider optimizing bundle size and reducing build complexity')
    }

    // TypeScript recommendations
    const tsErrors = errors.filter(e => e.type === 'typescript')
    if (tsErrors.length > 5) {
      recommendations.push('High number of TypeScript errors detected - consider gradual migration approach')
      recommendations.push('Enable TypeScript strict mode incrementally to catch errors early')
    }

    // Dependency recommendations
    const depErrors = errors.filter(e => e.type === 'dependency')
    if (depErrors.length > 0) {
      recommendations.push('Run npm install to ensure all dependencies are properly installed')
      recommendations.push('Check package.json for version conflicts and peer dependency issues')
    }

    // Environment-specific recommendations
    if (environmentInfo.nodeVersion.startsWith('v14')) {
      recommendations.push('Consider upgrading to Node.js 16+ for better Next.js compatibility')
    }

    // General recommendations
    if (errors.length > 10) {
      recommendations.push('High error count - consider fixing the most critical issues first')
      recommendations.push('Run lint checks to catch syntax and style issues before building')
    }

    if (recommendations.length === 0) {
      recommendations.push('Build issues appear to be environmental - check log file for specific details')
    }

    return recommendations
  }

  private generateQuickFixes(errors: BuildError[]): BuildDiagnosticResult['quickFixes'] {
    const quickFixes: BuildDiagnosticResult['quickFixes'] = []

    // Memory quick fixes
    if (errors.some(e => e.type === 'memory')) {
      quickFixes.push({
        issue: 'Memory allocation errors',
        command: 'NODE_OPTIONS="--max-old-space-size=4096" npm run build',
        description: 'Increase Node.js heap size to 4GB',
        risk: 'low'
      })
    }

    // Dependency quick fixes
    if (errors.some(e => e.type === 'dependency')) {
      quickFixes.push({
        issue: 'Missing or conflicting dependencies',
        command: 'npm install',
        description: 'Reinstall dependencies to resolve conflicts',
        risk: 'low'
      })
      
      quickFixes.push({
        issue: 'Peer dependency conflicts',
        command: 'npm install --legacy-peer-deps',
        description: 'Install with legacy peer dependency resolution',
        risk: 'medium'
      })
    }

    // TypeScript quick fixes
    if (errors.some(e => e.type === 'typescript')) {
      quickFixes.push({
        issue: 'TypeScript compilation errors',
        command: 'npx tsc --noEmit',
        description: 'Check TypeScript errors without building',
        risk: 'low'
      })
    }

    // Cache quick fixes
    if (errors.length > 0) {
      quickFixes.push({
        issue: 'Build cache corruption',
        command: 'rm -rf .next && npm run build',
        description: 'Clear Next.js cache and rebuild',
        risk: 'low'
      })
    }

    return quickFixes
  }

  private extractLogExcerpts(log: string, errors: BuildError[]): BuildDiagnosticResult['logExcerpts'] {
    const lines = log.split('\n')
    const errorLines = []
    const criticalLines = []

    // Find lines containing errors
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (line.toLowerCase().includes('error') || 
          line.toLowerCase().includes('failed') ||
          line.includes('❌')) {
        errorLines.push(`${i + 1}: ${line}`)
      }
      
      if (line.toLowerCase().includes('critical') ||
          line.toLowerCase().includes('fatal') ||
          line.includes('out of memory')) {
        criticalLines.push(`${i + 1}: ${line}`)
      }
    }

    return {
      firstErrors: errorLines.slice(0, 5),
      lastErrors: errorLines.slice(-5),
      criticalLines: criticalLines.slice(0, 10)
    }
  }

  private async saveBuildLog(): Promise<void> {
    const logPath = join(this.reportsPath, 'build-log.txt')
    const timestamp = new Date().toISOString()
    
    const logContent = `# Build Log - ${timestamp}

## Command
npx next build

## Environment
- Node.js: ${process.version}
- Working Directory: ${this.projectRoot}
- Timestamp: ${timestamp}

## Output
${this.buildLog}

---
Generated by Build Failure Analyzer v1.0
`

    await writeFile(logPath, logContent, 'utf-8')
    console.log(chalk.blue(`📋 Build log saved: ${logPath}`))
  }

  private async generateDiagnosticReport(result: BuildDiagnosticResult): Promise<void> {
    const reportContent = `# 🏗️ Build Failure Diagnostic Report

**Generated:** ${new Date().toISOString()}  
**Build Status:** ${result.buildSucceeded ? '✅ SUCCESS' : '❌ FAILED'}  
**Build Duration:** ${result.buildTime ? `${result.buildTime}ms` : 'Unknown'}

## 📊 Build Summary

${result.buildSucceeded ? `
✅ **Build completed successfully**
- Duration: ${result.buildTime}ms
- No critical errors detected
- ${result.warnings.length} warnings found
` : `
❌ **Build failed with ${result.errors.length} errors**

### Error Categories
| Type | Count | Severity |
|------|-------|----------|
| TypeScript Errors | ${result.errorCategories.typescript} | ${result.errorCategories.typescript > 0 ? '🔴 High' : '✅ None'} |
| Webpack Errors | ${result.errorCategories.webpack} | ${result.errorCategories.webpack > 0 ? '🔴 High' : '✅ None'} |
| Dependency Issues | ${result.errorCategories.dependency} | ${result.errorCategories.dependency > 0 ? '🟡 Moderate' : '✅ None'} |
| Memory Issues | ${result.errorCategories.memory} | ${result.errorCategories.memory > 0 ? '🚨 Critical' : '✅ None'} |
| Syntax Errors | ${result.errorCategories.syntax} | ${result.errorCategories.syntax > 0 ? '🔴 High' : '✅ None'} |
| Import Errors | ${result.errorCategories.import} | ${result.errorCategories.import > 0 ? '🟡 Moderate' : '✅ None'} |
| Unknown Errors | ${result.errorCategories.unknown} | ${result.errorCategories.unknown > 0 ? '🔍 Investigate' : '✅ None'} |
`}

## 🌐 Environment Information

| Component | Version/Status |
|-----------|----------------|
| **Node.js** | ${result.environmentInfo.nodeVersion} |
| **npm** | ${result.environmentInfo.npmVersion} |
| **Next.js** | ${result.environmentInfo.nextjsVersion} |
| **Memory Usage** | ${result.environmentInfo.memoryUsage} |
| **Disk Space** | ${result.environmentInfo.diskSpace} |

## 🔍 Error Analysis

${result.errors.length > 0 ? `
### Detailed Errors

${result.errors.map((error, index) => `
#### ${index + 1}. ${error.type.charAt(0).toUpperCase() + error.type.slice(1)} Error (${error.severity})

**Message:** \`${error.message}\`
${error.file ? `**File:** \`${error.file}${error.line ? `:${error.line}` : ''}\`` : ''}
${error.suggestion ? `**Suggested Fix:** ${error.suggestion}` : ''}
`).join('')}

### Critical Log Excerpts

${result.logExcerpts.criticalLines.length > 0 ? `
**Critical Issues:**
\`\`\`
${result.logExcerpts.criticalLines.join('\n')}
\`\`\`
` : ''}

**First Errors:**
\`\`\`
${result.logExcerpts.firstErrors.join('\n')}
\`\`\`

**Last Errors:**
\`\`\`
${result.logExcerpts.lastErrors.join('\n')}
\`\`\`
` : '✅ **No errors detected** - Build completed successfully'}

## ⚠️ Warnings

${result.warnings.length > 0 ? `
${result.warnings.map(warning => `- ${warning}`).join('\n')}
` : '✅ **No warnings** - Clean build output'}

## 💡 Recommendations

${result.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

## 🔧 Quick Fixes

${result.quickFixes.length > 0 ? `
${result.quickFixes.map(fix => `
### ${fix.issue}
**Command:** \`${fix.command}\`  
**Description:** ${fix.description}  
**Risk Level:** ${fix.risk.toUpperCase()}
`).join('')}
` : 'No automated quick fixes available - manual investigation required'}

## 🚀 Next Steps

${this.generateNextSteps(result)}

## 📋 Troubleshooting Checklist

- [ ] Check environment variables and configuration
- [ ] Verify all dependencies are installed: \`npm install\`
- [ ] Clear build cache: \`rm -rf .next\`
- [ ] Run TypeScript check: \`npx tsc --noEmit\`
- [ ] Check for syntax errors: \`npm run lint\`
- [ ] Increase memory if needed: \`NODE_OPTIONS="--max-old-space-size=4096"\`
- [ ] Review package.json for version conflicts
- [ ] Test with a clean node_modules: \`rm -rf node_modules && npm install\`

---

**Generated by:** Build Failure Analyzer v1.0  
**Full Logs:** reports/build-log.txt  
**Last Updated:** ${result.timestamp}
`

    const reportPath = join(this.reportsPath, 'build-diagnostics.md')
    await writeFile(reportPath, reportContent, 'utf-8')
    
    console.log(chalk.green(`✅ Diagnostic report generated: ${reportPath}`))
  }

  private generateNextSteps(result: BuildDiagnosticResult): string {
    if (result.buildSucceeded) {
      return `1. ✅ **Build is working** - no immediate action required
2. 📊 Address any warnings to improve build quality
3. 🔄 Set up continuous monitoring for future builds
4. 📈 Consider build optimization if duration is high (>${result.buildTime && result.buildTime > 60000 ? 'current build is slow' : '60s'})`
    }

    const steps = []
    
    if (result.errorCategories.memory > 0) {
      steps.push('🚨 **URGENT:** Address memory issues first - they block all builds')
    }
    
    if (result.errorCategories.dependency > 0) {
      steps.push('📦 **HIGH PRIORITY:** Fix dependency issues with npm install')
    }
    
    if (result.errorCategories.typescript > 5) {
      steps.push('🔧 **SYSTEMATIC:** Address TypeScript errors in batches, starting with critical ones')
    } else if (result.errorCategories.typescript > 0) {
      steps.push('🔧 **MODERATE:** Fix remaining TypeScript compilation errors')
    }
    
    if (result.quickFixes.length > 0) {
      steps.push(`⚡ **QUICK WINS:** Try ${result.quickFixes.length} automated fixes listed above`)
    }
    
    steps.push('🧪 **VERIFICATION:** Run build again after fixes to confirm resolution')
    steps.push('📈 **MONITORING:** Set up build monitoring to catch issues early')
    
    return steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
  }

  private displaySummary(result: BuildDiagnosticResult): void {
    console.log(chalk.blue('\n🏗️ Build Diagnostic Summary'))
    console.log(chalk.blue('=' .repeat(32)))
    
    const statusColor = result.buildSucceeded ? chalk.green : chalk.red
    console.log(statusColor(`🎯 Build Status: ${result.buildSucceeded ? 'SUCCESS' : 'FAILED'}`))
    
    if (result.buildTime) {
      const timeColor = result.buildTime > 60000 ? chalk.yellow : chalk.green
      console.log(timeColor(`⏱️ Build Duration: ${result.buildTime}ms`))
    }
    
    if (!result.buildSucceeded) {
      console.log(chalk.white('\n📊 Error Breakdown:'))
      Object.entries(result.errorCategories).forEach(([type, count]) => {
        if (count > 0) {
          const typeColor = count > 5 ? chalk.red : count > 2 ? chalk.yellow : chalk.white
          console.log(typeColor(`  ${type}: ${count} errors`))
        }
      })
      
      if (result.quickFixes.length > 0) {
        console.log(chalk.green(`\n⚡ Quick Fixes Available: ${result.quickFixes.length}`))
      }
    }
    
    if (result.warnings.length > 0) {
      console.log(chalk.yellow(`⚠️ Warnings: ${result.warnings.length}`))
    }
    
    console.log(chalk.blue(`\n📄 Full diagnostics: reports/build-diagnostics.md`))
    
    if (result.buildSucceeded) {
      console.log(chalk.green('\n✅ Build analysis complete - no issues detected'))
    } else {
      console.log(chalk.red('\n❌ Build failures detected - follow recommendations above'))
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  
  const options = {
    verbose: args.includes('--verbose'),
    saveLogs: args.includes('--save-logs')
  }

  try {
    const analyzer = new BuildFailureAnalyzer(options)
    const result = await analyzer.execute()
    
    // Exit with appropriate code based on build result
    if (!result.buildSucceeded) {
      console.log(chalk.red('\n❌ Exiting with failure code due to build errors'))
      process.exit(1)
    }
    
    if (result.warnings.length > 10) {
      console.log(chalk.yellow('\n⚠️ Exiting with warning code due to excessive warnings'))
      process.exit(2)
    }
    
    console.log(chalk.green('\n✅ Build diagnostics completed successfully'))
    process.exit(0)
    
  } catch (error) {
    console.error(chalk.red('❌ Build diagnostics failed:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { BuildFailureAnalyzer }