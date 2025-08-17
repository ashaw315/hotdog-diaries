#!/usr/bin/env node

import { db } from '../lib/db'
import { YouTubeScanningService } from '../lib/services/youtube-scanning'
import { GiphyScanningService } from '../lib/services/giphy-scanning'

async function diagnoseContentBalance() {
  console.log('🔍 DIAGNOSING CONTENT BALANCE ISSUES\n')
  
  try {
    await db.connect()
    
    // 1. Check current content distribution
    console.log('📊 CURRENT CONTENT DISTRIBUTION:')
    const contentStats = await db.query(`
      SELECT 
        content_type,
        source_platform,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue WHERE is_approved = true), 2) as percentage
      FROM content_queue 
      WHERE is_approved = true
      GROUP BY content_type, source_platform
      ORDER BY count DESC
    `)
    
    console.table(contentStats.rows)
    
    // 2. Check total counts by type
    console.log('\n📈 CONTENT TYPE TOTALS:')
    const typeTotals = await db.query(`
      SELECT 
        content_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue WHERE is_approved = true), 2) as percentage
      FROM content_queue 
      WHERE is_approved = true
      GROUP BY content_type
      ORDER BY count DESC
    `)
    
    console.table(typeTotals.rows)
    
    // 3. Check YouTube scanning results
    console.log('\n🎥 YOUTUBE DIAGNOSTIC:')
    const youtubeService = new YouTubeScanningService()
    console.log('Testing YouTube scan...')
    
    try {
      const youtubeResult = await youtubeService.performScan({ maxPosts: 5 })
      console.log('YouTube scan result:', {
        totalFound: youtubeResult.totalFound,
        processed: youtubeResult.processed,
        approved: youtubeResult.approved,
        rejected: youtubeResult.rejected
      })
      
      // Check what's in database from YouTube
      const youtubeInDb = await db.query(`
        SELECT 
          content_type, 
          COUNT(*) as count,
          is_approved,
          COUNT(*) FILTER (WHERE content_video_url IS NOT NULL) as has_video_url
        FROM content_queue 
        WHERE source_platform = 'youtube'
        GROUP BY content_type, is_approved
        ORDER BY count DESC
      `)
      console.log('YouTube content in database:')
      console.table(youtubeInDb.rows)
      
    } catch (error) {
      console.error('❌ YouTube scan failed:', error.message)
    }
    
    // 4. Check Giphy scanning results
    console.log('\n🎞️ GIPHY DIAGNOSTIC:')
    const giphyService = new GiphyScanningService()
    console.log('Testing Giphy scan...')
    
    try {
      const giphyResult = await giphyService.performScan({ maxPosts: 5 })
      console.log('Giphy scan result:', {
        totalFound: giphyResult.totalFound,
        processed: giphyResult.processed,
        approved: giphyResult.approved,
        rejected: giphyResult.rejected
      })
      
      // Check what's in database from Giphy
      const giphyInDb = await db.query(`
        SELECT 
          content_type, 
          COUNT(*) as count,
          is_approved,
          COUNT(*) FILTER (WHERE content_image_url IS NOT NULL) as has_image_url
        FROM content_queue 
        WHERE source_platform = 'giphy'
        GROUP BY content_type, is_approved
        ORDER BY count DESC
      `)
      console.log('Giphy content in database:')
      console.table(giphyInDb.rows)
      
    } catch (error) {
      console.error('❌ Giphy scan failed:', error.message)
    }
    
    // 5. Check recent scanning activity
    console.log('\n📅 RECENT SCANNING ACTIVITY:')
    const recentScans = await db.query(`
      SELECT 
        source_platform,
        content_type,
        DATE(created_at) as scan_date,
        COUNT(*) as items_added
      FROM content_queue 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY source_platform, content_type, DATE(created_at)
      ORDER BY scan_date DESC, items_added DESC
      LIMIT 20
    `)
    console.table(recentScans.rows)
    
    // 6. Check rejection reasons
    console.log('\n❌ REJECTION ANALYSIS:')
    const rejectedContent = await db.query(`
      SELECT 
        source_platform,
        content_type,
        COUNT(*) as rejected_count
      FROM content_queue 
      WHERE is_approved = false
      GROUP BY source_platform, content_type
      ORDER BY rejected_count DESC
    `)
    console.table(rejectedContent.rows)
    
    console.log('\n✅ Diagnosis complete!')
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error)
  } finally {
    await db.disconnect()
  }
}

diagnoseContentBalance().catch(console.error)