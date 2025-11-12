#!/usr/bin/env tsx

/**
 * Check what columns are detected in content_queue
 */

import { verifyTableColumns } from '@/lib/db-schema-utils'

async function checkSchemaDetection() {
  console.log('🔍 Checking schema detection for content_queue\n')

  const columns = await verifyTableColumns('content_queue')

  console.log(`Total columns detected: ${columns.length}`)
  console.log('\nColumns:')
  columns.forEach(col => {
    console.log(`  - ${col}`)
  })

  // Check for specific important columns
  const importantColumns = [
    'id',
    'content_text',
    'original_url',
    'original_author',
    'source_platform',
    'content_status',
    'is_posted',
    'is_approved'
  ]

  console.log('\nImportant columns check:')
  importantColumns.forEach(col => {
    const exists = columns.includes(col)
    console.log(`  ${exists ? '✅' : '❌'} ${col}`)
  })
}

checkSchemaDetection()
  .then(() => {
    console.log('\n✅ Check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error)
    process.exit(1)
  })
