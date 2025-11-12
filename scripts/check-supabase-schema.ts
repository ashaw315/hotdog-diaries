#!/usr/bin/env tsx

/**
 * Check the actual columns in Supabase content_queue table
 */

import { createClient } from '@supabase/supabase-js'

async function checkSchema() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials')
      console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'present' : 'missing')
      console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'present' : 'missing')
      process.exit(1)
    }

    console.log('Connecting to Supabase:', supabaseUrl)

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get a single row to see all available columns
    const { data, error } = await supabase
      .from('content_queue')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Error querying Supabase:', error)
      process.exit(1)
    }

    if (data && data.length > 0) {
      console.log('\n✅ Successfully queried content_queue table')
      console.log('\n📋 Available columns:')
      const columns = Object.keys(data[0]).sort()
      columns.forEach(col => {
        const value = data[0][col]
        const type = typeof value
        const preview = value ? String(value).substring(0, 50) : 'null/empty'
        console.log(`  - ${col}: (${type}) ${preview}`)
      })

      // Check for URL-related columns specifically
      console.log('\n🔍 URL-related columns:')
      const urlColumns = columns.filter(col =>
        col.toLowerCase().includes('url') ||
        col.toLowerCase().includes('link') ||
        col.toLowerCase().includes('source')
      )
      urlColumns.forEach(col => {
        console.log(`  ✓ ${col}: ${data[0][col] || '(null/empty)'}`)
      })

    } else {
      console.log('No rows found in content_queue table')
    }

    process.exit(0)
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

checkSchema()
