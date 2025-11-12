#!/usr/bin/env tsx

/**
 * Check the actual columns in content_queue table using SQL schema query
 */

import postgres from 'postgres'

async function checkSchema() {
  const POSTGRES_URL = process.env.POSTGRES_URL

  if (!POSTGRES_URL) {
    console.error('POSTGRES_URL not found')
    process.exit(1)
  }

  console.log('Connecting to:', POSTGRES_URL.substring(0, 50) + '...')

  const sql = postgres(POSTGRES_URL, { max: 1 })

  try {
    // Query the information_schema to get column definitions
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'content_queue'
      ORDER BY ordinal_position
    `

    console.log('\n✅ content_queue table schema:\n')
    console.log('Column Name                 Type                Nullable')
    console.log('─'.repeat(70))

    columns.forEach(col => {
      console.log(
        `${col.column_name.padEnd(28)} ${col.data_type.padEnd(20)} ${col.is_nullable}`
      )
    })

    // Check specifically for URL-related columns
    console.log('\n🔍 URL-related columns:')
    const urlColumns = columns.filter(col =>
      col.column_name.toLowerCase().includes('url') ||
      col.column_name.toLowerCase().includes('link') ||
      col.column_name.toLowerCase().includes('source')
    )

    if (urlColumns.length > 0) {
      urlColumns.forEach(col => {
        console.log(`  ✓ ${col.column_name} (${col.data_type})`)
      })
    } else {
      console.log('  ⚠️  No URL/link/source columns found!')
    }

    await sql.end()
    process.exit(0)
  } catch (error: any) {
    console.error('Error:', error.message)
    await sql.end()
    process.exit(1)
  }
}

checkSchema()
