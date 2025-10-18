#!/usr/bin/env tsx

/**
 * Bulk Update Deprecated Endpoints Script
 * Automatically updates remaining deprecated API endpoint references in frontend code
 */

import { promises as fs } from 'fs'
import path from 'path'

interface EndpointMapping {
  pattern: RegExp
  replacement: string
  description: string
}

// Mapping of deprecated endpoints to their consolidated replacements
const ENDPOINT_MAPPINGS: EndpointMapping[] = [
  // Authentication endpoints
  {
    pattern: /\/api\/admin\/login/g,
    replacement: '/api/admin/auth',
    description: 'Login endpoint → consolidated auth'
  },
  {
    pattern: /\/api\/admin\/me/g,
    replacement: '/api/admin/auth/me',
    description: 'User info endpoint → consolidated auth/me'
  },
  {
    pattern: /\/api\/admin\/logout/g,
    replacement: '/api/admin/auth',
    description: 'Logout endpoint → consolidated auth (DELETE method)'
  },

  // Content management endpoints
  {
    pattern: /\/api\/admin\/content\/queue/g,
    replacement: '/api/admin/content',
    description: 'Content queue → consolidated content'
  },
  {
    pattern: /\/api\/admin\/content\/posted/g,
    replacement: '/api/admin/content?status=posted',
    description: 'Posted content → consolidated content with status filter'
  },

  // Platform scanning endpoints
  {
    pattern: /\/api\/admin\/reddit\/scan/g,
    replacement: '/api/admin/platforms/scan',
    description: 'Reddit scan → consolidated platform scan'
  },
  {
    pattern: /\/api\/admin\/youtube\/scan/g,
    replacement: '/api/admin/platforms/scan',
    description: 'YouTube scan → consolidated platform scan'
  },
  {
    pattern: /\/api\/admin\/bluesky\/scan/g,
    replacement: '/api/admin/platforms/scan',
    description: 'Bluesky scan → consolidated platform scan'
  },
  {
    pattern: /\/api\/admin\/imgur\/scan/g,
    replacement: '/api/admin/platforms/scan',
    description: 'Imgur scan → consolidated platform scan'
  },
  {
    pattern: /\/api\/admin\/giphy\/scan/g,
    replacement: '/api/admin/platforms/scan',
    description: 'Giphy scan → consolidated platform scan'
  },
  {
    pattern: /\/api\/admin\/pixabay\/scan/g,
    replacement: '/api/admin/platforms/scan',
    description: 'Pixabay scan → consolidated platform scan'
  },
  {
    pattern: /\/api\/admin\/unsplash\/scan/g,
    replacement: '/api/admin/platforms/scan',
    description: 'Unsplash scan → consolidated platform scan'
  },
  {
    pattern: /\/api\/admin\/lemmy\/scan/g,
    replacement: '/api/admin/platforms/scan',
    description: 'Lemmy scan → consolidated platform scan'
  },
  {
    pattern: /\/api\/admin\/tumblr\/scan/g,
    replacement: '/api/admin/platforms/scan',
    description: 'Tumblr scan → consolidated platform scan'
  },

  // Dashboard and analytics
  {
    pattern: /\/api\/admin\/dashboard\/stats/g,
    replacement: '/api/admin/dashboard',
    description: 'Dashboard stats → consolidated dashboard'
  },
  {
    pattern: /\/api\/admin\/dashboard\/activity/g,
    replacement: '/api/admin/dashboard?view=activity',
    description: 'Dashboard activity → consolidated dashboard with view filter'
  },
  {
    pattern: /\/api\/admin\/content\/metrics/g,
    replacement: '/api/admin/analytics?type=content',
    description: 'Content metrics → consolidated analytics'
  },

  // Platform status endpoints
  {
    pattern: /\/api\/admin\/reddit\/status/g,
    replacement: '/api/admin/platforms/status?platform=reddit',
    description: 'Reddit status → consolidated platform status'
  },
  {
    pattern: /\/api\/admin\/youtube\/status/g,
    replacement: '/api/admin/platforms/status?platform=youtube',
    description: 'YouTube status → consolidated platform status'
  },
  {
    pattern: /\/api\/admin\/bluesky\/status/g,
    replacement: '/api/admin/platforms/status?platform=bluesky',
    description: 'Bluesky status → consolidated platform status'
  },

  // Scan history endpoints
  {
    pattern: /\/api\/admin\/reddit\/scan-history/g,
    replacement: '/api/admin/analytics?type=scan_history&platform=reddit',
    description: 'Reddit scan history → consolidated analytics'
  },
  {
    pattern: /\/api\/admin\/youtube\/scan-history/g,
    replacement: '/api/admin/analytics?type=scan_history&platform=youtube',
    description: 'YouTube scan history → consolidated analytics'
  }
]

interface UpdateResult {
  file: string
  changes: Array<{
    line: number
    oldCode: string
    newCode: string
    mapping: string
  }>
}

async function updateFile(filePath: string): Promise<UpdateResult | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    let hasChanges = false
    const changes: UpdateResult['changes'] = []

    // Apply all endpoint mappings
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      const originalLine = line

      for (const mapping of ENDPOINT_MAPPINGS) {
        if (mapping.pattern.test(line)) {
          const newLine = line.replace(mapping.pattern, mapping.replacement)
          if (newLine !== line) {
            changes.push({
              line: i + 1,
              oldCode: line.trim(),
              newCode: newLine.trim(),
              mapping: mapping.description
            })
            line = newLine
            hasChanges = true
          }
        }
      }

      lines[i] = line
    }

    // Handle special cases for platform scan requests that need body updates
    if (hasChanges) {
      const updatedContent = lines.join('\n')
      await fs.writeFile(filePath, updatedContent)
      
      return {
        file: filePath.replace(process.cwd() + '/', ''),
        changes
      }
    }

    return null
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error)
    return null
  }
}

async function findAndUpdateFiles(): Promise<UpdateResult[]> {
  const results: UpdateResult[] = []
  
  const scanPaths = [
    'app/admin',
    'components/admin',
    'lib/api-client.ts',
    'hooks'
  ]

  async function scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', '.next', 'dist'].includes(entry.name)) {
            await scanDirectory(fullPath)
          }
        } else if (entry.isFile()) {
          if (/\.(tsx?|jsx?)$/.test(entry.name)) {
            const result = await updateFile(fullPath)
            if (result) {
              results.push(result)
            }
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  for (const scanPath of scanPaths) {
    try {
      await fs.access(scanPath)
      console.log(`📁 Updating files in ${scanPath}...`)
      await scanDirectory(scanPath)
    } catch {
      console.log(`⚠️  ${scanPath} not found, skipping...`)
    }
  }

  return results
}

async function generateUpdateReport(results: UpdateResult[]): Promise<void> {
  const totalFiles = results.length
  const totalChanges = results.reduce((sum, result) => sum + result.changes.length, 0)

  const report = `# Bulk Deprecated Endpoint Update Report
Generated: ${new Date().toISOString()}

## Summary

- **Files Updated:** ${totalFiles}
- **Total Changes:** ${totalChanges}
- **Status:** ${totalChanges > 0 ? '✅ UPDATES APPLIED' : '📍 NO CHANGES NEEDED'}

## Files Modified

${results.map(result => `
### ${result.file}
**Changes Applied:** ${result.changes.length}

${result.changes.map(change => `
- **Line ${change.line}:** ${change.mapping}
  - **Before:** \`${change.oldCode}\`
  - **After:** \`${change.newCode}\`
`).join('\n')}
`).join('\n')}

## Endpoint Mapping Summary

${ENDPOINT_MAPPINGS.map(mapping => `
- **${mapping.description}**
  - Pattern: \`${mapping.pattern.source}\`
  - Replacement: \`${mapping.replacement}\`
`).join('\n')}

## Next Steps

1. 🧪 Test updated components to ensure they work with consolidated endpoints
2. 🔍 Run frontend migration verification script to check remaining deprecated usage
3. 📊 Monitor API logs to verify endpoints are being called correctly
4. 🚀 Run end-to-end tests to verify full functionality

---
*Report generated by bulk endpoint update script*
`

  await fs.writeFile('docs/bulk-endpoint-update-report.md', report)
  console.log('📄 Update report saved to docs/bulk-endpoint-update-report.md')
}

async function main(): Promise<void> {
  try {
    console.log('🔄 Starting bulk deprecated endpoint update...')
    
    const results = await findAndUpdateFiles()
    await generateUpdateReport(results)
    
    const totalChanges = results.reduce((sum, result) => sum + result.changes.length, 0)
    
    console.log('\n📊 Update Summary:')
    console.log(`├─ Files Updated: ${results.length}`)
    console.log(`├─ Total Changes: ${totalChanges}`)
    console.log(`└─ Status: ${totalChanges > 0 ? 'UPDATES APPLIED ✅' : 'NO CHANGES NEEDED 📍'}`)
    
    if (results.length > 0) {
      console.log('\n📝 Updated Files:')
      results.forEach(result => {
        console.log(`   ${result.file} (${result.changes.length} changes)`)
      })
    }
    
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Bulk update failed:', error)
    process.exit(1)
  }
}

// Run the bulk update
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('bulk-update-deprecated-endpoints')
if (isMainModule) {
  main()
}

export { findAndUpdateFiles, generateUpdateReport }