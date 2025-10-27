// Create admin user in production database using hybrid db connection
import { db } from '../lib/db'
import { AuthService } from '../lib/services/auth'

async function createProductionAdmin() {
  try {
    console.log('🔧 Creating production admin user...')

    // Check if admin user already exists
    console.log('👤 Checking for existing admin user...')
    const existingResult = await db.query<{ id: number; username: string; email: string }>(
      'SELECT id, username, email FROM admin_users WHERE username = $1',
      ['admin']
    )

    if (existingResult.rows && existingResult.rows.length > 0) {
      const existingUser = existingResult.rows[0]
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
    const newUserResult = await db.query<{ id: number; username: string; email: string }>(
      `INSERT INTO admin_users (
        username, 
        password_hash, 
        email, 
        full_name, 
        is_active, 
        created_at, 
        updated_at,
        login_count
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 0)
      RETURNING id, username, email`,
      ['admin', passwordHash, 'admin@hotdogdiaries.com', 'Administrator', true]
    )

    const newUser = newUserResult.rows?.[0]
    if (!newUser) {
      throw new Error('Failed to create admin user')
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
    console.error('❌ Failed to create admin user:', error)
  } finally {
    await db.disconnect()
  }
}

createProductionAdmin()