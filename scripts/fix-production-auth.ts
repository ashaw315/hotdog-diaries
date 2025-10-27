// Create admin user directly via Supabase API since connection strings aren't working
import { createClient } from '@supabase/supabase-js'
import { AuthService } from '../lib/services/auth'

async function fixProductionAuth() {
  try {
    console.log('🔧 Creating admin user via Supabase API...')

    const supabaseUrl = process.env.SUPABASE_URL || "https://ulaadphxfsrihoubjdrb.supabase.co"
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFkcGh4ZnNyaWhvdWJqZHJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYxNjI1NiwiZXhwIjoyMDcxMTkyMjU2fQ.8u_cd_4_apKd_1baqPq82k3YuWUmmnM51lvZE7muLE4"

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if admin user already exists
    console.log('👤 Checking for existing admin user...')
    const { data: existingUsers, error: checkError } = await supabase
      .from('admin_users')
      .select('id, username, email')
      .eq('username', 'admin')
      .limit(1)

    if (checkError) {
      console.error('❌ Error checking existing users:', checkError.message)
      throw checkError
    }

    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0]
      console.log('✅ Admin user already exists:', existingUser)
      
      // Generate token for existing user
      const token = AuthService.generateJWT({ 
        id: existingUser.id, 
        username: existingUser.username 
      })
      console.log('🔑 Fresh AUTH_TOKEN for existing user:')
      console.log(token)
      
      return
    }

    console.log('➕ Creating new admin user...')
    
    // Hash the password
    const passwordHash = await AuthService.hashPassword('StrongAdminPass123!')
    
    // Create the admin user
    const { data: newUsers, error: insertError } = await supabase
      .from('admin_users')
      .insert({
        username: 'admin',
        password_hash: passwordHash,
        email: 'admin@hotdogdiaries.com',
        full_name: 'Administrator',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        login_count: 0
      })
      .select()

    if (insertError) {
      console.error('❌ Error creating admin user:', insertError.message)
      throw insertError
    }

    const newUser = newUsers?.[0]
    if (!newUser) {
      throw new Error('Failed to create admin user - no data returned')
    }
    
    console.log('✅ Admin user created successfully:', newUser)
    
    // Generate token for new user
    const token = AuthService.generateJWT({ 
      id: newUser.id, 
      username: newUser.username 
    })
    
    console.log('🔑 Fresh AUTH_TOKEN for new user:')
    console.log(token)
    
    console.log('')
    console.log('🎉 Admin user ready! Login credentials:')
    console.log('  Username: admin')
    console.log('  Password: StrongAdminPass123!')
    
  } catch (error) {
    console.error('❌ Failed to fix production auth:', error)
  }
}

fixProductionAuth()