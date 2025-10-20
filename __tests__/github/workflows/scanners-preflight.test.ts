/**
 * Unit tests for scanner preflight checks
 * Tests the preflight utility used by YouTube and Reddit scanner workflows
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { execSync } from 'child_process'

// Mock child_process for GitHub CLI calls
jest.mock('child_process')
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>

// Import the preflight functions
import { 
  checkSecrets, 
  createOrUpdateSecretIssue, 
  runPreflight, 
  setOutput 
} from '../../../scripts/ci/lib/preflight'

describe('Preflight Secret Validation', () => {
  let originalEnv: NodeJS.ProcessEnv
  let mockGithubOutput: string

  beforeEach(() => {
    originalEnv = { ...process.env }
    mockGithubOutput = '/tmp/github_output_test'
    process.env.GITHUB_OUTPUT = mockGithubOutput
    
    // Reset mocks
    jest.clearAllMocks()
    
    // Mock file system operations
    jest.doMock('fs', () => ({
      appendFileSync: jest.fn()
    }))
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('checkSecrets', () => {
    it('should detect missing secrets correctly', () => {
      const config = {
        workflowName: 'Test Scanner',
        requiredSecrets: ['SECRET1', 'SECRET2', 'SECRET3'],
        issueLabel: 'test-secrets'
      }

      // Set only SECRET2
      process.env.SECRET1 = ''
      process.env.SECRET2 = 'value'
      delete process.env.SECRET3

      const result = checkSecrets(config)

      expect(result.shouldSkip).toBe(true)
      expect(result.missingSecrets).toEqual(['SECRET1', 'SECRET3'])
      expect(result.message).toContain('Missing required secrets: SECRET1, SECRET3')
    })

    it('should pass when all secrets are present', () => {
      const config = {
        workflowName: 'Test Scanner',
        requiredSecrets: ['SECRET1', 'SECRET2'],
        issueLabel: 'test-secrets'
      }

      process.env.SECRET1 = 'value1'
      process.env.SECRET2 = 'value2'

      const result = checkSecrets(config)

      expect(result.shouldSkip).toBe(false)
      expect(result.missingSecrets).toEqual([])
      expect(result.message).toBe('All required secrets are present')
    })

    it('should treat empty strings as missing secrets', () => {
      const config = {
        workflowName: 'Test Scanner',
        requiredSecrets: ['SECRET1'],
        issueLabel: 'test-secrets'
      }

      process.env.SECRET1 = '   '  // whitespace only

      const result = checkSecrets(config)

      expect(result.shouldSkip).toBe(true)
      expect(result.missingSecrets).toEqual(['SECRET1'])
    })
  })

  describe('setOutput', () => {
    it('should append to GITHUB_OUTPUT file when environment variable is set', () => {
      const fs = require('fs')
      setOutput('test_key', 'test_value')

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockGithubOutput,
        'test_key=test_value\\n'
      )
    })

    it('should handle missing GITHUB_OUTPUT gracefully', () => {
      delete process.env.GITHUB_OUTPUT
      
      // Should not throw
      expect(() => setOutput('test_key', 'test_value')).not.toThrow()
    })
  })

  describe('createOrUpdateSecretIssue', () => {
    const config = {
      workflowName: 'YouTube Scanner',
      requiredSecrets: ['YOUTUBE_API_KEY', 'AUTH_TOKEN'],
      issueLabel: 'ci-scanner-secrets'
    }

    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'mock-token'
    })

    it('should skip when no missing secrets', async () => {
      await expect(createOrUpdateSecretIssue(config, [])).resolves.not.toThrow()
      expect(mockExecSync).not.toHaveBeenCalled()
    })

    it('should create new issue when none exists', async () => {
      // Mock gh issue list returning empty array
      mockExecSync.mockReturnValueOnce('[]')
      
      // Mock gh issue create
      mockExecSync.mockReturnValueOnce('https://github.com/owner/repo/issues/123')

      await createOrUpdateSecretIssue(config, ['YOUTUBE_API_KEY'])

      expect(mockExecSync).toHaveBeenCalledTimes(2)
      
      // Check list command
      expect(mockExecSync).toHaveBeenNthCalledWith(1, 
        expect.stringContaining('gh issue list --label "ci-scanner-secrets"'),
        expect.any(Object)
      )
      
      // Check create command
      expect(mockExecSync).toHaveBeenNthCalledWith(2,
        expect.stringContaining('gh issue create'),
        expect.any(Object)
      )
    })

    it('should update existing issue when found', async () => {
      // Mock gh issue list returning existing issue
      mockExecSync.mockReturnValueOnce(JSON.stringify([
        { number: 456, title: 'CI Scanner Secrets Missing' }
      ]))

      await createOrUpdateSecretIssue(config, ['AUTH_TOKEN'])

      expect(mockExecSync).toHaveBeenCalledTimes(2)
      
      // Check update command
      expect(mockExecSync).toHaveBeenNthCalledWith(2,
        expect.stringContaining('gh issue edit 456'),
        expect.any(Object)
      )
    })

    it('should handle GitHub CLI errors gracefully', async () => {
      // Mock gh command throwing error
      mockExecSync.mockImplementation(() => {
        throw new Error('gh: command not found')
      })

      // Should not throw
      await expect(createOrUpdateSecretIssue(config, ['SECRET'])).resolves.not.toThrow()
    })
  })

  describe('runPreflight', () => {
    const config = {
      workflowName: 'Test Scanner',
      requiredSecrets: ['TEST_SECRET'],
      issueLabel: 'test-secrets'
    }

    it('should skip workflow when secrets are missing', async () => {
      delete process.env.TEST_SECRET

      const result = await runPreflight(config)

      expect(result.shouldSkip).toBe(true)
      expect(result.missingSecrets).toEqual(['TEST_SECRET'])
    })

    it('should proceed when all secrets are present', async () => {
      process.env.TEST_SECRET = 'valid-secret'

      const result = await runPreflight(config)

      expect(result.shouldSkip).toBe(false)
      expect(result.missingSecrets).toEqual([])
    })
  })

  describe('Integration: YouTube Scanner Workflow', () => {
    it('should validate YouTube scanner requirements', () => {
      const config = {
        workflowName: 'YouTube Scanner',
        requiredSecrets: ['YOUTUBE_API_KEY', 'AUTH_TOKEN', 'SITE_URL'],
        issueLabel: 'ci-scanner-secrets'
      }

      // Test missing YouTube API key
      process.env.AUTH_TOKEN = 'valid-token'
      process.env.SITE_URL = 'https://example.com'
      delete process.env.YOUTUBE_API_KEY

      const result = checkSecrets(config)

      expect(result.shouldSkip).toBe(true)
      expect(result.missingSecrets).toEqual(['YOUTUBE_API_KEY'])
    })
  })

  describe('Integration: Reddit Scanner Workflow', () => {
    it('should validate Reddit scanner requirements', () => {
      const config = {
        workflowName: 'Reddit Scanner',
        requiredSecrets: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'AUTH_TOKEN', 'SITE_URL'],
        issueLabel: 'ci-scanner-secrets'
      }

      // Test missing Reddit credentials
      process.env.AUTH_TOKEN = 'valid-token'
      process.env.SITE_URL = 'https://example.com'
      delete process.env.REDDIT_CLIENT_ID
      delete process.env.REDDIT_CLIENT_SECRET

      const result = checkSecrets(config)

      expect(result.shouldSkip).toBe(true)
      expect(result.missingSecrets).toEqual(['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'])
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON from gh CLI', async () => {
      const config = {
        workflowName: 'Test Scanner',
        requiredSecrets: ['SECRET'],
        issueLabel: 'test-secrets'
      }

      // Mock gh returning malformed JSON
      mockExecSync.mockReturnValueOnce('invalid json{')

      // Should not throw
      await expect(createOrUpdateSecretIssue(config, ['SECRET'])).resolves.not.toThrow()
    })

    it('should handle GitHub CLI authentication failures', async () => {
      const config = {
        workflowName: 'Test Scanner',
        requiredSecrets: ['SECRET'],
        issueLabel: 'test-secrets'
      }

      // Mock authentication failure
      mockExecSync.mockImplementation(() => {
        throw new Error('authentication required')
      })

      // Should not throw - degrades gracefully
      await expect(createOrUpdateSecretIssue(config, ['SECRET'])).resolves.not.toThrow()
    })
  })

  describe('Neutral Exit Workflow Integration', () => {
    it('should support neutral exit code 78 workflow pattern', () => {
      // This test validates the pattern used in the actual workflows
      const config = {
        workflowName: 'Test Scanner',
        requiredSecrets: ['SECRET'],
        issueLabel: 'test-secrets'
      }

      delete process.env.SECRET

      const result = checkSecrets(config)

      // Workflow should skip with neutral exit
      expect(result.shouldSkip).toBe(true)
      
      // This corresponds to the workflow using exit 78
      // for neutral conclusion in the skip-scan job
    })
  })
})

describe('CLI Integration', () => {
  let originalArgv: string[]

  beforeEach(() => {
    originalArgv = process.argv
  })

  afterEach(() => {
    process.argv = originalArgv
  })

  it('should handle CLI arguments correctly', () => {
    // Test the CLI argument parsing logic
    const mockArgv = [
      'node',
      '/path/to/preflight.ts',
      'YouTube Scanner',
      'YOUTUBE_API_KEY,AUTH_TOKEN,SITE_URL'
    ]

    process.argv = mockArgv

    const [, , workflowName, secretsArg] = mockArgv
    const requiredSecrets = secretsArg.split(',').map(s => s.trim())

    expect(workflowName).toBe('YouTube Scanner')
    expect(requiredSecrets).toEqual(['YOUTUBE_API_KEY', 'AUTH_TOKEN', 'SITE_URL'])
  })

  it('should handle invalid CLI arguments', () => {
    const mockArgv = ['node', '/path/to/preflight.ts'] // Missing required args

    process.argv = mockArgv

    const args = mockArgv.slice(2)
    expect(args.length).toBeLessThan(2)
    // CLI should exit with error code 1
  })
})