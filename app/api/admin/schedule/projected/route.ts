import { NextRequest, NextResponse } from 'next/server'
import { parseISO, format, setHours, setMinutes, setSeconds, addHours } from 'date-fns'

// Default daily posting slots in Eastern Time (hours in 24-hour format)
const DAILY_SLOTS = [8, 12, 15, 18, 21, 23.5] // 8:00 AM, 12:00 PM, 3:00 PM, 6:00 PM, 9:00 PM, 11:30 PM

interface ProjectedSlot {
  time: string        // Display time (e.g., "08:00 AM")
  iso: string         // ISO timestamp
  status: 'pending'   // All projected slots start as pending
  hour: number        // Hour for sorting/identification
}

interface ProjectedScheduleResponse {
  date: string
  projected_schedule: ProjectedSlot[]
  timezone: string
  total_slots: number
}

// Timezone utility function (using fallback approach like in daily route)
const toEastern = (date: Date) => {
  // Temporary fallback: Eastern Time is UTC-4 (EDT)
  return addHours(date, -4)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const timezone = 'America/New_York'
    
    // Parse target date or default to today
    let targetDate: Date
    try {
      if (dateParam) {
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
          return NextResponse.json({
            error: 'Invalid date format. Use YYYY-MM-DD format.'
          }, { status: 400 })
        }
        targetDate = parseISO(dateParam)
      } else {
        targetDate = new Date()
      }
    } catch (error) {
      return NextResponse.json({
        error: 'Invalid date provided. Use YYYY-MM-DD format.'
      }, { status: 400 })
    }
    
    // Convert to Eastern Time for slot generation
    const easternDate = toEastern(targetDate)
    
    // Generate projected time slots for the day
    const projectedSlots: ProjectedSlot[] = DAILY_SLOTS.map((hour) => {
      const h = Math.floor(hour)
      const m = Math.round((hour - h) * 60)
      
      // Create slot time in Eastern timezone
      const slotTime = setSeconds(setMinutes(setHours(easternDate, h), m), 0)
      
      return {
        time: format(slotTime, 'hh:mm a'),      // "08:00 AM"
        iso: slotTime.toISOString(),           // ISO timestamp
        status: 'pending' as const,            // All projected slots start as pending
        hour: hour                             // Original hour for reference
      }
    })
    
    // Sort by time (already in order but ensure consistency)
    projectedSlots.sort((a, b) => a.hour - b.hour)
    
    const response: ProjectedScheduleResponse = {
      date: format(targetDate, 'yyyy-MM-dd'),
      projected_schedule: projectedSlots,
      timezone: timezone,
      total_slots: projectedSlots.length
    }
    
    console.log('📅 Projected Schedule Generated:', {
      date: response.date,
      slots: projectedSlots.length,
      times: projectedSlots.map(s => s.time)
    })
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('Error in projected schedule API:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}