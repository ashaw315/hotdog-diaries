/**
 * Cron parsing utilities for workflow verification
 */

import { format, addDays, startOfDay } from 'date-fns';
import { utcToZonedTime, formatInTimeZone } from 'date-fns-tz';

export interface CronJob {
  expression: string;
  workflow: string;
  etTime: string;
  utcTime: string;
  nextRun: Date;
}

export interface CronCollision {
  timeSlot: string;
  workflows: string[];
  count: number;
}

/**
 * Parse a cron expression and convert to readable time
 */
export function parseCronExpression(cron: string): { minute: number; hour: number } {
  const parts = cron.split(' ');
  if (parts.length < 5) {
    throw new Error(`Invalid cron expression: ${cron}`);
  }
  
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);
  
  if (isNaN(minute) || isNaN(hour)) {
    throw new Error(`Invalid cron time in expression: ${cron}`);
  }
  
  return { minute, hour };
}

/**
 * Convert UTC cron time to Eastern Time
 */
export function utcToEasternTime(utcHour: number, utcMinute: number): string {
  // Create a UTC date for today with the specified time
  const today = new Date();
  const utcDate = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(), 
    today.getUTCDate(),
    utcHour,
    utcMinute
  ));
  
  // Convert to Eastern Time
  return formatInTimeZone(utcDate, 'America/New_York', 'h:mm a');
}

/**
 * Get next run time for a cron expression (today or tomorrow)
 */
export function getNextCronRun(cron: string): Date {
  const { minute, hour } = parseCronExpression(cron);
  
  const now = new Date();
  const today = startOfDay(now);
  
  // Try today first
  const todayRun = new Date(today);
  todayRun.setUTCHours(hour, minute, 0, 0);
  
  if (todayRun > now) {
    return todayRun;
  }
  
  // Otherwise tomorrow
  const tomorrow = addDays(today, 1);
  const tomorrowRun = new Date(tomorrow);
  tomorrowRun.setUTCHours(hour, minute, 0, 0);
  
  return tomorrowRun;
}

/**
 * Find cron collisions within the same minute
 */
export function findCronCollisions(cronJobs: CronJob[]): CronCollision[] {
  const timeSlots = new Map<string, string[]>();
  
  cronJobs.forEach(job => {
    const { minute, hour } = parseCronExpression(job.expression);
    const timeKey = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    if (!timeSlots.has(timeKey)) {
      timeSlots.set(timeKey, []);
    }
    timeSlots.get(timeKey)!.push(job.workflow);
  });
  
  const collisions: CronCollision[] = [];
  
  timeSlots.forEach((workflows, timeSlot) => {
    if (workflows.length >= 4) {  // 4+ workflows in same minute = severe collision
      collisions.push({
        timeSlot,
        workflows,
        count: workflows.length
      });
    }
  });
  
  return collisions.sort((a, b) => b.count - a.count);
}

/**
 * Parse workflow cron schedules from file content
 */
export function extractCronSchedules(workflowContent: string, workflowName: string): CronJob[] {
  const cronJobs: CronJob[] = [];
  
  // Match cron expressions in YAML
  const cronRegex = /^\s*-\s*cron:\s*['"]([^'"]+)['"].*$/gm;
  let match;
  
  while ((match = cronRegex.exec(workflowContent)) !== null) {
    const cronExpression = match[1];
    
    try {
      const { minute, hour } = parseCronExpression(cronExpression);
      const etTime = utcToEasternTime(hour, minute);
      const utcTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} UTC`;
      const nextRun = getNextCronRun(cronExpression);
      
      cronJobs.push({
        expression: cronExpression,
        workflow: workflowName,
        etTime,
        utcTime,
        nextRun
      });
    } catch (error) {
      console.warn(`Failed to parse cron expression "${cronExpression}" in ${workflowName}:`, error);
    }
  }
  
  return cronJobs;
}

/**
 * Get readable time ranges for the next 24 hours
 */
export function getNext24HourSchedule(cronJobs: CronJob[]): string[] {
  const now = new Date();
  const tomorrow = addDays(now, 1);
  
  const upcomingRuns = cronJobs
    .map(job => ({
      ...job,
      nextRun: getNextCronRun(job.expression)
    }))
    .filter(job => job.nextRun <= tomorrow)
    .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
  
  return upcomingRuns.map(job => 
    `${formatInTimeZone(job.nextRun, 'UTC', 'HH:mm')} UTC (${job.etTime} ET) - ${job.workflow}`
  );
}