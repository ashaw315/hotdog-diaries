#!/usr/bin/env tsx

/**
 * CI Audit: Today's Posting Matrix
 * 
 * Correlates scheduled content in DB with workflow runs to create a matrix
 * showing what should have posted today vs what actually happened.
 */

import fs from 'fs/promises'
import path from 'path'
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz'
import { parseISO, startOfDay, endOfDay } from 'date-fns'
import { createClient } from '@supabase/supabase-js'

interface ScheduledSlot {
  id: number
  slot_time_utc: string
  slot_time_et: string
  content_id?: number
  platform?: string
  content_text?: string
  status: 'scheduled' | 'posted' | 'failed' | 'empty'
}

interface WorkflowRun {
  id: number
  workflow_name: string
  run_number: number
  status: string
  conclusion: string
  created_at: string
  html_url: string
  expected_slot?: string
}

interface PostedContent {
  id: number
  content_queue_id: number
  posted_at: string
  platform?: string
  scheduled_post_id?: number
}

interface PostingMatrixEntry {
  slot_time_et: string
  slot_time_utc: string
  scheduled_content: {
    id?: number
    platform?: string
    text_preview?: string
    status: string
  }
  expected_workflow: string | null
  actual_workflow_run: {
    id?: number
    status?: string
    conclusion?: string
    url?: string
  } | null
  posting_result: {
    posted_content_id?: number
    posted_at?: string
    status: 'SUCCESS' | 'FAILED' | 'NOT_ATTEMPTED' | 'EMPTY_SLOT'
    error_reason?: string
  }
  root_cause: 'WORKFLOW_NOT_EXECUTED' | 'WORKFLOW_FAILED' | 'NO_SCHEDULED_CONTENT' | 
              'CONTENT_MISMATCH' | 'DB_WRITE_MISSING' | 'SUCCESS' | 'UNKNOWN'
}

interface TodayPostingMatrix {
  analysis_date_et: string
  analysis_date_utc: string
  posting_slots: PostingMatrixEntry[]
  summary: {
    total_slots: number
    successful_posts: number
    failed_posts: number
    empty_slots: number
    workflow_failures: number
    source_of_truth_violations: number
  }
  recommendations: string[]
}

class TodayPostingMatrixGenerator {
  private outputDir: string
  private easternTZ = 'America/New_York'
  private postingTimes = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30'] // ET times

  constructor() {
    this.outputDir = 'ci_audit/actions'
  }

  async generateMatrix(): Promise<TodayPostingMatrix> {
    console.log('📊 Generating today\'s posting matrix...')
    
    // Get today's date in ET
    const now = new Date()
    const todayET = formatInTimeZone(now, this.easternTZ, 'yyyy-MM-dd')
    const todayUTC = formatInTimeZone(now, 'UTC', 'yyyy-MM-dd')
    
    console.log(`📅 Analyzing date: ${todayET} (ET) / ${todayUTC} (UTC)`)
    
    // Connect to Supabase
    const supabase = this.createSupabaseClient()
    
    // Get scheduled content for today
    const scheduledSlots = await this.getScheduledSlotsForToday(todayET, supabase)
    console.log(`📋 Found ${scheduledSlots.length} scheduled slots`)
    
    // Get posted content for today
    const postedContent = await this.getPostedContentForToday(todayET, supabase)
    console.log(`📮 Found ${postedContent.length} posted items`)
    
    // Get workflow runs for today
    const workflowRuns = await this.getWorkflowRunsForToday()
    console.log(`🏃 Found ${workflowRuns.length} posting workflow runs`)
    
    // Build the matrix
    const matrix = await this.buildPostingMatrix(todayET, scheduledSlots, postedContent, workflowRuns)
    
    await this.saveMatrix(matrix)
    return matrix
  }

  private createSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required')
    }
    
    console.log('🔗 Connecting to Supabase production database...')
    return createClient(supabaseUrl, supabaseKey)
  }

  private async getScheduledSlotsForToday(dateET: string, supabase: any): Promise<ScheduledSlot[]> {
    // Try to find scheduled_posts table first
    console.log(`🔍 Querying scheduled_posts for date: ${dateET}`)
    
    try {
      // Query scheduled_posts with Supabase (simpler query without join)
      const { data: scheduledData, error: scheduledError } = await supabase
        .from('scheduled_posts')
        .select('id, scheduled_post_time, content_id, platform')
        .gte('scheduled_post_time', `${dateET}T00:00:00Z`)
        .lt('scheduled_post_time', `${dateET}T23:59:59Z`)
        .order('scheduled_post_time')
      
      if (scheduledError) {
        console.log('⚠️ scheduled_posts table error:', scheduledError.message)
        throw scheduledError
      }
      
      if (scheduledData && scheduledData.length > 0) {
        console.log(`✅ Found ${scheduledData.length} entries in scheduled_posts`)
        
        // Get content text separately for each scheduled post
        const enhancedData = await Promise.all(scheduledData.map(async (row) => {
          let content_text = null
          if (row.content_id) {
            const { data: contentData } = await supabase
              .from('content_queue')
              .select('content_text')
              .eq('id', row.content_id)
              .single()
            content_text = contentData?.content_text
          }
          
          return {
            id: row.id,
            slot_time_utc: row.scheduled_post_time,
            slot_time_et: formatInTimeZone(parseISO(row.scheduled_post_time), this.easternTZ, 'HH:mm'),
            content_id: row.content_id,
            platform: row.platform,
            content_text,
            status: 'scheduled' as const
          }
        }))
        
        return enhancedData
      }
      
      console.log('📭 No scheduled_posts found, checking content_queue...')
      
    } catch (error) {
      console.log('⚠️ scheduled_posts table access failed, trying content_queue...')
    }
    
    // Fallback: look for content scheduled for today in content_queue
    try {
      const { data: queueData, error: queueError } = await supabase
        .from('content_queue')
        .select('id, scheduled_post_time, source_platform, content_text, is_posted')
        .not('scheduled_post_time', 'is', null)
        .gte('scheduled_post_time', `${dateET}T00:00:00Z`)
        .lt('scheduled_post_time', `${dateET}T23:59:59Z`)
        .order('scheduled_post_time')
      
      if (queueError) {
        console.log('⚠️ content_queue table error:', queueError.message)
        throw queueError
      }
      
      if (queueData && queueData.length > 0) {
        console.log(`✅ Found ${queueData.length} entries in content_queue`)
        
        return queueData.map(row => ({
          id: row.id,
          slot_time_utc: row.scheduled_post_time,
          slot_time_et: formatInTimeZone(parseISO(row.scheduled_post_time), this.easternTZ, 'HH:mm'),
          content_id: row.id,
          platform: row.source_platform,
          content_text: row.content_text,
          status: row.is_posted ? 'posted' : 'scheduled' as const
        }))
      }
      
      console.log('📭 No scheduled content found in content_queue either')
      
    } catch (fallbackError) {
      console.log('⚠️ content_queue access also failed:', fallbackError.message)
    }
    
    console.log('⚠️ No scheduled content found, generating expected slots...')
    // Generate expected slots based on standard posting times
    return this.generateExpectedSlots(dateET)
  }

  private generateExpectedSlots(dateET: string): ScheduledSlot[] {
    return this.postingTimes.map((time, index) => {
      const slotTimeET = `${dateET}T${time}:00`
      const slotTimeUTC = this.convertETtoUTC(slotTimeET)
      
      return {
        id: index + 1,
        slot_time_utc: slotTimeUTC,
        slot_time_et: time,
        status: 'empty' as const
      }
    })
  }

  private convertETtoUTC(etTimeString: string): string {
    // Convert ET time to UTC
    const etDate = new Date(`${etTimeString}-05:00`) // Assuming EST, adjust for DST
    return etDate.toISOString()
  }

  private async getPostedContentForToday(dateET: string, supabase: any): Promise<PostedContent[]> {
    console.log(`🔍 Querying posted_content for date: ${dateET}`)
    
    try {
      const { data: postedData, error: postedError } = await supabase
        .from('posted_content')
        .select('id, content_queue_id, posted_at')
        .gte('posted_at', `${dateET}T00:00:00Z`)
        .lt('posted_at', `${dateET}T23:59:59Z`)
        .order('posted_at')
      
      if (postedError) {
        console.log('⚠️ posted_content table error:', postedError.message)
        return []
      }
      
      if (postedData && postedData.length > 0) {
        console.log(`✅ Found ${postedData.length} posted items`)
        return postedData
      }
      
      console.log('📭 No posted content found for today')
      return []
      
    } catch (error) {
      console.log('⚠️ posted_content table access failed:', error.message)
      return []
    }
  }

  private async getWorkflowRunsForToday(): Promise<WorkflowRun[]> {
    // Load runs data from previous analysis
    try {
      const runsPath = path.join(this.outputDir, 'runs.json')
      const runsData = JSON.parse(await fs.readFile(runsPath, 'utf8'))
      
      // Filter to posting workflows and today's runs
      const today = new Date()
      const todayStart = startOfDay(today)
      
      const postingRuns: WorkflowRun[] = []
      
      for (const workflowSummary of runsData) {
        if (this.isPostingWorkflow(workflowSummary.workflow_name)) {
          for (const run of workflowSummary.runs) {
            const runDate = parseISO(run.created_at)
            if (runDate >= todayStart) {
              postingRuns.push({
                id: run.id,
                workflow_name: workflowSummary.workflow_name,
                run_number: run.run_number,
                status: run.status,
                conclusion: run.conclusion,
                created_at: run.created_at,
                html_url: run.html_url,
                expected_slot: this.inferExpectedSlot(workflowSummary.workflow_name, run.created_at)
              })
            }
          }
        }
      }
      
      return postingRuns.sort((a, b) => a.created_at.localeCompare(b.created_at))
      
    } catch (error) {
      console.log('⚠️ Could not load workflow runs data')
      return []
    }
  }

  private isPostingWorkflow(name: string): boolean {
    const postingKeywords = ['post-', 'posting', 'breakfast', 'lunch', 'snack', 'dinner', 'evening', 'late']
    return postingKeywords.some(keyword => name.toLowerCase().includes(keyword))
  }

  private inferExpectedSlot(workflowName: string, createdAt: string): string {
    const timeET = formatInTimeZone(parseISO(createdAt), this.easternTZ, 'HH:mm')
    
    // Map workflow names to expected times
    const name = workflowName.toLowerCase()
    if (name.includes('breakfast')) return '08:00'
    if (name.includes('lunch')) return '12:00'
    if (name.includes('snack')) return '15:00'
    if (name.includes('dinner')) return '18:00'
    if (name.includes('evening')) return '21:00'
    if (name.includes('late')) return '23:30'
    
    // Fallback: find closest posting time
    const [hour, minute] = timeET.split(':').map(Number)
    const currentMinutes = hour * 60 + minute
    
    let closestTime = '08:00'
    let closestDiff = Infinity
    
    for (const postingTime of this.postingTimes) {
      const [postHour, postMinute] = postingTime.split(':').map(Number)
      const postMinutes = postHour * 60 + postMinute
      const diff = Math.abs(currentMinutes - postMinutes)
      
      if (diff < closestDiff) {
        closestDiff = diff
        closestTime = postingTime
      }
    }
    
    return closestTime
  }

  private async buildPostingMatrix(
    dateET: string,
    scheduledSlots: ScheduledSlot[],
    postedContent: PostedContent[],
    workflowRuns: WorkflowRun[]
  ): Promise<TodayPostingMatrix> {
    
    const entries: PostingMatrixEntry[] = []
    
    // Create entries for each expected posting time
    for (const expectedTime of this.postingTimes) {
      // Find scheduled slot for this time
      const scheduledSlot = scheduledSlots.find(slot => slot.slot_time_et === expectedTime)
      
      // Find workflow run for this time
      const workflowRun = workflowRuns.find(run => run.expected_slot === expectedTime)
      
      // Find posted content for this slot
      const postedItem = scheduledSlot ? 
        postedContent.find(pc => pc.scheduled_post_id === scheduledSlot.id) :
        null
      
      // Determine root cause
      const rootCause = this.determineRootCause(scheduledSlot, workflowRun, postedItem)
      
      const entry: PostingMatrixEntry = {
        slot_time_et: expectedTime,
        slot_time_utc: this.convertETtoUTC(`${dateET}T${expectedTime}:00`),
        scheduled_content: {
          id: scheduledSlot?.content_id,
          platform: scheduledSlot?.platform,
          text_preview: scheduledSlot?.content_text?.substring(0, 50),
          status: scheduledSlot?.status || 'empty'
        },
        expected_workflow: this.getExpectedWorkflowName(expectedTime),
        actual_workflow_run: workflowRun ? {
          id: workflowRun.id,
          status: workflowRun.status,
          conclusion: workflowRun.conclusion,
          url: workflowRun.html_url
        } : null,
        posting_result: {
          posted_content_id: postedItem?.id,
          posted_at: postedItem?.posted_at,
          status: this.determinePostingStatus(scheduledSlot, workflowRun, postedItem),
          error_reason: this.getErrorReason(rootCause, workflowRun)
        },
        root_cause: rootCause
      }
      
      entries.push(entry)
    }
    
    // Calculate summary
    const summary = {
      total_slots: entries.length,
      successful_posts: entries.filter(e => e.posting_result.status === 'SUCCESS').length,
      failed_posts: entries.filter(e => e.posting_result.status === 'FAILED').length,
      empty_slots: entries.filter(e => e.posting_result.status === 'EMPTY_SLOT').length,
      workflow_failures: entries.filter(e => e.root_cause === 'WORKFLOW_FAILED').length,
      source_of_truth_violations: 0 // TODO: detect from logs
    }
    
    const recommendations = this.generateRecommendations(entries)
    
    return {
      analysis_date_et: dateET,
      analysis_date_utc: formatInTimeZone(parseISO(`${dateET}T00:00:00`), 'UTC', 'yyyy-MM-dd'),
      posting_slots: entries,
      summary,
      recommendations
    }
  }

  private determineRootCause(
    scheduledSlot: ScheduledSlot | undefined,
    workflowRun: WorkflowRun | undefined,
    postedItem: PostedContent | null
  ): PostingMatrixEntry['root_cause'] {
    
    if (!scheduledSlot || scheduledSlot.status === 'empty') {
      return 'NO_SCHEDULED_CONTENT'
    }
    
    if (!workflowRun) {
      return 'WORKFLOW_NOT_EXECUTED'
    }
    
    if (workflowRun.conclusion === 'failure') {
      return 'WORKFLOW_FAILED'
    }
    
    if (scheduledSlot && workflowRun.conclusion === 'success' && !postedItem) {
      return 'DB_WRITE_MISSING'
    }
    
    if (postedItem) {
      return 'SUCCESS'
    }
    
    return 'UNKNOWN'
  }

  private getExpectedWorkflowName(timeET: string): string {
    const timeMap: Record<string, string> = {
      '08:00': 'post-breakfast',
      '12:00': 'post-lunch', 
      '15:00': 'post-snack',
      '18:00': 'post-dinner',
      '21:00': 'post-evening',
      '23:30': 'post-late-night'
    }
    
    return timeMap[timeET] || `post-${timeET.replace(':', '')}`
  }

  private determinePostingStatus(
    scheduledSlot: ScheduledSlot | undefined,
    workflowRun: WorkflowRun | undefined,
    postedItem: PostedContent | null
  ): PostingMatrixEntry['posting_result']['status'] {
    
    if (!scheduledSlot || scheduledSlot.status === 'empty') {
      return 'EMPTY_SLOT'
    }
    
    if (postedItem) {
      return 'SUCCESS'
    }
    
    if (workflowRun && workflowRun.conclusion === 'failure') {
      return 'FAILED'
    }
    
    return 'NOT_ATTEMPTED'
  }

  private getErrorReason(rootCause: PostingMatrixEntry['root_cause'], workflowRun?: WorkflowRun): string | undefined {
    switch (rootCause) {
      case 'WORKFLOW_NOT_EXECUTED':
        return 'Expected workflow did not run (check cron schedule or workflow triggers)'
      case 'WORKFLOW_FAILED':
        return `Workflow failed (see run #${workflowRun?.run_number} for details)`
      case 'NO_SCHEDULED_CONTENT':
        return 'No content was scheduled for this time slot'
      case 'DB_WRITE_MISSING':
        return 'Workflow succeeded but posted_content record was not created'
      case 'CONTENT_MISMATCH':
        return 'Scheduled content does not match posted content'
      default:
        return undefined
    }
  }

  private generateRecommendations(entries: PostingMatrixEntry[]): string[] {
    const recommendations: string[] = []
    
    const failedEntries = entries.filter(e => e.root_cause !== 'SUCCESS' && e.root_cause !== 'NO_SCHEDULED_CONTENT')
    
    if (failedEntries.length === 0) {
      recommendations.push('✅ All scheduled posts completed successfully')
      return recommendations
    }
    
    // Group by root cause
    const causeGroups = failedEntries.reduce((acc, entry) => {
      if (!acc[entry.root_cause]) acc[entry.root_cause] = []
      acc[entry.root_cause].push(entry)
      return acc
    }, {} as Record<string, PostingMatrixEntry[]>)
    
    for (const [cause, entries] of Object.entries(causeGroups)) {
      const times = entries.map(e => e.slot_time_et).join(', ')
      
      switch (cause) {
        case 'WORKFLOW_NOT_EXECUTED':
          recommendations.push(`🚨 Workflows did not run for slots: ${times} - Check cron schedules and GitHub Actions status`)
          break
        case 'WORKFLOW_FAILED':
          recommendations.push(`❌ Workflow failures at: ${times} - Check logs for error details`)
          break
        case 'DB_WRITE_MISSING':
          recommendations.push(`⚠️ Posts may have succeeded but DB not updated at: ${times} - Check ENFORCE_SCHEDULE_SOURCE_OF_TRUTH flag`)
          break
        case 'CONTENT_MISMATCH':
          recommendations.push(`🔄 Content mismatch detected at: ${times} - Verify posting logic`)
          break
      }
    }
    
    return recommendations
  }

  private async saveMatrix(matrix: TodayPostingMatrix): Promise<void> {
    // Save JSON data
    const jsonPath = path.join(this.outputDir, 'TODAY-posting-matrix.json')
    await fs.writeFile(jsonPath, JSON.stringify(matrix, null, 2))
    console.log(`💾 Saved posting matrix to ${jsonPath}`)
    
    // Generate markdown report
    await this.generateMatrixReport(matrix)
  }

  private async generateMatrixReport(matrix: TodayPostingMatrix): Promise<void> {
    const reportPath = path.join(this.outputDir, 'TODAY-posting-matrix.md')
    
    let content = `# Today's Posting Matrix - ${matrix.analysis_date_et}

Generated: ${new Date().toISOString()}

## Summary

`

    const successRate = matrix.summary.total_slots > 0 
      ? ((matrix.summary.successful_posts / matrix.summary.total_slots) * 100).toFixed(1)
      : '0'

    if (parseFloat(successRate) >= 80) {
      content += `✅ **${successRate}% Success Rate** - Good posting performance\n\n`
    } else if (parseFloat(successRate) >= 50) {
      content += `⚠️ **${successRate}% Success Rate** - Some issues detected\n\n`
    } else {
      content += `❌ **${successRate}% Success Rate** - Critical posting failures\n\n`
    }

    content += `- **Total posting slots**: ${matrix.summary.total_slots}\n`
    content += `- **Successful posts**: ${matrix.summary.successful_posts}\n`
    content += `- **Failed posts**: ${matrix.summary.failed_posts}\n`
    content += `- **Empty slots**: ${matrix.summary.empty_slots}\n`
    content += `- **Workflow failures**: ${matrix.summary.workflow_failures}\n\n`

    // Posting matrix table
    content += `## Posting Matrix\n\n`
    content += `| Time (ET) | Scheduled Content | Expected Workflow | Actual Run | Posting Result | Status | Root Cause |\n`
    content += `|-----------|-------------------|-------------------|------------|----------------|--------|------------|\n`
    
    for (const entry of matrix.posting_slots) {
      const scheduledContent = entry.scheduled_content.id 
        ? `${entry.scheduled_content.platform}: ${entry.scheduled_content.text_preview}...`
        : 'None'
      
      const actualRun = entry.actual_workflow_run 
        ? `[Run #${entry.actual_workflow_run.id}](${entry.actual_workflow_run.url}) (${entry.actual_workflow_run.conclusion})`
        : 'None'
      
      const postingResult = entry.posting_result.posted_content_id 
        ? `Posted #${entry.posting_result.posted_content_id}`
        : 'Not posted'
      
      const statusIcon = entry.posting_result.status === 'SUCCESS' ? '✅' :
                        entry.posting_result.status === 'FAILED' ? '❌' :
                        entry.posting_result.status === 'EMPTY_SLOT' ? '⚪' : '⏳'
      
      content += `| ${entry.slot_time_et} | ${scheduledContent} | ${entry.expected_workflow} | ${actualRun} | ${postingResult} | ${statusIcon} ${entry.posting_result.status} | ${entry.root_cause} |\n`
    }

    // Recommendations
    content += `\n## Recommendations\n\n`
    
    if (matrix.recommendations.length > 0) {
      matrix.recommendations.forEach(rec => {
        content += `${rec}\n\n`
      })
    } else {
      content += `✅ No specific recommendations - posting pipeline is functioning correctly\n\n`
    }

    // Immediate actions
    const criticalFailures = matrix.posting_slots.filter(e => 
      e.root_cause === 'WORKFLOW_FAILED' || e.root_cause === 'WORKFLOW_NOT_EXECUTED'
    )
    
    if (criticalFailures.length > 0) {
      content += `## Immediate Actions Required\n\n`
      
      criticalFailures.forEach(failure => {
        content += `### ${failure.slot_time_et} - ${failure.root_cause}\n`
        content += `**Error**: ${failure.posting_result.error_reason}\n`
        
        if (failure.actual_workflow_run) {
          content += `**Debug**: [View workflow run](${failure.actual_workflow_run.url})\n`
        } else {
          content += `**Debug**: Check why ${failure.expected_workflow} workflow did not execute\n`
        }
        
        // Suggest manual run command
        content += `**Manual trigger**: \`gh workflow run ${failure.expected_workflow}.yml --ref main\`\n\n`
      })
    }

    await fs.writeFile(reportPath, content)
    console.log(`📄 Generated posting matrix report at ${reportPath}`)
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('today-posting-matrix')
if (isMainModule) {
  const generator = new TodayPostingMatrixGenerator()
  generator.generateMatrix().catch(console.error)
}

export { TodayPostingMatrixGenerator }