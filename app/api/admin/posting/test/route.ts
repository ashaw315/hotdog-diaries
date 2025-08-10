import { NextRequest, NextResponse } from 'next/server'
import { PostingScheduler } from '@/lib/services/posting-scheduler'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // For testing purposes, we'll skip authentication checks but log the attempt
    await logToDatabase(
      LogLevel.INFO,
      'Manual posting test triggered',
      'AdminAPI',
      { timestamp: new Date().toISOString() }
    )

    // Select content for posting
    const content = await PostingScheduler.selectContentForPosting()
    if (!content) {
      return NextResponse.json({
        success: false,
        error: 'No approved content available for posting',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    // Execute the test post
    const postResult = await PostingScheduler.executeScheduledPost(content.id)
    
    if (postResult) {
      await logToDatabase(
        LogLevel.INFO,
        'Manual test posting successful',
        'AdminAPI',
        { 
          contentId: content.id,
          platform: content.source_platform,
          contentType: content.content_type
        }
      )
      
      return NextResponse.json({
        success: true,
        message: 'Test post successful',
        data: {
          contentId: content.id,
          platform: content.source_platform,
          contentType: content.content_type,
          contentText: content.content_text?.substring(0, 100) + '...',
          originalAuthor: content.original_author,
          postedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      })
    } else {
      await logToDatabase(
        LogLevel.ERROR,
        'Manual test posting failed',
        'AdminAPI',
        { 
          contentId: content.id,
          platform: content.source_platform
        }
      )
      
      return NextResponse.json({
        success: false,
        error: 'Failed to execute test post',
        data: {
          contentId: content.id,
          platform: content.source_platform,
          contentType: content.content_type
        },
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Manual test posting API failed',
      'AdminAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      success: false,
      error: 'Test posting API failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get next content that would be posted
    const content = await PostingScheduler.selectContentForPosting()
    
    if (!content) {
      return NextResponse.json({
        success: true,
        message: 'No content available for testing',
        nextContent: null,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Next content ready for test posting',
      nextContent: {
        contentId: content.id,
        platform: content.source_platform,
        contentType: content.content_type,
        contentText: content.content_text?.substring(0, 150) + '...',
        originalAuthor: content.original_author,
        hasImage: !!content.content_image_url,
        hasVideo: !!content.content_video_url
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get test content',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}