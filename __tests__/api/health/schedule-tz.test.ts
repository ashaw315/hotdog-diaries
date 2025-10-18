/**
 * Tests for Schedule Timezone Health Endpoint
 * 
 * Validates timezone conversion logic and DST handling.
 */

import { GET } from '../../../app/api/health/schedule-tz/route'
import { NextRequest } from 'next/server'

// Mock date-fns-tz functions
jest.mock('date-fns-tz', () => ({
  formatInTimeZone: jest.fn(),
  zonedTimeToUtc: jest.fn()
}))

import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz'

const mockFormatInTimeZone = formatInTimeZone as jest.MockedFunction<typeof formatInTimeZone>
const mockZonedTimeToUtc = zonedTimeToUtc as jest.MockedFunction<typeof zonedTimeToUtc>

describe('/api/health/schedule-tz', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mock returns
    mockFormatInTimeZone.mockReturnValue('2025-01-15 10:30:00 EST')
    mockZonedTimeToUtc.mockReturnValue(new Date('2025-01-15T15:30:00.000Z'))
  })

  const createRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3000/api/health/schedule-tz')
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
    
    return new NextRequest(url)
  }

  describe('successful health checks', () => {
    it('should return healthy status when all conversions succeed', async () => {
      const request = createRequest({ date: '2025-01-15' })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.current_time_et).toBe('2025-01-15 10:30:00 EST')
      expect(data.timezone_offset_hours).toBeDefined()
      expect(data.slot_conversions).toHaveLength(6) // 6 daily slots
      expect(data.issues).toHaveLength(0)
      expect(data.metadata.timezone).toBe('America/New_York')
    })

    it('should validate all 6 time slots correctly', async () => {
      const request = createRequest({ date: '2025-06-15' }) // Summer date
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.slot_conversions).toHaveLength(6)
      
      const expectedSlots = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30']
      data.slot_conversions.forEach((slot: any, index: number) => {
        expect(slot.slot_index).toBe(index)
        expect(slot.time_et).toBe(expectedSlots[index])
        expect(slot.time_utc).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
        expect(slot.is_valid).toBe(true)
      })
    })

    it('should detect DST correctly for summer dates', async () => {
      // Mock summer timezone offset (EDT = UTC-4)
      const summerDate = new Date('2025-07-15T10:00:00Z')
      jest.spyOn(Date, 'now').mockReturnValue(summerDate.getTime())
      
      mockFormatInTimeZone
        .mockReturnValueOnce('2025-07-15 06:00:00 EDT') // ET time
        .mockReturnValueOnce('2025-07-15 10:00:00') // UTC time
      
      const request = createRequest({ date: '2025-07-15' })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.metadata.dst_active).toBe(true)
      expect(Math.abs(data.timezone_offset_hours - (-4))).toBeLessThan(0.5)
    })

    it('should detect standard time correctly for winter dates', async () => {
      // Mock winter timezone offset (EST = UTC-5)  
      const winterDate = new Date('2025-01-15T10:00:00Z')
      jest.spyOn(Date, 'now').mockReturnValue(winterDate.getTime())
      
      mockFormatInTimeZone
        .mockReturnValueOnce('2025-01-15 05:00:00 EST') // ET time
        .mockReturnValueOnce('2025-01-15 10:00:00') // UTC time
      
      const request = createRequest({ date: '2025-01-15' })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.metadata.dst_active).toBe(false)
      expect(Math.abs(data.timezone_offset_hours - (-5))).toBeLessThan(0.5)
    })
  })

  describe('error handling', () => {
    it('should return warning status when some conversions fail', async () => {
      // Mock conversion failure for one slot
      mockZonedTimeToUtc
        .mockReturnValueOnce(new Date('2025-01-15T13:00:00.000Z')) // 08:00 ET -> UTC
        .mockImplementationOnce(() => { throw new Error('Conversion failed') }) // 12:00 ET fails
        .mockReturnValueOnce(new Date('2025-01-15T20:00:00.000Z')) // 15:00 ET -> UTC
        .mockReturnValueOnce(new Date('2025-01-15T23:00:00.000Z')) // 18:00 ET -> UTC
        .mockReturnValueOnce(new Date('2025-01-16T02:00:00.000Z')) // 21:00 ET -> UTC
        .mockReturnValueOnce(new Date('2025-01-16T04:30:00.000Z')) // 23:30 ET -> UTC
      
      const request = createRequest({ date: '2025-01-15' })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200) // Still returns 200 for warnings
      expect(data.status).toBe('error') // But status indicates error
      expect(data.issues).toContain(expect.stringContaining('Conversion failed for slot 1'))
      
      // Check that failed slot has proper error state
      const failedSlot = data.slot_conversions.find((s: any) => s.slot_index === 1)
      expect(failedSlot.is_valid).toBe(false)
      expect(failedSlot.time_utc).toBe('CONVERSION_FAILED')
    })

    it('should return error status for unexpected timezone offset', async () => {
      // Mock completely wrong timezone offset
      const testDate = new Date('2025-01-15T10:00:00Z')
      jest.spyOn(Date, 'now').mockReturnValue(testDate.getTime())
      
      mockFormatInTimeZone
        .mockReturnValueOnce('2025-01-15 02:00:00 PST') // Wrong timezone  
        .mockReturnValueOnce('2025-01-15 10:00:00') // UTC time
      
      const request = createRequest({ date: '2025-01-15' })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.status).toBe('error')
      expect(data.issues).toContain(expect.stringContaining('Unexpected timezone offset'))
    })

    it('should handle complete endpoint failure gracefully', async () => {
      // Mock critical failure
      mockFormatInTimeZone.mockImplementation(() => {
        throw new Error('Critical timezone failure')
      })
      
      const request = createRequest()
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.status).toBe('error')
      expect(data.issues).toContain('Health check failed: Critical timezone failure')
      expect(data.current_time_et).toBe('UNKNOWN')
    })
  })

  describe('configuration and defaults', () => {
    it('should use current date when no date parameter provided', async () => {
      const request = createRequest() // No date param
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.slot_conversions).toHaveLength(6)
      // Should work with today's date
    })

    it('should set proper cache headers', async () => {
      const request = createRequest()
      
      const response = await GET(request)
      
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
      expect(response.headers.get('Pragma')).toBe('no-cache')
    })

    it('should include proper metadata in response', async () => {
      const request = createRequest({ date: '2025-03-15' })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(data.metadata).toEqual({
        timezone: 'America/New_York',
        dst_active: expect.any(Boolean),
        check_timestamp: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
      })
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
})