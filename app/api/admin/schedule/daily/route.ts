import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSimpleClient } from '@/utils/supabase/server'

interface DailyScheduleItem {
  id: string
  platform: string
  content_type: 'image' | 'video' | 'text' | 'link'
  source: string
  scheduled_time: string
  title?: string
  confidence_score?: number
}

interface DailyScheduleResponse {
  date: string
  scheduled_content: DailyScheduleItem[]
  summary: {
    total_posts: number
    platforms: { [platform: string]: number }
    content_types: { [type: string]: number }
    diversity_score: number
  }
}

function calculateDiversityScore(platforms: { [platform: string]: number }, contentTypes: { [type: string]: number }, totalPosts: number): number {
  if (totalPosts === 0) return 0
  
  // Calculate platform diversity (0-50 points)
  const platformCount = Object.keys(platforms).length
  const maxPlatforms = 6 // reddit, bluesky, tumblr, lemmy, giphy, imgur
  const platformScore = Math.min(platformCount / maxPlatforms, 1) * 50
  
  // Calculate content type diversity (0-50 points)
  const typeCount = Object.keys(contentTypes).length
  const maxTypes = 4 // image, video, text, link
  const typeScore = Math.min(typeCount / maxTypes, 1) * 50
  
  return Math.round(platformScore + typeScore)
}

function mapContentType(originalType: string): 'image' | 'video' | 'text' | 'link' {
  const normalizedType = originalType?.toLowerCase()
  
  switch (normalizedType) {
    case 'image':
    case 'gif':
    case 'photo':
      return 'image'
    case 'video':
    case 'mp4':
      return 'video'
    case 'link':
    case 'url':
      return 'link'
    case 'text':
    case 'self':
    default:
      return 'text'
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    
    // Default to today if no date provided
    const targetDate = dateParam || new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json({
        error: 'Invalid date format. Use YYYY-MM-DD format.'
      }, { status: 400 })
    }
    
    let scheduledContent: DailyScheduleItem[] = []
    
    // Determine database type
    const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
    const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
    
    if (isSqlite) {
      // Use SQLite for development
      await db.connect()
      
      try {
        const result = await db.query(`
          SELECT 
            cq.id,
            cq.source_platform as platform,
            cq.content_type,
            cq.original_author as source,
            cq.scheduled_for as scheduled_time,
            SUBSTR(cq.content_text, 1, 100) as title,
            cq.confidence_score
          FROM content_queue cq
          WHERE cq.status = 'scheduled'
            AND DATE(cq.scheduled_for) = ?
          ORDER BY cq.scheduled_for ASC
        `, [targetDate])
        
        scheduledContent = (result.rows || []).map((row: any) => ({
          id: String(row.id),
          platform: row.platform || 'unknown',
          content_type: mapContentType(row.content_type),
          source: row.source || 'Unknown Source',
          scheduled_time: row.scheduled_time,
          title: row.title,
          confidence_score: row.confidence_score
        }))
        
      } catch (error) {
        console.error('SQLite query error:', error)
      } finally {
        await db.disconnect()
      }
    } else {
      // Use Supabase for production
      const supabase = createSimpleClient()
      
      try {
        const { data, error } = await supabase
          .from('content_queue')
          .select(`
            id,
            source_platform,
            content_type,
            original_author,
            scheduled_for,
            content_text,
            confidence_score
          `)
          .eq('status', 'scheduled')
          .gte('scheduled_for', `${targetDate}T00:00:00.000Z`)
          .lt('scheduled_for', `${targetDate}T23:59:59.999Z`)
          .order('scheduled_for', { ascending: true })
        
        if (error) {
          console.error('Supabase query error:', error)
        } else {
          scheduledContent = (data || []).map((row: any) => ({
            id: String(row.id),
            platform: row.source_platform || 'unknown',
            content_type: mapContentType(row.content_type),
            source: row.original_author || 'Unknown Source',
            scheduled_time: row.scheduled_for,
            title: row.content_text?.substring(0, 100),
            confidence_score: row.confidence_score
          }))
        }
      } catch (error) {
        console.error('Supabase connection error:', error)
      }
    }
    
    // Calculate summary statistics
    const totalPosts = scheduledContent.length
    const platforms: { [platform: string]: number } = {}
    const contentTypes: { [type: string]: number } = {}
    
    scheduledContent.forEach(item => {
      // Count platforms
      platforms[item.platform] = (platforms[item.platform] || 0) + 1
      
      // Count content types
      contentTypes[item.content_type] = (contentTypes[item.content_type] || 0) + 1
    })
    
    const diversityScore = calculateDiversityScore(platforms, contentTypes, totalPosts)
    
    const response: DailyScheduleResponse = {
      date: targetDate,
      scheduled_content: scheduledContent,
      summary: {
        total_posts: totalPosts,
        platforms,
        content_types: contentTypes,
        diversity_score: diversityScore
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error in daily schedule API:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}