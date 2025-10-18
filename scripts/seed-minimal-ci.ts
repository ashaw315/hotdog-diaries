#!/usr/bin/env tsx

/**
 * Minimal CI Database Seeder
 * Creates just the essential data needed for E2E tests
 */

import { db } from '@/lib/db'

async function seed() {
  console.log('🌱 Seeding minimal CI test data...')
  
  try {
    await db.connect()
    
    // Create admin user if not exists
    try {
      await db.query(`
        INSERT INTO admin_users (username, password_hash, email, full_name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO NOTHING
      `, [
        'admin',
        '$2b$10$K9WS.QmyXf9VNhm6zJv9dO4JBLOJu4gfKsRo6JK2VJv.9', // "admin123" hashed
        'admin@hotdogdiaries.com',
        'CI Admin User',
        true,
        new Date(),
        new Date()
      ])
      console.log('✅ Admin user seeded')
    } catch (error) {
      console.log('ℹ️ Admin user may already exist')
    }
    
    // Create minimal test content
    const testContent = [
      {
        content_text: 'Test Chicago Hotdog 1',
        content_type: 'image',
        source_platform: 'reddit',
        original_url: 'https://reddit.com/test1',
        original_author: 'TestUser1',
        content_hash: 'test_hash_1_' + Date.now(),
        is_approved: true,
        is_posted: false
      },
      {
        content_text: 'Test Hotdog Video 2',
        content_type: 'video',
        source_platform: 'youtube',
        original_url: 'https://youtube.com/test2',
        original_author: 'TestUser2',
        content_hash: 'test_hash_2_' + Date.now(),
        is_approved: false,
        is_posted: false
      }
    ]
    
    for (const content of testContent) {
      try {
        await db.query(`
          INSERT INTO content_queue (
            content_text, content_type, source_platform, original_url, original_author,
            content_hash, is_approved, is_posted, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (content_hash) DO NOTHING
        `, [
          content.content_text, content.content_type, content.source_platform,
          content.original_url, content.original_author, content.content_hash,
          content.is_approved, content.is_posted, new Date(), new Date()
        ])
        console.log('✅ Seeded:', content.content_text)
      } catch (error) {
        console.log('ℹ️ Content may already exist:', content.content_text)
      }
    }
    
    console.log('✅ Minimal CI test data seeded successfully')
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message)
    throw error
  } finally {
    await db.disconnect()
  }
}

// Run if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('seed-minimal-ci')
if (isMainModule) {
  seed().catch((error) => {
    console.error('❌ Minimal seeding failed:', error)
    process.exit(1)
  })
}

export { seed }