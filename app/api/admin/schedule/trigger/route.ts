import { NextRequest, NextResponse } from 'next/server'
import { postingService } from '@/lib/services/posting'
import { schedulingService } from '@/lib/services/scheduling'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { contentId } = body

    let result

    if (contentId) {
      result = await postingService.postContent(contentId, true)
    } else {
      const selectedContent = await schedulingService.selectRandomContent()
      
      if (!selectedContent) {
        return NextResponse.json({
          success: false,
          error: 'No approved content available for posting'
        }, { status: 400 })
      }

      result = await postingService.postContent(selectedContent.id, true)
    }

    if (result.success) {
      await logToDatabase(
        LogLevel.INFO,
        'Manual posting triggered successfully',
        'ScheduleAPI',
        { 
          contentId: result.contentId,
          postOrder: result.postOrder,
          triggeredContentId: contentId
        }
      )

      return NextResponse.json({
        success: true,
        message: 'Content posted successfully',
        contentId: result.contentId,
        postOrder: result.postOrder
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to trigger manual posting',
      'ScheduleAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}