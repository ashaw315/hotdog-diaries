# Authentication System Documentation

## Overview

The Hotdog Diaries admin panel uses a comprehensive authentication system built with Next.js 15, featuring JWT tokens, secure session management, and middleware-based route protection.

## Architecture

### Components

1. **AuthService** (`lib/services/auth.ts`)
   - Password hashing with bcrypt
   - JWT token generation and validation
   - Token refresh functionality
   - Password strength validation

2. **AdminService** (`lib/services/admin.ts`)
   - Admin user CRUD operations
   - Authentication workflow
   - Login tracking and statistics

3. **Next.js Middleware** (`middleware.ts`)
   - Route protection
   - Automatic token refresh
   - API and page route handling

4. **Auth Context** (`contexts/AuthContext.tsx`)
   - Client-side state management
   - React hooks for authentication
   - Automatic session handling

5. **Admin Login Component** (`components/admin/AdminLogin.tsx`)
   - User-friendly login interface
   - Form validation and error handling
   - Loading states and feedback

## Security Features

### Password Security
- **Bcrypt hashing** with 12 salt rounds
- **Strong password requirements**:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character

### JWT Security
- **Access tokens**: 24-hour expiry
- **Refresh tokens**: 7-day expiry
- **Secure cookie storage**: HttpOnly, Secure, SameSite=Strict
- **Token rotation**: New tokens on refresh
- **Issuer/Audience validation**

### Session Management
- **Automatic token refresh**: 23-hour intervals
- **Secure cookie handling**: HTTPOnly flags
- **Cross-site protection**: SameSite=Strict
- **Session invalidation**: Proper logout handling

## API Endpoints

### Authentication Endpoints

#### `POST /api/admin/login`
Login with username and password.

**Request:**
```json
{
  "username": "admin",
  "password": "StrongPassword123!",
  "rememberMe": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "full_name": "Administrator",
      "last_login_at": "2024-01-01T12:00:00Z"
    },
    "expiresAt": "2024-01-02T12:00:00Z"
  }
}
```

#### `POST /api/admin/logout`
Logout and invalidate session.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### `GET /api/admin/me`
Get current user profile (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "full_name": "Administrator",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "last_login_at": "2024-01-01T12:00:00Z",
    "login_count": 5
  }
}
```

#### `POST /api/admin/refresh`
Refresh access token using refresh token.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Tokens refreshed successfully",
    "expiresAt": "2024-01-02T12:00:00Z"
  }
}
```

## Route Protection

### Protected Routes
- `/admin/*` - All admin panel routes
- `/api/admin/me` - User profile API
- `/api/admin/logout` - Logout API
- `/api/content/queue/*` - Content management APIs
- `/api/content/[id]/*` - Individual content APIs

### Public Routes
- `/admin/login` - Login page
- `/api/admin/login` - Login API
- `/api/content` - Public content API (read-only)
- `/` - Homepage

### Middleware Behavior
1. **Unauthenticated access to protected routes** → Redirect to `/admin/login`
2. **Authenticated access to login page** → Redirect to `/admin`
3. **API requests without auth** → Return 401 JSON response
4. **Token refresh on expiry** → Automatic with new cookies
5. **Service errors** → Graceful fallback with error messages

## React Hooks

### `useAuth()`
Access authentication state and functions.

```tsx
const { user, isLoading, isAuthenticated, login, logout, refreshUser } = useAuth()
```

### `useRequireAuth()`
Automatically redirect if not authenticated.

```tsx
const auth = useRequireAuth() // Redirects to login if not authenticated
```

### `useRedirectIfAuthenticated()`
Redirect authenticated users away from login page.

```tsx
useRedirectIfAuthenticated('/admin') // Redirects to admin if authenticated
```

## Setup and Configuration

### Environment Variables

Required environment variables:

```bash
# JWT Secrets (minimum 32 characters each)
JWT_SECRET="your-secure-jwt-secret-key-here"
JWT_REFRESH_SECRET="your-secure-refresh-secret-key"

# Base URL for redirects
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Default admin user (for seeding)
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="StrongAdminPass123!"
ADMIN_EMAIL="admin@hotdogdiaries.com"
ADMIN_FULL_NAME="Administrator"
```

### Initial Admin User

Create the initial admin user:

```bash
# Using environment variables
npx tsx scripts/seed-admin.ts

# With custom credentials
npx tsx scripts/seed-admin.ts -u superadmin -e admin@example.com -p "MySecurePass123!"

# Force recreate existing user
npx tsx scripts/seed-admin.ts --force
```

### Database Migration

Ensure the admin_users table exists:

```sql
-- This is handled by the migration in lib/migrations/001_initial_schema.sql
-- Run the migration if not already applied
```

## Usage Examples

### Client-Side Authentication Check

```tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'

export default function ProtectedComponent() {
  const { user, isLoading, isAuthenticated } = useAuth()

  if (isLoading) return <div>Loading...</div>
  if (!isAuthenticated) return <div>Please log in</div>

  return <div>Welcome, {user?.username}!</div>
}
```

### Server-Side Authentication Check

```tsx
import { NextAuthUtils } from '@/lib/auth'

export default async function ServerComponent() {
  const user = await NextAuthUtils.getCurrentUser()
  
  if (!user) {
    return <div>Not authenticated</div>
  }

  return <div>Server-side auth: {user.username}</div>
}
```

### API Route Protection

```tsx
import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const authResult = await NextAuthUtils.verifyRequestAuth(request)
  
  if (!authResult.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Access authenticated user
  const user = authResult.user
  
  return NextResponse.json({ message: `Hello, ${user?.username}!` })
}
```

## Security Best Practices

### Implemented Security Measures

1. **Password Security**
   - Bcrypt hashing with high salt rounds
   - Password strength validation
   - Secure password generation utility

2. **Token Security**
   - Short-lived access tokens (24 hours)
   - Longer refresh tokens (7 days)
   - Automatic token rotation
   - Secure storage in HttpOnly cookies

3. **Session Security**
   - HttpOnly cookies prevent XSS
   - Secure flag for HTTPS
   - SameSite=Strict prevents CSRF
   - Automatic session cleanup

4. **Route Protection**
   - Middleware-based protection
   - Graceful error handling
   - Proper redirects and fallbacks

5. **Input Validation**
   - Username sanitization
   - Password strength requirements
   - Request validation middleware

### Security Recommendations

1. **Environment Security**
   - Use strong, unique JWT secrets (32+ characters)
   - Rotate JWT secrets periodically
   - Use HTTPS in production
   - Set secure environment variables

2. **Database Security**
   - Use connection pooling
   - Implement rate limiting
   - Monitor authentication attempts
   - Regular security audits

3. **Client Security**
   - Implement CSRF protection
   - Use Content Security Policy
   - Regular dependency updates
   - Security header configuration

## Error Handling

### Common Error Scenarios

1. **Invalid Credentials** → 401 with clear message
2. **Expired Token** → Automatic refresh attempt
3. **Inactive Account** → 403 with account status
4. **Service Unavailable** → 500 with retry options
5. **Validation Errors** → 400 with field-specific messages

### Error Recovery

- **Token expiry**: Automatic refresh with fallback to login
- **Network errors**: Retry mechanisms with backoff
- **Service errors**: Graceful degradation with user feedback
- **Validation errors**: Real-time feedback and correction hints

## Testing

### Test Coverage

- ✅ AuthService unit tests (password hashing, JWT operations)
- ✅ AdminService integration tests (authentication flow)
- ✅ API route tests (login, logout, profile, refresh)
- ✅ Component tests (login form, auth context)
- ✅ Middleware tests (route protection, redirects)
- ✅ Security tests (token validation, session handling)

### Running Tests

```bash
# Run all authentication tests
npm test -- --testPathPatterns="auth|admin|login"

# Run specific test suites
npm test -- auth.test.ts
npm test -- AdminLogin.test.tsx
npm test -- middleware.test.ts
```

## Troubleshooting

### Common Issues

1. **"JWT_SECRET environment variable is required"**
   - Set JWT_SECRET in .env.local
   - Ensure minimum 32 characters

2. **"Database not connected"**
   - Check database configuration
   - Ensure migrations are run

3. **"Invalid username or password"**
   - Verify user exists in database
   - Check password strength requirements

4. **"Token has expired"**
   - Should auto-refresh; check refresh token
   - May need to log in again

5. **"Authentication service unavailable"**
   - Check database connection
   - Verify environment variables

### Debug Mode

Enable authentication debugging:

```bash
# Set debug environment variable
DEBUG=auth:* npm run dev
```

This comprehensive authentication system provides enterprise-level security with a user-friendly experience, following Next.js best practices and modern security standards.