import { AdminUser, LogLevel } from '@/types'
import { query, insert, update } from '@/lib/db-query-builder'
import { AuthService } from './auth'
import { logToDatabase } from '@/lib/db'

export interface CreateAdminUserData {
  username: string
  password: string
  email?: string
  full_name?: string
  is_active?: boolean
}

export interface AdminLoginData {
  username: string
  password: string
}

export interface AdminProfile {
  id: number
  username: string
  email?: string
  full_name?: string
  is_active: boolean
  created_at: Date
  last_login_at?: Date
  login_count: number
}

export class AdminService {
  /**
   * Get or create service account for CI/CD
   */
  static async getServiceAccount(): Promise<AdminUser | null> {
    try {
      return await query('admin_users')
        .where('username', '=', 'service-account')
        .where('is_active', '=', true)
        .first<AdminUser>()
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get service account',
        'AdminService',
        { error: error.message }
      )
      return null
    }
  }

  /**
   * Create service account for CI/CD
   */
  static async createServiceAccount(): Promise<AdminUser> {
    try {
      const existingAccount = await this.getServiceAccount()
      if (existingAccount) {
        return existingAccount
      }

      // Generate secure password for service account
      const password = AuthService.generateSecurePassword(32)
      const passwordHash = await AuthService.hashPassword(password)

      const serviceAccount = await insert('admin_users', {
        username: 'service-account',
        password_hash: passwordHash,
        email: 'service@hotdog-diaries.com',
        full_name: 'CI/CD Service Account',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).returning<AdminUser>('*')

      await logToDatabase(
        LogLevel.INFO,
        'Service account created',
        'AdminService',
        { accountId: serviceAccount.id }
      )

      return serviceAccount
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to create service account',
        'AdminService',
        { error: error.message }
      )
      throw error
    }
  }

  /**
   * Update last activity timestamp
   */
  static async updateLastActivity(userId: number): Promise<void> {
    try {
      await update('admin_users')
        .set({ 
          last_login_at: new Date(),
          updated_at: new Date()
        })
        .where('id', '=', userId)
        .execute()
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to update last activity',
        'AdminService',
        { userId, error: error.message }
      )
    }
  }

  /**
   * Create a new admin user
   */
  static async createAdminUser(data: CreateAdminUserData): Promise<AdminUser> {
    try {
      // Validate password strength
      const passwordValidation = AuthService.validatePasswordStrength(data.password)
      if (!passwordValidation.isValid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`)
      }

      // Check if username already exists
      const existingUser = await query('admin_users')
        .where('username', '=', data.username)
        .first<AdminUser>()

      if (existingUser) {
        throw new Error(`Username '${data.username}' already exists`)
      }

      // Check if email already exists (if provided)
      if (data.email) {
        const existingEmail = await query('admin_users')
          .where('email', '=', data.email)
          .first<AdminUser>()

        if (existingEmail) {
          throw new Error(`Email '${data.email}' already exists`)
        }
      }

      // Hash the password
      const passwordHash = await AuthService.hashPassword(data.password)

      // Create the user
      const newUser = await insert('admin_users')
        .values({
          username: data.username,
          password_hash: passwordHash,
          email: data.email || null,
          full_name: data.full_name || null,
          is_active: data.is_active !== false, // Default to true
          created_at: new Date(),
          updated_at: new Date(),
          login_count: 0
        })
        .first<AdminUser>()

      if (!newUser) {
        throw new Error('Failed to create admin user')
      }

      // Log the creation
      await logToDatabase(
        LogLevel.INFO,
        'ADMIN_USER_CREATED',
        `Admin user created: ${data.username}`,
        { userId: newUser.id, username: data.username }
      )

      // Remove password_hash from response
      const { password_hash, ...userWithoutPassword } = newUser
      return userWithoutPassword as AdminUser
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'ADMIN_USER_CREATE_FAILED',
        `Failed to create admin user: ${data.username}`,
        { username: data.username, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  /**
   * Authenticate admin user with username and password
   */
  static async authenticateAdmin(data: AdminLoginData): Promise<{ user: AdminProfile; tokens: { accessToken: string; refreshToken: string } }> {
    try {
      // Find user by username
      const user = await query('admin_users')
        .where('username', '=', data.username)
        .where('is_active', '=', true)
        .first<AdminUser>()

      if (!user) {
        throw new Error('Invalid username or password')
      }

      // Verify password
      const isValidPassword = await AuthService.validatePassword(data.password, user.password_hash)
      if (!isValidPassword) {
        throw new Error('Invalid username or password')
      }

      // Update last login and increment login count
      await this.updateLastLogin(user.id)

      // Generate tokens using standard auth service for consistency
      const tokens = AuthService.generateTokens({
        id: user.id,
        username: user.username
      })

      // Prepare user profile (without password_hash)
      const userProfile: AdminProfile = {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        is_active: user.is_active,
        created_at: user.created_at,
        last_login_at: new Date(),
        login_count: (user.login_count || 0) + 1
      }

      // Log successful authentication
      await logToDatabase(
        LogLevel.INFO,
        'ADMIN_LOGIN_SUCCESS',
        `Admin user logged in: ${data.username}`,
        { userId: user.id, username: data.username }
      )

      return { user: userProfile, tokens }
    } catch (error) {
      // Log failed authentication attempt
      await logToDatabase(
        LogLevel.WARNING,
        'ADMIN_LOGIN_FAILED',
        `Failed login attempt for username: ${data.username}`,
        { username: data.username, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  /**
   * Update last login timestamp and increment login count
   */
  static async updateLastLogin(userId: number): Promise<void> {
    try {
      // Use raw SQL to increment login count atomically
      const { db } = await import('@/lib/db')
      await db.query(
        `UPDATE admin_users 
         SET last_login_at = NOW(), 
             login_count = COALESCE(login_count, 0) + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [userId]
      )
    } catch (error) {
      // Don't throw error for login tracking failures
      await logToDatabase(
        LogLevel.ERROR,
        'LOGIN_TRACKING_FAILED',
        `Failed to update login tracking for user ${userId}`,
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Get admin user by ID
   */
  static async getAdminById(userId: number): Promise<AdminProfile | null> {
    try {
      const user = await query('admin_users')
        .select(['id', 'username', 'email', 'full_name', 'is_active', 'created_at', 'last_login_at', 'login_count'])
        .where('id', '=', userId)
        .where('is_active', '=', true)
        .first<AdminProfile>()

      return user || null
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'ADMIN_USER_FETCH_FAILED',
        `Failed to fetch admin user by ID: ${userId}`,
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return null
    }
  }

  /**
   * Get admin user by username
   */
  static async getAdminByUsername(username: string): Promise<AdminProfile | null> {
    try {
      const user = await query('admin_users')
        .select(['id', 'username', 'email', 'full_name', 'is_active', 'created_at', 'last_login_at', 'login_count'])
        .where('username', '=', username)
        .where('is_active', '=', true)
        .first<AdminProfile>()

      return user || null
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'ADMIN_USER_FETCH_FAILED',
        `Failed to fetch admin user by username: ${username}`,
        { username, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return null
    }
  }

  /**
   * Update admin user profile
   */
  static async updateAdminProfile(
    userId: number, 
    updates: Partial<Pick<AdminUser, 'email' | 'full_name'>>
  ): Promise<AdminProfile> {
    try {
      const updatedUser = await update('admin_users')
        .set({
          ...updates,
          updated_at: new Date()
        })
        .where('id', '=', userId)
        .where('is_active', '=', true)
        .first<AdminUser>()

      if (!updatedUser) {
        throw new Error('Admin user not found or inactive')
      }

      await logToDatabase(
        LogLevel.INFO,
        'ADMIN_PROFILE_UPDATED',
        `Admin profile updated for user: ${updatedUser.username}`,
        { userId, updates }
      )

      return {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        is_active: updatedUser.is_active,
        created_at: updatedUser.created_at,
        last_login_at: updatedUser.last_login_at,
        login_count: updatedUser.login_count || 0
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'ADMIN_PROFILE_UPDATE_FAILED',
        `Failed to update admin profile for user ${userId}`,
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  /**
   * Change admin user password
   */
  static async changePassword(
    userId: number, 
    currentPassword: string, 
    newPassword: string
  ): Promise<void> {
    try {
      // Validate new password strength
      const passwordValidation = AuthService.validatePasswordStrength(newPassword)
      if (!passwordValidation.isValid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`)
      }

      // Get current user
      const user = await query('admin_users')
        .where('id', '=', userId)
        .where('is_active', '=', true)
        .first<AdminUser>()

      if (!user) {
        throw new Error('Admin user not found or inactive')
      }

      // Verify current password
      const isValidCurrentPassword = await AuthService.validatePassword(currentPassword, user.password_hash)
      if (!isValidCurrentPassword) {
        throw new Error('Current password is incorrect')
      }

      // Hash new password
      const newPasswordHash = await AuthService.hashPassword(newPassword)

      // Update password
      await update('admin_users')
        .set({
          password_hash: newPasswordHash,
          updated_at: new Date()
        })
        .where('id', '=', userId)
        .first()

      await logToDatabase(
        LogLevel.INFO,
        'ADMIN_PASSWORD_CHANGED',
        `Password changed for admin user: ${user.username}`,
        { userId, username: user.username }
      )
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'ADMIN_PASSWORD_CHANGE_FAILED',
        `Failed to change password for user ${userId}`,
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  /**
   * Deactivate admin user
   */
  static async deactivateAdmin(userId: number): Promise<void> {
    try {
      const user = await update('admin_users')
        .set({
          is_active: false,
          updated_at: new Date()
        })
        .where('id', '=', userId)
        .first<AdminUser>()

      if (!user) {
        throw new Error('Admin user not found')
      }

      await logToDatabase(
        LogLevel.INFO,
        'ADMIN_USER_DEACTIVATED',
        `Admin user deactivated: ${user.username}`,
        { userId, username: user.username }
      )
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'ADMIN_DEACTIVATION_FAILED',
        `Failed to deactivate admin user ${userId}`,
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  /**
   * Get admin user statistics
   */
  static async getAdminStats(): Promise<{
    totalAdmins: number
    activeAdmins: number
    recentLogins: number
  }> {
    try {
      const totalAdmins = await query('admin_users').count()
      const activeAdmins = await query('admin_users').where('is_active', '=', true).count()
      
      // Recent logins in last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentLogins = await query('admin_users')
        .where('last_login_at', '>', oneDayAgo)
        .count()

      return {
        totalAdmins,
        activeAdmins,
        recentLogins
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'ADMIN_STATS_FETCH_FAILED',
        'Failed to fetch admin statistics',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }
}