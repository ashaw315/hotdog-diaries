#!/usr/bin/env tsx

/**
 * CI Audit: Cron Analyzer
 * 
 * Analyzes cron schedules in workflows to detect collisions, compute next runs,
 * and identify potential thundering herd problems.
 */

import fs from 'fs/promises'
import path from 'path'
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz'
import { addMinutes, addHours, addDays, parseISO } from 'date-fns'

interface CronSchedule {
  workflow_name: string
  workflow_filename: string
  cron_expression: string
  timezone: string // Always 'UTC' for GitHub Actions
  next_run_utc: Date
  next_run_et: string
  prev_run_utc?: Date
  prev_run_et?: string
  parsed: {
    minute: string
    hour: string
    day: string
    month: string
    dayOfWeek: string
  }
  collision_group?: string
  frequency: 'every_minute' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'complex'
}

interface CronCollision {
  time_utc: string
  time_et: string
  workflows: string[]
  severity: 'low' | 'medium' | 'high'
  reason: string
}

interface CronAnalysis {
  total_scheduled_workflows: number
  schedules: CronSchedule[]
  collisions: CronCollision[]
  analysis: {
    thundering_herd_risk: boolean
    peak_load_times: string[]
    recommendations: string[]
  }
  today_schedule: {
    date_et: string
    expected_runs: Array<{
      time_et: string
      workflow: string
      should_have_run: boolean
      estimated_run_time_utc: string
    }>
  }
}

class CronAnalyzer {
  private outputDir: string
  private easternTZ = 'America/New_York'

  constructor() {
    this.outputDir = 'ci_audit/actions'
  }

  async analyzeCrons(): Promise<CronAnalysis> {
    console.log('⏰ Analyzing cron schedules...')
    
    // Load workflows data
    const workflowsPath = path.join(this.outputDir, 'workflows.json')
    const workflows = JSON.parse(await fs.readFile(workflowsPath, 'utf8'))
    
    // Extract scheduled workflows
    const scheduledWorkflows = workflows.filter((w: any) => w.on.schedule)
    console.log(`📅 Found ${scheduledWorkflows.length} scheduled workflows`)
    
    const schedules: CronSchedule[] = []
    
    for (const workflow of scheduledWorkflows) {
      if (workflow.on.schedule) {
        for (const schedule of workflow.on.schedule) {
          const cronSchedule = this.parseCronSchedule(workflow, schedule.cron)
          schedules.push(cronSchedule)
        }
      }
    }
    
    // Detect collisions
    const collisions = this.detectCollisions(schedules)
    
    // Analyze patterns
    const analysis = this.analyzePatterns(schedules, collisions)
    
    // Generate today's schedule
    const todaySchedule = this.generateTodaySchedule(schedules)
    
    const result: CronAnalysis = {
      total_scheduled_workflows: scheduledWorkflows.length,
      schedules: schedules.sort((a, b) => a.next_run_utc.getTime() - b.next_run_utc.getTime()),
      collisions,
      analysis,
      today_schedule: todaySchedule
    }
    
    await this.saveAnalysis(result)
    return result
  }

  private parseCronSchedule(workflow: any, cronExpr: string): CronSchedule {
    const parts = cronExpr.trim().split(/\s+/)
    
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${cronExpr}`)
    }
    
    const [minute, hour, day, month, dayOfWeek] = parts
    
    // Calculate next run time
    const now = new Date()
    const nextRun = this.calculateNextRun(cronExpr, now)
    const prevRun = this.calculatePreviousRun(cronExpr, now)
    
    // Convert to Eastern Time for display - handle invalid dates
    let nextRunET: string
    let prevRunET: string | undefined
    
    try {
      nextRunET = formatInTimeZone(nextRun, this.easternTZ, 'yyyy-MM-dd HH:mm:ss zzz')
    } catch (error) {
      nextRunET = 'Invalid date'
    }
    
    try {
      prevRunET = prevRun ? formatInTimeZone(prevRun, this.easternTZ, 'yyyy-MM-dd HH:mm:ss zzz') : undefined
    } catch (error) {
      prevRunET = undefined
    }
    
    return {
      workflow_name: workflow.name,
      workflow_filename: workflow.filename,
      cron_expression: cronExpr,
      timezone: 'UTC',
      next_run_utc: nextRun,
      next_run_et: nextRunET,
      prev_run_utc: prevRun,
      prev_run_et: prevRunET,
      parsed: { minute, hour, day, month, dayOfWeek },
      frequency: this.determineFrequency(parts),
      collision_group: this.getCollisionGroup(minute, hour)
    }
  }

  private calculateNextRun(cronExpr: string, from: Date): Date {
    // Simplified cron calculation for common patterns
    const parts = cronExpr.split(/\s+/)
    const [minute, hour, day, month, dayOfWeek] = parts
    
    const next = new Date(from)
    next.setSeconds(0)
    next.setMilliseconds(0)
    
    try {
      // Handle specific patterns
      if (minute !== '*' && hour !== '*') {
        // Daily at specific time
        const targetMinute = parseInt(minute) || 0
        const targetHour = parseInt(hour) || 0
        
        // Validate ranges
        if (targetMinute >= 0 && targetMinute <= 59 && targetHour >= 0 && targetHour <= 23) {
          next.setMinutes(targetMinute)
          next.setHours(targetHour)
          
          // If this time has passed today, move to tomorrow
          if (next <= from) {
            next.setDate(next.getDate() + 1)
          }
        } else {
          // Invalid time values, fallback
          next.setHours(next.getHours() + 1)
        }
      } else if (minute !== '*' && hour === '*') {
        // Every hour at specific minute
        const targetMinute = parseInt(minute) || 0
        if (targetMinute >= 0 && targetMinute <= 59) {
          next.setMinutes(targetMinute)
          
          // If this minute has passed this hour, move to next hour
          if (next <= from) {
            next.setHours(next.getHours() + 1)
          }
        } else {
          next.setHours(next.getHours() + 1)
        }
      } else if (minute === '*') {
        // Every minute
        next.setMinutes(next.getMinutes() + 1)
      } else {
        // Fallback: add an hour
        next.setHours(next.getHours() + 1)
      }
    } catch (error) {
      // If any date operations fail, fallback to adding an hour
      next.setHours(next.getHours() + 1)
    }
    
    return next
  }

  private calculatePreviousRun(cronExpr: string, from: Date): Date | undefined {
    // Calculate when this cron would have last run
    const parts = cronExpr.split(/\s+/)
    const [minute, hour] = parts
    
    if (minute !== '*' && hour !== '*') {
      const prev = new Date(from)
      prev.setSeconds(0)
      prev.setMilliseconds(0)
      prev.setMinutes(parseInt(minute))
      prev.setHours(parseInt(hour))
      
      // If this time hasn't occurred today, go back to yesterday
      if (prev > from) {
        prev.setDate(prev.getDate() - 1)
      }
      
      return prev
    }
    
    return undefined
  }

  private determineFrequency(parts: string[]): CronSchedule['frequency'] {
    const [minute, hour, day, month, dayOfWeek] = parts
    
    if (minute === '*') return 'every_minute'
    if (hour === '*') return 'hourly'
    if (day === '*' && month === '*' && dayOfWeek === '*') return 'daily'
    if (dayOfWeek !== '*') return 'weekly'
    if (day !== '*') return 'monthly'
    
    return 'complex'
  }

  private getCollisionGroup(minute: string, hour: string): string {
    if (minute === '*') return 'every-minute'
    if (hour === '*') return `minute-${minute}`
    return `${hour}:${minute.padStart(2, '0')}`
  }

  private detectCollisions(schedules: CronSchedule[]): CronCollision[] {
    const collisions: CronCollision[] = []
    
    // Group by collision group
    const groups = schedules.reduce((acc, schedule) => {
      const group = schedule.collision_group || 'other'
      if (!acc[group]) acc[group] = []
      acc[group].push(schedule)
      return acc
    }, {} as Record<string, CronSchedule[]>)
    
    // Find groups with multiple workflows
    for (const [group, groupSchedules] of Object.entries(groups)) {
      if (groupSchedules.length > 1) {
        let severity: CronCollision['severity'] = 'low'
        let reason = `${groupSchedules.length} workflows scheduled at same time`
        
        // Determine severity
        if (groupSchedules.length >= 5) {
          severity = 'high'
          reason = `High collision risk: ${groupSchedules.length} workflows`
        } else if (groupSchedules.length >= 3) {
          severity = 'medium'
          reason = `Moderate collision risk: ${groupSchedules.length} workflows`
        }
        
        // Check if any are posting workflows
        const postingWorkflows = groupSchedules.filter(s => 
          s.workflow_name.toLowerCase().includes('post')
        )
        if (postingWorkflows.length > 0) {
          severity = 'high'
          reason += ' (includes posting workflows)'
        }
        
        const sampleSchedule = groupSchedules[0]
        collisions.push({
          time_utc: sampleSchedule.next_run_utc.toISOString(),
          time_et: sampleSchedule.next_run_et,
          workflows: groupSchedules.map(s => s.workflow_name),
          severity,
          reason
        })
      }
    }
    
    return collisions.sort((a, b) => 
      new Date(a.time_utc).getTime() - new Date(b.time_utc).getTime()
    )
  }

  private analyzePatterns(schedules: CronSchedule[], collisions: CronCollision[]): CronAnalysis['analysis'] {
    const recommendations: string[] = []
    
    // Check for thundering herd
    const thunderingHerdRisk = collisions.some(c => c.severity === 'high')
    if (thunderingHerdRisk) {
      recommendations.push('Stagger high-collision workflows by 1-2 minutes to reduce load spikes')
    }
    
    // Find peak load times
    const hourCounts: Record<string, number> = {}
    schedules.forEach(s => {
      if (s.parsed.hour !== '*') {
        const hour = s.parsed.hour.padStart(2, '0')
        hourCounts[hour] = (hourCounts[hour] || 0) + 1
      }
    })
    
    const peakLoadTimes = Object.entries(hourCounts)
      .filter(([_, count]) => count >= 3)
      .map(([hour, count]) => `${hour}:xx UTC (${count} workflows)`)
      .sort()
    
    // Additional recommendations
    const everyMinuteWorkflows = schedules.filter(s => s.frequency === 'every_minute')
    if (everyMinuteWorkflows.length > 0) {
      recommendations.push(`${everyMinuteWorkflows.length} workflows run every minute - consider reducing frequency`)
    }
    
    const postingWorkflows = schedules.filter(s => s.workflow_name.toLowerCase().includes('post'))
    if (postingWorkflows.length === 0) {
      recommendations.push('No posting workflows found in cron schedules - posting may rely on other triggers')
    }
    
    return {
      thundering_herd_risk: thunderingHerdRisk,
      peak_load_times: peakLoadTimes,
      recommendations
    }
  }

  private generateTodaySchedule(schedules: CronSchedule[]): CronAnalysis['today_schedule'] {
    const now = new Date()
    const todayET = formatInTimeZone(now, this.easternTZ, 'yyyy-MM-dd')
    
    // Get start and end of today in ET, converted to UTC
    const startOfDayET = new Date(`${todayET}T00:00:00-05:00`) // Assuming EST, adjust for DST
    const endOfDayET = new Date(`${todayET}T23:59:59-05:00`)
    
    const expectedRuns: CronAnalysis['today_schedule']['expected_runs'] = []
    
    for (const schedule of schedules) {
      // Check if this workflow should have run today
      if (schedule.prev_run_utc && 
          schedule.prev_run_utc >= startOfDayET && 
          schedule.prev_run_utc <= endOfDayET) {
        
        const timeET = formatInTimeZone(schedule.prev_run_utc, this.easternTZ, 'HH:mm')
        expectedRuns.push({
          time_et: timeET,
          workflow: schedule.workflow_name,
          should_have_run: true,
          estimated_run_time_utc: schedule.prev_run_utc.toISOString()
        })
      }
      
      // Also check if it should run later today
      if (schedule.next_run_utc >= now && 
          schedule.next_run_utc <= endOfDayET) {
        
        const timeET = formatInTimeZone(schedule.next_run_utc, this.easternTZ, 'HH:mm')
        expectedRuns.push({
          time_et: timeET,
          workflow: schedule.workflow_name,
          should_have_run: false,
          estimated_run_time_utc: schedule.next_run_utc.toISOString()
        })
      }
    }
    
    return {
      date_et: todayET,
      expected_runs: expectedRuns.sort((a, b) => a.time_et.localeCompare(b.time_et))
    }
  }

  private async saveAnalysis(analysis: CronAnalysis): Promise<void> {
    // Save JSON data
    const jsonPath = path.join(this.outputDir, 'cron-analysis.json')
    await fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2))
    console.log(`💾 Saved cron analysis to ${jsonPath}`)
    
    // Generate markdown report
    await this.generateCronReport(analysis)
  }

  private async generateCronReport(analysis: CronAnalysis): Promise<void> {
    const reportPath = path.join(this.outputDir, 'cron-collisions.md')
    
    let content = `# Cron Schedule Analysis

Generated: ${new Date().toISOString()}
Scheduled workflows: ${analysis.total_scheduled_workflows}

## Overview

`

    if (analysis.analysis.thundering_herd_risk) {
      content += `❌ **Thundering Herd Risk Detected** - Multiple workflows may execute simultaneously\n\n`
    } else {
      content += `✅ **No Major Collision Risks** - Workflows are reasonably distributed\n\n`
    }

    // Collisions table
    if (analysis.collisions.length > 0) {
      content += `## Schedule Collisions\n\n`
      content += `| Time (ET) | Severity | Workflows | Issue |\n`
      content += `|-----------|----------|-----------|-------|\n`
      
      for (const collision of analysis.collisions) {
        const severityIcon = collision.severity === 'high' ? '🔴' : 
                           collision.severity === 'medium' ? '🟡' : '🟢'
        const timeET = collision.time_et.split(' ')[1] // Extract time part
        
        content += `| ${timeET} | ${severityIcon} ${collision.severity} | ${collision.workflows.join(', ')} | ${collision.reason} |\n`
      }
      content += `\n`
    } else {
      content += `## Schedule Collisions\n\n✅ No schedule collisions detected\n\n`
    }

    // All schedules
    content += `## All Scheduled Workflows\n\n`
    content += `| Workflow | Frequency | Next Run (ET) | Cron Expression |\n`
    content += `|----------|-----------|---------------|------------------|\n`
    
    for (const schedule of analysis.schedules) {
      const nextRunET = schedule.next_run_et.split(' ')[1] // Extract time part
      const frequencyIcon = schedule.frequency === 'every_minute' ? '⚡' :
                           schedule.frequency === 'hourly' ? '🔄' :
                           schedule.frequency === 'daily' ? '📅' : '📆'
      
      content += `| ${schedule.workflow_name} | ${frequencyIcon} ${schedule.frequency} | ${nextRunET} | \`${schedule.cron_expression}\` |\n`
    }

    // Today's schedule
    content += `\n## Today's Expected Runs (${analysis.today_schedule.date_et})\n\n`
    
    if (analysis.today_schedule.expected_runs.length > 0) {
      content += `| Time (ET) | Workflow | Status |\n`
      content += `|-----------|----------|--------|\n`
      
      for (const run of analysis.today_schedule.expected_runs) {
        const status = run.should_have_run ? '✅ Should have run' : '⏳ Scheduled later'
        content += `| ${run.time_et} | ${run.workflow} | ${status} |\n`
      }
    } else {
      content += `ℹ️ No scheduled workflows expected to run today\n`
    }

    // Peak load analysis
    if (analysis.analysis.peak_load_times.length > 0) {
      content += `\n## Peak Load Times\n\n`
      analysis.analysis.peak_load_times.forEach(time => {
        content += `- ${time}\n`
      })
    }

    // Recommendations
    content += `\n## Recommendations\n\n`
    if (analysis.analysis.recommendations.length > 0) {
      analysis.analysis.recommendations.forEach(rec => {
        content += `- ${rec}\n`
      })
    } else {
      content += `✅ No specific recommendations - cron schedules appear well-configured\n`
    }

    await fs.writeFile(reportPath, content)
    console.log(`📄 Generated cron report at ${reportPath}`)
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('analyze-crons')
if (isMainModule) {
  const analyzer = new CronAnalyzer()
  analyzer.analyzeCrons().catch(console.error)
}

export { CronAnalyzer }