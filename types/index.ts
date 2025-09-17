export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  service: string
  version?: string
  uptime?: number
  environment?: string
  checks?: {
    database?: string
    socialMediaScanner?: string
    contentScheduler?: string
  }
  error?: string
}

export interface HotdogPost {
  id: string
  content: string
  imageUrl?: string
  source: 'reddit' | 'youtube' | 'pixabay' | 'news' | 'mastodon' | 'bluesky'
  sourceUrl: string
  timestamp: string
  engagement: {
    likes: number
    shares: number
    comments: number
  }
  processed: boolean
}

export interface NavItem {
  href: string
  label: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Database Entity Types
export interface ContentQueue {
  id: number
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  content_type: ContentType
  source_platform: SourcePlatform
  original_url: string
  original_author?: string
  scraped_at: Date
  content_hash: string
  is_posted: boolean
  posted_at?: Date
  is_approved: boolean
  admin_notes?: string
  created_at: Date
  updated_at: Date
}

export interface PostedContent {
  id: number
  content_queue_id: number
  posted_at: Date
  scheduled_time?: Date
  post_order: number
  created_at: Date
  updated_at: Date
}

export interface SystemLog {
  id: number
  log_level: LogLevel
  message: string
  component: string
  metadata?: Record<string, any>
  created_at: Date
}

export interface AdminUser {
  id: number
  username: string
  password_hash: string
  last_login?: Date
  created_at: Date
  updated_at: Date
}

// Enums
export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  GIF = 'gif',
  MIXED = 'mixed'
}

export enum SourcePlatform {
  REDDIT = 'reddit',
  YOUTUBE = 'youtube',
  PIXABAY = 'pixabay',
  NEWS = 'news',
  MASTODON = 'mastodon',
  BLUESKY = 'bluesky',
  GIPHY = 'giphy',
  TUMBLR = 'tumblr',
  LEMMY = 'lemmy'
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

// API Request/Response Types
export interface ContentApiResponse {
  success: boolean
  data: {
    content: PostedContent[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  message?: string
}

export interface DatabaseHealthCheck {
  connected: boolean
  latency?: number
  error?: string
}

export interface EnhancedHealthResponse extends Omit<HealthCheckResponse, 'checks'> {
  checks: {
    database: DatabaseHealthCheck
    socialMediaScanner?: string
    contentScheduler?: string
  }
}

// Content Processing Types
export interface ContentProcessingResult {
  id?: number
  status: 'processed' | 'approved' | 'rejected' | 'flagged' | 'error'
  analysisResult?: {
    score: number
    confidence: number
    reasons: string[]
  }
  processed?: number
  approved?: number
  rejected?: number
  flagged?: number
  errors?: string[]
}

// Extended AdminUser type with optional fields
export interface AdminUserWithDetails extends AdminUser {
  email?: string
  full_name?: string
  is_active?: boolean
}

// Content creation types
export interface ContentItem {
  id?: number
  content_text: string
  content_image_url?: string
  content_video_url?: string
  content_type: string
  source_platform: string
  original_url?: string
  original_author?: string
  posted_at?: Date | string
  scraped_at?: Date | string
  is_posted?: boolean
  is_approved?: boolean
  content_status?: string
  [key: string]: unknown // Allow additional properties
}

// API Error types
export interface ApiError {
  message: string
  code?: string
  status?: number
}

// YouTube API types
export interface YouTubeVideoItem {
  id: string
  title: string
  channelTitle: string
  description?: string
  thumbnailUrl?: string
  publishedAt?: string
  likeCount?: number
  viewCount?: number
  duration?: string
}

// Service status types
export interface ServiceStatus {
  platform: string
  isEnabled: boolean
  isAuthenticated: boolean
  connectionStatus: string
  connectionMessage: string
  scanInterval: number
  searchTerms: string[]
  lastScanTime?: string
  nextScanTime?: string
  healthStatus?: string
  stats: {
    totalScanned: number
    totalApproved: number
    totalRejected: number
    successRate: number
  }
  capabilities: {
    canSchedule: boolean
    canPost: boolean
    supportsVideo: boolean
    supportsImages: boolean
  }
}

// Database connection pool types
export interface ConnectionPoolStats {
  total: number
  idle: number
  active: number
}