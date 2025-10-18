/**
 * Main Posting Service Index
 * 
 * Exports the new schedule-only posting service as the primary interface.
 * Maintains backward compatibility while enforcing single source of truth.
 */

export {
  postFromSchedule,
  checkPostingHealth,
  type ScheduledSlot,
  type PostingResult,
  type PostingConfig
} from './schedule-only-poster'

// Legacy exports for backward compatibility (deprecated)
export { postContent, postNextContent } from './legacy-poster'

// Re-export types
export type { BatchPostingResult } from '../posting-service'