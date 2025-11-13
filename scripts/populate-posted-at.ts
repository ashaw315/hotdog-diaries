#!/usr/bin/env tsx

/**
 * Populate missing posted_at values in posted_content table
 * Uses created_at as the timestamp for when content was posted
 */

import { createClient } from '@supabase/supabase-js'

async function populatePostedAt() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  console.log('Connecting to Supabase...')
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // First, check how many rows have NULL posted_at
    const { data: nullRows, error: countError } = await supabase
      .from('posted_content')
      .select('id, created_at, post_order')
      .is('posted_at', null)
      .order('id', { ascending: true })

    if (countError) {
      throw new Error(`Failed to count NULL rows: ${countError.message}`)
    }

    console.log(`\n📊 Found ${nullRows?.length || 0} rows with NULL posted_at`)

    if (!nullRows || nullRows.length === 0) {
      console.log('✅ All rows already have posted_at values!')
      process.exit(0)
    }

    console.log('\n🔧 Updating posted_at to use created_at timestamp...\n')

    // Update each row to set posted_at = created_at
    let updated = 0
    let failed = 0

    for (const row of nullRows) {
      const { error: updateError } = await supabase
        .from('posted_content')
        .update({ posted_at: row.created_at })
        .eq('id', row.id)

      if (updateError) {
        console.error(`❌ Failed to update row ${row.id}:`, updateError.message)
        failed++
      } else {
        updated++
        if (updated % 10 === 0) {
          console.log(`   Updated ${updated}/${nullRows.length} rows...`)
        }
      }
    }

    console.log(`\n✅ Successfully updated ${updated} rows`)
    if (failed > 0) {
      console.log(`❌ Failed to update ${failed} rows`)
    }

    // Verify the update
    const { data: remainingNulls, error: verifyError } = await supabase
      .from('posted_content')
      .select('id')
      .is('posted_at', null)

    if (verifyError) {
      throw new Error(`Failed to verify update: ${verifyError.message}`)
    }

    console.log(`\n📊 Remaining NULL posted_at values: ${remainingNulls?.length || 0}`)

    if ((remainingNulls?.length || 0) === 0) {
      console.log('\n🎉 All posted_at values are now populated!')
    }

    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

populatePostedAt()
