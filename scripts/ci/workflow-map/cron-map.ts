#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { format, parse } from 'date-fns';
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';

interface CronEntry {
  workflow_name: string;
  filename: string;
  cron_expression: string;
  parsed_utc: {
    minute: string;
    hour: string;
    day: string;
    month: string;
    dow: string;
  };
  sample_times_utc: string[];
  sample_times_et: string[];
  description: string;
}

interface CronCollision {
  time_window: string;
  colliding_workflows: string[];
  severity: 'minor' | 'moderate' | 'severe';
}

interface CronMapData {
  generated_at: string;
  timezone: string;
  dst_note: string;
  entries: CronEntry[];
  collisions: CronCollision[];
  summary: {
    total_scheduled_workflows: number;
    total_cron_expressions: number;
    collision_windows: number;
    staggering_recommendations: string[];
  };
}

function parseCronExpression(cron: string): any {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${cron}`);
  }
  
  return {
    minute: parts[0],
    hour: parts[1],
    day: parts[2],
    month: parts[3],
    dow: parts[4], // day of week
  };
}

function generateSampleTimes(cronExpr: any, count: number = 5): Date[] {
  const times: Date[] = [];
  const now = new Date();
  
  // Simple approximation - generate times for the next few days
  // This is a simplified implementation; a full cron parser would be more complex
  
  for (let dayOffset = 0; dayOffset < 7 && times.length < count; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    
    // Handle hour
    const hours = cronExpr.hour === '*' ? [0, 6, 12, 18] : 
                  cronExpr.hour.includes(',') ? cronExpr.hour.split(',').map(Number) :
                  cronExpr.hour.includes('/') ? generateStepValues(cronExpr.hour) :
                  [parseInt(cronExpr.hour)];
    
    // Handle minute
    const minutes = cronExpr.minute === '*' ? [0] :
                   cronExpr.minute.includes(',') ? cronExpr.minute.split(',').map(Number) :
                   cronExpr.minute.includes('/') ? generateStepValues(cronExpr.minute) :
                   [parseInt(cronExpr.minute)];
    
    for (const hour of hours) {
      for (const minute of minutes) {
        if (times.length >= count) break;
        
        const time = new Date(date);
        time.setHours(hour, minute, 0, 0);
        
        if (time > now) {
          times.push(time);
        }
      }
    }
  }
  
  return times.slice(0, count);
}

function generateStepValues(stepExpr: string): number[] {
  // Handle expressions like "*/5" or "0/15"
  const [start, step] = stepExpr.split('/');
  const startVal = start === '*' ? 0 : parseInt(start);
  const stepVal = parseInt(step);
  
  const values: number[] = [];
  for (let i = startVal; i < 60; i += stepVal) {
    values.push(i);
    if (values.length >= 4) break; // Limit for sample generation
  }
  
  return values;
}

function describeCronExpression(cronExpr: any): string {
  const { minute, hour, day, month, dow } = cronExpr;
  
  // Generate a human-readable description
  let desc = '';
  
  if (minute === '0' && hour !== '*') {
    desc += `At ${hour}:00`;
  } else if (minute !== '*' && hour !== '*') {
    desc += `At ${hour}:${minute.padStart(2, '0')}`;
  } else if (minute.includes('/')) {
    const step = minute.split('/')[1];
    desc += `Every ${step} minutes`;
  } else if (hour.includes('/')) {
    const step = hour.split('/')[1];
    desc += `Every ${step} hours`;
  } else {
    desc += 'Complex schedule';
  }
  
  if (dow !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (dow.includes(',')) {
      const dayNums = dow.split(',').map(Number);
      desc += ` on ${dayNums.map(n => days[n]).join(', ')}`;
    } else {
      desc += ` on ${days[parseInt(dow)]}`;
    }
  }
  
  if (day !== '*') {
    desc += ` on day ${day} of month`;
  }
  
  return desc + ' UTC';
}

function findCollisions(entries: CronEntry[]): CronCollision[] {
  const collisions: CronCollision[] = [];
  const timeSlots: Map<string, string[]> = new Map();
  
  // Group workflows by their execution times (rounded to nearest 5 minutes)
  for (const entry of entries) {
    for (const utcTime of entry.sample_times_utc) {
      const date = new Date(utcTime);
      // Round to nearest 5-minute window
      const roundedMinute = Math.round(date.getMinutes() / 5) * 5;
      const timeKey = `${date.getHours().toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`;
      
      if (!timeSlots.has(timeKey)) {
        timeSlots.set(timeKey, []);
      }
      
      const workflows = timeSlots.get(timeKey)!;
      if (!workflows.includes(entry.workflow_name)) {
        workflows.push(entry.workflow_name);
      }
    }
  }
  
  // Find time slots with multiple workflows
  for (const [timeWindow, workflows] of timeSlots.entries()) {
    if (workflows.length > 1) {
      const severity = workflows.length >= 4 ? 'severe' : 
                     workflows.length >= 3 ? 'moderate' : 'minor';
      
      collisions.push({
        time_window: timeWindow,
        colliding_workflows: workflows,
        severity,
      });
    }
  }
  
  return collisions.sort((a, b) => b.colliding_workflows.length - a.colliding_workflows.length);
}

function generateStaggeringRecommendations(collisions: CronCollision[]): string[] {
  const recommendations: string[] = [];
  
  for (const collision of collisions) {
    if (collision.severity === 'severe' || collision.severity === 'moderate') {
      const workflows = collision.colliding_workflows.join(', ');
      recommendations.push(
        `Stagger workflows at ${collision.time_window} UTC: ${workflows} (±2-5 min offset recommended)`
      );
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('No critical staggering needed - workflows are well distributed');
  }
  
  return recommendations;
}

async function main() {
  console.log('📅 Generating cron schedule map...');
  
  try {
    // Read workflow data
    const workflowData = JSON.parse(readFileSync('ci_audit/workflow_map/data/workflows.json', 'utf8'));
    
    const cronEntries: CronEntry[] = [];
    
    for (const workflow of workflowData.workflows) {
      const scheduleTriggers = workflow.triggers.filter((t: any) => t.event === 'schedule');
      
      for (const trigger of scheduleTriggers) {
        if (trigger.cron && Array.isArray(trigger.cron)) {
          for (const cronExpr of trigger.cron) {
            try {
              const parsed = parseCronExpression(cronExpr);
              const sampleTimes = generateSampleTimes(parsed);
              
              cronEntries.push({
                workflow_name: workflow.name,
                filename: workflow.filename,
                cron_expression: cronExpr,
                parsed_utc: parsed,
                sample_times_utc: sampleTimes.map(t => t.toISOString()),
                sample_times_et: sampleTimes.map(t => 
                  formatInTimeZone(t, 'America/New_York', 'yyyy-MM-dd HH:mm:ss zzz')
                ),
                description: describeCronExpression(parsed),
              });
            } catch (error) {
              console.warn(`⚠️  Failed to parse cron expression "${cronExpr}" in ${workflow.name}:`, error);
            }
          }
        }
      }
    }
    
    const collisions = findCollisions(cronEntries);
    const staggeringRecommendations = generateStaggeringRecommendations(collisions);
    
    const cronMap: CronMapData = {
      generated_at: new Date().toISOString(),
      timezone: 'America/New_York',
      dst_note: 'Eastern Time observes DST (UTC-4 in summer, UTC-5 in winter). Cron expressions run in UTC.',
      entries: cronEntries,
      collisions,
      summary: {
        total_scheduled_workflows: new Set(cronEntries.map(e => e.workflow_name)).size,
        total_cron_expressions: cronEntries.length,
        collision_windows: collisions.length,
        staggering_recommendations: staggeringRecommendations,
      },
    };
    
    const outputPath = 'ci_audit/workflow_map/data/cron_map.json';
    writeFileSync(outputPath, JSON.stringify(cronMap, null, 2));
    
    console.log(`✅ Cron map generated`);
    console.log(`📊 Summary:`);
    console.log(`   - Scheduled workflows: ${cronMap.summary.total_scheduled_workflows}`);
    console.log(`   - Total cron expressions: ${cronMap.summary.total_cron_expressions}`);
    console.log(`   - Collision windows: ${cronMap.summary.collision_windows}`);
    console.log(`📁 Data saved to: ${outputPath}`);
    
    if (collisions.length > 0) {
      console.log(`\n⚠️  Found ${collisions.length} potential scheduling collisions`);
      collisions.slice(0, 3).forEach(c => {
        console.log(`   - ${c.time_window} UTC (${c.severity}): ${c.colliding_workflows.join(', ')}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to generate cron map:', error);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}