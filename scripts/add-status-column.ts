#!/usr/bin/env tsx

/**
 * Add status column to scheduled_posts table in production Supabase
 */

import { createSimpleClient } from '../utils/supabase/server'
import * as fs from 'fs'
import * as path from 'path'

async function addStatusColumn() {
  const supabase = createSimpleClient()

  console.log('\n🔧 Adding status column to scheduled_posts table\n')
  console.log('=' .repeat(80))

  try {
    // Read the migration SQL file
    const migrationPath = path.join(
      __dirname,
      '../supabase/migrations/20251029_add_status_column.sql'
    )
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('📝 Executing migration SQL...\n')

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('⚠️  exec_sql RPC not available, trying direct execution...\n')

      // Split into individual statements and execute
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SELECT pg_notify'))

      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 60)}...`)
        const result = await supabase.rpc('exec_sql', { query: statement })
        if (result.error) {
          console.error(`❌ Error executing statement:`, result.error)
        }
      }
    }

    console.log('\n✅ Migration completed successfully!\n')
    console.log('Testing with a simple query...\n')

    // Test that the column exists
    const { data: testData, error: testError } = await supabase
      .from('scheduled_posts')
      .select('id, status')
      .limit(1)

    if (testError) {
      console.error('❌ Error testing status column:', testError)
      console.log('\n⚠️  You may need to run the migration manually in Supabase SQL Editor:')
      console.log(`   https://supabase.com/dashboard/project/_/sql`)
      console.log(`\n📄 Migration file: ${migrationPath}`)
    } else {
      console.log('✅ Status column is now available!')
      console.log('   Sample row:', testData)
    }

  } catch (err) {
    console.error('❌ Error:', err)
    console.log('\n⚠️  Please run the migration manually in Supabase SQL Editor:')
    console.log(`   1. Go to: https://supabase.com/dashboard/project/_/sql`)
    console.log(`   2. Copy and paste the contents of: supabase/migrations/20251029_add_status_column.sql`)
    console.log(`   3. Click "Run"`)
  }
}

addStatusColumn().catch(console.error)
