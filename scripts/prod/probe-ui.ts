#!/usr/bin/env tsx

/**
 * Probe production UI health endpoints
 */

import { parseArgs } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { getTodayET } from './lib/time'

interface Args {
  date?: string
}

interface ProbeResult {
  endpoint: string
  status: number
  ok: boolean
  body?: any
  error?: string
  responseTime: number
}

interface UIProbeReport {
  date: string
  baseUrl: string
  checkedAt: string
  probes: ProbeResult[]
  overallOk: boolean
}

async function main() {
  const { values } = parseArgs({
    options: {
      date: { type: 'string' }
    }
  })

  const args: Args = {
    date: values.date || getTodayET()
  }

  const baseUrl = process.env.PROD_BASE_URL || 'https://hotdog-diaries.vercel.app'

  console.log(`🔍 Probing UI at ${baseUrl} for ${args.date}`)

  const probes: ProbeResult[] = []

  // Probe 1: Schedule health endpoint
  console.log('  Checking /api/health/schedule-tz...')
  const scheduleProbe = await probeEndpoint(
    `${baseUrl}/api/health/schedule-tz?date=${args.date}`
  )
  probes.push(scheduleProbe)
  console.log(`    → ${scheduleProbe.ok ? '✅' : '❌'} Status: ${scheduleProbe.status}`)

  // Probe 2: Source of truth endpoint
  console.log('  Checking /api/health/posting-source-of-truth...')
  const sourceProbe = await probeEndpoint(
    `${baseUrl}/api/health/posting-source-of-truth?date=${args.date}`
  )
  probes.push(sourceProbe)
  console.log(`    → ${sourceProbe.ok ? '✅' : '❌'} Status: ${sourceProbe.status}`)

  // Probe 3: Admin page (just check it loads)
  console.log('  Checking /admin page...')
  const adminProbe = await probeEndpoint(
    `${baseUrl}/admin`,
    {
      validateBody: (body: string) => {
        // Look for known markers in the admin page
        return body.includes('Forecast') || body.includes('Dashboard') || body.includes('Admin')
      }
    }
  )
  probes.push(adminProbe)
  console.log(`    → ${adminProbe.ok ? '✅' : '❌'} Status: ${adminProbe.status}`)

  // Probe 4: Main page
  console.log('  Checking / page...')
  const mainProbe = await probeEndpoint(
    baseUrl,
    {
      validateBody: (body: string) => {
        // Look for known markers
        return body.includes('Hotdog') || body.includes('hotdog') || body.includes('<!DOCTYPE')
      }
    }
  )
  probes.push(mainProbe)
  console.log(`    → ${mainProbe.ok ? '✅' : '❌'} Status: ${mainProbe.status}`)

  // Generate report
  const report: UIProbeReport = {
    date: args.date!,
    baseUrl,
    checkedAt: new Date().toISOString(),
    probes,
    overallOk: probes.every(p => p.ok)
  }

  // Save results
  await mkdir('ci_audit/watchdog', { recursive: true })
  await writeFile(
    'ci_audit/watchdog/ui-today.json',
    JSON.stringify(report, null, 2)
  )

  if (!report.overallOk) {
    const failures = probes.filter(p => !p.ok)
    console.error(`❌ ${failures.length} endpoint(s) failed`)
    process.exit(1)
  } else {
    console.log('✅ All endpoints healthy')
  }
}

async function probeEndpoint(
  url: string, 
  options?: {
    validateBody?: (body: string) => boolean
  }
): Promise<ProbeResult> {
  const startTime = Date.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HotdogDiaries-Watchdog/1.0'
      }
    })

    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    let body: any
    const contentType = response.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      body = await response.json()
    } else {
      body = await response.text()
    }

    let ok = response.status === 200

    // Additional validation
    if (ok && options?.validateBody) {
      ok = options.validateBody(typeof body === 'string' ? body : JSON.stringify(body))
    }

    // For JSON health endpoints, also check for ok: false
    if (ok && typeof body === 'object' && body.ok === false) {
      ok = false
    }

    return {
      endpoint: url,
      status: response.status,
      ok,
      body: typeof body === 'string' ? body.substring(0, 500) : body,
      responseTime
    }

  } catch (error: any) {
    return {
      endpoint: url,
      status: 0,
      ok: false,
      error: error.message,
      responseTime: Date.now() - startTime
    }
  }
}

// ES module check for direct execution
if (process.argv[1] && process.argv[1].includes('probe-ui')) {
  main().catch(console.error)
}

export { main as probeUI }