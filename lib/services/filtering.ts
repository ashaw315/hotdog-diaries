import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import crypto from 'crypto'

export interface FilterPattern {
  id: number
  pattern_type: 'spam' | 'inappropriate' | 'unrelated' | 'required'
  pattern: string
  description: string
  is_regex: boolean
  is_enabled: boolean
  created_at: Date
  updated_at: Date
}

export interface ContentAnalysis {
  content_id?: number
  is_spam: boolean
  is_inappropriate: boolean
  is_unrelated: boolean
  is_valid_hotdog: boolean
  confidence_score: number
  flagged_patterns: string[]
  processing_notes: string[]
  similarity_hash: string
  duplicate_of?: number
}

export interface FilteringStats {
  total_processed: number
  auto_approved: number
  auto_rejected: number
  flagged_for_review: number
  spam_detected: number
  inappropriate_detected: number
  unrelated_detected: number
  duplicates_detected: number
  false_positives: number
  false_negatives: number
  accuracy_rate: number
}

export class FilteringService {
  private static readonly DEFAULT_SPAM_PATTERNS = [
    'buy now',
    'limited time',
    'discount',
    'promo code',
    'sale',
    'offer',
    'deal',
    'click here',
    'act now',
    'don\'t miss',
    'free shipping',
    'call now',
    'order today',
    'special offer',
    'best price',
    'lowest price',
    'save \\$\\d+',
    'get yours',
    'hurry',
    'expires',
    'bonus',
    'win',
    'prize',
    'winner',
    'congratulations',
    'claim your',
    'earn money',
    'work from home',
    'make money',
    'get rich',
    'investment',
    'profit',
    'guaranteed',
    'risk free',
    'no obligation',
    'free trial',
    'subscribe',
    'follow us',
    'like and share',
    'dm me',
    'link in bio',
    'swipe up',
    'check out my',
    'follow me',
    'instagram\\.com',
    'onlyfans',
    'cashapp',
    'venmo',
    'paypal\\.me',
    'bitcoin',
    'crypto',
    'nft',
    'affiliate',
    'referral',
    'commission'
  ]

  private static readonly DEFAULT_INAPPROPRIATE_PATTERNS = [
    'fuck',
    'shit',
    '\\bdamn\\b',
    '\\bhell\\b', 
    '\\bass\\b',
    'bitch',
    'bastard',
    'crap',
    'piss',
    'cock',
    'dick',
    'pussy',
    'tits',
    'boobs',
    'sex',
    'porn',
    'nude',
    'naked',
    'xxx',
    'adult',
    'escort',
    'hookup',
    'dating',
    'kill',
    'murder',
    'suicide',
    'die',
    'death',
    'violence',
    'hate',
    'racist',
    'nazi',
    'terrorism',
    'bomb',
    'weapon',
    'gun',
    'knife',
    'drug',
    'cocaine',
    'heroin',
    'marijuana',
    'weed',
    'cannabis',
    'alcohol',
    'drink',
    'drunk',
    'beer',
    'wine',
    'vodka',
    'whiskey'
  ]

  private static readonly DEFAULT_UNRELATED_PATTERNS = [
    'hotdog[,!\\s]+that\'s amazing',
    'hotdog[,!\\s]+that is amazing',
    'hotdog[,!\\s]+wow',
    'hotdog[,!\\s]+incredible',
    'hotdog[,!\\s]+unbelievable',
    'hotdog[,!\\s]+no way',
    'hotdog[,!\\s]+really',
    'hotdog[,!\\s]+seriously',
    'hotdog[,!\\s]+damn',
    'hotdog[,!\\s]+dude',
    'hotdog[,!\\s]+man',
    'hotdog[,!\\s]+bro',
    'hotdog[,!\\s]+yo',
    'hotdog[,!\\s]+wait',
    'hotdog[,!\\s]+hold on',
    'hotdog[,!\\s]+what',
    'hotdog[,!\\s]+how',
    'hotdog[,!\\s]+why',
    'hotdog[,!\\s]+when',
    'hotdog[,!\\s]+where',
    'hotdog[,!\\s]+omg',
    'hotdog[,!\\s]+oh my god',
    'hotdog[,!\\s]+jesus',
    'hotdog[,!\\s]+christ',
    'hotdog[,!\\s]+wtf',
    'hotdog[,!\\s]+lol',
    'hotdog[,!\\s]+lmao',
    'hotdog[,!\\s]+haha',
    'hotdog[,!\\s]+this is',
    'hotdog[,!\\s]+that was',
    'hotdog[,!\\s]+you are',
    'hotdog[,!\\s]+he is',
    'hotdog[,!\\s]+she is',
    'hotdog[,!\\s]+it is',
    'hotdog[,!\\s]+we are',
    'hotdog[,!\\s]+they are'
  ]

  private static readonly DEFAULT_REQUIRED_PATTERNS = [
    'hot\\s*dog',
    'hotdog',
    'hot-dog',
    'frankfurter',
    'wiener',
    'sausage',
    'bratwurst',
    'polish sausage',
    'kielbasa',
    'chorizo',
    'andouille',
    'breakfast sausage',
    'italian sausage',
    'coney',
    'chili dog',
    'corn dog',
    'pigs in a blanket',
    'vienna sausage',
    'cocktail sausage',
    'breakfast link',
    'smoked sausage',
    'turkey dog',
    'veggie dog',
    'tofu dog',
    'plant-based dog',
    'vegan dog',
    'beef frank',
    'all beef',
    'kosher dog',
    'hebrew national',
    'nathan\'s',
    'ballpark frank',
    'oscar mayer',
    'johnsonville',
    'hillshire farm',
    'sabretts',
    'hebrew national',
    'dirty water dog',
    'street dog',
    'stadium dog',
    'baseball dog',
    'fair dog',
    'carnival dog',
    'cart dog',
    'vendor dog',
    'foot long',
    'quarter pound',
    'jumbo dog',
    'mini dog',
    'cocktail weenie',
    'little smokie',
    'pig in blanket',
    'mustard',
    'ketchup',
    'relish',
    'onions',
    'sauerkraut',
    'chili',
    'cheese',
    'bun',
    'roll',
    'bread',
    'grill',
    'bbq',
    'barbecue',
    'cookout',
    'picnic',
    'baseball game',
    'stadium',
    'ballpark',
    'fair',
    'carnival',
    'street vendor',
    'food truck',
    'cart',
    'stand'
  ]

  async getFilterPatterns(): Promise<FilterPattern[]> {
    try {
      const result = await db.query<FilterPattern>(
        'SELECT * FROM filter_patterns WHERE is_enabled = true ORDER BY pattern_type, created_at'
      )
      return result.rows
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get filter patterns',
        'FilteringService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return []
    }
  }

  async isSpamContent(text: string): Promise<{ isSpam: boolean; patterns: string[]; confidence: number }> {
    try {
      const spamPatterns = await this.getPatternsByType('spam')
      const flaggedPatterns: string[] = []
      let spamScore = 0
      
      const cleanText = text.toLowerCase().trim()
      
      for (const pattern of spamPatterns) {
        const regex = pattern.is_regex ? new RegExp(pattern.pattern, 'i') : new RegExp(pattern.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        
        if (regex.test(cleanText)) {
          flaggedPatterns.push(pattern.pattern)
          spamScore += 1
        }
      }
      
      // Additional heuristic checks
      const urlCount = (cleanText.match(/https?:\/\/\S+/g) || []).length
      const emailCount = (cleanText.match(/\S+@\S+\.\S+/g) || []).length
      const phoneCount = (cleanText.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/g) || []).length
      const exclamationCount = (cleanText.match(/!/g) || []).length
      const capsRatio = (cleanText.match(/[A-Z]/g) || []).length / cleanText.length
      
      if (urlCount > 2) {
        flaggedPatterns.push('excessive_urls')
        spamScore += 2
      }
      
      if (emailCount > 1) {
        flaggedPatterns.push('multiple_emails')
        spamScore += 2
      }
      
      if (phoneCount > 0) {
        flaggedPatterns.push('phone_number')
        spamScore += 1
      }
      
      if (exclamationCount > 3) {
        flaggedPatterns.push('excessive_exclamations')
        spamScore += 1
      }
      
      if (capsRatio > 0.5 && cleanText.length > 10) {
        flaggedPatterns.push('excessive_caps')
        spamScore += 1
      }
      
      const confidence = Math.min(spamScore / 5, 1)
      const isSpam = confidence > 0.6
      
      return { isSpam, patterns: flaggedPatterns, confidence }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to check spam content',
        'FilteringService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return { isSpam: false, patterns: [], confidence: 0 }
    }
  }

  async isInappropriateContent(text: string): Promise<{ isInappropriate: boolean; patterns: string[]; confidence: number }> {
    try {
      const inappropriatePatterns = await this.getPatternsByType('inappropriate')
      const flaggedPatterns: string[] = []
      let inappropriateScore = 0
      
      const cleanText = text.toLowerCase().trim()
      
      for (const pattern of inappropriatePatterns) {
        const regex = pattern.is_regex ? new RegExp(pattern.pattern, 'i') : new RegExp(pattern.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        
        if (regex.test(cleanText)) {
          flaggedPatterns.push(pattern.pattern)
          inappropriateScore += 1
        }
      }
      
      const confidence = Math.min(inappropriateScore / 3, 1)
      const isInappropriate = confidence > 0.3
      
      return { isInappropriate, patterns: flaggedPatterns, confidence }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to check inappropriate content',
        'FilteringService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return { isInappropriate: false, patterns: [], confidence: 0 }
    }
  }

  async isUnrelatedContent(text: string): Promise<{ isUnrelated: boolean; patterns: string[]; confidence: number }> {
    try {
      const unrelatedPatterns = await this.getPatternsByType('unrelated')
      const flaggedPatterns: string[] = []
      let unrelatedScore = 0
      
      const cleanText = text.toLowerCase().trim()
      
      for (const pattern of unrelatedPatterns) {
        const regex = pattern.is_regex ? new RegExp(pattern.pattern, 'i') : new RegExp(pattern.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        
        if (regex.test(cleanText)) {
          flaggedPatterns.push(pattern.pattern)
          unrelatedScore += 1
        }
      }
      
      const confidence = Math.min(unrelatedScore / 2, 1)
      const isUnrelated = confidence > 0.5
      
      return { isUnrelated, patterns: flaggedPatterns, confidence }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to check unrelated content',
        'FilteringService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return { isUnrelated: false, patterns: [], confidence: 0 }
    }
  }

  async isValidHotdogContent(content: any): Promise<ContentAnalysis> {
    try {
      const text = this.extractTextFromContent(content)
      const processingNotes: string[] = []
      
      // *** ENHANCED: Platform-aware hotdog detection ***
      // Expanded terms including slang, memes, and food-related terms
      const hotdogTerms = [
        'hotdog', 'hot dog', 'hot-dog', 
        'sausage', 'frankfurter', 'wiener', 'bratwurst',
        'corn dog', 'chili dog', 'mustard', 'ketchup', 'relish',
        // Food-related terms that often appear with hotdog content
        'grill', 'bbq', 'barbecue', 'bun', 'condiment', 'ballpark',
        'stadium', 'fair food', 'street food', 'americana',
        // Meme terms (especially for Imgur/Reddit)
        'glizzy', 'weiner', 'tube meat', 'mystery meat',
        'processed meat', 'link', 'dog'
      ]
      
      const lowerText = text.toLowerCase()
      let hasHotdogReference = false
      const foundTerms: string[] = []
      
      for (const term of hotdogTerms) {
        if (lowerText.includes(term)) {
          hasHotdogReference = true
          foundTerms.push(term)
          processingNotes.push(`Found hotdog term: ${term}`)
        }
      }
      
      // Platform-specific analysis boosts
      const isVisualContent = content.content_type === 'image' || content.content_type === 'video'
      const isFromVisualPlatform = ['imgur', 'tumblr', 'pixabay', 'youtube'].includes(content.source_platform)
      
      // For visual platforms, be more permissive even without explicit hotdog terms
      let visualContentBoost = false
      if (isVisualContent && isFromVisualPlatform && !hasHotdogReference) {
        // Look for food/cooking related context that might indicate hotdog content
        const foodContext = [
          'food', 'eat', 'cooking', 'kitchen', 'recipe', 'meal',
          'lunch', 'dinner', 'snack', 'yummy', 'tasty', 'delicious'
        ]
        
        const hasFoodContext = foodContext.some(term => lowerText.includes(term))
        if (hasFoodContext || text.length < 50) { // Short descriptions often on image posts
          visualContentBoost = true
          hasHotdogReference = true // Treat as potential hotdog content
          processingNotes.push('Visual content boost applied - potential hotdog imagery')
        }
      }
      
      if (!hasHotdogReference && !visualContentBoost) {
        processingNotes.push('No hotdog terms or visual content indicators found')
      }
      
      // *** BYPASS COMPLEX FILTERING - Only check for obvious spam/inappropriate ***
      const isObviousSpam = lowerText.includes('buy now') || lowerText.includes('click here') || lowerText.includes('limited time')
      const isObviousInappropriate = lowerText.includes('fuck') || lowerText.includes('shit') || lowerText.includes('porn')
      
      // *** PLATFORM-AWARE CONFIDENCE SCORING ***
      let confidence = 0.8  // Default high confidence for hotdog terms
      
      // Apply platform-specific scoring adjustments
      const platformBoosts = {
        'imgur': 0.15,     // Boost for meme/image content
        'giphy': 0.18,     // High boost for GIF content about hotdogs
        'tumblr': 0.12,    // Boost for creative visual content  
        'youtube': 0.10,   // Boost for video content
        'lemmy': 0.08,     // Slight boost for community content
        'pixabay': 0.05,   // Already performs well, small boost
        'reddit': 0.02     // Already performs well, tiny boost
      }
      
      const platformBoost = platformBoosts[content.source_platform as keyof typeof platformBoosts] || 0
      
      // Base confidence calculation
      if (!hasHotdogReference) {
        if (visualContentBoost) {
          confidence = 0.55 + platformBoost  // Medium confidence for visual content boost
          processingNotes.push('Applied visual content confidence boost')
        } else {
          confidence = 0.2  // Low if no hotdog terms and no visual boost
        }
      } else {
        // Has hotdog reference - apply platform boost
        confidence = Math.min(0.95, confidence + platformBoost)
        if (foundTerms.length > 1) {
          confidence = Math.min(0.98, confidence + 0.1) // Multiple term bonus
          processingNotes.push(`Multiple hotdog terms found: ${foundTerms.join(', ')}`)
        }
      }
      
      // Visual content gets additional boost
      if (isVisualContent) {
        confidence = Math.min(0.99, confidence + 0.08)
        processingNotes.push('Visual content confidence boost applied')
      }
      
      // GIFs get extra boost - they're perfect for hotdog memes and reactions
      if (content.content_type === 'gif') {
        confidence = Math.min(0.99, confidence + 0.1)
        processingNotes.push('GIF content boost applied - perfect for food memes')
      }
      
      // Videos get boost - they're great for cooking tutorials and reviews
      if (content.content_type === 'video') {
        confidence = Math.min(0.99, confidence + 0.08)
        processingNotes.push('Video content boost applied - great for food tutorials')
      }
      
      // Penalty for obvious spam/inappropriate
      if (isObviousSpam) {
        confidence = Math.max(0, confidence - 0.5)
        processingNotes.push('Obvious spam detected')
      }
      
      if (isObviousInappropriate) {
        confidence = Math.max(0, confidence - 0.7)
        processingNotes.push('Obvious inappropriate content detected')
      }
      
      const isValidHotdog = hasHotdogReference && !isObviousSpam && !isObviousInappropriate
      
      // Generate similarity hash
      const similarityHash = this.generateSimilarityHash(text)
      
      const analysis: ContentAnalysis = {
        is_spam: isObviousSpam,
        is_inappropriate: isObviousInappropriate,
        is_unrelated: false, // Bypass unrelated check
        is_valid_hotdog: isValidHotdog,
        confidence_score: confidence,
        flagged_patterns: [], // Bypass complex pattern flagging
        processing_notes: processingNotes,
        similarity_hash: similarityHash
      }
      
      await logToDatabase(
        LogLevel.INFO,
        'Content analysis completed (SIMPLIFIED FILTERING)',
        'FilteringService',
        {
          analysis,
          textLength: text.length,
          hasHotdogReference,
          extractedText: text.substring(0, 200),
          finalConfidence: confidence,
          isObviousSpam,
          isObviousInappropriate,
          processingNotes
        }
      )
      
      return analysis
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to validate hotdog content',
        'FilteringService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      
      return {
        is_spam: false,
        is_inappropriate: false,
        is_unrelated: false,
        is_valid_hotdog: false,
        confidence_score: 0,
        flagged_patterns: [],
        processing_notes: ['Analysis failed'],
        similarity_hash: ''
      }
    }
  }

  async testFilterPattern(pattern: string, isRegex: boolean, testText: string): Promise<{
    matches: boolean
    error?: string
    matchedText?: string
  }> {
    try {
      let regex: RegExp
      
      if (isRegex) {
        regex = new RegExp(pattern, 'i')
      } else {
        regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      }
      
      const matches = regex.test(testText)
      const matchedText = matches ? testText.match(regex)?.[0] : undefined
      
      return { matches, matchedText }
    } catch (error) {
      return {
        matches: false,
        error: error instanceof Error ? error.message : 'Invalid pattern'
      }
    }
  }

  async getFilteringStats(startDate?: Date, endDate?: Date): Promise<FilteringStats> {
    try {
      const dateFilter = startDate && endDate ? 
        'WHERE created_at >= $1 AND created_at <= $2' : 
        'WHERE created_at >= NOW() - INTERVAL \'7 days\''
      
      const params = startDate && endDate ? [startDate, endDate] : []
      
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_processed,
          COUNT(*) FILTER (WHERE is_approved = true AND is_flagged = false) as auto_approved,
          COUNT(*) FILTER (WHERE is_approved = false AND is_flagged = false) as auto_rejected,
          COUNT(*) FILTER (WHERE is_flagged = true) as flagged_for_review,
          COUNT(*) FILTER (WHERE filter_results->>'is_spam' = 'true') as spam_detected,
          COUNT(*) FILTER (WHERE filter_results->>'is_inappropriate' = 'true') as inappropriate_detected,
          COUNT(*) FILTER (WHERE filter_results->>'is_unrelated' = 'true') as unrelated_detected,
          COUNT(*) FILTER (WHERE duplicate_of IS NOT NULL) as duplicates_detected,
          COUNT(*) FILTER (WHERE admin_override = true AND is_approved = true) as false_positives,
          COUNT(*) FILTER (WHERE admin_override = true AND is_approved = false) as false_negatives
        FROM content_analysis ${dateFilter}
      `, params)
      
      const stats = result.rows[0]
      const totalProcessed = parseInt(stats.total_processed)
      const falsePositives = parseInt(stats.false_positives)
      const falseNegatives = parseInt(stats.false_negatives)
      
      const accuracyRate = totalProcessed > 0 ? 
        1 - ((falsePositives + falseNegatives) / totalProcessed) : 0
      
      return {
        total_processed: totalProcessed,
        auto_approved: parseInt(stats.auto_approved),
        auto_rejected: parseInt(stats.auto_rejected),
        flagged_for_review: parseInt(stats.flagged_for_review),
        spam_detected: parseInt(stats.spam_detected),
        inappropriate_detected: parseInt(stats.inappropriate_detected),
        unrelated_detected: parseInt(stats.unrelated_detected),
        duplicates_detected: parseInt(stats.duplicates_detected),
        false_positives: falsePositives,
        false_negatives: falseNegatives,
        accuracy_rate: accuracyRate
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get filtering stats',
        'FilteringService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      
      return {
        total_processed: 0,
        auto_approved: 0,
        auto_rejected: 0,
        flagged_for_review: 0,
        spam_detected: 0,
        inappropriate_detected: 0,
        unrelated_detected: 0,
        duplicates_detected: 0,
        false_positives: 0,
        false_negatives: 0,
        accuracy_rate: 0
      }
    }
  }

  private async getPatternsByType(type: 'spam' | 'inappropriate' | 'unrelated' | 'required'): Promise<FilterPattern[]> {
    try {
      const result = await db.query<FilterPattern>(
        'SELECT * FROM filter_patterns WHERE pattern_type = $1 AND is_enabled = true',
        [type]
      )
      
      // If no patterns in database, use defaults
      if (result.rows.length === 0) {
        return await this.getDefaultPatterns(type)
      }
      
      return result.rows
    } catch (error) {
      // Fall back to default patterns
      return await this.getDefaultPatterns(type)
    }
  }

  private async getDefaultPatterns(type: 'spam' | 'inappropriate' | 'unrelated' | 'required'): Promise<FilterPattern[]> {
    const defaultPatterns = {
      spam: FilteringService.DEFAULT_SPAM_PATTERNS,
      inappropriate: FilteringService.DEFAULT_INAPPROPRIATE_PATTERNS,
      unrelated: FilteringService.DEFAULT_UNRELATED_PATTERNS,
      required: FilteringService.DEFAULT_REQUIRED_PATTERNS
    }
    
    const patterns = defaultPatterns[type] || []
    
    return patterns.map((pattern, index) => ({
      id: index,
      pattern_type: type,
      pattern,
      description: `Default ${type} pattern`,
      is_regex: true,
      is_enabled: true,
      created_at: new Date(),
      updated_at: new Date()
    }))
  }

  private extractTextFromContent(content: any): string {
    const textParts: string[] = []
    
    if (content.content_text) {
      textParts.push(content.content_text)
    }
    
    if (content.original_author) {
      textParts.push(content.original_author)
    }
    
    if (content.alt_text) {
      textParts.push(content.alt_text)
    }
    
    if (content.caption) {
      textParts.push(content.caption)
    }
    
    // Handle direct text input (used by Pixabay and other platforms)
    if (content.text) {
      textParts.push(content.text)
    }
    
    // Handle metadata tags (common for image platforms like Pixabay)
    if (content.metadata && content.metadata.tags && Array.isArray(content.metadata.tags)) {
      textParts.push(content.metadata.tags.join(' '))
    }
    
    return textParts.join(' ').trim()
  }

  private generateSimilarityHash(text: string): string {
    // Normalize text for similarity comparison
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    // Generate hash
    return crypto.createHash('md5').update(normalized).digest('hex')
  }
}

export const filteringService = new FilteringService()