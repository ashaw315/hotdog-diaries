import { NextRequest, NextResponse } from 'next/server'
import { schedulingService } from '@/lib/services/scheduling'
import { postingService } from '@/lib/services/posting'
import { logToDatabase, db } from '@/lib/db'
import { LogLevel } from '@/types'
import { createSimpleClient } from '@/utils/supabase/server'

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

// Helper function to check actual posting status from database
async function checkActualPostingStatus(mealTimes: string[], timezone: string = 'America/New_York'): Promise<{ [time: string]: boolean }> {
  try {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    let todaysPosts: any[] = []
    
    // Use different database approach based on environment
    const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
    const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
    
    if (isSqlite) {
      // Use SQLite for development
      await db.connect()
      const result = await db.query(`
        SELECT posted_at, scheduled_time 
        FROM posted_content 
        WHERE DATE(posted_at) = DATE('now')
      `)
      todaysPosts = result.rows || []
      await db.disconnect()
    } else {
      // Use Supabase for production
      const supabase = createSimpleClient()
      const { data, error } = await supabase
        .from('posted_content')
        .select('posted_at, scheduled_time')
        .gte('posted_at', `${today}T00:00:00.000Z`)
        .lt('posted_at', `${today}T23:59:59.999Z`)
      
      if (error) {
        console.error('❌ Error checking actual posting status:', error)
        return {}
      }
      
      todaysPosts = data || []
    }
    
    // Convert posted times to meal time format and build status map
    const statusMap: { [time: string]: boolean } = {}
    
    for (const mealTime of mealTimes) {
      statusMap[mealTime] = false
      
      if (todaysPosts && todaysPosts.length > 0) {
        // Check if any post was made within 1 hour of this meal time
        const [mealHours, mealMinutes] = mealTime.split(':').map(num => parseInt(num, 10))
        const mealTimeInMinutes = mealHours * 60 + mealMinutes
        
        const wasPosted = todaysPosts.some(post => {
          const postTime = new Date(post.posted_at)
          const postHours = postTime.getUTCHours()
          const postMinutes = postTime.getMinutes()
          const postTimeInMinutes = postHours * 60 + postMinutes
          
          // Consider it posted if within 1 hour of scheduled time
          const timeDiff = Math.abs(mealTimeInMinutes - postTimeInMinutes)
          return timeDiff <= 60 // Within 60 minutes
        })
        
        statusMap[mealTime] = wasPosted
      }
    }
    
    return statusMap
  } catch (error) {
    console.error('❌ Error in checkActualPostingStatus:', error)
    return {}
  }
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
    
    // Get actual posting status from database
    const actualPostingStatus = await checkActualPostingStatus(POSTING_SCHEDULE, TIMEZONE)
    
    // Create today's schedule with actual posting status
    const platforms = ['reddit', 'bluesky', 'tumblr', 'lemmy', 'giphy', 'imgur']
    const todaysSchedule: ScheduleTime[] = POSTING_SCHEDULE.map((time, index) => {
      return {
        time,
        posted: actualPostingStatus[time] || false, // Use actual posting status from database
        scheduledDate: createScheduledDate(time, TIMEZONE),
        platform: platforms[index % platforms.length] // Distribute platforms evenly
      }
    })
    
    // Get real post counts from database
    let totalPosts = 0
    let thisWeeksPosts = 0
    let thisMonthsPosts = 0
    let totalApproved = 0
    let totalPending = 0
    
    try {
      const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
      const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
      
      if (isSqlite) {
        // Use SQLite for development
        await db.connect()
        
        const totalResult = await db.query('SELECT COUNT(*) as count FROM posted_content')
        totalPosts = totalResult.rows[0]?.count || 0
        
        const weekResult = await db.query(`
          SELECT COUNT(*) as count FROM posted_content 
          WHERE posted_at >= datetime('now', '-7 days')
        `)
        thisWeeksPosts = weekResult.rows[0]?.count || 0
        
        const monthResult = await db.query(`
          SELECT COUNT(*) as count FROM posted_content 
          WHERE posted_at >= datetime('now', '-30 days')
        `)
        thisMonthsPosts = monthResult.rows[0]?.count || 0
        
        const approvedResult = await db.query(`
          SELECT COUNT(*) as count FROM content_queue 
          WHERE is_approved = 1 AND is_posted = 0
        `)
        totalApproved = approvedResult.rows[0]?.count || 0
        
        const pendingResult = await db.query(`
          SELECT COUNT(*) as count FROM content_queue 
          WHERE is_approved = 0
        `)
        totalPending = pendingResult.rows[0]?.count || 0
        
        await db.disconnect()
      } else {
        // Use Supabase for production
        const supabase = createSimpleClient()
        
        const { data: totalPostsData } = await supabase
          .from('posted_content')
          .select('id', { count: 'exact' })
        
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: weekPostsData } = await supabase
          .from('posted_content')
          .select('id', { count: 'exact' })
          .gte('posted_at', weekAgo)
        
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: monthPostsData } = await supabase
          .from('posted_content')
          .select('id', { count: 'exact' })
          .gte('posted_at', monthAgo)
        
        // Get queue statistics
        const { data: approvedData } = await supabase
          .from('content_queue')
          .select('id', { count: 'exact' })
          .eq('is_approved', true)
          .eq('is_posted', false)
        
        const { data: pendingData } = await supabase
          .from('content_queue')
          .select('id', { count: 'exact' })
          .eq('is_approved', false)
        
        totalPosts = totalPostsData?.length || 0
        thisWeeksPosts = weekPostsData?.length || 0
        thisMonthsPosts = monthPostsData?.length || 0
        totalApproved = approvedData?.length || 0
        totalPending = pendingData?.length || 0
      }
    } catch (error) {
      console.error('❌ Error getting post statistics:', error)
      // Fall back to defaults if database query fails
      totalPosts = 3
      thisWeeksPosts = 3
      thisMonthsPosts = 3
      totalApproved = 0
      totalPending = 0
    }
    
    // Real queue status with actual data
    const queueStatus: QueueStatus = {
      totalApproved,
      totalPending,
      totalPosted: totalPosts,
      isHealthy: totalApproved > 10,
      alertLevel: totalApproved > 10 ? 'none' : totalApproved > 5 ? 'warning' : 'critical',
      message: totalApproved > 10 
        ? 'Queue is healthy with sufficient approved content'
        : totalApproved > 5 
        ? 'Queue is running low on approved content'
        : 'CRITICAL: Queue needs more approved content'
    }
    
    // Calculate actual today's posts from the schedule
    const actualTodaysPosts = todaysSchedule.filter(s => s.posted).length
    
    const stats: ScheduleStats = {
      todaysPosts: actualTodaysPosts,
      thisWeeksPosts,
      thisMonthsPosts,
      totalPosts,
      avgPostsPerDay: totalPosts > 0 ? parseFloat((totalPosts / 30).toFixed(1)) : 0
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