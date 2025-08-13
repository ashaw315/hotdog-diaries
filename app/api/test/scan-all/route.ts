import { NextRequest, NextResponse } from 'next/server'
import { contentScanningService } from '@/lib/services/content-scanning'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'

interface PlatformScanResult {
  platform: string
  status: 'success' | 'partial' | 'failed'
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
  duration: number
  timestamp: string
}

interface ValidationResult {
  platform: string
  totalInDb: number
  approvedInDb: number
  avgConfidence: number
  hasContent: boolean
  hasApprovedContent: boolean
}

const PLATFORMS = [
  'reddit',
  'youtube', 
  'imgur',
  'lemmy',
  'tumblr',
  'pixabay',
  'bluesky',
  'giphy'
]

export async function POST(request: NextRequest) {
  try {
    // Check if in development/test mode
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development/test mode' },
        { status: 403 }
      )
    }

    console.log('🧪 Starting comprehensive platform scan test...')
    
    const scanResults: PlatformScanResult[] = []
    const startTime = Date.now()

    // Scan each platform individually
    for (const platform of PLATFORMS) {
      console.log(`\n📡 Scanning ${platform}...`)
      const platformStart = Date.now()
      
      try {
        // Perform the scan
        const result = await contentScanningService.scanPlatform(platform, 10) // Limit to 10 items for testing
        
        const platformResult: PlatformScanResult = {
          platform,
          status: result.errors.length === 0 ? 'success' : 
                  result.processed > 0 ? 'partial' : 'failed',
          totalFound: result.found,
          processed: result.processed,
          approved: result.approved,
          rejected: result.rejected,
          duplicates: result.duplicates,
          errors: result.errors,
          duration: Date.now() - platformStart,
          timestamp: new Date().toISOString()
        }
        
        scanResults.push(platformResult)
        
        console.log(`✅ ${platform}: Found ${result.found}, Approved ${result.approved}`)
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ ${platform} scan failed:`, errorMessage)
        
        scanResults.push({
          platform,
          status: 'failed',
          totalFound: 0,
          processed: 0,
          approved: 0,
          rejected: 0,
          duplicates: 0,
          errors: [errorMessage],
          duration: Date.now() - platformStart,
          timestamp: new Date().toISOString()
        })
      }
      
      // Small delay between platforms to avoid overwhelming APIs
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Validate content in database
    console.log('\n🔍 Validating database content...')
    const validationResults = await validateContentSources()

    // Generate summary
    const summary = {
      totalPlatforms: PLATFORMS.length,
      successfulScans: scanResults.filter(r => r.status === 'success').length,
      partialScans: scanResults.filter(r => r.status === 'partial').length,
      failedScans: scanResults.filter(r => r.status === 'failed').length,
      totalContentFound: scanResults.reduce((sum, r) => sum + r.totalFound, 0),
      totalContentApproved: scanResults.reduce((sum, r) => sum + r.approved, 0),
      totalDuration: Date.now() - startTime
    }

    // Log final results
    console.log('\n📊 Scan Test Summary:')
    console.log(`- Platforms tested: ${summary.totalPlatforms}`)
    console.log(`- Successful: ${summary.successfulScans}`)
    console.log(`- Partial: ${summary.partialScans}`)
    console.log(`- Failed: ${summary.failedScans}`)
    console.log(`- Total content found: ${summary.totalContentFound}`)
    console.log(`- Total content approved: ${summary.totalContentApproved}`)

    // Store results for the test results page
    await storeTestResults({
      scanResults,
      validationResults,
      summary,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      summary,
      scanResults,
      validationResults,
      message: 'Platform scan test completed. View detailed results at /test-results'
    })

  } catch (error) {
    console.error('Scan test error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

async function validateContentSources(): Promise<ValidationResult[]> {
  try {
    const query = `
      SELECT 
        cq.source_platform,
        COUNT(DISTINCT cq.id) as total,
        SUM(CASE WHEN cq.is_approved = 1 THEN 1 ELSE 0 END) as approved,
        AVG(ca.confidence_score) as avg_confidence
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      GROUP BY cq.source_platform
      ORDER BY cq.source_platform
    `
    
    const result = await db.query(query)
    const platformData = new Map(result.rows.map(row => [
      row.source_platform,
      {
        total: parseInt(row.total),
        approved: parseInt(row.approved),
        avgConfidence: parseFloat(row.avg_confidence || '0')
      }
    ]))

    // Create validation results for all platforms
    return PLATFORMS.map(platform => {
      const data = platformData.get(platform) || { total: 0, approved: 0, avgConfidence: 0 }
      
      return {
        platform,
        totalInDb: data.total,
        approvedInDb: data.approved,
        avgConfidence: Math.round(data.avgConfidence * 100) / 100,
        hasContent: data.total > 0,
        hasApprovedContent: data.approved > 0
      }
    })
    
  } catch (error) {
    console.error('Validation query error:', error)
    return PLATFORMS.map(platform => ({
      platform,
      totalInDb: 0,
      approvedInDb: 0,
      avgConfidence: 0,
      hasContent: false,
      hasApprovedContent: false
    }))
  }
}

async function storeTestResults(results: any): Promise<void> {
  try {
    // Store in a simple JSON file for the test results page to read
    const resultsPath = path.join(process.cwd(), 'test-results.json')
    
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2))
    console.log('✅ Test results saved to test-results.json')
    
  } catch (error) {
    console.error('Failed to store test results:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return current validation results without running scans
    const validationResults = await validateContentSources()
    
    const summary = {
      platforms: PLATFORMS.length,
      platformsWithContent: validationResults.filter(v => v.hasContent).length,
      platformsWithApprovedContent: validationResults.filter(v => v.hasApprovedContent).length,
      totalContent: validationResults.reduce((sum, v) => sum + v.totalInDb, 0),
      totalApprovedContent: validationResults.reduce((sum, v) => sum + v.approvedInDb, 0)
    }
    
    return NextResponse.json({
      success: true,
      summary,
      validationResults,
      message: 'Current platform content status. Use POST to run full scan test.'
    })
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}