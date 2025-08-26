import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const supabase = createSimpleClient()
    
    // Check for duplicates in content_queue
    console.log('📊 Checking for duplicates in database...')
    
    // 1. Check for duplicate content hashes
    const { data: hashDuplicates } = await supabase.rpc('check_duplicate_hashes', {
      sql: `
        SELECT 
          content_hash,
          COUNT(*) as count,
          array_agg(id ORDER BY id) as ids,
          array_agg(source_platform) as platforms
        FROM content_queue
        WHERE content_hash IS NOT NULL
        GROUP BY content_hash
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 10
      `
    }).single()
    
    // 2. Check for duplicate image URLs
    const { data: imageDuplicates } = await supabase.rpc('check_duplicate_images', {
      sql: `
        SELECT 
          content_image_url,
          COUNT(*) as count,
          array_agg(id ORDER BY id) as ids,
          array_agg(source_platform) as platforms
        FROM content_queue
        WHERE content_image_url IS NOT NULL
        GROUP BY content_image_url
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 10
      `
    }).single()
    
    // 3. Check for duplicate text content
    const { data: textDuplicates } = await supabase.rpc('check_duplicate_text', {
      sql: `
        SELECT 
          LEFT(content_text, 100) as text_preview,
          source_platform,
          COUNT(*) as count,
          array_agg(id ORDER BY id) as ids
        FROM content_queue
        WHERE content_text IS NOT NULL AND LENGTH(content_text) > 20
        GROUP BY LEFT(content_text, 100), source_platform
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 10
      `
    }).single()
    
    // 4. Check for duplicate posts in posted_content
    const { data: postedDuplicates } = await supabase.rpc('check_posted_duplicates', {
      sql: `
        SELECT 
          content_queue_id,
          COUNT(*) as times_posted,
          array_agg(id ORDER BY posted_at) as post_ids
        FROM posted_content
        GROUP BY content_queue_id
        HAVING COUNT(*) > 1
        ORDER BY times_posted DESC
        LIMIT 10
      `
    }).single()
    
    // 5. Check for inconsistent is_posted flags
    const { data: flagInconsistencies } = await supabase.rpc('check_flag_inconsistencies', {
      sql: `
        WITH posted_ids AS (
          SELECT DISTINCT content_queue_id FROM posted_content
        ),
        inconsistent AS (
          SELECT 
            cq.id,
            cq.is_posted,
            CASE 
              WHEN pi.content_queue_id IS NOT NULL THEN true 
              ELSE false 
            END as should_be_posted
          FROM content_queue cq
          LEFT JOIN posted_ids pi ON cq.id = pi.content_queue_id
          WHERE (cq.is_posted = true AND pi.content_queue_id IS NULL)
             OR (cq.is_posted = false AND pi.content_queue_id IS NOT NULL)
        )
        SELECT COUNT(*) as count FROM inconsistent
      `
    }).single()
    
    // Calculate totals
    const totalHashDuplicates = hashDuplicates?.length || 0
    const totalImageDuplicates = imageDuplicates?.length || 0
    const totalTextDuplicates = textDuplicates?.length || 0
    const totalPostedDuplicates = postedDuplicates?.length || 0
    const totalInconsistencies = flagInconsistencies?.count || 0
    
    const totalDuplicates = totalHashDuplicates + totalImageDuplicates + 
                           totalTextDuplicates + totalPostedDuplicates
    
    // Get overall statistics
    const { data: overallStats } = await supabase
      .from('content_queue')
      .select('id, is_posted, is_approved')
    
    const { data: postedStats } = await supabase
      .from('posted_content')
      .select('id')
    
    const response = {
      duplicates_found: totalDuplicates,
      flag_inconsistencies: totalInconsistencies,
      details: {
        hash_duplicates: {
          count: totalHashDuplicates,
          samples: hashDuplicates?.slice(0, 3)
        },
        image_duplicates: {
          count: totalImageDuplicates,
          samples: imageDuplicates?.slice(0, 3)
        },
        text_duplicates: {
          count: totalTextDuplicates,
          samples: textDuplicates?.slice(0, 3)
        },
        posted_duplicates: {
          count: totalPostedDuplicates,
          samples: postedDuplicates?.slice(0, 3)
        }
      },
      statistics: {
        total_content: overallStats?.length || 0,
        total_posted: postedStats?.length || 0,
        approved_unposted: overallStats?.filter(c => c.is_approved && !c.is_posted).length || 0
      },
      health_status: totalDuplicates === 0 ? 'healthy' : 
                     totalDuplicates < 10 ? 'warning' : 'critical',
      recommendations: generateRecommendations(totalDuplicates, totalInconsistencies)
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('❌ Monitor check failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function generateRecommendations(duplicates: number, inconsistencies: number): string[] {
  const recommendations: string[] = []
  
  if (duplicates > 0) {
    recommendations.push(`Run cleanup job to remove ${duplicates} duplicate items`)
  }
  
  if (inconsistencies > 0) {
    recommendations.push(`Sync is_posted flags to fix ${inconsistencies} inconsistencies`)
  }
  
  if (duplicates > 50) {
    recommendations.push('Review duplicate detection logic in scanners')
    recommendations.push('Consider adding database constraints')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Database is healthy - no action needed')
  }
  
  return recommendations
}