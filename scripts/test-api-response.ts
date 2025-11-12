#!/usr/bin/env tsx

/**
 * Test what the API actually returns
 */

async function testAPIResponse() {
  const baseUrl = 'https://hotdog-diaries.vercel.app'
  const url = `${baseUrl}/api/admin/content/queue?page=1&limit=10&status=discovered`

  console.log(`🧪 Testing API endpoint: ${url}\n`)

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${process.env.AUTH_TOKEN || 'test'}`
    }
  })

  if (!response.ok) {
    console.error('❌ API request failed:', response.status, response.statusText)
    const text = await response.text()
    console.error('Response:', text)
    return
  }

  const data = await response.json()

  console.log('Response structure:')
  console.log(`- content items: ${data.content?.length || 0}`)
  console.log(`- total: ${data.total}`)
  console.log(`- page: ${data.page}`)
  console.log(`- limit: ${data.limit}`)

  if (data.content && data.content.length > 0) {
    console.log('\n📋 First 3 items:')
    data.content.slice(0, 3).forEach((item: any, idx: number) => {
      console.log(`\n${idx + 1}. ID: ${item.id}`)
      console.log(`   Platform: ${item.source_platform}`)
      console.log(`   Status: ${item.content_status}`)
      console.log(`   Has original_url field: ${item.hasOwnProperty('original_url')}`)
      console.log(`   original_url value: '${item.original_url}'`)
      console.log(`   original_url is null: ${item.original_url === null}`)
      console.log(`   original_url is undefined: ${item.original_url === undefined}`)
      console.log(`   Text: ${item.content_text?.substring(0, 60)}...`)
    })
  }
}

testAPIResponse()
  .then(() => {
    console.log('\n✅ Test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })
