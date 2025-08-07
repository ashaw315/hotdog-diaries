import { NextRequest, NextResponse } from 'next/server'
import { automatedPostingService } from '@/lib/services/automated-posting'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    await logToDatabase(
      LogLevel.INFO,
      'Forced automated posting test triggered',
      'TestAPI',
      { timestamp: new Date().toISOString() }
    )

    // Get content to post (bypass meal time check for testing)
    const selectedContent = await (automatedPostingService as any).selectContentForPosting({
      maxItems: 1,
      platformBalance: true,
      qualityThreshold: 0.6,
      avoidRecentDuplicates: true,
      recentHours: 24
    })

    if (selectedContent.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No suitable content found for posting',
        selectedContent: 0
      })
    }

    // Post the selected content
    const results = []
    for (const content of selectedContent) {
      const result = await (automatedPostingService as any).postContent(content)
      results.push(result)
    }

    const successCount = results.filter(r => r.success).length
    
    await logToDatabase(
      LogLevel.INFO,
      `Forced posting test completed: ${successCount}/${results.length} successful`,
      'TestAPI',
      { 
        results: results.length,
        successful: successCount,
        contentSelected: selectedContent.length
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Forced posting test completed',
      results: results.length,
      successful: successCount,
      failed: results.filter(r => !r.success).length,
      posts: results.map(r => ({
        contentId: r.contentId,
        platform: r.platform,
        contentType: r.contentType,
        success: r.success,
        error: r.error,
        postedAt: r.postedAt
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      `Forced posting test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'TestAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}