import { NextRequest, NextResponse } from 'next/server'
import { schedulingService } from '@/lib/services/scheduling'
import { postingService } from '@/lib/services/posting'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

interface ScheduleTime {
  time: string
  posted: boolean
  scheduledDate: string
  platform?: string
}

interface ScheduleConfig {
  id: number
  meal_times: string[]
  timezone: string
  is_enabled: boolean
  created_at: string
  updated_at: string
}

interface QueueStatus {
  totalApproved: number
  totalPending: number
  totalPosted: number
  isHealthy: boolean
  alertLevel: 'none' | 'warning' | 'critical'
  message: string
}

interface ScheduleStats {
  todaysPosts: number
  thisWeeksPosts: number
  thisMonthsPosts: number
  totalPosts: number
  avgPostsPerDay: number
}

// Helper function to convert time to timezone-aware date
function createScheduledDate(timeStr: string, timezone: string = 'America/New_York'): string {
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
  const [hours, minutes] = timeStr.split(':').map(num => parseInt(num, 10))
  
  // Create date in the specified timezone
  const date = new Date(`${today}T${timeStr}:00`)
  return date.toISOString()
}

// Helper function to calculate time until next post
function calculateTimeUntilNext(nextTime: string, timezone: string = 'America/New_York'): number {
  const now = new Date()
  const [hours, minutes] = nextTime.split(':').map(num => parseInt(num, 10))
  
  const today = new Date().toLocaleDateString('en-CA')
  const nextDate = new Date(`${today}T${nextTime}:00`)
  
  // If the time has passed today, schedule for tomorrow
  if (nextDate <= now) {
    nextDate.setDate(nextDate.getDate() + 1)
  }
  
  return Math.floor((nextDate.getTime() - now.getTime()) / 1000)
}

// Helper function to determine if current time is within posting window
function isCurrentlyPostingTime(mealTimes: string[], timezone: string = 'America/New_York'): boolean {
  const now = new Date()
  const currentTime = now.toLocaleTimeString('en-US', { 
    timeZone: timezone, 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  })
  
  // Check if current time is within 5 minutes of any meal time
  return mealTimes.some(mealTime => {
    const [mealHours, mealMinutes] = mealTime.split(':').map(num => parseInt(num, 10))
    const [currentHours, currentMinutes] = currentTime.split(':').map(num => parseInt(num, 10))
    
    const mealTimeInMinutes = mealHours * 60 + mealMinutes
    const currentTimeInMinutes = currentHours * 60 + currentMinutes
    
    const timeDiff = Math.abs(mealTimeInMinutes - currentTimeInMinutes)
    return timeDiff <= 5 // Within 5 minutes
  })
}

// Helper function to find next meal time
function findNextMealTime(mealTimes: string[], timezone: string = 'America/New_York'): string {
  const now = new Date()
  const currentTime = now.toLocaleTimeString('en-US', { 
    timeZone: timezone, 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  })
  
  const [currentHours, currentMinutes] = currentTime.split(':').map(num => parseInt(num, 10))
  const currentTimeInMinutes = currentHours * 60 + currentMinutes
  
  // Find the next meal time today
  const nextTodayMeal = mealTimes.find(mealTime => {
    const [hours, minutes] = mealTime.split(':').map(num => parseInt(num, 10))
    const mealTimeInMinutes = hours * 60 + minutes
    return mealTimeInMinutes > currentTimeInMinutes
  })
  
  // If no more meals today, return first meal tomorrow
  return nextTodayMeal || mealTimes[0]
}

export async function GET(request: NextRequest) {
  try {
    // Correct posting schedule: 6 times daily as specified
    const POSTING_SCHEDULE = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30']
    const TIMEZONE = 'America/New_York'
    
    // Create properly typed configuration
    const config: ScheduleConfig = {
      id: 1,
      meal_times: POSTING_SCHEDULE,
      timezone: TIMEZONE,
      is_enabled: true,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    }
    
    // Calculate schedule dynamics
    const nextMealTime = findNextMealTime(POSTING_SCHEDULE, TIMEZONE)
    const timeUntilNext = calculateTimeUntilNext(nextMealTime, TIMEZONE)
    const isPostingTime = isCurrentlyPostingTime(POSTING_SCHEDULE, TIMEZONE)
    
    // Create today's schedule with platform distribution
    const platforms = ['reddit', 'bluesky', 'tumblr', 'lemmy', 'giphy', 'imgur']
    const todaysSchedule: ScheduleTime[] = POSTING_SCHEDULE.map((time, index) => {
      const [hours] = time.split(':').map(num => parseInt(num, 10))
      const now = new Date()
      const currentHour = now.getHours()
      
      return {
        time,
        posted: hours < currentHour, // Mark as posted if time has passed
        scheduledDate: createScheduledDate(time, TIMEZONE),
        platform: platforms[index % platforms.length] // Distribute platforms evenly
      }
    })
    
    // Mock queue status with proper number formatting
    const queueStatus: QueueStatus = {
      totalApproved: 47,
      totalPending: 156,
      totalPosted: 1248, // Properly formatted number without comma
      isHealthy: true,
      alertLevel: 'none',
      message: 'Queue is healthy with sufficient approved content'
    }
    
    // Mock statistics with proper number types
    const stats: ScheduleStats = {
      todaysPosts: todaysSchedule.filter(s => s.posted).length,
      thisWeeksPosts: 18,
      thisMonthsPosts: 89,
      totalPosts: 1248, // Properly formatted number
      avgPostsPerDay: parseFloat((5.8).toFixed(1)) // Ensure proper decimal formatting
    }
    
    const scheduleData = {
      config,
      schedule: {
        nextPostTime: createScheduledDate(nextMealTime, TIMEZONE),
        nextMealTime,
        timeUntilNext,
        isPostingTime,
        todaysSchedule
      },
      queueStatus,
      stats
    }

    return NextResponse.json(scheduleData, {
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

// Validation helper for time format
function validateTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  return timeRegex.test(time)
}

// Validation helper for timezone
function validateTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { meal_times, timezone, is_enabled } = body

    // Validate meal_times
    if (meal_times !== undefined) {
      if (!Array.isArray(meal_times)) {
        return NextResponse.json({
          error: 'meal_times must be an array'
        }, { status: 400 })
      }

      if (meal_times.length === 0 || meal_times.length > 24) {
        return NextResponse.json({
          error: 'meal_times must contain between 1 and 24 times'
        }, { status: 400 })
      }

      for (const time of meal_times) {
        if (typeof time !== 'string' || !validateTimeFormat(time)) {
          return NextResponse.json({
            error: `Invalid time format: "${time}". Use HH:MM format (e.g., "08:00", "23:30").`
          }, { status: 400 })
        }
      }

      // Check for duplicate times
      const uniqueTimes = new Set(meal_times)
      if (uniqueTimes.size !== meal_times.length) {
        return NextResponse.json({
          error: 'meal_times cannot contain duplicate times'
        }, { status: 400 })
      }
    }

    // Validate timezone
    if (timezone !== undefined) {
      if (typeof timezone !== 'string' || !validateTimezone(timezone)) {
        return NextResponse.json({
          error: `Invalid timezone: "${timezone}". Use valid IANA timezone identifiers (e.g., "America/New_York").`
        }, { status: 400 })
      }
    }

    // Validate is_enabled
    if (is_enabled !== undefined && typeof is_enabled !== 'boolean') {
      return NextResponse.json({
        error: 'is_enabled must be a boolean value'
      }, { status: 400 })
    }

    // Create properly typed updated configuration
    const updatedConfig: ScheduleConfig = {
      id: 1,
      meal_times: meal_times || ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30'],
      timezone: timezone || 'America/New_York',
      is_enabled: is_enabled !== undefined ? is_enabled : true,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('Schedule configuration updated via API (mock):', updatedConfig)

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      message: 'Schedule configuration updated successfully'
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error updating schedule configuration:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

// POST endpoint for manual trigger capability
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, time } = body

    if (action !== 'trigger_post') {
      return NextResponse.json({
        error: 'Invalid action. Only "trigger_post" is supported.'
      }, { status: 400 })
    }

    // Validate time if provided
    if (time && (!validateTimeFormat(time))) {
      return NextResponse.json({
        error: `Invalid time format: "${time}". Use HH:MM format.`
      }, { status: 400 })
    }

    // Mock manual trigger response
    const triggerTime = time || new Date().toLocaleTimeString('en-US', { 
      timeZone: 'America/New_York', 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    })

    console.log(`Manual post trigger initiated for time: ${triggerTime}`)

    return NextResponse.json({
      success: true,
      action: 'trigger_post',
      scheduledTime: triggerTime,
      message: `Manual post trigger scheduled for ${triggerTime}`,
      triggeredAt: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error triggering manual post:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}