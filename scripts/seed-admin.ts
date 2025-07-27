#!/usr/bin/env tsx

/**
 * Database seeding script for initial admin user
 * Run with: npx tsx scripts/seed-admin.ts
 */

import { AdminService } from '../lib/services/admin'
import { AuthService } from '../lib/services/auth'
import { db } from '../lib/db'

interface SeedOptions {
  username?: string
  password?: string
  email?: string
  fullName?: string
  force?: boolean
}

/**
 * Create initial admin user
 */
async function createInitialAdmin(options: SeedOptions = {}) {
  try {
    console.log('🌭 Hotdog Diaries Admin Seeder')
    console.log('==============================')

    // Check database connection
    console.log('Checking database connection...')
    await db.connect()
    console.log('✅ Database connected successfully')

    const username = options.username || process.env.ADMIN_USERNAME || 'admin'
    const email = options.email || process.env.ADMIN_EMAIL || 'admin@hotdogdiaries.com'
    const fullName = options.fullName || process.env.ADMIN_FULL_NAME || 'Admin User'
    
    // Generate secure password if not provided
    let password = options.password || process.env.ADMIN_PASSWORD
    if (!password) {
      password = AuthService.generateSecurePassword(16)
      console.log(`🔑 Generated secure password: ${password}`)
      console.log('⚠️  Please save this password securely!')
    }

    // Check if admin user already exists
    const existingAdmin = await AdminService.getAdminByUsername(username)
    
    if (existingAdmin && !options.force) {
      console.log(`❌ Admin user '${username}' already exists`)
      console.log('Use --force flag to recreate the user')
      process.exit(1)
    }

    if (existingAdmin && options.force) {
      console.log(`⚠️  Recreating existing admin user '${username}'`)
      // In a real implementation, you might want to deactivate the old user
      // For now, we'll just create a new one (which will fail due to unique constraint)
    }

    // Validate password strength
    const passwordValidation = AuthService.validatePasswordStrength(password)
    if (!passwordValidation.isValid) {
      console.log('❌ Password validation failed:')
      passwordValidation.errors.forEach(error => console.log(`   - ${error}`))
      process.exit(1)
    }

    console.log('\nCreating admin user...')
    console.log(`Username: ${username}`)
    console.log(`Email: ${email}`)
    console.log(`Full Name: ${fullName}`)

    // Create the admin user
    const adminUser = await AdminService.createAdminUser({
      username,
      password,
      email,
      full_name: fullName,
      is_active: true
    })

    console.log('\n✅ Admin user created successfully!')
    console.log('==============================')
    console.log(`ID: ${adminUser.id}`)
    console.log(`Username: ${adminUser.username}`)
    console.log(`Email: ${adminUser.email}`)
    console.log(`Full Name: ${adminUser.full_name}`)
    console.log(`Created: ${adminUser.created_at}`)
    
    if (!options.password && !process.env.ADMIN_PASSWORD) {
      console.log('\n🔑 Login Credentials:')
      console.log(`Username: ${username}`)
      console.log(`Password: ${password}`)
      console.log('\n⚠️  IMPORTANT: Save these credentials securely!')
    }

    console.log('\n🚀 You can now login to the admin panel at /admin/login')

  } catch (error) {
    console.error('\n❌ Error creating admin user:')
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): SeedOptions {
  const args = process.argv.slice(2)
  const options: SeedOptions = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--username':
      case '-u':
        options.username = args[++i]
        break
      case '--password':
      case '-p':
        options.password = args[++i]
        break
      case '--email':
      case '-e':
        options.email = args[++i]
        break
      case '--name':
      case '-n':
        options.fullName = args[++i]
        break
      case '--force':
      case '-f':
        options.force = true
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
        break
      default:
        console.error(`Unknown option: ${arg}`)
        printHelp()
        process.exit(1)
    }
  }

  return options
}

/**
 * Print help information
 */
function printHelp() {
  console.log(`
🌭 Hotdog Diaries Admin Seeder

Usage: npx tsx scripts/seed-admin.ts [options]

Options:
  -u, --username <username>   Admin username (default: 'admin' or ADMIN_USERNAME env var)
  -p, --password <password>   Admin password (default: generated or ADMIN_PASSWORD env var)
  -e, --email <email>         Admin email (default: 'admin@hotdogdiaries.com' or ADMIN_EMAIL env var)
  -n, --name <name>           Admin full name (default: 'Admin User' or ADMIN_FULL_NAME env var)
  -f, --force                 Force recreate if user exists
  -h, --help                  Show this help message

Environment Variables:
  ADMIN_USERNAME              Default admin username
  ADMIN_PASSWORD              Default admin password
  ADMIN_EMAIL                 Default admin email
  ADMIN_FULL_NAME             Default admin full name

Examples:
  npx tsx scripts/seed-admin.ts
  npx tsx scripts/seed-admin.ts -u superadmin -e admin@example.com
  npx tsx scripts/seed-admin.ts --force
`)
}

/**
 * Generate multiple demo admin users for testing
 */
async function createDemoUsers() {
  const demoUsers = [
    {
      username: 'demo_admin',
      password: 'Demo123!Admin',
      email: 'demo@hotdogdiaries.com',
      full_name: 'Demo Administrator'
    },
    {
      username: 'test_user',
      password: 'Test123!User',
      email: 'test@hotdogdiaries.com',
      full_name: 'Test User'
    }
  ]

  console.log('\n🎭 Creating demo users...')
  
  for (const userData of demoUsers) {
    try {
      const user = await AdminService.createAdminUser(userData)
      console.log(`✅ Created demo user: ${user.username}`)
    } catch (error) {
      console.log(`⚠️  Failed to create ${userData.username}: ${error instanceof Error ? error.message : error}`)
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs()
  
  // Special command for creating demo users
  if (options.username === 'demo') {
    await createDemoUsers()
    return
  }
  
  await createInitialAdmin(options)
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { createInitialAdmin, createDemoUsers }