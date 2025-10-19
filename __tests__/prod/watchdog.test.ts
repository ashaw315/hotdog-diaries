/**
 * Production Watchdog Tests
 */

import { checkActionsToday } from '../../scripts/prod/check-actions-today'
import { checkDBPosting } from '../../scripts/prod/check-db-posting'
import { probeUI } from '../../scripts/prod/probe-ui'
import { emitWatchdogReport } from '../../scripts/prod/emit-watchdog-report'
import * as fs from 'node:fs/promises'
import { execSync } from 'node:child_process'

// Mock external dependencies
jest.mock('node:child_process')
jest.mock('node:fs/promises')
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        gte: jest.fn(() => ({
          lte: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }))
}))

// Mock fetch
global.fetch = jest.fn()

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>
const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>
const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>
const mockMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>
const mockFetch = global.fetch as jest.Mock

describe('Production Watchdog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
    
    // Set required env vars
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    process.env.PROD_BASE_URL = 'https://test.hotdogdiaries.com'
  })

  describe('check-actions-today', () => {
    it('should detect missing workflow executions', async () => {
      // Mock gh api response with no runs
      mockExecSync.mockReturnValue('[]')
      
      // Mock process.exit to capture exit code
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
        throw new Error(`Process.exit called with code: ${code}`)
      })

      try {
        await checkActionsToday()
      } catch (error: any) {
        expect(error.message).toContain('Process.exit called with code: 1')
      }

      mockExit.mockRestore()
    })

    it('should pass when workflows executed successfully', async () => {
      // Mock gh api response with successful runs
      const mockRuns = JSON.stringify([
        {
          id: 1,
          name: 'Post Breakfast',
          status: 'completed',
          conclusion: 'success',
          created_at: new Date().toISOString(),
          html_url: 'https://github.com/test/runs/1'
        }
      ])
      
      mockExecSync.mockReturnValue(mockRuns)
      
      // Should not throw
      await expect(checkActionsToday()).resolves.not.toThrow()
    })
  })

  describe('probe-ui', () => {
    it('should detect endpoint failures', async () => {
      // Mock failed fetch
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
        throw new Error(`Process.exit called with code: ${code}`)
      })

      try {
        await probeUI()
      } catch (error: any) {
        expect(error.message).toContain('Process.exit called with code: 1')
      }

      mockExit.mockRestore()
    })

    it('should pass when all endpoints are healthy', async () => {
      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ ok: true })
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ ok: true })
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          headers: new Map([['content-type', 'text/html']]),
          text: async () => '<html>Dashboard</html>'
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          headers: new Map([['content-type', 'text/html']]),
          text: async () => '<html>Hotdog Diaries</html>'
        } as any)
      
      await expect(probeUI()).resolves.not.toThrow()
    })
  })

  describe('emit-watchdog-report', () => {
    it('should generate RED report for critical failures', async () => {
      // Mock reading JSON files with failures
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify({
          slots: [
            { slot: 'breakfast', status: 'MISSING_EXECUTION', timeET: '08:00' }
          ]
        }))
        .mockResolvedValueOnce(JSON.stringify({
          flags: { SCHEDULE_TODAY_OK: false },
          scheduleTodayCount: 3
        }))
        .mockResolvedValueOnce(JSON.stringify({
          overallOk: false,
          probes: []
        }))
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
        throw new Error(`Process.exit called with code: ${code}`)
      })

      // Mock fs.existsSync
      jest.spyOn(require('node:fs'), 'existsSync').mockReturnValue(true)

      try {
        await emitWatchdogReport()
      } catch (error: any) {
        expect(error.message).toContain('Process.exit called with code: 1')
      }

      // Verify report was written
      expect(mockWriteFile).toHaveBeenCalledWith(
        'ci_audit/watchdog/PROD_WATCHDOG_REPORT.md',
        expect.stringContaining('RED')
      )

      mockExit.mockRestore()
    })

    it('should generate GREEN report when everything is healthy', async () => {
      // Mock reading JSON files with all healthy
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify({
          slots: [
            { slot: 'breakfast', status: 'EXECUTED_SUCCESS', timeET: '08:00' }
          ]
        }))
        .mockResolvedValueOnce(JSON.stringify({
          flags: { SCHEDULE_TODAY_OK: true, SCHEDULE_TOMORROW_OK: true },
          scheduleTodayCount: 6,
          scheduleTomorrowCount: 6
        }))
        .mockResolvedValueOnce(JSON.stringify({
          overallOk: true,
          probes: [{ ok: true }]
        }))
      
      jest.spyOn(require('node:fs'), 'existsSync').mockReturnValue(true)

      await expect(emitWatchdogReport()).resolves.not.toThrow()

      // Verify report was written
      expect(mockWriteFile).toHaveBeenCalledWith(
        'ci_audit/watchdog/PROD_WATCHDOG_REPORT.md',
        expect.stringContaining('GREEN')
      )
    })
  })

  describe('report generation', () => {
    it('should include actionable next steps for failures', async () => {
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify({
          slots: [
            { slot: 'lunch', status: 'MISSING_EXECUTION', timeET: '12:00', isPast: true }
          ]
        }))
        .mockResolvedValueOnce(JSON.stringify({
          flags: { SCHEDULE_TODAY_OK: false },
          scheduleTodayCount: 2
        }))
        .mockResolvedValueOnce(JSON.stringify({
          overallOk: true,
          probes: []
        }))
      
      jest.spyOn(require('node:fs'), 'existsSync').mockReturnValue(true)
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
        throw new Error(`Process.exit called with code: ${code}`)
      })

      try {
        await emitWatchdogReport()
      } catch (error) {
        // Expected to exit with 1
      }

      // Verify report includes remediation commands
      expect(mockWriteFile).toHaveBeenCalledWith(
        'ci_audit/watchdog/PROD_WATCHDOG_REPORT.md',
        expect.stringContaining('gh workflow run')
      )

      mockExit.mockRestore()
    })
  })
})