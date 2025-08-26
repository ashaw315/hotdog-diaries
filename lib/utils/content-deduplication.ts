import crypto from 'crypto'
import { createSimpleClient } from '@/utils/supabase/server'

export interface ContentItem {
  content_text?: string
  content_image_url?: string | null
  content_video_url?: string | null
  original_url?: string
  source_platform?: string
  content_hash?: string
}

/**
 * Generate a truly unique content hash using all identifying information
 */
export function generateContentHash(content: ContentItem): string {
  // Normalize text content - remove extra spaces, lowercase, trim
  const normalizedText = content.content_text
    ? content.content_text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s]/g, '') // Remove special chars for consistency
    : ''
  
  // Include ALL identifying information for truly unique hash
  const hashComponents = [
    content.source_platform?.toLowerCase() || '',
    normalizedText,
    content.content_image_url || '',
    content.content_video_url || '',
    content.original_url || '',
    // Add author if available to distinguish same content from different sources
    (content as any).original_author || ''
  ]
  
  // Create a deterministic string representation
  const hashInput = hashComponents
    .map(component => component.trim())
    .join('|')
  
  // If hash input is empty, use timestamp to ensure uniqueness
  if (!hashInput || hashInput === '|||||') {
    return crypto.createHash('sha256')
      .update(`empty-${Date.now()}-${Math.random()}`)
      .digest('hex')
  }
  
  return crypto.createHash('sha256')
    .update(hashInput)
    .digest('hex')
}

/**
 * Generate a secondary hash for similar content detection
 */
export function generateSimilarityHash(content: ContentItem): string {
  // For image content, use just the image URL
  if (content.content_image_url) {
    return crypto.createHash('md5')
      .update(content.content_image_url)
      .digest('hex')
  }
  
  // For text content, use normalized text
  if (content.content_text && content.content_text.length > 10) {
    const normalizedText = content.content_text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 100) // First 100 chars
    
    return crypto.createHash('md5')
      .update(normalizedText)
      .digest('hex')
  }
  
  return crypto.createHash('md5')
    .update(content.original_url || 'no-url')
    .digest('hex')
}

/**
 * Check if content is a duplicate using multiple detection strategies
 */
export async function isDuplicateContent(content: ContentItem): Promise<{
  isDuplicate: boolean
  reason?: string
  existingId?: number
}> {
  const supabase = createSimpleClient()
  
  // Strategy 1: Check exact content_hash
  if (content.content_hash) {
    const { data: hashMatch } = await supabase
      .from('content_queue')
      .select('id')
      .eq('content_hash', content.content_hash)
      .single()
    
    if (hashMatch) {
      return {
        isDuplicate: true,
        reason: 'Exact content hash match',
        existingId: hashMatch.id
      }
    }
  }
  
  // Strategy 2: Check exact image URL (most reliable for visual content)
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
        existingId: imageMatch.id
      }
    }
  }
  
  // Strategy 3: Check exact original URL
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
        existingId: urlMatch.id
      }
    }
  }
  
  // Strategy 4: Check similar text content (fuzzy matching)
  if (content.content_text && content.content_text.length > 20) {
    // First 50 characters for fuzzy matching
    const textPrefix = content.content_text.trim().substring(0, 50)
    const { data: textMatches } = await supabase
      .from('content_queue')
      .select('id, content_text')
      .ilike('content_text', textPrefix + '%')
      .limit(5)
    
    if (textMatches && textMatches.length > 0) {
      // Check for very similar text (90%+ similarity)
      for (const match of textMatches) {
        const similarity = calculateTextSimilarity(
          content.content_text, 
          match.content_text || ''
        )
        
        if (similarity > 0.9) {
          return {
            isDuplicate: true,
            reason: `Very similar text (${Math.round(similarity * 100)}% match)`,
            existingId: match.id
          }
        }
      }
    }
  }
  
  return { isDuplicate: false }
}

/**
 * Calculate text similarity using simple character-based comparison
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0
  
  const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, ' ').trim()
  const norm1 = normalize(text1)
  const norm2 = normalize(text2)
  
  if (norm1 === norm2) return 1
  
  // Simple character overlap calculation
  const shorter = norm1.length < norm2.length ? norm1 : norm2
  const longer = norm1.length >= norm2.length ? norm1 : norm2
  
  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++
    }
  }
  
  return matches / Math.max(norm1.length, norm2.length)
}

/**
 * Safe content insertion with duplicate detection
 */
export async function saveContentSafely(content: ContentItem): Promise<{
  success?: boolean
  duplicate?: boolean
  error?: string
  data?: any
  reason?: string
}> {
  try {
    // Generate proper hashes
    const contentWithHash = {
      ...content,
      content_hash: generateContentHash(content)
    }
    
    // Check for duplicates using multiple strategies
    const duplicateCheck = await isDuplicateContent(contentWithHash)
    if (duplicateCheck.isDuplicate) {
      return {
        duplicate: true,
        reason: duplicateCheck.reason
      }
    }
    
    // Try to insert with unique constraint handling
    const supabase = createSimpleClient()
    const { data, error } = await supabase
      .from('content_queue')
      .insert(contentWithHash)
      .select()
      .single()
    
    if (error) {
      // Handle unique constraint violations
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return {
          duplicate: true,
          reason: 'Database unique constraint violation'
        }
      }
      
      return {
        error: error.message
      }
    }
    
    return {
      success: true,
      data
    }
    
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}