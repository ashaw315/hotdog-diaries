/**
 * Tests for posting diversity constraints as specified in the unified posting workflow
 * Requirements:
 * - No platform repeats within 30 days
 * - Platform caps ≤3 posts per day  
 * - Author caps ≤2 posts per day
 * - ≥4 content categories per day
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock types for diversity testing
interface PostingCandidate {
  id: number;
  platform: string;
  author: string;
  category: string;
  lastPosted?: Date;
}

interface DiversityConstraints {
  maxSamePlatformPerDay: number;
  maxSameAuthorPerDay: number;
  minCategoriesPerDay: number;
  platformCooldownDays: number;
}

interface DiversityState {
  todaysPosts: PostingCandidate[];
  recentPlatforms: Map<string, Date[]>; // platform -> array of posting dates
}

// Mock diversity checker implementation
class PostingDiversityChecker {
  private constraints: DiversityConstraints = {
    maxSamePlatformPerDay: 3,
    maxSameAuthorPerDay: 2,  
    minCategoriesPerDay: 4,
    platformCooldownDays: 30
  };

  validateCandidate(candidate: PostingCandidate, state: DiversityState): {
    allowed: boolean;
    reason?: string;
    diversityScore: number;
  } {
    const today = new Date().toISOString().split('T')[0];
    
    // Check platform daily cap
    const todaysPlatformPosts = state.todaysPosts.filter(p => p.platform === candidate.platform);
    if (todaysPlatformPosts.length >= this.constraints.maxSamePlatformPerDay) {
      return {
        allowed: false,
        reason: `Platform ${candidate.platform} already has ${todaysPlatformPosts.length} posts today (max: ${this.constraints.maxSamePlatformPerDay})`,
        diversityScore: 0
      };
    }

    // Check author daily cap  
    const todaysAuthorPosts = state.todaysPosts.filter(p => p.author === candidate.author);
    if (todaysAuthorPosts.length >= this.constraints.maxSameAuthorPerDay) {
      return {
        allowed: false,
        reason: `Author ${candidate.author} already has ${todaysAuthorPosts.length} posts today (max: ${this.constraints.maxSameAuthorPerDay})`,
        diversityScore: 0
      };
    }

    // Check platform cooldown (30 days)
    const recentPosts = state.recentPlatforms.get(candidate.platform) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.constraints.platformCooldownDays);
    
    const recentPostsInWindow = recentPosts.filter(date => date > cutoffDate);
    if (recentPostsInWindow.length > 0) {
      return {
        allowed: false,
        reason: `Platform ${candidate.platform} posted within last ${this.constraints.platformCooldownDays} days`,
        diversityScore: 0
      };
    }

    // Calculate diversity score (higher is better)
    const categoryCount = new Set([...state.todaysPosts.map(p => p.category), candidate.category]).size;
    const diversityScore = Math.min(1.0, categoryCount / this.constraints.minCategoriesPerDay);

    return {
      allowed: true,
      diversityScore
    };
  }

  getDailyDiversityStatus(state: DiversityState): {
    categoriesCount: number;
    platformDistribution: Record<string, number>;
    authorDistribution: Record<string, number>;
    meetsCategoryRequirement: boolean;
  } {
    const categories = new Set(state.todaysPosts.map(p => p.category));
    const platformCounts: Record<string, number> = {};
    const authorCounts: Record<string, number> = {};

    state.todaysPosts.forEach(post => {
      platformCounts[post.platform] = (platformCounts[post.platform] || 0) + 1;
      authorCounts[post.author] = (authorCounts[post.author] || 0) + 1;
    });

    return {
      categoriesCount: categories.size,
      platformDistribution: platformCounts,
      authorDistribution: authorCounts,
      meetsCategoryRequirement: categories.size >= this.constraints.minCategoriesPerDay
    };
  }
}

describe('Posting Diversity Constraints', () => {
  let diversityChecker: PostingDiversityChecker;
  let mockState: DiversityState;

  beforeEach(() => {
    diversityChecker = new PostingDiversityChecker();
    mockState = {
      todaysPosts: [],
      recentPlatforms: new Map()
    };
  });

  describe('Platform Daily Caps (≤3 per day)', () => {
    it('should allow first post from platform', () => {
      const candidate: PostingCandidate = {
        id: 1,
        platform: 'reddit',
        author: 'author1',
        category: 'meme'
      };

      const result = diversityChecker.validateCandidate(candidate, mockState);
      
      expect(result.allowed).toBe(true);
      expect(result.diversityScore).toBeGreaterThan(0);
    });

    it('should allow up to 3 posts from same platform per day', () => {
      // Add 2 posts from reddit today
      mockState.todaysPosts = [
        { id: 1, platform: 'reddit', author: 'author1', category: 'meme' },
        { id: 2, platform: 'reddit', author: 'author2', category: 'photo' }
      ];

      const candidate: PostingCandidate = {
        id: 3,
        platform: 'reddit',
        author: 'author3',
        category: 'video'
      };

      const result = diversityChecker.validateCandidate(candidate, mockState);
      expect(result.allowed).toBe(true);
    });

    it('should reject 4th post from same platform in one day', () => {
      // Add 3 posts from reddit today (at the limit)
      mockState.todaysPosts = [
        { id: 1, platform: 'reddit', author: 'author1', category: 'meme' },
        { id: 2, platform: 'reddit', author: 'author2', category: 'photo' },
        { id: 3, platform: 'reddit', author: 'author3', category: 'video' }
      ];

      const candidate: PostingCandidate = {
        id: 4,
        platform: 'reddit',
        author: 'author4',
        category: 'text'
      };

      const result = diversityChecker.validateCandidate(candidate, mockState);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('reddit already has 3 posts today');
    });
  });

  describe('Author Daily Caps (≤2 per day)', () => {
    it('should allow up to 2 posts from same author per day', () => {
      mockState.todaysPosts = [
        { id: 1, platform: 'reddit', author: 'prolific_author', category: 'meme' }
      ];

      const candidate: PostingCandidate = {
        id: 2,
        platform: 'twitter',
        author: 'prolific_author',
        category: 'photo'
      };

      const result = diversityChecker.validateCandidate(candidate, mockState);
      expect(result.allowed).toBe(true);
    });

    it('should reject 3rd post from same author in one day', () => {
      mockState.todaysPosts = [
        { id: 1, platform: 'reddit', author: 'prolific_author', category: 'meme' },
        { id: 2, platform: 'twitter', author: 'prolific_author', category: 'photo' }
      ];

      const candidate: PostingCandidate = {
        id: 3,
        platform: 'instagram',
        author: 'prolific_author',
        category: 'video'
      };

      const result = diversityChecker.validateCandidate(candidate, mockState);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('prolific_author already has 2 posts today');
    });
  });

  describe('Platform Cooldown (30 days)', () => {
    it('should reject platform used within 30 days', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 15); // 15 days ago
      
      mockState.recentPlatforms.set('niche_platform', [recentDate]);

      const candidate: PostingCandidate = {
        id: 1,
        platform: 'niche_platform',
        author: 'author1',
        category: 'meme'
      };

      const result = diversityChecker.validateCandidate(candidate, mockState);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('niche_platform posted within last 30 days');
    });

    it('should allow platform used more than 30 days ago', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
      
      mockState.recentPlatforms.set('niche_platform', [oldDate]);

      const candidate: PostingCandidate = {
        id: 1,
        platform: 'niche_platform',
        author: 'author1',
        category: 'meme'
      };

      const result = diversityChecker.validateCandidate(candidate, mockState);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Category Diversity (≥4 categories per day)', () => {
    it('should track category count correctly', () => {
      mockState.todaysPosts = [
        { id: 1, platform: 'reddit', author: 'author1', category: 'meme' },
        { id: 2, platform: 'twitter', author: 'author2', category: 'photo' },
        { id: 3, platform: 'instagram', author: 'author3', category: 'video' }
      ];

      const status = diversityChecker.getDailyDiversityStatus(mockState);
      
      expect(status.categoriesCount).toBe(3);
      expect(status.meetsCategoryRequirement).toBe(false); // Need 4
    });

    it('should meet category requirement with 4+ categories', () => {
      mockState.todaysPosts = [
        { id: 1, platform: 'reddit', author: 'author1', category: 'meme' },
        { id: 2, platform: 'twitter', author: 'author2', category: 'photo' },
        { id: 3, platform: 'instagram', author: 'author3', category: 'video' },
        { id: 4, platform: 'tiktok', author: 'author4', category: 'recipe' }
      ];

      const status = diversityChecker.getDailyDiversityStatus(mockState);
      
      expect(status.categoriesCount).toBe(4);
      expect(status.meetsCategoryRequirement).toBe(true);
    });

    it('should increase diversity score with more categories', () => {
      mockState.todaysPosts = [
        { id: 1, platform: 'reddit', author: 'author1', category: 'meme' },
        { id: 2, platform: 'twitter', author: 'author2', category: 'photo' }
      ];

      const candidate: PostingCandidate = {
        id: 3,
        platform: 'instagram',
        author: 'author3',
        category: 'video' // New category
      };

      const result = diversityChecker.validateCandidate(candidate, mockState);
      expect(result.allowed).toBe(true);
      expect(result.diversityScore).toBe(0.75); // 3 categories / 4 required
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex diversity scenario', () => {
      // Setup a realistic day with mixed content
      mockState.todaysPosts = [
        { id: 1, platform: 'reddit', author: 'meme_lord', category: 'meme' },
        { id: 2, platform: 'reddit', author: 'food_blogger', category: 'recipe' },
        { id: 3, platform: 'twitter', author: 'photographer', category: 'photo' },
        { id: 4, platform: 'instagram', author: 'meme_lord', category: 'video' }  // meme_lord's 2nd post
      ];

      // Try to add a 3rd reddit post (should fail - platform cap)
      const candidate1: PostingCandidate = {
        id: 5,
        platform: 'reddit',
        author: 'new_author',
        category: 'news'
      };

      // Try to add a 3rd post from meme_lord (should fail - author cap)
      const candidate2: PostingCandidate = {
        id: 6,
        platform: 'tiktok',
        author: 'meme_lord',
        category: 'comedy'
      };

      // Try to add a valid diverse post
      const candidate3: PostingCandidate = {
        id: 7,
        platform: 'youtube',
        author: 'chef_special',
        category: 'cooking'
      };

      const result1 = diversityChecker.validateCandidate(candidate1, mockState);
      const result2 = diversityChecker.validateCandidate(candidate2, mockState);
      const result3 = diversityChecker.validateCandidate(candidate3, mockState);

      expect(result1.allowed).toBe(false); // Reddit at cap
      expect(result2.allowed).toBe(false); // meme_lord at cap
      expect(result3.allowed).toBe(true);  // Valid diverse candidate
    });
  });
});