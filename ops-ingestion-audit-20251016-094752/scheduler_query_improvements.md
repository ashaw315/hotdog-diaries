# STEP 5: Scheduler Candidate Query Improvements

## Overview
Update the scheduler's content selection logic to:
1. Exclude deprioritized content (ingest_priority < 0)
2. Boost underrepresented platforms 
3. Maintain fallback for low-content scenarios

## 1. Updated Supabase Query Filter

**File**: `lib/services/schedule-content-production.ts` (or relevant scheduler file)

### BEFORE:
```typescript
const { data: candidates } = await supabase
  .from('content_queue')
  .select('id, source_platform, content_type, confidence_score, created_at')
  .eq('is_approved', true)
  .eq('is_posted', false)
  .order('confidence_score', { ascending: false })
  .order('created_at', { ascending: true })
  .limit(100)
```

### AFTER:
```typescript
// Get current pool distribution for underrep calculation
const poolDistribution = await getCurrentPoolDistribution()
const underrepPlatforms = getUnderrepresentedPlatforms(poolDistribution)

const { data: candidates } = await supabase
  .from('content_queue')
  .select('id, source_platform, content_type, confidence_score, created_at')
  .eq('is_approved', true)
  .eq('is_posted', false)
  .gte('ingest_priority', 0)  // NEW: Exclude deprioritized content
  .order('underrep_boost', { ascending: false })  // NEW: Boost underrep platforms
  .order('confidence_score', { ascending: false })
  .order('created_at', { ascending: true })
  .limit(200)  // Increased limit for better selection
```

## 2. Underrepresentation Boost Logic

Add these helper functions:

```typescript
interface PoolDistribution {
  [platform: string]: {
    count: number
    percentage: number
  }
}

async function getCurrentPoolDistribution(): Promise<PoolDistribution> {
  const { data } = await supabase
    .from('content_queue')
    .select('source_platform')
    .eq('is_approved', true)
    .eq('is_posted', false)
    .gte('ingest_priority', 0)
  
  const total = data?.length || 0
  const distribution = data?.reduce((acc, item) => {
    const platform = item.source_platform.toLowerCase()
    acc[platform] = (acc[platform] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}
  
  return Object.entries(distribution).reduce((acc, [platform, count]) => {
    acc[platform] = {
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }
    return acc
  }, {} as PoolDistribution)
}

function getUnderrepresentedPlatforms(distribution: PoolDistribution): string[] {
  const UNDERREP_THRESHOLD = 15  // Platforms below 15% are underrepresented
  
  return Object.entries(distribution)
    .filter(([_, data]) => data.percentage < UNDERREP_THRESHOLD)
    .map(([platform]) => platform)
}

// Enhanced candidate selection with underrep boost
async function selectDiverseCandidates(limit: number = 100) {
  const poolDistribution = await getCurrentPoolDistribution()
  const underrepPlatforms = getUnderrepresentedPlatforms(poolDistribution)
  
  console.log(`🎯 Boosting underrepresented platforms: ${underrepPlatforms.join(', ')}`)
  
  const { data: candidates } = await supabase
    .from('content_queue')
    .select('id, source_platform, content_type, confidence_score, created_at')
    .eq('is_approved', true)
    .eq('is_posted', false)
    .gte('ingest_priority', 0)
    .order('created_at', { ascending: true })
    .limit(limit * 2)  // Get more candidates for sorting
  
  if (!candidates) return []
  
  // Apply underrep boost in memory
  const boostedCandidates = candidates.map(item => ({
    ...item,
    underrep_boost: underrepPlatforms.includes(item.source_platform.toLowerCase()) ? 1 : 0
  }))
  
  // Sort with boost priority
  return boostedCandidates
    .sort((a, b) => {
      // First by underrep boost
      if (a.underrep_boost !== b.underrep_boost) {
        return b.underrep_boost - a.underrep_boost
      }
      // Then by confidence
      if (a.confidence_score !== b.confidence_score) {
        return b.confidence_score - a.confidence_score
      }
      // Finally by age (oldest first)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
    .slice(0, limit)
}
```

## 3. Fallback for Low Content Pool

```typescript
async function getSchedulerCandidates(requestedCount: number = 100): Promise<ContentCandidate[]> {
  // Try normal selection first
  let candidates = await selectDiverseCandidates(requestedCount)
  
  // If not enough candidates, relax priority filter
  if (candidates.length < requestedCount * 0.5) {
    console.log(`⚠️ Low candidate pool (${candidates.length}), including deprioritized content`)
    
    const { data: fallbackCandidates } = await supabase
      .from('content_queue')
      .select('id, source_platform, content_type, confidence_score, created_at')
      .eq('is_approved', true)
      .eq('is_posted', false)
      // No priority filter - include all content
      .order('confidence_score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(requestedCount)
    
    candidates = fallbackCandidates || []
  }
  
  return candidates
}
```

## 4. Usage in Scheduler

Update the main scheduling function:

```typescript
// In generateDailySchedule or equivalent function
const candidates = await getSchedulerCandidates(50)

console.log(`📊 Selected candidates from platforms:`, 
  [...new Set(candidates.map(c => c.source_platform))].join(', ')
)

// Continue with existing scheduling logic...
```

## Migration Notes

1. **Deploy Order**: Add `ingest_priority` column first, then deploy code changes
2. **Backward Compatibility**: Code works if `ingest_priority` column doesn't exist (COALESCE defaults to 0)
3. **Performance**: Consider adding composite index: `(is_approved, is_posted, ingest_priority, confidence_score)`
4. **Monitoring**: Log platform distribution in scheduled content to verify diversity improvements

