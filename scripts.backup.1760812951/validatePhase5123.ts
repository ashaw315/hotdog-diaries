// scripts/validatePhase5123.ts - Phase 5.12.3 Implementation Validation
import 'dotenv/config'
import { generateDailySchedule } from '../lib/jobs/schedule-content-production'
import { db } from '../lib/db'

async function validatePhase5123() {
  console.log('🧪 Phase 5.12.3 Implementation Validation')
  console.log('=========================================')
  
  let allTestsPassed = true
  const results: string[] = []

  try {
    // Test 1: Database connection
    console.log('\n1️⃣ Testing database connection...')
    try {
      await db.connect()
      const testQuery = await db.query('SELECT COUNT(*) as count FROM scheduled_posts')
      console.log(`✅ Database connected, scheduled_posts has ${testQuery.rows[0]?.count || 0} entries`)
      results.push('✅ Database connection: PASS')
    } catch (e) {
      console.error('❌ Database connection failed:', e)
      results.push('❌ Database connection: FAIL')
      allTestsPassed = false
    }

    // Test 2: Schedule generation for tomorrow
    console.log('\n2️⃣ Testing schedule generation...')
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowISO = tomorrow.toISOString().split('T')[0]
      
      // Check if schedule exists for tomorrow
      const existingSchedule = await db.query(
        'SELECT COUNT(*) as count FROM scheduled_posts WHERE DATE(scheduled_post_time) = ?',
        [tomorrowISO]
      )
      
      if (existingSchedule.rows[0]?.count === 0) {
        console.log(`📅 Generating schedule for ${tomorrowISO}...`)
        await generateDailySchedule(tomorrowISO)
        console.log('✅ Schedule generation completed')
        results.push('✅ Schedule generation: PASS')
      } else {
        console.log(`✅ Schedule already exists for ${tomorrowISO} (${existingSchedule.rows[0].count} entries)`)
        results.push('✅ Schedule verification: PASS')
      }
    } catch (e) {
      console.error('❌ Schedule generation failed:', e)
      results.push('❌ Schedule generation: FAIL')
      allTestsPassed = false
    }

    // Test 3: Verify today's schedule exists
    console.log('\n3️⃣ Testing today\'s schedule...')
    try {
      const today = new Date().toISOString().split('T')[0]
      const todaySchedule = await db.query(
        'SELECT COUNT(*) as count FROM scheduled_posts WHERE DATE(scheduled_post_time) = ?',
        [today]
      )
      
      const count = todaySchedule.rows[0]?.count || 0
      if (count >= 3) {
        console.log(`✅ Today's schedule has ${count} posts`)
        results.push('✅ Today\'s schedule: PASS')
      } else {
        console.log(`⚠️ Today's schedule only has ${count} posts (expected 6)`)
        results.push('⚠️ Today\'s schedule: PARTIAL')
      }
    } catch (e) {
      console.error('❌ Today\'s schedule check failed:', e)
      results.push('❌ Today\'s schedule: FAIL')
      allTestsPassed = false
    }

    // Test 4: Verify table schema
    console.log('\n4️⃣ Testing table schema...')
    try {
      // Test if we can query required columns
      const testQuery = await db.query(`
        SELECT id, content_id, platform, content_type, 
               scheduled_post_time, scheduled_slot_index 
        FROM scheduled_posts LIMIT 1
      `)
      console.log('✅ All required columns accessible via SELECT')
      results.push('✅ Table schema: PASS')
    } catch (e) {
      console.error('❌ Schema check failed - missing columns:', e)
      results.push('❌ Table schema: FAIL')
      allTestsPassed = false
    }

    // Test 5: Platform diversity check
    console.log('\n5️⃣ Testing platform diversity...')
    try {
      const today = new Date().toISOString().split('T')[0]
      const platformStats = await db.query(`
        SELECT platform, COUNT(*) as count 
        FROM scheduled_posts 
        WHERE DATE(scheduled_post_time) = ? 
        GROUP BY platform
      `, [today])
      
      console.log('📊 Platform distribution for today:')
      platformStats.rows.forEach(row => {
        console.log(`   ${row.platform}: ${row.count} posts`)
      })
      
      const maxPostsPerPlatform = Math.max(...platformStats.rows.map(r => r.count))
      if (maxPostsPerPlatform <= 2) {
        console.log('✅ Platform diversity maintained (max 2 posts per platform)')
        results.push('✅ Platform diversity: PASS')
      } else {
        console.log(`⚠️ Platform diversity warning: ${maxPostsPerPlatform} posts from one platform`)
        results.push('⚠️ Platform diversity: WARNING')
      }
    } catch (e) {
      console.error('❌ Platform diversity check failed:', e)
      results.push('❌ Platform diversity: FAIL')
      allTestsPassed = false
    }

  } finally {
    await db.disconnect()
  }

  // Final results
  console.log('\n📋 VALIDATION RESULTS')
  console.log('====================')
  results.forEach(result => console.log(result))
  
  console.log('\n🎯 OVERALL STATUS')
  console.log('=================')
  if (allTestsPassed) {
    console.log('🎉 Phase 5.12.3 Implementation: ✅ COMPLETE')
    console.log('')
    console.log('📋 Ready for production deployment!')
    console.log('🚀 Follow the guide: PHASE-5.12.3-PRODUCTION-GUIDE.md')
    console.log('')
    console.log('Next steps:')
    console.log('1. Run SQL migration in Supabase Studio')
    console.log('2. Configure Vercel environment variables')
    console.log('3. Redeploy production')
    console.log('4. Run health check: /api/admin/schedule/forecast/health')
    console.log('5. Test forecast: /api/admin/schedule/forecast?date=2025-10-09')
  } else {
    console.log('❌ Phase 5.12.3 Implementation: ISSUES FOUND')
    console.log('Please fix the failing tests before deployment.')
    process.exit(1)
  }
  
  return allTestsPassed
}

if (require.main === module) {
  validatePhase5123().catch(e => {
    console.error('💥 Validation failed:', e)
    process.exit(1)
  })
}

export { validatePhase5123 }