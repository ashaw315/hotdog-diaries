# STEP 6: Ingestion Job Quotas System

## Overview
Implement per-platform daily quotas and buffer floors to prevent future ingestion skew.

## 1. Quota Configuration

```typescript
// lib/utils/ingestion-quotas.ts

export interface PlatformQuotas {
  dailyCap: number      // Max items per day per platform
  bufferFloor: number   // Min approved unposted items to maintain
  burstAllowed: number  // Items to fetch when below floor
}

export const PLATFORM_QUOTAS: Record<string, PlatformQuotas> = {
  pixabay: { dailyCap: 50, bufferFloor: 100, burstAllowed: 150 },
  bluesky: { dailyCap: 50, bufferFloor: 100, burstAllowed: 150 },
  reddit: { dailyCap: 30, bufferFloor: 50, burstAllowed: 100 },
  giphy: { dailyCap: 25, bufferFloor: 40, burstAllowed: 80 },
  imgur: { dailyCap: 25, bufferFloor: 40, burstAllowed: 80 },
  tumblr: { dailyCap: 20, bufferFloor: 30, burstAllowed: 60 },
  lemmy: { dailyCap: 20, bufferFloor: 30, burstAllowed: 60 },
  mastodon: { dailyCap: 15, bufferFloor: 25, burstAllowed: 50 },
  youtube: { dailyCap: 10, bufferFloor: 15, burstAllowed: 30 },
  default: { dailyCap: 30, bufferFloor: 50, burstAllowed: 100 }
}

export function getPlatformQuota(platform: string): PlatformQuotas {
  return PLATFORM_QUOTAS[platform.toLowerCase()] || PLATFORM_QUOTAS.default
}
```

## 2. Quota Enforcement Functions

```typescript
// lib/services/ingestion-quota-manager.ts

import { createClient } from '@supabase/supabase-js'
import { getPlatformQuota } from '../utils/ingestion-quotas'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export class IngestionQuotaManager {
  
  async countInsertedToday(platform: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]
    const todayStart = `${today}T00:00:00Z`
    const todayEnd = `${today}T23:59:59Z`
    
    const { count } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true })
      .eq('source_platform', platform)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
    
    return count || 0
  }
  
  async countApprovedUnposted(platform: string): Promise<number> {
    const { count } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true })
      .eq('source_platform', platform)
      .eq('is_approved', true)
      .eq('is_posted', false)
      .gte('ingest_priority', 0)  // Only count active priority items
    
    return count || 0
  }
  
  async shouldThrottleIngestion(platform: string): Promise<{
    shouldThrottle: boolean
    reason: string
    insertedToday: number
    availableBuffer: number
  }> {
    const quota = getPlatformQuota(platform)
    const insertedToday = await this.countInsertedToday(platform)
    const availableBuffer = await this.countApprovedUnposted(platform)
    
    if (insertedToday >= quota.dailyCap) {
      return {
        shouldThrottle: true,
        reason: `Daily cap reached (${insertedToday}/${quota.dailyCap})`,
        insertedToday,
        availableBuffer
      }
    }
    
    if (availableBuffer >= quota.bufferFloor * 2) {
      return {
        shouldThrottle: true,
        reason: `Buffer overflow (${availableBuffer} items, target: ${quota.bufferFloor})`,
        insertedToday,
        availableBuffer
      }
    }
    
    return {
      shouldThrottle: false,
      reason: 'Within quota limits',
      insertedToday,
      availableBuffer
    }
  }
  
  async shouldBoostIngestion(platform: string): Promise<{
    shouldBoost: boolean
    targetItems: number
    availableBuffer: number
  }> {
    const quota = getPlatformQuota(platform)
    const availableBuffer = await this.countApprovedUnposted(platform)
    
    if (availableBuffer < quota.bufferFloor) {
      return {
        shouldBoost: true,
        targetItems: quota.burstAllowed,
        availableBuffer
      }
    }
    
    return {
      shouldBoost: false,
      targetItems: 0,
      availableBuffer
    }
  }
  
  async getAllPlatformStatus(): Promise<Record<string, {
    insertedToday: number
    bufferSize: number
    quota: PlatformQuotas
    status: 'throttled' | 'boost' | 'normal'
    action: string
  }>> {
    const platforms = Object.keys(PLATFORM_QUOTAS).filter(p => p !== 'default')
    const status: Record<string, any> = {}
    
    for (const platform of platforms) {
      const insertedToday = await this.countInsertedToday(platform)
      const bufferSize = await this.countApprovedUnposted(platform)
      const quota = getPlatformQuota(platform)
      
      const throttleCheck = await this.shouldThrottleIngestion(platform)
      const boostCheck = await this.shouldBoostIngestion(platform)
      
      let statusType: 'throttled' | 'boost' | 'normal' = 'normal'
      let action = 'Continue normal ingestion'
      
      if (throttleCheck.shouldThrottle) {
        statusType = 'throttled'
        action = `PAUSE: ${throttleCheck.reason}`
      } else if (boostCheck.shouldBoost) {
        statusType = 'boost'
        action = `BOOST: Fetch ${boostCheck.targetItems} items (${bufferSize}/${quota.bufferFloor})`
      }
      
      status[platform] = {
        insertedToday,
        bufferSize,
        quota,
        status: statusType,
        action
      }
    }
    
    return status
  }
}
```

## 3. Collector Integration

```typescript
// scripts/collectors/base-collector.ts

import { IngestionQuotaManager } from '../lib/services/ingestion-quota-manager'

export abstract class BaseCollector {
  protected quotaManager = new IngestionQuotaManager()
  protected platform: string
  
  constructor(platform: string) {
    this.platform = platform
  }
  
  async shouldRunCollection(): Promise<{
    run: boolean
    maxItems: number
    reason: string
  }> {
    const throttleCheck = await this.quotaManager.shouldThrottleIngestion(this.platform)
    
    if (throttleCheck.shouldThrottle) {
      return {
        run: false,
        maxItems: 0,
        reason: throttleCheck.reason
      }
    }
    
    const boostCheck = await this.quotaManager.shouldBoostIngestion(this.platform)
    
    if (boostCheck.shouldBoost) {
      return {
        run: true,
        maxItems: boostCheck.targetItems,
        reason: `Boost collection - buffer low (${boostCheck.availableBuffer} items)`
      }
    }
    
    const quota = getPlatformQuota(this.platform)
    const remainingDaily = quota.dailyCap - throttleCheck.insertedToday
    
    return {
      run: true,
      maxItems: Math.min(remainingDaily, 25), // Normal batch size
      reason: `Normal collection (${remainingDaily} items remaining today)`
    }
  }
  
  async collect(): Promise<void> {
    const decision = await this.shouldRunCollection()
    
    console.log(`🔍 ${this.platform} collection decision: ${decision.reason}`)
    
    if (!decision.run) {
      console.log(`⏸️ Skipping ${this.platform} collection: ${decision.reason}`)
      return
    }
    
    console.log(`🚀 Starting ${this.platform} collection (max ${decision.maxItems} items)`)
    
    try {
      await this.performCollection(decision.maxItems)
    } catch (error) {
      console.error(`❌ ${this.platform} collection failed:`, error)
    }
  }
  
  abstract performCollection(maxItems: number): Promise<void>
}
```

## 4. Round-Robin Execution

```typescript
// scripts/run-balanced-ingestion.ts

import { IngestionQuotaManager } from '../lib/services/ingestion-quota-manager'

async function runBalancedIngestion() {
  const quotaManager = new IngestionQuotaManager()
  const platformStatus = await quotaManager.getAllPlatformStatus()
  
  console.log('📊 PLATFORM STATUS REPORT:')
  console.log('Platform'.padEnd(12) + 'Inserted'.padEnd(10) + 'Buffer'.padEnd(8) + 'Status'.padEnd(12) + 'Action')
  console.log('='.repeat(70))
  
  const priorityOrder: Array<{platform: string, priority: number}> = []
  
  Object.entries(platformStatus).forEach(([platform, status]) => {
    console.log(
      platform.padEnd(12) + 
      status.insertedToday.toString().padEnd(10) + 
      status.bufferSize.toString().padEnd(8) + 
      status.status.toUpperCase().padEnd(12) + 
      status.action
    )
    
    // Calculate priority for round-robin
    let priority = 0
    if (status.status === 'boost') priority = 100  // Highest priority
    else if (status.status === 'normal') priority = 50
    else priority = 0  // Throttled platforms get no priority
    
    priorityOrder.push({ platform, priority })
  })
  
  // Sort by priority, then randomize within same priority
  priorityOrder.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    return Math.random() - 0.5  // Random order for same priority
  })
  
  console.log('\n🔄 EXECUTION ORDER:')
  priorityOrder.forEach(({ platform }, index) => {
    console.log(`${index + 1}. ${platform}`)
  })
  
  // Execute collectors in priority order
  for (const { platform } of priorityOrder) {
    const status = platformStatus[platform]
    if (status.status !== 'throttled') {
      console.log(`\n🚀 Running ${platform} collector...`)
      // await runCollector(platform)  // Implement collector execution
    }
  }
}

// Export for cron/GitHub Actions
export { runBalancedIngestion }
```

## 5. Monitoring Dashboard

```typescript
// scripts/ingestion-balance-report.ts

import { IngestionQuotaManager } from '../lib/services/ingestion-quota-manager'

async function generateBalanceReport() {
  const quotaManager = new IngestionQuotaManager()
  const status = await quotaManager.getAllPlatformStatus()
  
  const summary = {
    timestamp: new Date().toISOString(),
    totalPlatforms: Object.keys(status).length,
    throttledPlatforms: Object.values(status).filter(s => s.status === 'throttled').length,
    boostNeeded: Object.values(status).filter(s => s.status === 'boost').length,
    totalBufferSize: Object.values(status).reduce((sum, s) => sum + s.bufferSize, 0),
    platforms: status
  }
  
  console.log('📊 INGESTION BALANCE REPORT')
  console.log('============================')
  console.log(`🕐 Generated: ${summary.timestamp}`)
  console.log(`📈 Platforms needing boost: ${summary.boostNeeded}`)
  console.log(`⏸️ Throttled platforms: ${summary.throttledPlatforms}`)
  console.log(`📦 Total buffer size: ${summary.totalBufferSize} items`)
  
  // Export for monitoring
  return summary
}

export { generateBalanceReport }
```

