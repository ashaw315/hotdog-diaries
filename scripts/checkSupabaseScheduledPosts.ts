// scripts/checkSupabaseScheduledPosts.ts
import { createClient } from '@supabase/supabase-js'

async function checkScheduledPostsTable() {
  console.log('🔍 Checking scheduled_posts table in Supabase...')
  
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
    process.exit(1)
  }
  
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    const { error } = await supabase.from('scheduled_posts').select('id').limit(1)
    
    if (error && String(error.message).includes("Could not find the table 'public.scheduled_posts'")) {
      console.error('❌ scheduled_posts missing in Supabase — run migration')
      console.error('Run: supabase/migrations/20251009_create_scheduled_posts.sql')
      process.exit(1)
    }
    
    if (error) {
      console.error('❌ Unexpected error accessing scheduled_posts:', error.message)
      process.exit(1)
    }
    
    console.log('✅ scheduled_posts present')
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Failed to check scheduled_posts table:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  checkScheduledPostsTable()
}

export default checkScheduledPostsTable