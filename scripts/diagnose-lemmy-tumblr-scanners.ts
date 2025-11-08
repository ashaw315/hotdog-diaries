/**
 * Diagnostic script to test Lemmy and Tumblr scanners directly
 * Bypasses smart-scan wrapper to see exact errors
 */

const SITE_URL = process.env.SITE_URL || 'https://hotdog-diaries.vercel.app'
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''

interface ScanResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
}

async function testScanner(platform: 'lemmy' | 'tumblr', maxPosts: number = 5): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔍 Testing ${platform.toUpperCase()} Scanner`)
  console.log(`${'='.repeat(60)}\n`)

  const url = `${SITE_URL}/api/admin/${platform}/scan`

  console.log(`📡 Calling: ${url}`)
  console.log(`🔧 Parameters: maxPosts=${maxPosts}`)
  console.log(`🔑 Auth: ${AUTH_TOKEN ? 'Token present (' + AUTH_TOKEN.length + ' chars)' : 'No token!'}\n`)

  try {
    const startTime = Date.now()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ maxPosts })
    })

    const duration = Date.now() - startTime

    console.log(`⏱️  Response time: ${duration}ms`)
    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`)
    console.log(`📋 Headers:`)
    response.headers.forEach((value, key) => {
      console.log(`   ${key}: ${value}`)
    })

    // Try to parse response as JSON
    const contentType = response.headers.get('content-type')
    let responseData: any

    if (contentType?.includes('application/json')) {
      responseData = await response.json()
      console.log(`\n✅ Valid JSON Response:`)
      console.log(JSON.stringify(responseData, null, 2))
    } else {
      const text = await response.text()
      console.log(`\n⚠️  Non-JSON Response (${contentType}):`)
      console.log(text.substring(0, 500))
      if (text.length > 500) {
        console.log(`... (truncated, ${text.length} total chars)`)
      }
      return
    }

    // Analyze the response
    console.log(`\n📈 Analysis:`)

    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status}`)
      if (responseData?.error) {
        console.log(`❌ Error Message: ${responseData.error}`)
      }
      return
    }

    if (responseData.success) {
      console.log(`✅ Success: ${responseData.success}`)

      if (responseData.data) {
        console.log(`📊 Scan Results:`)
        console.log(`   Total Found: ${responseData.data.totalFound || 0}`)
        console.log(`   Processed: ${responseData.data.processed || 0}`)
        console.log(`   Approved: ${responseData.data.approved || 0}`)
        console.log(`   Rejected: ${responseData.data.rejected || 0}`)
      }

      if (responseData.message) {
        console.log(`💬 Message: ${responseData.message}`)
      }
    } else {
      console.log(`❌ Success flag is false`)
      console.log(`❌ Error: ${responseData.error || 'Unknown error'}`)
    }

  } catch (error) {
    console.log(`\n❌ EXCEPTION THROWN:`)
    console.log(`   Type: ${error.constructor.name}`)
    console.log(`   Message: ${error.message}`)

    if (error.cause) {
      console.log(`   Cause: ${error.cause}`)
    }

    console.log(`\n   Full Error:`)
    console.log(error)
  }
}

async function testSmartScan(platform: 'lemmy' | 'tumblr'): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🧠 Testing Smart-Scan Wrapper for ${platform.toUpperCase()}`)
  console.log(`${'='.repeat(60)}\n`)

  const url = `${SITE_URL}/api/admin/smart-scan`

  console.log(`📡 Calling: ${url}`)
  console.log(`🔧 Parameters: platform=${platform}, forceOverride=true`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        platform,
        forceOverride: true,
        maxPosts: 5
      })
    })

    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`)

    const contentType = response.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      const data = await response.json()
      console.log(`\n✅ Response:`)
      console.log(JSON.stringify(data, null, 2))

      // Check what properties are present
      console.log(`\n🔍 Response Properties:`)
      console.log(`   Has 'skipped': ${data.skipped !== undefined}`)
      console.log(`   Has 'scanned': ${data.scanned !== undefined}`)
      console.log(`   Has 'success': ${data.success !== undefined}`)
      console.log(`   Has 'error': ${data.error !== undefined}`)
    } else {
      const text = await response.text()
      console.log(`\n⚠️  Non-JSON Response:`)
      console.log(text.substring(0, 500))
    }

  } catch (error) {
    console.log(`\n❌ Exception: ${error.message}`)
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Lemmy & Tumblr Scanner Diagnostic Tool                   ║
╚════════════════════════════════════════════════════════════╝
`)

  console.log(`🌐 Site URL: ${SITE_URL}`)
  console.log(`🔑 Auth Token: ${AUTH_TOKEN ? '✅ Set' : '❌ Missing'}`)

  if (!AUTH_TOKEN) {
    console.log(`\n⚠️  WARNING: No AUTH_TOKEN found!`)
    console.log(`   Set it with: export AUTH_TOKEN="your-token"`)
    console.log(`   Or run with: AUTH_TOKEN="..." pnpm tsx scripts/diagnose-lemmy-tumblr-scanners.ts\n`)
  }

  // Test 1: Direct scanner endpoints
  await testScanner('lemmy')
  await testScanner('tumblr')

  // Test 2: Smart-scan wrapper
  await testSmartScan('lemmy')
  await testSmartScan('tumblr')

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Diagnostic Complete`)
  console.log(`${'='.repeat(60)}\n`)
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
