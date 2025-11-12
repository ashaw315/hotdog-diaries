#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function findItem() {
  const { data, error } = await supabase
    .from('content_queue')
    .select('*')
    .ilike('content_text', '%Unpopular hotdog condiment%')
    .limit(1)

  if (error) {
    console.error('Error:', error)
  } else if (data && data.length > 0) {
    const item = data[0]
    console.log('Found item:')
    console.log('ID:', item.id)
    console.log('Text:', item.content_text)
    console.log('Platform:', item.source_platform)
    console.log('Status:', item.content_status)
    console.log('original_url:', item.original_url)
    console.log('URL is null:', item.original_url === null)
    console.log('URL is undefined:', item.original_url === undefined)
    console.log('URL type:', typeof item.original_url)
    console.log('original_author:', item.original_author)
  } else {
    console.log('Item not found')
  }
}

findItem().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
