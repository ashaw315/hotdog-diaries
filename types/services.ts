/**
 * Service Type Definitions
 * 
 * This file contains all type definitions for service classes and their interfaces
 */

// ========================================
// Base Service Types
// ========================================

export interface ServiceHealthCheck {
  isHealthy: boolean
  message: string
  details?: Record<string, unknown>
  lastChecked: Date
}

export interface ServiceConnectionTest {
  success: boolean
  message: string
  details?: Record<string, unknown>
}

export interface ServiceScanOptions {
  maxPosts?: number
  maxResults?: number
  query?: string
  since?: Date
  until?: Date
}

export interface ServiceScanResult {
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
  duration?: number
}

// ========================================
// Content Service Types
// ========================================

export interface CreateContentOptions {
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  content_type: 'text' | 'image' | 'video' | 'mixed' | 'gif'
  source_platform: string
  original_url: string
  original_author?: string
  confidence_score?: number
}

export interface ContentServiceInterface {
  createContent(options: CreateContentOptions): Promise<{ id: number }>
  getContent(id: number): Promise<unknown>
  updateContent(id: number, updates: Partial<CreateContentOptions>): Promise<void>
  deleteContent(id: number): Promise<void>
}

// ========================================
// Authentication Service Types
// ========================================

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
}

export interface JWTPayload {
  userId: number
  username: string
  iat?: number
  exp?: number
  aud?: string
  iss?: string
}

export interface AuthResult {
  user: {
    id: number
    username: string
    email?: string
  }
  tokens: AuthTokens
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthServiceInterface {
  hashPassword(password: string): Promise<string>
  validatePassword(password: string, hash: string): Promise<boolean>
  generateJWT(payload: Pick<JWTPayload, 'userId' | 'username'>): string
  verifyJWT(token: string): JWTPayload
  authenticate(credentials: LoginCredentials): Promise<AuthResult>
}

// ========================================
// Admin Service Types
// ========================================

export interface AdminUser {
  id: number
  username: string
  email?: string
  full_name?: string
  is_active: boolean
  password_hash: string
  last_login?: string
  created_at: string
  updated_at: string
}

export interface CreateAdminUserOptions {
  username: string
  password: string
  email?: string
  full_name?: string
}

export interface AdminServiceInterface {
  createAdminUser(options: CreateAdminUserOptions): Promise<AdminUser>
  getAdminByUsername(username: string): Promise<AdminUser | null>
  getAdminById(id: number): Promise<AdminUser | null>
  authenticateAdmin(credentials: LoginCredentials): Promise<AuthResult>
  updateLastLogin(userId: number): Promise<void>
}

// ========================================
// Social Media Service Types
// ========================================

export interface SocialMediaPost {
  id: string
  title: string
  content: string
  author: string
  url: string
  imageUrl?: string
  videoUrl?: string
  createdAt: Date
  score: number
  platform: string
}

export interface SocialMediaServiceInterface {
  testConnection(): Promise<ServiceConnectionTest>
  performScan(options: ServiceScanOptions): Promise<ServiceScanResult>
  getApiStatus(): Promise<{
    isAuthenticated: boolean
    quotaUsed?: number
    quotaRemaining?: number
    lastError?: string
  }>
}

// ========================================
// Scanning Service Types
// ========================================

export interface ScanningServiceInterface extends SocialMediaServiceInterface {
  searchContent(query: string, options?: ServiceScanOptions): Promise<SocialMediaPost[]>
  processPost(post: SocialMediaPost): Promise<{
    approved: boolean
    reason: string
    confidenceScore: number
  }>
}

// ========================================
// Health Service Types
// ========================================

export interface SystemHealth {
  database: ServiceHealthCheck
  services: Record<string, ServiceHealthCheck>
  overall: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
}

export interface HealthServiceInterface {
  checkDatabaseHealth(): Promise<ServiceHealthCheck>
  checkServiceHealth(serviceName: string): Promise<ServiceHealthCheck>
  getOverallHealth(): Promise<SystemHealth>
}

// ========================================
// Posting Service Types
// ========================================

export interface PostingOptions {
  contentId: number
  scheduledTime?: Date
  force?: boolean
}

export interface PostingResult {
  success: boolean
  contentId: number
  postedAt: Date
  message: string
  error?: string
}

export interface PostingServiceInterface {
  schedulePost(options: PostingOptions): Promise<{ success: boolean; message: string }>
  postNow(contentId: number): Promise<PostingResult>
  getScheduledPosts(): Promise<unknown[]>
  cancelScheduledPost(postId: number): Promise<void>
}

// ========================================
// Monitoring Service Types
// ========================================

export interface MetricData {
  name: string
  value: number
  unit: string
  timestamp: Date
  tags?: Record<string, string>
}

export interface MonitoringServiceInterface {
  recordMetric(metric: MetricData): Promise<void>
  getMetrics(name: string, since?: Date): Promise<MetricData[]>
  getSystemMetrics(): Promise<Record<string, MetricData[]>>
}

// ========================================
// Type Guards
// ========================================

export function isServiceHealthCheck(obj: unknown): obj is ServiceHealthCheck {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as ServiceHealthCheck).isHealthy === 'boolean' &&
    typeof (obj as ServiceHealthCheck).message === 'string'
  )
}

export function isSocialMediaPost(obj: unknown): obj is SocialMediaPost {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as SocialMediaPost).id === 'string' &&
    typeof (obj as SocialMediaPost).title === 'string' &&
    typeof (obj as SocialMediaPost).platform === 'string'
  )
}

export function isAuthResult(obj: unknown): obj is AuthResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as AuthResult).user === 'object' &&
    typeof (obj as AuthResult).tokens === 'object'
  )
}

// ========================================
// Error Types
// ========================================

export class ServiceError extends Error {
  public readonly code: string
  public readonly service: string
  public readonly details?: Record<string, unknown>

  constructor(
    message: string,
    code: string,
    service: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.service = service
    this.details = details
  }
}

export class AuthenticationError extends ServiceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_FAILED', 'auth', details)
    this.name = 'AuthenticationError'
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_FAILED', 'validation', details)
    this.name = 'ValidationError'
  }
}

export class NetworkError extends ServiceError {
  constructor(message: string, service: string, details?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', service, details)
    this.name = 'NetworkError'
  }
}

export class RateLimitError extends ServiceError {
  public readonly retryAfter?: number

  constructor(message: string, service: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', service, { retryAfter })
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}