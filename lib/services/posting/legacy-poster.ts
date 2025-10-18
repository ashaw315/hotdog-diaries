/**
 * Legacy Posting Service
 * 
 * Provides backward compatibility for existing code.
 * When ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true, these functions will
 * delegate to the new schedule-only poster or return appropriate errors.
 */

import { postFromSchedule } from './schedule-only-poster'
import { PostingResult as LegacyPostingResult } from '../posting-service'
import { ContentItem } from '../../../types'

const ENFORCE_SCHEDULE_SOURCE_OF_TRUTH = process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH !== 'false'

/**
 * @deprecated Use postFromSchedule() instead
 */
export async function postContent(
  content: ContentItem,
  isScheduled: boolean = false
): Promise<LegacyPostingResult> {
  
  if (ENFORCE_SCHEDULE_SOURCE_OF_TRUTH) {
    console.warn('⚠️ postContent() is deprecated. Use postFromSchedule() with scheduled_posts table.')
    
    // Try to delegate to schedule-only poster
    const result = await postFromSchedule()
    
    return {
      success: result.success,
      contentId: result.contentId,
      contentText: result.metadata?.contentPreview as string,
      platform: result.platform,
      postedAt: result.postedAt,
      error: result.error
    }
  }
  
  // Legacy fallback (when feature flag is disabled)
  const { postContent: legacyPostContent } = await import('../posting-service')
  return legacyPostContent(content, isScheduled)
}

/**
 * @deprecated Use postFromSchedule() instead
 */
export async function postNextContent(): Promise<LegacyPostingResult> {
  
  if (ENFORCE_SCHEDULE_SOURCE_OF_TRUTH) {
    console.warn('⚠️ postNextContent() is deprecated. Use postFromSchedule() with scheduled_posts table.')
    
    // Try to delegate to schedule-only poster
    const result = await postFromSchedule()
    
    return {
      success: result.success,
      contentId: result.contentId,
      contentText: result.metadata?.contentPreview as string,
      platform: result.platform,
      postedAt: result.postedAt,
      error: result.error || (result.type !== 'POSTED' ? `No content posted: ${result.type}` : undefined)
    }
  }
  
  // Legacy fallback (when feature flag is disabled)
  const { postNextContent: legacyPostNextContent } = await import('../posting-service')
  return legacyPostNextContent()
}