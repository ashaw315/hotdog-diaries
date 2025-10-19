#!/usr/bin/env tsx

/**
 * Synthetic posting canary - dry run test
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { getCurrentET } from './lib/time'

interface CanaryResult {
  status: 'SUCCESS' | 'FAILED' | 'NOT_CONFIGURED' | 'SKIPPED'
  runtime: string
  message: string
  timingMs?: number
  path?: string[]
}

async function main() {
  const runCanary = process.env.RUN_CANARY === 'true'
  
  if (!runCanary) {
    console.log('⏩ Canary skipped (RUN_CANARY != true)')
    await saveResult({
      status: 'SKIPPED',
      runtime: getCurrentET(),
      message: 'Canary not requested'
    })
    return
  }

  console.log('🐤 Running synthetic posting canary...')

  // Check if we're in a safe time window (06:20-06:40 ET)
  const currentET = getCurrentET()
  const currentHour = parseInt(currentET.split(':')[0])
  const currentMinute = parseInt(currentET.split(':')[1])
  
  const isSafeWindow = (currentHour === 6 && currentMinute >= 20 && currentMinute <= 40)
  
  if (!isSafeWindow) {
    console.log(`⏩ Canary skipped - outside safe window (current: ${currentET})`)
    await saveResult({
      status: 'SKIPPED',
      runtime: currentET,
      message: 'Outside safe window (06:20-06:40 ET)'
    })
    return
  }

  const startTime = Date.now()
  const path: string[] = []

  try {
    // Step 1: Check if dry-run endpoint exists
    console.log('  Step 1: Checking dry-run endpoint...')
    path.push('check_endpoint')
    
    const baseUrl = process.env.PROD_BASE_URL || 'https://hotdog-diaries.vercel.app'
    const dryRunUrl = `${baseUrl}/api/internal/posting/dry-run`
    
    const checkResponse = await fetch(dryRunUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'HotdogDiaries-Canary/1.0'
      }
    }).catch(() => null)

    if (!checkResponse || checkResponse.status === 404) {
      console.log('  → Dry-run endpoint not configured')
      await saveResult({
        status: 'NOT_CONFIGURED',
        runtime: currentET,
        message: 'Dry-run endpoint not found',
        path
      })
      return
    }

    // Step 2: Execute dry-run posting
    console.log('  Step 2: Executing dry-run posting...')
    path.push('execute_dryrun')

    const postResponse = await fetch(dryRunUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HotdogDiaries-Canary/1.0',
        'X-Dry-Run': 'true'
      },
      body: JSON.stringify({
        slot: 'canary-test',
        dryRun: true,
        source: 'prod-watchdog'
      })
    })

    const result = await postResponse.json().catch(() => ({}))
    path.push('parse_response')

    if (!postResponse.ok) {
      throw new Error(`Dry-run failed: ${postResponse.status} - ${JSON.stringify(result)}`)
    }

    // Step 3: Validate response
    console.log('  Step 3: Validating response...')
    path.push('validate')

    if (result.error) {
      throw new Error(`Dry-run error: ${result.error}`)
    }

    const timingMs = Date.now() - startTime
    console.log(`  ✅ Canary successful in ${timingMs}ms`)

    await saveResult({
      status: 'SUCCESS',
      runtime: currentET,
      message: 'Dry-run posting completed successfully',
      timingMs,
      path
    })

  } catch (error: any) {
    const timingMs = Date.now() - startTime
    console.error(`  ❌ Canary failed: ${error.message}`)
    
    await saveResult({
      status: 'FAILED',
      runtime: currentET,
      message: error.message,
      timingMs,
      path
    })

    process.exit(1)
  }
}

async function saveResult(result: CanaryResult) {
  await mkdir('ci_audit/watchdog', { recursive: true })
  await writeFile(
    'ci_audit/watchdog/canary.json',
    JSON.stringify({
      ...result,
      timestamp: new Date().toISOString()
    }, null, 2)
  )
}

// ES module check for direct execution
if (process.argv[1] && process.argv[1].includes('synthetic-post-canary')) {
  main().catch(console.error)
}

export { main as syntheticPostCanary }