import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ContentProcessor } from '@/lib/services/content-processor'

export async function POST(request: NextRequest) {
  try {
    const contentProcessor = new ContentProcessor()
    
    const { batchSize = 10, contentId } = await request.json()
    
    if (contentId) {
      const result = await contentProcessor.processContent(contentId)
      
      return NextResponse.json({
        success: true,
        contentId,
        status: result.status,
        analysisResult: result.analysisResult
      })
    } else {
      const result = await contentProcessor.processBatch(batchSize)
      
      return NextResponse.json({
        success: true,
        processed: result.processed,
        approved: result.approved,
        rejected: result.rejected,
        flagged: result.flagged,
        errors: result.errors
      })
    }
  } catch (error) {
    console.error('Error processing content:', error)
    return NextResponse.json(
      { error: 'Failed to process content' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Mock data for now - replace with real database queries once tables are properly configured
    const mockProcessingStats = {
      stats: {
        pending: 47,
        processing: 3,
        approved: 156,
        rejected: 23,
        flagged: 8,
        avg_processing_time: 34.5
      },
      recentActivity: [
        { status: 'approved', count: 12, hour: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
        { status: 'pending', count: 8, hour: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
        { status: 'rejected', count: 3, hour: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
        { status: 'flagged', count: 1, hour: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() },
        { status: 'approved', count: 15, hour: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
        { status: 'pending', count: 6, hour: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() }
      ]
    }

    return NextResponse.json(mockProcessingStats, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching processing stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch processing stats' },
      { status: 500 }
    )
  }
}