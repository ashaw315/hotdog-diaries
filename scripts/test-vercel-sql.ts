// Test hybrid database connection
import { db } from '../lib/db'

async function testDatabaseConnection() {
  try {
    console.log('🧪 Testing hybrid database connection...')
    
    const result = await db.query<{ db: string; user: string }>(
      'SELECT current_database() as db, current_user as user'
    )
    console.log('✅ Database connection successful:', result.rows?.[0])
    
    // Check for admin_users table
    const tables = await db.query<{ table_name: string }>(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = 'admin_users'`
    )
    console.log('📋 admin_users table exists:', (tables.rows?.length || 0) > 0)
    
    if (tables.rows && tables.rows.length > 0) {
      // Check for existing admin user
      const adminUsers = await db.query<{ id: number; username: string; email: string }>(
        'SELECT id, username, email FROM admin_users WHERE username = $1',
        ['admin']
      )
      console.log('👤 Existing admin users:', adminUsers.rows)
    }
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error)
  } finally {
    await db.disconnect()
  }
}

testDatabaseConnection()