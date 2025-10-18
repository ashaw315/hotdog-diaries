#!/usr/bin/env tsx

/**
 * Frontend Migration Verification Script
 * Scans admin frontend code to verify usage of consolidated endpoints
 */

import { promises as fs } from 'fs'
import path from 'path'
import { DEPRECATED_ENDPOINTS } from '../lib/api-deprecation'

interface FrontendAnalysis {
  summary: {
    totalFiles: number
    filesWithDeprecatedAPIs: number
    totalDeprecatedReferences: number
    migrationComplete: boolean
  }
  deprecatedUsage: {
    file: string
    line: number
    code: string
    endpoint: string
    replacement: string
  }[]
  consolidatedUsage: {
    file: string
    line: number
    code: string
    endpoint: string
  }[]
  recommendations: string[]
}

// Consolidated endpoints we expect to see
const CONSOLIDATED_ENDPOINTS = [
  '/api/admin/auth',
  '/api/admin/auth/me',
  '/api/admin/auth/refresh',
  '/api/admin/content',
  '/api/admin/platforms/scan',
  '/api/admin/platforms/status', 
  '/api/admin/dashboard',
  '/api/admin/analytics',
  '/api/admin/queue',
  '/api/admin/schedule',
  '/api/admin/health',
  '/api/admin/metrics',
  '/api/admin/maintenance',
  '/api/admin/debug',
  '/api/admin/filters'
]

async function scanDirectoryForAPICalls(dirPath: string): Promise<{
  deprecatedCalls: Array<{file: string, line: number, code: string, endpoint: string}>,
  consolidatedCalls: Array<{file: string, line: number, code: string, endpoint: string}>
}> {
  const deprecatedCalls: Array<{file: string, line: number, code: string, endpoint: string}> = []
  const consolidatedCalls: Array<{file: string, line: number, code: string, endpoint: string}> = []
  
  async function scanFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineNumber = i + 1
        
        // Look for API calls in various patterns
        const apiPatterns = [
          /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
          /axios\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g,
          /\.request\s*\(\s*['"`]([^'"`]+)['"`]/g,
          /apiClient\.\w+\s*\(\s*['"`]([^'"`]+)['"`]/g,
          /\$\{.*?\}\/api\/admin\/[^'"`\s]+/g, // Template literals
          /\/api\/admin\/[a-zA-Z0-9\-_\/\[\]]+/g // Direct API path references
        ]
        
        for (const pattern of apiPatterns) {
          let match
          while ((match = pattern.exec(line)) !== null) {
            let endpoint = match[1] || match[2] || match[0]
            
            // Clean up the endpoint
            endpoint = endpoint.replace(/\$\{.*?\}/g, '[dynamic]') // Replace template variables
            if (!endpoint.startsWith('/api/admin')) continue
            
            // Check if it's a deprecated endpoint
            const isDeprecated = Object.keys(DEPRECATED_ENDPOINTS).some(dep => 
              endpoint.includes(dep.replace('/api/admin', '')) || 
              endpoint === dep
            )
            
            // Check if it's a consolidated endpoint
            const isConsolidated = CONSOLIDATED_ENDPOINTS.some(cons => 
              endpoint.startsWith(cons) || endpoint === cons
            )
            
            if (isDeprecated) {
              deprecatedCalls.push({
                file: filePath,
                line: lineNumber,
                code: line.trim(),
                endpoint
              })
            } else if (isConsolidated) {
              consolidatedCalls.push({
                file: filePath,
                line: lineNumber,
                code: line.trim(), 
                endpoint
              })
            }
          }
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  async function walkDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          // Skip node_modules and .git
          if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)) {
            await walkDirectory(fullPath)
          }
        } else if (entry.isFile()) {
          // Only scan relevant frontend files
          if (/\.(tsx?|jsx?|vue|svelte)$/.test(entry.name)) {
            await scanFile(fullPath)
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  await walkDirectory(dirPath)
  return { deprecatedCalls, consolidatedCalls }
}

async function verifyFrontendMigration(): Promise<FrontendAnalysis> {
  console.log('🔍 Scanning frontend code for API endpoint usage...')
  
  // Scan admin-related directories
  const scanPaths = [
    'app/admin',
    'components/admin', 
    'lib/api-client.ts',
    'hooks',
    'pages/admin'
  ]
  
  let allDeprecatedCalls: Array<{file: string, line: number, code: string, endpoint: string}> = []
  let allConsolidatedCalls: Array<{file: string, line: number, code: string, endpoint: string}> = []
  let totalFiles = 0
  
  for (const scanPath of scanPaths) {
    try {
      await fs.access(scanPath)
      console.log(`📁 Scanning ${scanPath}...`)
      
      const { deprecatedCalls, consolidatedCalls } = await scanDirectoryForAPICalls(scanPath)
      allDeprecatedCalls.push(...deprecatedCalls)
      allConsolidatedCalls.push(...consolidatedCalls)
      
      // Count files in directory
      const countFiles = async (dir: string): Promise<number> => {
        let count = 0
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isDirectory() && !['node_modules', '.git', '.next'].includes(entry.name)) {
              count += await countFiles(path.join(dir, entry.name))
            } else if (entry.isFile() && /\.(tsx?|jsx?|vue|svelte)$/.test(entry.name)) {
              count++
            }
          }
        } catch {}
        return count
      }
      
      totalFiles += await countFiles(scanPath)
      
    } catch {
      console.log(`⚠️  ${scanPath} not found, skipping...`)
    }
  }
  
  // Build analysis
  const deprecatedUsage = allDeprecatedCalls.map(call => {
    const matchingDeprecated = Object.entries(DEPRECATED_ENDPOINTS).find(([dep]) => 
      call.endpoint.includes(dep.replace('/api/admin', '')) || call.endpoint === dep
    )
    
    return {
      file: call.file.replace(process.cwd() + '/', ''),
      line: call.line,
      code: call.code,
      endpoint: call.endpoint,
      replacement: matchingDeprecated?.[1].replacementEndpoint || 'Unknown'
    }
  })
  
  const consolidatedUsage = allConsolidatedCalls.map(call => ({
    file: call.file.replace(process.cwd() + '/', ''),
    line: call.line,
    code: call.code,
    endpoint: call.endpoint
  }))
  
  const filesWithDeprecatedAPIs = new Set(deprecatedUsage.map(usage => usage.file)).size
  const migrationComplete = deprecatedUsage.length === 0
  
  // Generate recommendations
  const recommendations: string[] = []
  
  if (migrationComplete) {
    recommendations.push('✅ Frontend migration appears complete - no deprecated API usage detected!')
    recommendations.push('🧪 Consider running end-to-end tests to verify functionality')
  } else {
    recommendations.push(`🔄 ${deprecatedUsage.length} deprecated API references found in ${filesWithDeprecatedAPIs} files`)
    recommendations.push('📝 Update these files to use consolidated endpoints')
    
    // Group by endpoint for easier fixing
    const endpointGroups = deprecatedUsage.reduce((acc, usage) => {
      if (!acc[usage.endpoint]) acc[usage.endpoint] = []
      acc[usage.endpoint].push(usage)
      return acc
    }, {} as Record<string, typeof deprecatedUsage>)
    
    for (const [endpoint, usages] of Object.entries(endpointGroups)) {
      if (usages.length > 1) {
        recommendations.push(`🎯 High priority: ${endpoint} used in ${usages.length} locations`)
      }
    }
  }
  
  if (consolidatedUsage.length > 0) {
    recommendations.push(`✅ Found ${consolidatedUsage.length} consolidated endpoint usages - migration is progressing`)
  }
  
  return {
    summary: {
      totalFiles,
      filesWithDeprecatedAPIs,
      totalDeprecatedReferences: deprecatedUsage.length,
      migrationComplete
    },
    deprecatedUsage,
    consolidatedUsage,
    recommendations
  }
}

async function generateFrontendMigrationReport(analysis: FrontendAnalysis): Promise<void> {
  const report = `# Frontend Migration Verification Report
Generated: ${new Date().toISOString()}

## Summary

- **Total Frontend Files Scanned:** ${analysis.summary.totalFiles}
- **Files with Deprecated API Usage:** ${analysis.summary.filesWithDeprecatedAPIs}
- **Total Deprecated References:** ${analysis.summary.totalDeprecatedReferences}
- **Migration Status:** ${analysis.summary.migrationComplete ? '✅ COMPLETE' : '🔄 IN PROGRESS'}

## Migration Progress

${analysis.summary.migrationComplete ? 
  '🎉 **MIGRATION COMPLETE!** No deprecated API usage detected in frontend code.' :
  `📊 **Migration Progress:** ${analysis.summary.totalDeprecatedReferences > 0 ? 
    Math.round((1 - analysis.summary.totalDeprecatedReferences / (analysis.summary.totalDeprecatedReferences + analysis.consolidatedUsage.length)) * 100) : 0
  }% (${analysis.consolidatedUsage.length} consolidated vs ${analysis.summary.totalDeprecatedReferences} deprecated)`
}

## Recommendations

${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

${analysis.deprecatedUsage.length > 0 ? `
## Deprecated API Usage Found

${analysis.deprecatedUsage.map(usage => `
### ${usage.file}:${usage.line}
- **Deprecated Endpoint:** \`${usage.endpoint}\`
- **Replacement:** \`${usage.replacement}\`
- **Code:** \`${usage.code}\`
`).join('\n')}
` : ''}

${analysis.consolidatedUsage.length > 0 ? `
## Consolidated Endpoint Usage (Good!)

${analysis.consolidatedUsage.slice(0, 10).map(usage => `
- **${usage.file}:${usage.line}** - \`${usage.endpoint}\`
`).join('\n')}

${analysis.consolidatedUsage.length > 10 ? `\n*...and ${analysis.consolidatedUsage.length - 10} more consolidated endpoint usages*` : ''}
` : ''}

## Next Steps

${analysis.summary.migrationComplete ? `
1. ✅ Run end-to-end tests to verify functionality
2. 📊 Monitor API usage logs for any remaining deprecated calls
3. 🗑️ Proceed with deprecated endpoint removal
` : `
1. 🔄 Update files with deprecated API usage
2. 🧪 Test updated components thoroughly  
3. 🔍 Re-run this verification after changes
4. 📊 Monitor API logs during testing
`}

---
*Report generated by frontend migration verification script*
`

  await fs.writeFile('docs/frontend-migration-verification.md', report)
  console.log('📄 Frontend migration report saved to docs/frontend-migration-verification.md')
}

async function main(): Promise<void> {
  try {
    console.log('🔍 Starting frontend migration verification...')
    
    const analysis = await verifyFrontendMigration()
    await generateFrontendMigrationReport(analysis)
    
    console.log('\n📊 Verification Summary:')
    console.log(`├─ Files Scanned: ${analysis.summary.totalFiles}`)
    console.log(`├─ Deprecated References: ${analysis.summary.totalDeprecatedReferences}`)
    console.log(`├─ Consolidated References: ${analysis.consolidatedUsage.length}`)
    console.log(`└─ Migration Complete: ${analysis.summary.migrationComplete ? 'YES ✅' : 'NO 🔄'}`)
    
    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Key Recommendations:')
      analysis.recommendations.slice(0, 3).forEach(rec => console.log(`   ${rec}`))
    }
    
    process.exit(analysis.summary.migrationComplete ? 0 : 1)
    
  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  }
}

// Run the verification
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('verify-frontend-migration')
if (isMainModule) {
  main()
}

export { verifyFrontendMigration, generateFrontendMigrationReport }