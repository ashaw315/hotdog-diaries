#!/usr/bin/env tsx
/**
 * Force refill production scheduled_posts for specific date
 * This calls the same generateDailySchedule function that the forecast API uses
 */

import { generateDailySchedule } from '../lib/jobs/schedule-content-production'

async function forceRefillProduction() {
  const date = '2025-10-15'
  
  console.log(`🔧 Force refilling scheduled_posts for ${date}`)
  console.log('=' .repeat(50))
  
  try {
    // Set production environment
    process.env.NODE_ENV = 'production'
    
    // Call generateDailySchedule with forceRefill
    const result = await generateDailySchedule(date, {
      mode: 'create-or-reuse',
      forceRefill: true
    })
    
    console.log('✅ Schedule generation completed')
    console.log(`📊 Result:`, {
      date: result.date,
      filled: result.filled,
      mode: result.mode,
      environment: result.debug?.environment,
      candidatesFound: result.debug?.candidates_found
    })
    
    if (result.filled >= 6) {
      console.log('🎉 SUCCESS: All 6 slots should now be filled')
    } else {
      console.log(`⚠️ PARTIAL: Only ${result.filled} slots filled`)
    }
    
    return result
    
  } catch (error) {
    console.error('❌ Force refill failed:', error)
    throw error
  }
}

forceRefillProduction()