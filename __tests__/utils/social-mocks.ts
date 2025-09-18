/**
 * Centralized Social Media Service Mocks
 * 
 * Provides standardized mock data and service mocks for all social media platforms
 * used in the Hotdog Diaries content pipeline. Prevents real API calls during testing.
 */

import { ContentType, SourcePlatform } from '@/types'

// ========================================
// Mock Data Objects
// ========================================

export const mockRedditPost = {
  id: "reddit123",
  title: "Amazing hotdog spotted in NYC food truck",
  url: "https://reddit.com/r/hotdogs/amazing_hotdog_123",
  author: "hotdog_lover_2024",
  created_utc: Math.floor(Date.now() / 1000),
  score: 342,
  num_comments: 28,
  thumbnail: "https://external-preview.redd.it/hotdog123.jpg",
  selftext: "This hotdog from the food truck was incredible! Best mustard combo ever.",
  subreddit: "hotdogs",
  permalink: "/r/hotdogs/comments/123/amazing_hotdog_spotted/",
  domain: "reddit.com",
  ups: 342,
  downs: 15
}

export const mockYouTubeVideo = {
  id: "yt123abc",
  title: "Ultimate Hotdog Eating Contest 2025 Championship",
  url: "https://youtube.com/watch?v=yt123abc",
  publishedAt: new Date().toISOString(),
  channelTitle: "Food Challenge Network",
  channelId: "UC123456789",
  description: "Watch the most intense hotdog eating competition of the year! Professional eaters compete for the title.",
  thumbnails: {
    default: { url: "https://i.ytimg.com/vi/yt123abc/default.jpg" },
    medium: { url: "https://i.ytimg.com/vi/yt123abc/mqdefault.jpg" },
    high: { url: "https://i.ytimg.com/vi/yt123abc/hqdefault.jpg" }
  },
  duration: "PT8M42S",
  viewCount: "125847",
  likeCount: "3421",
  commentCount: "287"
}

export const mockBlueskyPost = {
  id: "bsky123",
  text: "Found the best hotdog stand in Brooklyn! Their chili dog is life-changing 🌭",
  createdAt: new Date().toISOString(),
  author: {
    handle: "foodie.bsky.social",
    displayName: "NYC Food Explorer"
  },
  uri: "at://did:plc:123/app.bsky.feed.post/bsky123",
  cid: "bafyrei123",
  replyCount: 5,
  repostCount: 12,
  likeCount: 45,
  embed: {
    images: [{
      alt: "Delicious chili hotdog with toppings",
      image: {
        ref: { $link: "bafyrei456" },
        mimeType: "image/jpeg",
        size: 245678
      }
    }]
  }
}

export const mockImgurPost = {
  id: "imgur123",
  title: "My homemade hotdog creation",
  description: "Bacon-wrapped hotdog with caramelized onions and spicy mustard",
  link: "https://imgur.com/imgur123",
  images: [{
    id: "img123",
    link: "https://i.imgur.com/img123.jpg",
    type: "image/jpeg",
    width: 800,
    height: 600,
    size: 123456,
    description: "Bacon-wrapped hotdog masterpiece"
  }],
  datetime: Math.floor(Date.now() / 1000),
  views: 1547,
  ups: 89,
  downs: 3,
  points: 86,
  score: 86,
  is_album: false,
  in_gallery: true,
  tags: ["food", "hotdog", "cooking"]
}

export const mockGiphyGif = {
  id: "giphy123",
  title: "Hotdog Dance GIF",
  url: "https://giphy.com/gifs/hotdog-dance-party-giphy123",
  images: {
    original: {
      url: "https://media.giphy.com/media/giphy123/giphy.gif",
      width: "480",
      height: "360",
      size: "1234567",
      mp4: "https://media.giphy.com/media/giphy123/giphy.mp4"
    },
    downsized: {
      url: "https://media.giphy.com/media/giphy123/200_d.gif",
      width: "200",
      height: "150",
      size: "234567"
    }
  },
  username: "foodanimations",
  source: "https://example.com/source",
  rating: "g",
  trending_datetime: new Date().toISOString(),
  import_datetime: new Date().toISOString()
}

export const mockTumblrPost = {
  id: "tumblr123",
  type: "photo",
  blog_name: "hotdog-aesthetic",
  post_url: "https://hotdog-aesthetic.tumblr.com/post/123/chicago-style",
  timestamp: Math.floor(Date.now() / 1000),
  date: new Date().toISOString(),
  format: "html",
  tags: ["hotdog", "chicago style", "food photography"],
  summary: "Chicago-style hotdog perfection",
  caption: "<p>The perfect Chicago-style hotdog: yellow mustard, onions, relish, tomato, pickle, sport peppers, celery salt. No ketchup!</p>",
  photos: [{
    original_size: {
      url: "https://64.media.tumblr.com/123/tumblr_inline_123_500.jpg",
      width: 500,
      height: 375
    },
    alt_sizes: [{
      url: "https://64.media.tumblr.com/123/tumblr_inline_123_250.jpg",
      width: 250,
      height: 188
    }]
  }],
  note_count: 42
}

export const mockLemmyPost = {
  post: {
    id: 12345,
    name: "Chicago vs New York hotdog debate",
    url: "https://lemmy.world/post/12345",
    body: "Let's settle this once and for all - which city has the superior hotdog?",
    creator_id: 67890,
    community_id: 111,
    published: new Date().toISOString(),
    updated: new Date().toISOString(),
    score: 89,
    upvotes: 102,
    downvotes: 13,
    nsfw: false,
    ap_id: "https://lemmy.world/post/12345",
    local: true
  },
  creator: {
    id: 67890,
    name: "hotdog_expert",
    display_name: "Hotdog Expert",
    avatar: "https://lemmy.world/pictrs/image/avatar123.webp",
    local: true
  },
  community: {
    id: 111,
    name: "food",
    title: "Food Discussion",
    description: "A place to discuss all things food",
    icon: "https://lemmy.world/pictrs/image/community123.webp",
    local: true
  },
  counts: {
    id: 123,
    post_id: 12345,
    comments: 15,
    score: 89,
    upvotes: 102,
    downvotes: 13,
    published: new Date().toISOString()
  }
}

export const mockUnsplashPhoto = {
  id: "unsplash123",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  width: 3000,
  height: 2000,
  color: "#8B4513",
  description: "Gourmet hotdog with artisanal toppings",
  alt_description: "A beautifully plated hotdog with gourmet toppings on a wooden board",
  urls: {
    raw: "https://images.unsplash.com/photo-123?ixid=raw",
    full: "https://images.unsplash.com/photo-123?ixid=full",
    regular: "https://images.unsplash.com/photo-123?ixid=regular&w=1080",
    small: "https://images.unsplash.com/photo-123?ixid=small&w=400",
    thumb: "https://images.unsplash.com/photo-123?ixid=thumb&w=200"
  },
  links: {
    self: "https://api.unsplash.com/photos/unsplash123",
    html: "https://unsplash.com/photos/unsplash123",
    download: "https://unsplash.com/photos/unsplash123/download"
  },
  likes: 234,
  user: {
    id: "user123",
    username: "foodphotographer",
    name: "Food Photographer",
    profile_image: {
      small: "https://images.unsplash.com/profile-123?w=32",
      medium: "https://images.unsplash.com/profile-123?w=64",
      large: "https://images.unsplash.com/profile-123?w=128"
    }
  },
  tags: [
    { title: "hotdog" },
    { title: "food" },
    { title: "gourmet" },
    { title: "sausage" }
  ]
}

export const mockPixabayPhoto = {
  id: "pixabay789",
  tags: "hotdog, food, grill, sausage, barbecue",
  views: 15420,
  likes: 342,
  downloads: 1250,
  webformatURL: "https://pixabay.com/get/hotdog_640.jpg",
  previewURL: "https://pixabay.com/get/hotdog_150.jpg",
  user: "FoodPhotographer",
  pageURL: "https://pixabay.com/photos/hotdog-grill-food-789/",
  type: "photo",
  webformatWidth: 640,
  webformatHeight: 480,
  description: "hotdog, food, grill - Photo by FoodPhotographer",
  photographer: "FoodPhotographer",
  photoUrl: "https://pixabay.com/get/hotdog_640.jpg",
  thumbnailUrl: "https://pixabay.com/get/hotdog_150.jpg",
  pageUrl: "https://pixabay.com/photos/hotdog-grill-food-789/",
  createdAt: new Date(),
  width: 640,
  height: 480
}

// ========================================
// Service Mock Functions
// ========================================

export function mockRedditService() {
  return {
    fetchPosts: jest.fn().mockResolvedValue([mockRedditPost]),
    validateToken: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue([mockRedditPost]),
    getSubredditPosts: jest.fn().mockResolvedValue([mockRedditPost]),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      rateLimitRemaining: 100,
      lastError: null
    })
  }
}

export function mockYouTubeService() {
  return {
    fetchVideos: jest.fn().mockResolvedValue([mockYouTubeVideo]),
    validateKey: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue([mockYouTubeVideo]),
    getVideoDetails: jest.fn().mockResolvedValue(mockYouTubeVideo),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      quotaRemaining: 9500,
      lastError: null
    })
  }
}

export function mockBlueskyService() {
  return {
    fetchPosts: jest.fn().mockResolvedValue([mockBlueskyPost]),
    validateSession: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue([mockBlueskyPost]),
    authenticate: jest.fn().mockResolvedValue(true),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      sessionValid: true,
      lastError: null
    })
  }
}

export function mockImgurService() {
  return {
    fetchImages: jest.fn().mockResolvedValue([mockImgurPost]),
    validateClientId: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue([mockImgurPost]),
    getGalleryImages: jest.fn().mockResolvedValue([mockImgurPost]),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      rateLimitRemaining: 1000,
      lastError: null
    })
  }
}

export function mockGiphyService() {
  return {
    fetchGifs: jest.fn().mockResolvedValue([mockGiphyGif]),
    validateKey: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue([mockGiphyGif]),
    trending: jest.fn().mockResolvedValue([mockGiphyGif]),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      rateLimitRemaining: 500,
      lastError: null
    })
  }
}

export function mockTumblrService() {
  return {
    fetchPosts: jest.fn().mockResolvedValue([mockTumblrPost]),
    validateKey: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue([mockTumblrPost]),
    getBlogPosts: jest.fn().mockResolvedValue([mockTumblrPost]),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      rateLimitRemaining: 300,
      lastError: null
    })
  }
}

export function mockLemmyService() {
  return {
    fetchPosts: jest.fn().mockResolvedValue([mockLemmyPost]),
    validateConnection: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue([mockLemmyPost]),
    getCommunityPosts: jest.fn().mockResolvedValue([mockLemmyPost]),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      instanceReachable: true,
      lastError: null
    })
  }
}

export function mockUnsplashService() {
  return {
    fetchPhotos: jest.fn().mockResolvedValue([mockUnsplashPhoto]),
    validateKey: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue([mockUnsplashPhoto]),
    getRandomPhotos: jest.fn().mockResolvedValue([mockUnsplashPhoto]),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      rateLimitRemaining: 50,
      lastError: null
    })
  }
}

export function mockPixabayService() {
  return {
    searchPhotos: jest.fn().mockResolvedValue([mockPixabayPhoto]),
    validateKey: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue([mockPixabayPhoto]),
    getPopularPhotos: jest.fn().mockResolvedValue([mockPixabayPhoto]),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getApiStatus: jest.fn().mockResolvedValue({
      isAuthenticated: true,
      rateLimitRemaining: 5000,
      requestsPerHour: 5000,
      lastError: null
    }),
    performScan: jest.fn().mockResolvedValue({
      totalFound: 15,
      processed: 12,
      approved: 8,
      rejected: 4,
      duplicates: 3,
      errors: []
    }),
    testConnection: jest.fn().mockResolvedValue({
      success: true,
      message: 'Pixabay connection successful',
      details: { testResultsCount: 1 }
    }),
    getScanConfig: jest.fn().mockResolvedValue({
      isEnabled: true,
      scanInterval: 240,
      maxPhotosPerScan: 30,
      searchTerms: ['hotdog', 'hot dog', 'frankfurter'],
      minLikes: 5,
      minDownloads: 50
    })
  }
}

// ========================================
// Standardized Content Processing
// ========================================

export const mockProcessedContent = {
  reddit: {
    id: "processed_reddit_123",
    content_text: mockRedditPost.title + "\n\n" + mockRedditPost.selftext,
    content_type: ContentType.TEXT,
    source_platform: SourcePlatform.REDDIT,
    original_url: `https://reddit.com${mockRedditPost.permalink}`,
    original_author: mockRedditPost.author,
    content_image_url: mockRedditPost.thumbnail !== "self" ? mockRedditPost.thumbnail : null,
    scraped_at: new Date(),
    confidence_score: 0.85,
    is_approved: false,
    is_posted: false
  },
  youtube: {
    id: "processed_youtube_123",
    content_text: mockYouTubeVideo.title + "\n\n" + mockYouTubeVideo.description,
    content_type: ContentType.VIDEO,
    source_platform: SourcePlatform.YOUTUBE,
    original_url: mockYouTubeVideo.url,
    original_author: mockYouTubeVideo.channelTitle,
    content_video_url: mockYouTubeVideo.url,
    content_image_url: mockYouTubeVideo.thumbnails.high.url,
    scraped_at: new Date(),
    confidence_score: 0.92,
    is_approved: false,
    is_posted: false
  },
  bluesky: {
    id: "processed_bluesky_123",
    content_text: mockBlueskyPost.text,
    content_type: ContentType.IMAGE,
    source_platform: SourcePlatform.BLUESKY,
    original_url: mockBlueskyPost.uri,
    original_author: mockBlueskyPost.author.handle,
    content_image_url: mockBlueskyPost.embed?.images?.[0]?.image ? `https://bsky.app/img/${mockBlueskyPost.embed.images[0].image.ref.$link}` : null,
    scraped_at: new Date(),
    confidence_score: 0.78,
    is_approved: false,
    is_posted: false
  },
  pixabay: {
    id: "processed_pixabay_123",
    content_text: mockPixabayPhoto.description,
    content_type: ContentType.IMAGE,
    source_platform: SourcePlatform.PIXABAY,
    original_url: mockPixabayPhoto.pageUrl,
    original_author: `Photo by ${mockPixabayPhoto.photographer} on Pixabay`,
    content_image_url: mockPixabayPhoto.photoUrl,
    scraped_at: new Date(),
    confidence_score: 0.82,
    is_approved: false,
    is_posted: false
  }
}

// ========================================
// Error Mock Functions
// ========================================

export function mockServiceError(service: string, errorType: 'network' | 'auth' | 'ratelimit' | 'notfound') {
  const errors = {
    network: new Error(`${service} API network error - connection timeout`),
    auth: new Error(`${service} API authentication failed - invalid credentials`),
    ratelimit: new Error(`${service} API rate limit exceeded - try again later`),
    notfound: new Error(`${service} API endpoint not found - check API version`)
  }
  
  return errors[errorType]
}

// ========================================
// Scanning Service Mocks
// ========================================

export const mockScanResult = {
  totalFound: 5,
  processed: 4,
  approved: 2,
  rejected: 2,
  duplicates: 1,
  errors: [] as string[]
}

export function mockScanningService(platform: string) {
  return {
    performScan: jest.fn().mockResolvedValue(mockScanResult),
    testConnection: jest.fn().mockResolvedValue({
      success: true,
      message: `${platform} connection successful`,
      details: { status: 'connected', authenticated: true }
    }),
    getQuotaStatus: jest.fn().mockResolvedValue({
      remaining: 1000,
      resetTime: Date.now() + 3600000, // 1 hour from now
      dailyLimit: 5000
    })
  }
}