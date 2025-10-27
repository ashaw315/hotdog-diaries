// Test admin authentication with the new Supabase fallback
import { db } from '../lib/db'

async function testAuthFallback() {
  try {
    console.log('🧪 Testing admin authentication with Supabase fallback...')
    
    // Test the specific query used by AdminService.getAdminByUsername
    const result = await db.query<{ id: number; username: string; email: string }>(
      'SELECT id, username, email, full_name, is_active, created_at, last_login_at, login_count FROM admin_users WHERE username = $1 AND is_active = true LIMIT 1',
      ['admin']
    )
    
    console.log('✅ Admin user query successful via fallback!')
    console.log('Result:', result.rows)
    
    if (result.rows && result.rows.length > 0) {
      const user = result.rows[0]
      console.log(`🎉 Found admin user: ${user.username} (ID: ${user.id})`)
    } else {
      console.log('⚠️  No admin user found')
    }
    
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message)
  } finally {
    await db.disconnect()
  }
}

testAuthFallback()