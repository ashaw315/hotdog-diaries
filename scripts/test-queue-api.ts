// Test what the queue API returns
const SITE_URL = 'https://hotdog-diaries.vercel.app'

async function testAPI() {
  try {
    // Mint a JWT token
    const { mintJWT } = await import('./ci/lib/jwt-core.js')
    const token = mintJWT({
      sub: 'test-queue',
      aud: 'api',
      iss: 'hotdog-diaries'
    }, process.env.JWT_SECRET!, { expiresIn: '10m' })
    
    // Test the content API with approved filter
    const response = await fetch(`${SITE_URL}/api/admin/content?status=approved&limit=10`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    const data = await response.json()
    
    if (data.success && data.data) {
      console.log(`\nApproved content (first 10 items):`)
      console.log(`Total: ${data.data.pagination.total}`)
      console.log(`\nPlatforms in this batch:`)
      const platforms = new Set(data.data.content.map((item: any) => item.source_platform))
      platforms.forEach(p => console.log(`  - ${p}`))
      
      console.log(`\nFirst item:`)
      console.log(JSON.stringify(data.data.content[0], null, 2))
    } else {
      console.log('Error:', data)
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testAPI()
