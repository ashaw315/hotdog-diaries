import { createSimpleClient } from '@/utils/supabase/server'
import { db } from '@/lib/db'

interface ContentCandidate {
  id: number
  content_text?: string
  content_image_url?: string | null
  content_video_url?: string | null
  content_type: string
  source_platform: string
  original_url: string
  original_author?: string
  content_hash?: string
  confidence_score: number
  created_at: string
}

/**
 * Select unique content to post that hasn't been posted before
 */
export async function selectUniqueContentToPost(options: {
  maxPosts?: number
  contentType?: string | null
  platform?: string | null
  forcePost?: boolean
} = {}): Promise<ContentCandidate[]> {
  const supabase = createSimpleClient()
  const { maxPosts = 1, contentType, platform, forcePost = false } = options
  
  console.log('🔍 Selecting unique content to post...', options)
  
  // 1. Get approved, unposted content candidates
  let query = supabase
    .from('content_queue')
    .select(`
      id, content_text, content_image_url, content_video_url, 
      content_type, source_platform, original_url, original_author,
      content_hash, confidence_score, created_at
    `)
    .eq('is_approved', true)
    .eq('is_posted', false)
    .order('confidence_score', { ascending: false })
    .order('created_at', { ascending: true }) // Prefer older content
    .limit(maxPosts * 10) // Get many candidates to filter

  if (contentType) query = query.eq('content_type', contentType)
  if (platform) query = query.eq('source_platform', platform)

  const { data: candidates, error: candidatesError } = await query
  
  if (candidatesError) {
    throw new Error(`Failed to get candidates: ${candidatesError.message}`)
  }

  if (!candidates || candidates.length === 0) {
    throw new Error('No approved content available for posting')
  }

  console.log(`📋 Found ${candidates.length} content candidates`)

  // 2. Get all previously posted content for comparison
  const { data: postedContent, error: postedError } = await supabase
    .from('posted_content')
    .select(`
      id, content_queue_id,
      content_queue!inner (
        content_text,
        content_image_url,
        content_video_url,
        content_hash,
        original_url
      )
    `)

  if (postedError) {
    console.warn('Warning: Could not fetch posted content for comparison:', postedError.message)
  }

  const postedItems = postedContent || []
  console.log(`📝 Checking against ${postedItems.length} previously posted items`)

  // 3. Filter candidates to remove any that are too similar to posted content
  const uniqueCandidates: ContentCandidate[] = []
  
  for (const candidate of candidates) {
    let isDuplicate = false
    let reason = ''
    
    if (!forcePost) {
      // Check against all posted content
      for (const postedItem of postedItems) {
        const posted = postedItem.content_queue
        
        // Exact hash match
        if (candidate.content_hash && posted.content_hash === candidate.content_hash) {
          isDuplicate = true
          reason = 'Same content hash'
          break
        }
        
        // Exact image URL match
        if (candidate.content_image_url && posted.content_image_url === candidate.content_image_url) {
          isDuplicate = true
          reason = 'Same image URL'
          break
        }
        
        // Exact original URL match
        if (candidate.original_url && posted.original_url === candidate.original_url) {
          isDuplicate = true
          reason = 'Same original URL'
          break
        }
        
        // Very similar text content
        if (candidate.content_text && posted.content_text) {
          const similarity = calculateTextSimilarity(candidate.content_text, posted.content_text)
          if (similarity > 0.85) {
            isDuplicate = true
            reason = `Very similar text (${Math.round(similarity * 100)}% match)`
            break
          }
        }
      }
    }
    
    if (isDuplicate) {
      console.log(`🔍 Skipping duplicate candidate ${candidate.id}: ${reason}`)
    } else {
      uniqueCandidates.push(candidate)
      
      // Stop when we have enough unique candidates
      if (uniqueCandidates.length >= maxPosts) {
        break
      }
    }
  }

  console.log(`✅ Selected ${uniqueCandidates.length} unique content items`)
  
  if (uniqueCandidates.length === 0) {
    throw new Error('No unique content available - all candidates are duplicates of posted content')
  }

  return uniqueCandidates
}

/**
 * Calculate similarity between two text strings
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0
  
  const normalize = (str: string) => 
    str.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim()
  
  const norm1 = normalize(text1)
  const norm2 = normalize(text2)
  
  if (norm1 === norm2) return 1
  
  // Check if one text contains the other (substring match)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return Math.max(norm1.length, norm2.length) / Math.min(norm1.length, norm2.length)
  }
  
  // Simple word-based similarity
  const words1 = norm1.split(' ')
  const words2 = norm2.split(' ')
  const commonWords = words1.filter(word => words2.includes(word))
  
  return (commonWords.length * 2) / (words1.length + words2.length)
}

/**
 * Verify content is truly unique before posting
 */
export async function verifyContentUniqueness(contentId: number): Promise<{
  isUnique: boolean
  reason?: string
  similarContentId?: number
}> {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (isDevelopment) {
    await db.connect()
    
    // Get the content to verify
    const contentResult = await db.query('SELECT * FROM content_queue WHERE id = ?', [contentId])
    
    if (!contentResult.rows || contentResult.rows.length === 0) {
      return { isUnique: false, reason: 'Content not found' }
    }
    
    // Check if it's already been posted
    const postedResult = await db.query('SELECT id FROM posted_content WHERE content_queue_id = ?', [contentId])
    
    if (postedResult.rows && postedResult.rows.length > 0) {
      return { isUnique: false, reason: 'Content already posted' }
    }
  } else {
    const supabase = createSimpleClient()
    
    // Get the content to verify
    const { data: content, error: contentError } = await supabase
      .from('content_queue')
      .select('*')
      .eq('id', contentId)
      .single()
    
    if (contentError || !content) {
      return { isUnique: false, reason: 'Content not found' }
    }
    
    // Check if it's already been posted
    const { data: alreadyPosted } = await supabase
      .from('posted_content')
      .select('id')
      .eq('content_queue_id', contentId)
      .single()
    
    if (alreadyPosted) {
      return { isUnique: false, reason: 'Content already posted' }
    }
  }
  
  // Use the unique selection logic
  try {
    const uniqueItems = await selectUniqueContentToPost({ maxPosts: 1, forcePost: false })
    const isSelected = uniqueItems.some(item => item.id === contentId)
    
    if (!isSelected) {
      return { isUnique: false, reason: 'Content filtered out as duplicate' }
    }
    
    return { isUnique: true }
  } catch (error) {
    return { 
      isUnique: false, 
      reason: error instanceof Error ? error.message : 'Uniqueness check failed'
    }
  }
}