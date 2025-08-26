import { createSimpleClient } from '@/utils/supabase/server'
import { generateContentHash } from './content-deduplication'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  reason?: string
  existingId?: number
  confidence?: number
}

/**
 * Enhanced duplicate detection with multiple strategies
 */
export async function checkForDuplicate(content: any): Promise<DuplicateCheckResult> {
  const supabase = createSimpleClient()
  
  // Generate content hash
  const contentHash = generateContentHash(content)
  
  // Strategy 1: Exact hash match (highest confidence)
  const { data: hashMatch } = await supabase
    .from('content_queue')
    .select('id')
    .eq('content_hash', contentHash)
    .single()
  
  if (hashMatch) {
    return {
      isDuplicate: true,
      reason: 'Exact content hash match',
      existingId: hashMatch.id,
      confidence: 1.0
    }
  }
  
  // Strategy 2: Same image URL (very high confidence)
  if (content.content_image_url) {
    const { data: imageMatch } = await supabase
      .from('content_queue')
      .select('id')
      .eq('content_image_url', content.content_image_url)
      .single()
    
    if (imageMatch) {
      return {
        isDuplicate: true,
        reason: 'Same image URL',
        existingId: imageMatch.id,
        confidence: 0.99
      }
    }
  }
  
  // Strategy 3: Same video URL (very high confidence)
  if (content.content_video_url) {
    const { data: videoMatch } = await supabase
      .from('content_queue')
      .select('id')
      .eq('content_video_url', content.content_video_url)
      .single()
    
    if (videoMatch) {
      return {
        isDuplicate: true,
        reason: 'Same video URL',
        existingId: videoMatch.id,
        confidence: 0.99
      }
    }
  }
  
  // Strategy 4: Same original URL (high confidence)
  if (content.original_url) {
    const { data: urlMatch } = await supabase
      .from('content_queue')
      .select('id')
      .eq('original_url', content.original_url)
      .single()
    
    if (urlMatch) {
      return {
        isDuplicate: true,
        reason: 'Same original URL',
        existingId: urlMatch.id,
        confidence: 0.95
      }
    }
  }
  
  // Strategy 5: Same text and platform (high confidence for text content)
  if (content.content_text && content.source_platform) {
    const { data: textMatch } = await supabase
      .from('content_queue')
      .select('id')
      .eq('source_platform', content.source_platform)
      .eq('content_text', content.content_text)
      .single()
    
    if (textMatch) {
      return {
        isDuplicate: true,
        reason: 'Same text from same platform',
        existingId: textMatch.id,
        confidence: 0.9
      }
    }
  }
  
  // Strategy 6: Fuzzy text matching (medium confidence)
  if (content.content_text && content.content_text.length > 20) {
    // Check for very similar text
    const textPrefix = content.content_text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .substring(0, 50)
    
    const { data: similarTexts } = await supabase
      .from('content_queue')
      .select('id, content_text, source_platform')
      .ilike('content_text', `${textPrefix}%`)
      .limit(10)
    
    if (similarTexts && similarTexts.length > 0) {
      for (const similar of similarTexts) {
        // Skip if different platform (might be legitimate cross-posting)
        if (similar.source_platform !== content.source_platform) {
          continue
        }
        
        const similarity = calculateSimilarity(
          content.content_text,
          similar.content_text || ''
        )
        
        if (similarity > 0.85) {
          return {
            isDuplicate: true,
            reason: `Very similar text (${Math.round(similarity * 100)}% match)`,
            existingId: similar.id,
            confidence: similarity
          }
        }
      }
    }
  }
  
  return { isDuplicate: false }
}

/**
 * Calculate text similarity using Levenshtein distance
 */
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0
  
  const normalize = (str: string) => 
    str.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  
  const s1 = normalize(text1)
  const s2 = normalize(text2)
  
  if (s1 === s2) return 1
  
  // Simple similarity based on common words
  const words1 = new Set(s1.split(' '))
  const words2 = new Set(s2.split(' '))
  
  let commonWords = 0
  for (const word of words1) {
    if (words2.has(word)) commonWords++
  }
  
  const totalWords = Math.max(words1.size, words2.size)
  return commonWords / totalWords
}

/**
 * Batch duplicate checking for multiple items
 */
export async function checkBatchForDuplicates(
  items: any[]
): Promise<Map<number, DuplicateCheckResult>> {
  const results = new Map<number, DuplicateCheckResult>()
  
  // Check each item
  for (let i = 0; i < items.length; i++) {
    const result = await checkForDuplicate(items[i])
    results.set(i, result)
  }
  
  return results
}

/**
 * Safe content insertion with comprehensive duplicate checking
 */
export async function insertContentSafely(content: any): Promise<{
  success: boolean
  duplicate?: boolean
  error?: string
  data?: any
  duplicateReason?: string
}> {
  try {
    // Check for duplicates first
    const duplicateCheck = await checkForDuplicate(content)
    
    if (duplicateCheck.isDuplicate) {
      return {
        success: false,
        duplicate: true,
        duplicateReason: duplicateCheck.reason
      }
    }
    
    // Generate content hash
    content.content_hash = generateContentHash(content)
    
    // Attempt insert
    const supabase = createSimpleClient()
    const { data, error } = await supabase
      .from('content_queue')
      .insert(content)
      .select()
      .single()
    
    if (error) {
      // Handle constraint violations
      if (
        error.code === '23505' || 
        error.message?.includes('duplicate') ||
        error.message?.includes('unique')
      ) {
        return {
          success: false,
          duplicate: true,
          duplicateReason: 'Database constraint violation'
        }
      }
      
      return {
        success: false,
        error: error.message
      }
    }
    
    return {
      success: true,
      data
    }
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}