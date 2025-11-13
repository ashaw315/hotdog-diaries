#!/usr/bin/env tsx

/**
 * Check the actual columns in posted_content table
 */

import postgres from 'postgres'

async function checkSchema() {
  const POSTGRES_URL = process.env.POSTGRES_URL

  if (!POSTGRES_URL) {
    console.error('POSTGRES_URL not found')
    process.exit(1)
  }

  const sql = postgres(POSTGRES_URL, { max: 1 })

  try {
    // Query the information_schema to get column definitions
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'posted_content'
      ORDER BY ordinal_position
    `

    console.log('\n✅ posted_content table schema:\n')
    console.log('Column Name                 Type                Nullable')
    console.log('─'.repeat(70))

    columns.forEach(col => {
      console.log(
        `${col.column_name.padEnd(28)} ${col.data_type.padEnd(20)} ${col.is_nullable}`
      )
    })

    // Check for posted_at column specifically
    const hasPostedAt = columns.some(col => col.column_name === 'posted_at')
    console.log(`\n${hasPostedAt ? '✅' : '❌'} posted_at column ${hasPostedAt ? 'EXISTS' : 'MISSING'}`)

    // Sample some data from posted_content
    console.log('\n🔍 Sample posted_content rows:\n')
    const sampleRows = await sql`
      SELECT *
      FROM posted_content
      ORDER BY id DESC
      LIMIT 5
    `

    sampleRows.forEach(row => {
      console.log('Row:', JSON.stringify(row, null, 2))
    })

    await sql.end()
    process.exit(0)
  } catch (error: any) {
    console.error('Error:', error.message)
    await sql.end()
    process.exit(1)
  }
}

checkSchema()
