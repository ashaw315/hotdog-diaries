#!/usr/bin/env tsx

/**
 * Deployment Checklist for Scheduling System
 * Verifies all components are ready for production deployment
 */

import { db } from '../lib/db'
import { scheduleNextBatch, getUpcomingSchedule } from '../lib/services/schedule-content'
import { getPostingStats } from '../lib/services/posting-service'

interface ChecklistItem {
  name: string
  description: string
  status: 'pending' | 'success' | 'warning' | 'error'
  details?: string
  fix?: string
}

async function runDeploymentChecklist(): Promise<ChecklistItem[]> {
  const checklist: ChecklistItem[] = []
  
  // 1. Database Schema Check
  try {
    await db.connect()
    
    // Check if scheduling columns exist
    const schemaCheck = await db.query(`
      PRAGMA table_info(content_queue)
    `)
    
    const columns = schemaCheck.rows.map((row: any) => row.name)
    const requiredColumns = ['status', 'priority', 'scheduled_for', 'posted_at', 'updated_at']
    const missingColumns = requiredColumns.filter(col => !columns.includes(col))
    
    if (missingColumns.length === 0) {
      checklist.push({
        name: 'Database Schema',
        description: 'All required scheduling columns present',
        status: 'success',
        details: `Columns: ${requiredColumns.join(', ')}`
      })
    } else {
      checklist.push({
        name: 'Database Schema',
        description: 'Missing required columns',
        status: 'error',
        details: `Missing: ${missingColumns.join(', ')}`,
        fix: 'Run: npm run db:migrate-scheduling'
      })
    }
  } catch (error) {
    checklist.push({
      name: 'Database Schema',
      description: 'Failed to check database schema',
      status: 'error',
      details: error instanceof Error ? error.message : 'Unknown error',
      fix: 'Check database connection and run migrations'
    })
  }
  
  // 2. Content Availability Check
  try {
    const contentCheck = await db.query(`
      SELECT 
        COUNT(CASE WHEN is_approved = 1 AND is_posted = 0 AND status = 'approved' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
        COUNT(CASE WHEN is_posted = 1 THEN 1 END) as posted
      FROM content_queue
    `)
    
    const content = contentCheck.rows[0]
    const daysOfContent = Math.floor(content.available / 6)
    
    if (daysOfContent >= 7) {
      checklist.push({
        name: 'Content Buffer',
        description: 'Sufficient content available for scheduling',
        status: 'success',
        details: `${daysOfContent} days of content (${content.available} posts)`
      })
    } else if (daysOfContent >= 3) {
      checklist.push({
        name: 'Content Buffer',
        description: 'Limited content available',
        status: 'warning',
        details: `Only ${daysOfContent} days of content (${content.available} posts)`,
        fix: 'Run content scanning to gather more posts'
      })
    } else {
      checklist.push({
        name: 'Content Buffer',
        description: 'Insufficient content for reliable scheduling',
        status: 'error',
        details: `Only ${daysOfContent} days of content (${content.available} posts)`,
        fix: 'Run aggressive content scanning and approval'
      })
    }
  } catch (error) {
    checklist.push({
      name: 'Content Buffer',
      description: 'Failed to check content availability',
      status: 'error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
  
  // 3. Scheduler Service Test
  try {
    const scheduleTest = await scheduleNextBatch(1, 3) // Test with 1 day, 3 posts
    
    if (scheduleTest.summary.totalScheduled > 0) {
      checklist.push({
        name: 'Scheduler Service',
        description: 'Scheduling service operational',
        status: 'success',
        details: `Scheduled ${scheduleTest.summary.totalScheduled} posts successfully`
      })
    } else if (scheduleTest.errors.length > 0) {
      checklist.push({
        name: 'Scheduler Service',
        description: 'Scheduler has issues',
        status: 'warning',
        details: `Errors: ${scheduleTest.errors.join(', ')}`,
        fix: 'Check content availability and platform diversity settings'
      })
    } else {
      checklist.push({
        name: 'Scheduler Service',
        description: 'Scheduler returned no results',
        status: 'warning',
        details: 'No content was scheduled',
        fix: 'Verify approved content exists and meets scheduling criteria'
      })
    }
  } catch (error) {
    checklist.push({
      name: 'Scheduler Service',
      description: 'Scheduler service failed',
      status: 'error',
      details: error instanceof Error ? error.message : 'Unknown error',
      fix: 'Check scheduler service implementation and dependencies'
    })
  }
  
  // 4. API Endpoints Check
  try {
    // Test if we can get upcoming schedule
    const upcomingSchedule = await getUpcomingSchedule(7)
    
    checklist.push({
      name: 'API Endpoints',
      description: 'Core API functions working',
      status: 'success',
      details: `Retrieved ${upcomingSchedule.length} scheduled items`
    })
  } catch (error) {
    checklist.push({
      name: 'API Endpoints',
      description: 'API functions failed',
      status: 'error',
      details: error instanceof Error ? error.message : 'Unknown error',
      fix: 'Check API implementations and database connectivity'
    })
  }
  
  // 5. Platform Diversity Check
  try {
    const platformCheck = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) as count
      FROM content_queue 
      WHERE is_approved = 1 AND is_posted = 0 AND status = 'approved'
      GROUP BY source_platform
      HAVING COUNT(*) > 0
      ORDER BY count DESC
    `)
    
    const platforms = platformCheck.rows
    const uniquePlatforms = platforms.length
    
    if (uniquePlatforms >= 5) {
      checklist.push({
        name: 'Platform Diversity',
        description: 'Excellent platform diversity',
        status: 'success',
        details: `${uniquePlatforms} platforms available: ${platforms.map(p => p.source_platform).join(', ')}`
      })
    } else if (uniquePlatforms >= 3) {
      checklist.push({
        name: 'Platform Diversity',
        description: 'Good platform diversity',
        status: 'success',
        details: `${uniquePlatforms} platforms available: ${platforms.map(p => p.source_platform).join(', ')}`
      })
    } else if (uniquePlatforms >= 2) {
      checklist.push({
        name: 'Platform Diversity',
        description: 'Limited platform diversity',
        status: 'warning',
        details: `Only ${uniquePlatforms} platforms: ${platforms.map(p => p.source_platform).join(', ')}`,
        fix: 'Enable more content sources for better diversity'
      })
    } else {
      checklist.push({
        name: 'Platform Diversity',
        description: 'Poor platform diversity',
        status: 'error',
        details: `Only ${uniquePlatforms} platform(s) available`,
        fix: 'Add content from multiple platforms before deployment'
      })
    }
  } catch (error) {
    checklist.push({
      name: 'Platform Diversity',
      description: 'Failed to check platform diversity',
      status: 'error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
  
  // 6. Environment Configuration
  const requiredEnvVars = [
    'JWT_SECRET',
    'NODE_ENV'
  ]
  
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
  
  if (missingEnvVars.length === 0) {
    checklist.push({
      name: 'Environment Config',
      description: 'All required environment variables set',
      status: 'success',
      details: 'JWT_SECRET, NODE_ENV configured'
    })
  } else {
    checklist.push({
      name: 'Environment Config',
      description: 'Missing environment variables',
      status: 'error',
      details: `Missing: ${missingEnvVars.join(', ')}`,
      fix: 'Set all required environment variables'
    })
  }
  
  // 7. Performance Indexes Check
  try {
    const indexCheck = await db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='index' 
      AND name LIKE '%scheduling%' 
      OR name LIKE '%posted_content%'
      OR name LIKE '%content_queue%'
    `)
    
    const indexes = indexCheck.rows.map((row: any) => row.name)
    const hasSchedulingIndexes = indexes.some(name => 
      name.includes('scheduling') || 
      name.includes('posted_content') || 
      name.includes('content_queue')
    )
    
    if (hasSchedulingIndexes) {
      checklist.push({
        name: 'Database Indexes',
        description: 'Performance indexes present',
        status: 'success',
        details: `Found indexes: ${indexes.join(', ')}`
      })
    } else {
      checklist.push({
        name: 'Database Indexes',
        description: 'Missing performance indexes',
        status: 'warning',
        details: 'No scheduling-specific indexes found',
        fix: 'Run database migration to add performance indexes'
      })
    }
  } catch (error) {
    checklist.push({
      name: 'Database Indexes',
      description: 'Failed to check indexes',
      status: 'warning',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
  
  return checklist
}

async function main() {
  console.log('🚀 Deployment Checklist for Scheduling System')
  console.log('=' .repeat(50))
  
  try {
    const checklist = await runDeploymentChecklist()
    
    let successCount = 0
    let warningCount = 0
    let errorCount = 0
    
    // Display results
    checklist.forEach((item, index) => {
      const statusIcon = {
        success: '✅',
        warning: '⚠️',
        error: '❌',
        pending: '⏳'
      }[item.status]
      
      console.log(`\n${index + 1}. ${statusIcon} ${item.name}`)
      console.log(`   ${item.description}`)
      
      if (item.details) {
        console.log(`   Details: ${item.details}`)
      }
      
      if (item.fix) {
        console.log(`   Fix: ${item.fix}`)
      }
      
      // Count statuses
      switch (item.status) {
        case 'success': successCount++; break
        case 'warning': warningCount++; break
        case 'error': errorCount++; break
      }
    })
    
    // Summary
    console.log('\n' + '=' .repeat(50))
    console.log('📊 DEPLOYMENT READINESS SUMMARY')
    console.log(`✅ Passed: ${successCount}`)
    console.log(`⚠️  Warnings: ${warningCount}`)
    console.log(`❌ Errors: ${errorCount}`)
    
    // Deployment recommendation
    if (errorCount === 0 && warningCount <= 1) {
      console.log('\n🎉 SYSTEM READY FOR DEPLOYMENT')
      console.log('All critical checks passed. The scheduling system is production-ready.')
    } else if (errorCount === 0) {
      console.log('\n⚠️  DEPLOYMENT WITH CAUTION')
      console.log('No critical errors, but warnings should be addressed post-deployment.')
    } else {
      console.log('\n🚫 NOT READY FOR DEPLOYMENT')
      console.log('Critical errors must be resolved before deployment.')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Deployment checklist failed:', error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Run checklist if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('deployment-checklist')
if (isMainModule) {
  main()
}

export { runDeploymentChecklist }