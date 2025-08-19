import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

interface BulkScheduleRequest {
  contentIds: number[]
  scheduleType: 'immediate' | 'next_meal' | 'distribute' | 'custom'
  customDateTime?: string
  distributionHours?: number // for distribute type
}

const MEAL_TIMES = [
  { hour: 7, minute: 0 },   // Breakfast
  { hour: 12, minute: 0 },  // Lunch  
  { hour: 15, minute: 0 },  // Afternoon snack
  { hour: 18, minute: 0 },  // Dinner
  { hour: 20, minute: 0 },  // Evening snack
  { hour: 22, minute: 0 }   // Late night
]

export async function POST(request: NextRequest) {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: BulkScheduleRequest = await request.json()
    const { contentIds, scheduleType, customDateTime, distributionHours = 24 } = body

    if (!contentIds || contentIds.length === 0) {
      return NextResponse.json({ error: 'Content IDs are required' }, { status: 400 })
    }

    // Verify all content items are approved
    const contentCheck = await db.query(
      'SELECT id, content_status FROM content_queue WHERE id = ANY($1)',
      [contentIds]
    )

    const nonApprovedContent = contentCheck.rows.filter(
      item => item.content_status !== 'approved'
    )

    if (nonApprovedContent.length > 0) {
      return NextResponse.json({ 
        error: 'All content must be approved before scheduling',
        nonApprovedIds: nonApprovedContent.map(item => item.id)
      }, { status: 400 })
    }

    let scheduledTimes: Date[] = []

    switch (scheduleType) {
      case 'immediate':
        // Schedule all for immediate posting (next 5 minutes)
        scheduledTimes = contentIds.map((_, index) => 
          new Date(Date.now() + (index * 2 * 60 * 1000)) // 2 minutes apart
        )
        break

      case 'next_meal':
        // Schedule for the next upcoming meal time
        const nextMealTime = getNextMealTime()
        scheduledTimes = contentIds.map((_, index) => 
          new Date(nextMealTime.getTime() + (index * 10 * 60 * 1000)) // 10 minutes apart
        )
        break

      case 'distribute':
        // Distribute evenly across the specified hours
        const startTime = new Date()
        const endTime = new Date(startTime.getTime() + distributionHours * 60 * 60 * 1000)
        const interval = (endTime.getTime() - startTime.getTime()) / contentIds.length
        
        scheduledTimes = contentIds.map((_, index) => 
          new Date(startTime.getTime() + (index * interval))
        )
        break

      case 'custom':
        if (!customDateTime) {
          return NextResponse.json({ error: 'Custom date time is required' }, { status: 400 })
        }
        const baseTime = new Date(customDateTime)
        scheduledTimes = contentIds.map((_, index) => 
          new Date(baseTime.getTime() + (index * 15 * 60 * 1000)) // 15 minutes apart
        )
        break

      default:
        return NextResponse.json({ error: 'Invalid schedule type' }, { status: 400 })
    }

    // Update all content items
    const updatePromises = contentIds.map(async (contentId, index) => {
      const scheduledFor = scheduledTimes[index]
      
      const result = await db.query(
        `UPDATE content_queue 
         SET content_status = 'scheduled', 
             scheduled_for = $1, 
             reviewed_by = $2, 
             reviewed_at = NOW(), 
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, scheduled_for`,
        [scheduledFor, authResult.user?.username, contentId]
      )

      return result.rows[0]
    })

    const scheduledContent = await Promise.all(updatePromises)

    // Log the bulk scheduling action
    await logToDatabase(
      LogLevel.INFO,
      'Bulk content scheduled',
      'AdminAPI',
      {
        scheduleType,
        contentCount: contentIds.length,
        distributionHours,
        customDateTime,
        user: authResult.user.username,
        scheduledTimes: scheduledTimes.map(t => t.toISOString())
      }
    )

    return NextResponse.json({
      success: true,
      scheduled: scheduledContent.length,
      scheduleType,
      content: scheduledContent.map((item, index) => ({
        id: item.id,
        scheduled_for: item.scheduled_for,
        scheduled_time: scheduledTimes[index].toISOString()
      }))
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to bulk schedule content',
      'AdminAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json(
      { error: 'Failed to schedule content' },
      { status: 500 }
    )
  }
}

function getNextMealTime(): Date {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  
  // Find the next meal time
  for (const mealTime of MEAL_TIMES) {
    if (currentHour < mealTime.hour || 
        (currentHour === mealTime.hour && currentMinute < mealTime.minute)) {
      const nextMeal = new Date(now)
      nextMeal.setHours(mealTime.hour, mealTime.minute, 0, 0)
      return nextMeal
    }
  }
  
  // If no meal time today, schedule for first meal time tomorrow
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(MEAL_TIMES[0].hour, MEAL_TIMES[0].minute, 0, 0)
  return tomorrow
}