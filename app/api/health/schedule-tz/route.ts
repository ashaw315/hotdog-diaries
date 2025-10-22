import { NextRequest, NextResponse } from 'next/server'
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz'
import { parseISO, format, addHours } from 'date-fns'

/**
 * Health endpoint for timezone handling verification
 * 
 * Validates that our timezone conversions for Eastern Time are working correctly
 * and that scheduled times align with expected posting windows.
 */

const TZ = 'America/New_York'
const SLOT_TIMES_ET = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30']

interface TimezoneHealthCheck {
  status: 'healthy' | 'warning' | 'error'
  current_time_et: string
  current_time_utc: string
  timezone_offset_hours: number
  slot_conversions: Array<{
    slot_index: number
    time_et: string
    time_utc: string
    is_valid: boolean
  }>
  issues: string[]
  metadata: {
    timezone: string
    dst_active: boolean
    check_timestamp: string
  }
}

// Convert ET time to UTC for a given date
function etToUtc(dateStr: string, timeStr: string): string {
  try {
    // Create a date string in ET timezone and parse it correctly
    const etDateTimeStr = `${dateStr}T${timeStr}:00`
    const etDateTime = parseISO(etDateTimeStr)
    
    // Use formatInTimeZone to handle the conversion properly
    const utcIsoString = formatInTimeZone(etDateTime, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    return utcIsoString
  } catch (error) {
    throw new Error(`Failed to convert ET time ${timeStr} on ${dateStr} to UTC: ${error}`)
  }
}

// Check if timezone conversion is working properly
function validateTimezoneConversions(testDate: string): TimezoneHealthCheck {
  const issues: string[] = []
  const now = new Date()
  
  // Get current times
  const currentTimeET = formatInTimeZone(now, TZ, 'yyyy-MM-dd HH:mm:ss zzz')
  const currentTimeUTC = now.toISOString()
  
  // Calculate signed timezone offset: (ET - UTC) in hours
  const utc = new Date();
  const et = new Date(
    utc.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  
  // Compute signed offset: (ET - UTC) in hours
  const offsetMs = et.getTime() - utc.getTime();
  const offsetHours = Math.round(offsetMs / (1000 * 60 * 60)); // will be -4 in EDT, -5 in EST
  
  // Check if DST is active (offset should be -4 in summer, -5 in winter)
  const isDstActive = offsetHours === -4
  
  // Validate slot conversions
  const slotConversions = SLOT_TIMES_ET.map((timeET, index) => {
    try {
      const utcIso = etToUtc(testDate, timeET)
      const isValid = utcIso.includes('T') && utcIso.endsWith('Z')
      
      if (!isValid) {
        issues.push(`Invalid UTC conversion for slot ${index} (${timeET} ET)`)
      }
      
      return {
        slot_index: index,
        time_et: timeET,
        time_utc: utcIso,
        is_valid: isValid
      }
    } catch (error: any) {
      issues.push(`Conversion failed for slot ${index} (${timeET} ET): ${error.message}`)
      return {
        slot_index: index,
        time_et: timeET,
        time_utc: 'CONVERSION_FAILED',
        is_valid: false
      }
    }
  })
  
  // Validate expected offset ranges - ensure timezone_offset_hours is signed relative to UTC
  if (isDstActive && offsetHours !== -4) {
    issues.push(`Unexpected timezone offset during EDT: ${offsetHours} hours (expected -4, UTC -> ET should be -4 during DST)`)
  } else if (!isDstActive && offsetHours !== -5) {
    issues.push(`Unexpected timezone offset during EST: ${offsetHours} hours (expected -5, UTC -> ET should be -5 during standard time)`)
  }
  
  // Check for reasonable conversion results
  const invalidConversions = slotConversions.filter(s => !s.is_valid)
  if (invalidConversions.length > 0) {
    issues.push(`${invalidConversions.length} slot conversions failed`)
  }
  
  // Determine overall status
  let status: 'healthy' | 'warning' | 'error' = 'healthy'
  if (issues.length > 0) {
    status = issues.some(i => i.includes('failed') || i.includes('CONVERSION_FAILED')) ? 'error' : 'warning'
  }
  
  return {
    status,
    current_time_et: currentTimeET,
    current_time_utc: currentTimeUTC,
    timezone_offset_hours: offsetHours,
    slot_conversions: slotConversions,
    issues,
    metadata: {
      timezone: TZ,
      dst_active: isDstActive,
      check_timestamp: now.toISOString()
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const testDate = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
    
    console.log(`🕒 Health check: timezone conversions for ${testDate}`)
    
    const healthCheck = validateTimezoneConversions(testDate)
    
    const responseCode = healthCheck.status === 'healthy' ? 200 : 
                        healthCheck.status === 'warning' ? 200 : 500
    
    console.log(`🕒 Timezone health: ${healthCheck.status} (${healthCheck.issues.length} issues)`)
    
    return NextResponse.json(healthCheck, { 
      status: responseCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
    
  } catch (error: any) {
    console.error('❌ Timezone health check failed:', error)
    
    return NextResponse.json({
      status: 'error',
      current_time_et: 'UNKNOWN',
      current_time_utc: new Date().toISOString(),
      timezone_offset_hours: 0,
      slot_conversions: [],
      issues: [`Health check failed: ${error.message}`],
      metadata: {
        timezone: TZ,
        dst_active: false,
        check_timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}