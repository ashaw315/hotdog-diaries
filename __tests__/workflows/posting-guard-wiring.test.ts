/**
 * Posting Guard Wiring Tests
 * 
 * Verifies that all posting workflows have proper guard configuration
 */

import { readFile, readdir } from 'fs/promises'
import { parse as parseYaml } from 'yaml'
import path from 'path'

describe('Posting Guard Wiring', () => {
  let postingWorkflows: string[] = []

  beforeAll(async () => {
    const workflowsDir = '.github/workflows'
    const files = await readdir(workflowsDir)
    postingWorkflows = files.filter(file => 
      file.startsWith('post-') && file.endsWith('.yml')
    )
  })

  it('should find posting workflows', () => {
    expect(postingWorkflows.length).toBeGreaterThan(0)
  })

  describe.each(postingWorkflows.map(f => [f]))('workflow %s', (workflowFile) => {
    let workflow: any

    beforeAll(async () => {
      const content = await readFile(path.join('.github/workflows', workflowFile), 'utf8')
      workflow = parseYaml(content)
    })

    it('should have top-level permissions or minimal perms', () => {
      expect(workflow.permissions).toBeDefined()
      expect(typeof workflow.permissions).toBe('object')
    })

    it('should have a guard job', () => {
      expect(workflow.jobs.guard).toBeDefined()
      expect(workflow.jobs.guard.uses).toMatch(/\/_posting-guard\.yml$/)
    })

    it('should have posting job depend on guard', () => {
      const postingJobName = Object.keys(workflow.jobs).find(name => name !== 'guard')
      expect(postingJobName).toBeDefined()
      
      const postingJob = workflow.jobs[postingJobName!]
      expect(postingJob.needs).toBeDefined()
      
      // Handle both string and array needs
      if (Array.isArray(postingJob.needs)) {
        expect(postingJob.needs).toContain('guard')
      } else {
        expect(postingJob.needs).toBe('guard')
      }
    })

    it('should have timeout on posting job', () => {
      const postingJobName = Object.keys(workflow.jobs).find(name => name !== 'guard')
      const postingJob = workflow.jobs[postingJobName!]
      
      expect(postingJob['timeout-minutes']).toBeDefined()
      expect(typeof postingJob['timeout-minutes']).toBe('number')
      expect(postingJob['timeout-minutes']).toBeGreaterThan(0)
    })

    it('should have concurrency group with cancel-in-progress', () => {
      const postingJobName = Object.keys(workflow.jobs).find(name => name !== 'guard')
      const postingJob = workflow.jobs[postingJobName!]
      
      expect(postingJob.concurrency).toBeDefined()
      expect(postingJob.concurrency.group).toBeDefined()
      expect(postingJob.concurrency['cancel-in-progress']).toBe(true)
    })

    it('should have staggered cron if scheduled', () => {
      if (workflow.on?.schedule) {
        for (const schedule of workflow.on.schedule) {
          if (schedule.cron) {
            const cronParts = schedule.cron.split(' ')
            // If it's an hourly cron, it should not be exactly on the hour
            if (cronParts.length >= 2 && cronParts[1].match(/^\d+$/)) {
              expect(cronParts[1]).not.toMatch(/0$/)
            }
          }
        }
      }
    })
  })
})