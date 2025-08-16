import { NextRequest, NextResponse } from 'next/server'
import { schedulingService } from '@/lib/services/scheduling'
import { postingService } from '@/lib/services/posting'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // Mock data for now - replace with real services once they're properly configured
    const mockScheduleData = {
      config: {
        id: 1,
        meal_times: ['08:00', '12:00', '17:00', '20:00', '22:00', '23:30'],
        timezone: 'America/New_York',
        is_enabled: true,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      schedule: {
        nextPostTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        nextMealTime: '17:00',
        timeUntilNext: 7200, // 2 hours in seconds
        isPostingTime: false,
        todaysSchedule: [
          {
            time: '08:00',
            posted: true,
            scheduledDate: new Date().toISOString().split('T')[0] + 'T08:00:00Z'
          },
          {
            time: '12:00',
            posted: true,
            scheduledDate: new Date().toISOString().split('T')[0] + 'T12:00:00Z'
          },
          {
            time: '17:00',
            posted: false,
            scheduledDate: new Date().toISOString().split('T')[0] + 'T17:00:00Z'
          },
          {
            time: '20:00',
            posted: false,
            scheduledDate: new Date().toISOString().split('T')[0] + 'T20:00:00Z'
          },
          {
            time: '22:00',
            posted: false,
            scheduledDate: new Date().toISOString().split('T')[0] + 'T22:00:00Z'
          },
          {
            time: '23:30',
            posted: false,
            scheduledDate: new Date().toISOString().split('T')[0] + 'T23:30:00Z'
          }
        ]
      },
      queueStatus: {
        totalApproved: 47,
        totalPending: 156,
        totalPosted: 1248,
        isHealthy: true,
        alertLevel: 'none' as const,
        message: 'Queue is healthy with sufficient approved content'
      },
      stats: {
        todaysPosts: 2,
        thisWeeksPosts: 18,
        thisMonthsPosts: 89,
        totalPosts: 1248,
        avgPostsPerDay: 5.8
      }
    }

    return NextResponse.json(mockScheduleData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error in schedule API:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { meal_times, timezone, is_enabled } = body

    if (meal_times && !Array.isArray(meal_times)) {
      return NextResponse.json({
        error: 'meal_times must be an array'
      }, { status: 400 })
    }

    if (meal_times) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      for (const time of meal_times) {
        if (!timeRegex.test(time)) {
          return NextResponse.json({
            error: `Invalid time format: ${time}. Use HH:MM format.`
          }, { status: 400 })
        }
      }
    }

    // Mock updated config - in real implementation this would update the database
    const updatedConfig = {
      id: 1,
      meal_times: meal_times || ['08:00', '12:00', '17:00', '20:00', '22:00', '23:30'],
      timezone: timezone || 'America/New_York',
      is_enabled: is_enabled !== undefined ? is_enabled : true,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('Schedule config updated via API (mock):', { updatedConfig })

    return NextResponse.json({
      success: true,
      config: updatedConfig
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error updating schedule config:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}