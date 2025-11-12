#!/usr/bin/env tsx

/**
 * Test POSTGRES_URL connection to verify it has original_url data
 */

import { sql as vercelSql } from '@vercel/postgres'

async function testPostgresConnection() {
  try {
    console.log('Testing POSTGRES_URL connection...')
    console.log('Connection string prefix:', process.env.POSTGRES_URL?.substring(0, 50) + '...')

    const result = await vercelSql`
      SELECT id, content_text, original_url, source_platform
      FROM content_queue
      WHERE content_text ILIKE '%Unpopular hotdog condiment%'
      LIMIT 1
    `

    console.log('\n=== Result from POSTGRES_URL (Vercel SQL) ===')
    console.log('Rows found:', result.rows.length)

    if (result.rows.length > 0) {
      const row = result.rows[0]
      console.log('\nID:', row.id)
      console.log('Content:', row.content_text)
      console.log('Platform:', row.source_platform)
      console.log('URL:', row.original_url)
      console.log('URL is null:', row.original_url === null)
      console.log('URL type:', typeof row.original_url)
    } else {
      console.log('No rows found')
    }

    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    console.error('Full error:', error)
    process.exit(1)
  }
}

testPostgresConnection()
