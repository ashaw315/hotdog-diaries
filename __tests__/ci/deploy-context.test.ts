/**
 * @jest-environment node
 */

import * as fs from 'fs'
import * as path from 'path'
import { jest } from '@jest/globals'
import {
  extractGitHubDeploymentContext,
  queryVercelDeployment,
  shouldProceedWithChecks,
  setGitHubOutputs,
  writeJobSummary,
  type DeploymentContext,
  type VercelDeployment
} from '../../scripts/ci/lib/deploy-context'

// Mock fetch globally
global.fetch = jest.fn()

// Mock fs
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  appendFileSync: jest.fn()
}))

const mockFs = fs as jest.Mocked<typeof fs>

describe('deploy-context', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.GITHUB_EVENT_NAME
    delete process.env.GITHUB_EVENT_PATH
    delete process.env.GITHUB_SHA
    delete process.env.GITHUB_OUTPUT
    delete process.env.GITHUB_STEP_SUMMARY
    delete process.env.GITHUB_ACTIONS
    delete process.env.VERCEL_TOKEN
    delete process.env.VERCEL_PROJECT_ID
    delete process.env.VERCEL_TEAM_ID
  })

  describe('extractGitHubDeploymentContext', () => {
    it('should extract context from deployment_status event', () => {
      process.env.GITHUB_EVENT_NAME = 'deployment_status'
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json'
      process.env.GITHUB_SHA = 'abc123'

      const mockEvent = {
        deployment: {
          sha: 'def456',
          environment: 'production',
          description: 'Deploy to production'
        },
        deployment_status: {
          state: 'success',
          target_url: 'https://example.com',
          description: 'Deployment successful'
        }
      }

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockEvent))

      const result = extractGitHubDeploymentContext()

      expect(result).toEqual({
        state: 'success',
        url: 'https://example.com',
        commit: 'def456',
        reason: 'Deployment successful',
        environment: 'production'
      })
    })

    it('should handle deployment_status with missing URL (fallback chain)', () => {
      process.env.GITHUB_EVENT_NAME = 'deployment_status'
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json'

      const mockEvent = {
        deployment: {
          sha: 'abc123',
          payload: {
            web_url: 'https://fallback.com'
          }
        },
        deployment_status: {
          state: 'success',
          description: 'Success but no direct URL'
        }
      }

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockEvent))

      const result = extractGitHubDeploymentContext()

      expect(result).toEqual({
        state: 'success',
        url: 'https://fallback.com',
        commit: 'abc123',
        reason: 'Success but no direct URL',
        environment: undefined
      })
    })

    it('should extract context from push event', () => {
      process.env.GITHUB_EVENT_NAME = 'push'
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json'
      process.env.GITHUB_SHA = 'push123'

      mockFs.readFileSync.mockReturnValue('{}')

      const result = extractGitHubDeploymentContext()

      expect(result).toEqual({
        state: 'push',
        url: '',
        commit: 'push123',
        reason: 'Push event - will query Vercel API',
        environment: 'production'
      })
    })

    it('should return null for unsupported events', () => {
      process.env.GITHUB_EVENT_NAME = 'pull_request'
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json'

      mockFs.readFileSync.mockReturnValue('{}')

      const result = extractGitHubDeploymentContext()

      expect(result).toBeNull()
    })

    it('should handle malformed event JSON', () => {
      process.env.GITHUB_EVENT_NAME = 'deployment_status'
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json'

      mockFs.readFileSync.mockReturnValue('invalid json')

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = extractGitHubDeploymentContext()

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse GitHub event'),
        expect.any(String)
      )

      consoleSpy.mockRestore()
    })

    it('should return null when no event path is set', () => {
      const result = extractGitHubDeploymentContext()
      expect(result).toBeNull()
    })
  })

  describe('queryVercelDeployment', () => {
    const mockVercelDeployment = (overrides: Partial<VercelDeployment> = {}): VercelDeployment => ({
      uid: 'deployment-123',
      url: 'example-abc123.vercel.app',
      state: 'READY',
      readyState: 'READY',
      meta: {
        githubCommitSha: 'abc123'
      },
      target: 'production',
      ...overrides
    })

    beforeEach(() => {
      process.env.VERCEL_TOKEN = 'test-token'
      process.env.VERCEL_PROJECT_ID = 'test-project'
    })

    it('should query successful deployment', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          deployments: [mockVercelDeployment()]
        })
      } as Response)

      const result = await queryVercelDeployment('abc123')

      expect(result).toEqual({
        state: 'success',
        url: 'https://example-abc123.vercel.app',
        commit: 'abc123',
        reason: 'Vercel deployment ready',
        environment: 'production'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.vercel.com/v6/deployments'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
    })

    it('should handle failed deployment', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          deployments: [mockVercelDeployment({
            state: 'ERROR',
            readyState: 'ERROR',
            errorMessage: 'Build failed'
          })]
        })
      } as Response)

      const result = await queryVercelDeployment('abc123')

      expect(result).toEqual({
        state: 'failure',
        url: '',
        commit: 'abc123',
        reason: 'Build failed',
        environment: 'production'
      })
    })

    it('should wait for deployment in progress and timeout', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      // Mock multiple responses - building then timeout
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            deployments: [mockVercelDeployment({
              state: 'BUILDING',
              readyState: 'BUILDING'
            })]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            deployments: [mockVercelDeployment({
              state: 'BUILDING',
              readyState: 'BUILDING'
            })]
          })
        } as Response)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await queryVercelDeployment('abc123', {
        maxWaitMinutes: 0.01, // 0.6 seconds
        pollIntervalSeconds: 0.1 // 100ms
      })

      expect(result.state).toBe('timeout')
      expect(result.reason).toContain('Timeout waiting for deployment to complete')
      
      consoleSpy.mockRestore()
    })

    it('should wait for deployment and succeed when ready', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      // First call: building, second call: ready
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            deployments: [mockVercelDeployment({
              state: 'BUILDING',
              readyState: 'BUILDING'
            })]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            deployments: [mockVercelDeployment()]
          })
        } as Response)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await queryVercelDeployment('abc123', {
        maxWaitMinutes: 1,
        pollIntervalSeconds: 0.1
      })

      expect(result.state).toBe('success')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deployment building')
      )
      
      consoleSpy.mockRestore()
    })

    it('should handle no deployments found and timeout', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ deployments: [] })
      } as Response)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await queryVercelDeployment('abc123', {
        maxWaitMinutes: 0.01,
        pollIntervalSeconds: 0.1
      })

      expect(result.state).toBe('timeout')
      expect(result.reason).toContain('Timeout waiting')
      
      consoleSpy.mockRestore()
    })

    it('should handle Vercel API authentication error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response)

      await expect(queryVercelDeployment('abc123')).rejects.toThrow(
        'Vercel API authentication failed: 401 Unauthorized'
      )
    })

    it('should handle Vercel API access forbidden error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      } as Response)

      await expect(queryVercelDeployment('abc123')).rejects.toThrow(
        'Vercel API access forbidden: 403 Forbidden'
      )
    })

    it('should require VERCEL_TOKEN and VERCEL_PROJECT_ID', async () => {
      delete process.env.VERCEL_TOKEN

      await expect(queryVercelDeployment('abc123')).rejects.toThrow(
        'Missing required Vercel credentials'
      )
    })

    it('should include team ID in request when provided', async () => {
      process.env.VERCEL_TEAM_ID = 'team-123'
      
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deployments: [mockVercelDeployment()] })
      } as Response)

      await queryVercelDeployment('abc123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('teamId=team-123'),
        expect.any(Object)
      )
    })

    it('should handle network errors with retry', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ deployments: [mockVercelDeployment()] })
        } as Response)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await queryVercelDeployment('abc123', {
        maxWaitMinutes: 1,
        pollIntervalSeconds: 0.1
      })

      expect(result.state).toBe('success')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error querying Vercel API')
      )
      
      consoleSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })
  })

  describe('shouldProceedWithChecks', () => {
    it('should return true for successful deployment with URL', () => {
      const context: DeploymentContext = {
        state: 'success',
        url: 'https://example.com',
        commit: 'abc123',
        reason: 'Success'
      }

      expect(shouldProceedWithChecks(context)).toBe(true)
    })

    it('should return false for successful deployment without URL', () => {
      const context: DeploymentContext = {
        state: 'success',
        url: '',
        commit: 'abc123',
        reason: 'Success but no URL'
      }

      expect(shouldProceedWithChecks(context)).toBe(false)
    })

    it('should return false for failed deployment', () => {
      const context: DeploymentContext = {
        state: 'failure',
        url: 'https://example.com',
        commit: 'abc123',
        reason: 'Failed'
      }

      expect(shouldProceedWithChecks(context)).toBe(false)
    })

    it('should return false for in-progress deployment', () => {
      const context: DeploymentContext = {
        state: 'in_progress',
        url: '',
        commit: 'abc123',
        reason: 'Building'
      }

      expect(shouldProceedWithChecks(context)).toBe(false)
    })
  })

  describe('setGitHubOutputs', () => {
    it('should set GitHub outputs when GITHUB_OUTPUT is available', () => {
      process.env.GITHUB_OUTPUT = '/tmp/outputs'

      const context: DeploymentContext = {
        state: 'success',
        url: 'https://example.com',
        commit: 'abc123',
        reason: 'Success',
        environment: 'production'
      }

      setGitHubOutputs(context)

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/outputs',
        expect.stringContaining('state=success')
      )
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/outputs',
        expect.stringContaining('url=https://example.com')
      )
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/outputs',
        expect.stringContaining('proceed=true')
      )
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/outputs',
        expect.stringContaining('environment=production')
      )
    })

    it('should not write outputs when GITHUB_OUTPUT is not set', () => {
      const context: DeploymentContext = {
        state: 'success',
        url: 'https://example.com',
        commit: 'abc123',
        reason: 'Success'
      }

      setGitHubOutputs(context)

      expect(mockFs.appendFileSync).not.toHaveBeenCalled()
    })
  })

  describe('writeJobSummary', () => {
    it('should write success summary', () => {
      process.env.GITHUB_STEP_SUMMARY = '/tmp/summary'

      const context: DeploymentContext = {
        state: 'success',
        url: 'https://example.com',
        commit: 'abc123def',
        reason: 'Success',
        environment: 'production'
      }

      writeJobSummary(context)

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/summary',
        expect.stringContaining('✅ Deployment Context Analysis')
      )
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/summary',
        expect.stringContaining('abc123d')
      )
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/summary',
        expect.stringContaining('✅ Yes')
      )
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/summary',
        expect.stringContaining('Ready for Health Checks')
      )
    })

    it('should write failure summary', () => {
      process.env.GITHUB_STEP_SUMMARY = '/tmp/summary'

      const context: DeploymentContext = {
        state: 'failure',
        url: '',
        commit: 'abc123',
        reason: 'Build failed',
        environment: 'preview'
      }

      writeJobSummary(context)

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/summary',
        expect.stringContaining('❌ Deployment Context Analysis')
      )
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/summary',
        expect.stringContaining('⏸️ No')
      )
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/summary',
        expect.stringContaining('Next Steps')
      )
    })

    it('should not write summary when GITHUB_STEP_SUMMARY is not set', () => {
      const context: DeploymentContext = {
        state: 'success',
        url: 'https://example.com',
        commit: 'abc123',
        reason: 'Success'
      }

      writeJobSummary(context)

      expect(mockFs.appendFileSync).not.toHaveBeenCalled()
    })
  })
})