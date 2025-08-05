# Hotdog Diaries API Documentation

**Version:** 1.0.0  
**Base URL:** `https://hotdog-diaries.vercel.app/api`  
**Authentication:** JWT-based with middleware protection  

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Endpoints](#endpoints)
   - [Health & System](#health--system)
   - [Authentication](#authentication-endpoints)
   - [Content Management](#content-management)
   - [Dashboard & Analytics](#dashboard--analytics)
   - [Scheduling](#scheduling)
   - [Social Media Integration](#social-media-integration)
   - [Content Filtering](#content-filtering)
   - [System Management](#system-management)

## Overview

The Hotdog Diaries API provides comprehensive endpoints for managing a social media content aggregation system. The API supports content discovery from multiple platforms (Reddit, YouTube, Unsplash, Flickr, Mastodon), automated posting scheduling, and administrative controls.

### Key Features
- 81 total API endpoints
- Multi-platform social media scanning
- Automated content posting with scheduling
- Advanced content filtering and moderation
- Real-time analytics and monitoring
- Comprehensive admin dashboard

## Authentication

The API uses JWT-based authentication with the following characteristics:

### Protected Routes
All admin routes and API endpoints require authentication except:
- `/api/health` - Public health check
- `/api/admin/login` - Login endpoint
- `/api/content` (GET only) - Public content viewing

### Authentication Flow
1. **Login:** POST to `/api/admin/login` with credentials
2. **Token Storage:** JWT tokens stored in secure HTTP-only cookies
3. **Automatic Refresh:** Refresh tokens handle session extension
4. **Logout:** POST to `/api/admin/logout` to clear session

### Headers
For authenticated requests:
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-08-04T10:30:00Z",
  "details": {} // Optional additional context
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

## Rate Limiting

- **General API:** 100 requests per minute per IP
- **Social Media Scanning:** 10 requests per hour per platform
- **Cron Endpoints:** 1 request per minute (authenticated)

## Endpoints

### Health & System

#### `GET /api/health`
**Description:** System health check  
**Authentication:** Not required  
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-04T10:30:00Z",
  "service": "hotdog-diaries",
  "version": "1.0.0",
  "uptime": 123.45,
  "environment": "production",
  "checks": {
    "database": { "connected": true, "responseTime": 45 },
    "socialMediaScanner": "operational",
    "contentScheduler": "operational"
  }
}
```

### Authentication Endpoints

#### `POST /api/admin/login`
**Description:** Admin user authentication  
**Authentication:** Not required  
**Request:**
```json
{
  "username": "admin",
  "password": "securepassword",
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
      "lastLogin": "2025-08-04T10:30:00Z"
    }
  },
  "message": "Login successful"
}
```

#### `GET /api/admin/me`
**Description:** Get current user profile  
**Authentication:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "lastLogin": "2025-08-04T10:30:00Z",
    "permissions": ["admin", "content_manage"]
  }
}
```

#### `POST /api/admin/refresh`
**Description:** Refresh authentication tokens  
**Authentication:** Refresh token required  
**Response:** New tokens set as cookies

#### `POST /api/admin/logout`
**Description:** Logout and clear session  
**Authentication:** Required  
**Response:** Cookies cleared, session terminated

### Content Management

#### `GET /api/content`
**Description:** Get paginated posted content  
**Authentication:** Not required  
**Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 12, max: 50)
- `order` (string: 'asc'|'desc', default: 'desc')

**Response:**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "content_text": "Amazing hotdog photo!",
        "content_image_url": "https://example.com/hotdog.jpg",
        "source_platform": "reddit",
        "source_url": "https://reddit.com/r/hotdogs/post123",
        "posted_at": "2025-08-04T08:00:00Z",
        "engagement": {
          "likes": 45,
          "shares": 12,
          "comments": 8
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 12,
      "total": 150,
      "totalPages": 13,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### `POST /api/content`
**Description:** Create new content entry  
**Authentication:** Not required (for webhook integration)  
**Request:**
```json
{
  "content_text": "Content description",
  "content_image_url": "https://example.com/image.jpg",
  "source_platform": "reddit",
  "source_url": "https://source.url",
  "content_type": "image",
  "metadata": {}
}
```

#### `GET /api/content/queue`
**Description:** Get content queue for posting  
**Authentication:** Required  
**Parameters:**
- `page` (number)
- `limit` (number)
- `orderBy` (string: 'created_at'|'score'|'engagement')
- `orderDirection` (string: 'asc'|'desc')
- `status` (string: 'pending'|'approved'|'rejected')
- `platform` (string: platform filter)

#### `GET /api/content/[id]`
**Description:** Get specific content item  
**Authentication:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "content_text": "Content text",
    "content_image_url": "https://example.com/image.jpg",
    "source_platform": "reddit",
    "is_approved": true,
    "is_posted": false,
    "created_at": "2025-08-04T10:00:00Z",
    "metadata": {}
  }
}
```

#### `PUT /api/content/[id]`
**Description:** Update content item  
**Authentication:** Required  
**Request:**
```json
{
  "content_text": "Updated text",
  "is_approved": true,
  "admin_notes": "Looks good for posting"
}
```

#### `DELETE /api/content/[id]`
**Description:** Delete content item  
**Authentication:** Required  

#### `POST /api/content/[id]/approve`
**Description:** Approve content for posting  
**Authentication:** Required  
**Request:**
```json
{
  "notes": "Approved for posting"
}
```

#### `POST /api/content/[id]/reject`
**Description:** Reject content  
**Authentication:** Required  
**Request:**
```json
{
  "reason": "Inappropriate content",
  "notes": "Does not meet quality standards"
}
```

#### `POST /api/content/[id]/schedule`
**Description:** Schedule content for posting  
**Authentication:** Required  
**Request:**
```json
{
  "scheduled_for": "2025-08-05T12:00:00Z",
  "priority": "normal"
}
```

#### `POST /api/content/[id]/post`
**Description:** Manually post content immediately  
**Authentication:** Required  

### Dashboard & Analytics

#### `GET /api/admin/dashboard/stats`
**Description:** Main dashboard statistics  
**Authentication:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "totalContent": 150,
    "pendingContent": 25,
    "approvedContent": 45,
    "postedToday": 6,
    "totalViews": 12500,
    "lastPostTime": "2025-08-04T08:00:00Z",
    "nextPostTime": "2025-08-04T12:00:00Z",
    "avgEngagement": 2.4,
    "systemStatus": "online"
  }
}
```

#### `GET /api/admin/dashboard/activity`
**Description:** Recent system activity  
**Authentication:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": 1,
        "type": "content_posted",
        "description": "Posted hotdog content from Reddit",
        "timestamp": "2025-08-04T08:00:00Z",
        "metadata": {
          "contentId": 123,
          "platform": "reddit"
        }
      }
    ]
  }
}
```

### Scheduling

#### `GET /api/admin/schedule`
**Description:** Get posting schedule configuration  
**Authentication:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "meal_times": ["08:00", "12:00", "16:00", "20:00"],
    "timezone": "America/New_York",
    "is_enabled": true,
    "next_post_time": "2025-08-04T12:00:00Z",
    "posts_per_day": 6
  }
}
```

#### `PUT /api/admin/schedule`
**Description:** Update schedule configuration  
**Authentication:** Required  
**Request:**
```json
{
  "meal_times": ["08:00", "12:00", "16:00", "20:00"],
  "timezone": "America/New_York",
  "is_enabled": true,
  "posts_per_day": 6
}
```

#### `GET /api/admin/schedule/next`
**Description:** Get next scheduled posting time  
**Authentication:** Required  

#### `POST /api/admin/schedule/trigger`
**Description:** Manually trigger scheduled posting  
**Authentication:** Required  

#### `POST /api/admin/schedule/pause`
**Description:** Pause/resume scheduled posting  
**Authentication:** Required  
**Request:**
```json
{
  "paused": true,
  "reason": "Maintenance window"
}
```

### Social Media Integration

#### `POST /api/admin/social/scan`
**Description:** Start scanning across all platforms  
**Authentication:** Required  
**Request:**
```json
{
  "platforms": ["reddit", "youtube", "unsplash"],
  "force": false
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "scanId": "scan_20250804_103000",
    "platforms": ["reddit", "youtube", "unsplash"],
    "estimatedDuration": 300,
    "results": {
      "reddit": { "status": "started", "estimatedCompletion": "2025-08-04T10:35:00Z" },
      "youtube": { "status": "started", "estimatedCompletion": "2025-08-04T10:40:00Z" },
      "unsplash": { "status": "started", "estimatedCompletion": "2025-08-04T10:32:00Z" }
    }
  }
}
```

#### `GET /api/admin/social/stats`
**Description:** Social media scanning statistics  
**Authentication:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "platforms": {
      "reddit": {
        "totalScans": 45,
        "contentFound": 1250,
        "contentApproved": 450,
        "lastScan": "2025-08-04T08:00:00Z",
        "apiStatus": "connected"
      },
      "youtube": {
        "totalScans": 32,
        "contentFound": 890,
        "contentApproved": 320,
        "lastScan": "2025-08-04T08:00:00Z",
        "apiStatus": "connected"
      }
    },
    "totalContentFound": 2140,
    "totalContentApproved": 770
  }
}
```

#### `GET /api/admin/social/status`
**Description:** Current scanner status  
**Authentication:** Required  

#### `GET /api/admin/social/settings`
**Description:** Get social media scanning settings  
**Authentication:** Required  

#### `PUT /api/admin/social/settings`
**Description:** Update scanning settings  
**Authentication:** Required  

### Platform-Specific Endpoints

#### Reddit Integration

##### `POST /api/admin/reddit/scan`
**Description:** Trigger Reddit scanning  
**Authentication:** Required  
**Request:**
```json
{
  "subreddits": ["hotdogs", "food"],
  "limit": 25,
  "test": false
}
```

##### `GET /api/admin/reddit/settings`
**Description:** Get Reddit configuration  
**Authentication:** Required  

##### `PUT /api/admin/reddit/settings`
**Description:** Update Reddit settings  
**Authentication:** Required  
**Request:**
```json
{
  "isEnabled": true,
  "scanInterval": 60,
  "subreddits": ["hotdogs", "food", "grilling"],
  "minScore": 10,
  "maxPostsPerScan": 25
}
```

##### `GET /api/admin/reddit/stats`
**Description:** Reddit scanning statistics  
**Authentication:** Required  

##### `POST /api/admin/reddit/test-connection`
**Description:** Test Reddit API connection  
**Authentication:** Required  

#### YouTube Integration

##### `POST /api/admin/youtube/scan`
**Description:** Scan YouTube for hotdog videos  
**Authentication:** Required  

##### `GET /api/admin/youtube/config`
**Description:** Get YouTube API configuration  
**Authentication:** Required  

##### `PUT /api/admin/youtube/config`
**Description:** Update YouTube settings  
**Authentication:** Required  

#### Unsplash Integration

##### `POST /api/admin/unsplash/scan`
**Description:** Scan Unsplash for hotdog photos  
**Authentication:** Required  
**Parameters:**
- `test=true` for test scan

##### `GET /api/admin/unsplash/config`
**Description:** Get Unsplash configuration  
**Authentication:** Required  

##### `PUT /api/admin/unsplash/config`
**Description:** Update Unsplash settings  
**Authentication:** Required  

##### `POST /api/admin/unsplash/search`
**Description:** Search Unsplash photos  
**Authentication:** Required  
**Request:**
```json
{
  "query": "hotdog",
  "maxResults": 20,
  "orientation": "landscape",
  "orderBy": "relevant"
}
```

##### `GET /api/admin/unsplash/scans`
**Description:** Get Unsplash scan history  
**Authentication:** Required  
**Parameters:**
- `limit` (number, default: 10)

### Content Filtering

#### `GET /api/admin/filters`
**Description:** Get content filtering rules  
**Authentication:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "patterns": {
      "blacklist": ["spam", "inappropriate"],
      "whitelist": ["hotdog", "sausage", "grill"],
      "minScore": 10,
      "maxAge": 7
    },
    "stats": {
      "totalFiltered": 234,
      "falsePositives": 12,
      "accuracy": 94.8
    }
  }
}
```

#### `PUT /api/admin/filters`
**Description:** Update filtering rules  
**Authentication:** Required  
**Request:**
```json
{
  "patterns": {
    "blacklist": ["spam", "inappropriate", "nsfw"],
    "whitelist": ["hotdog", "sausage", "grill", "food"],
    "minScore": 15,
    "maxAge": 5
  }
}
```

#### `POST /api/admin/filters/test`
**Description:** Test filter patterns  
**Authentication:** Required  
**Request:**
```json
{
  "content": "Test content to filter",
  "metadata": {
    "score": 25,
    "age": 3,
    "source": "reddit"
  }
}
```

### System Management

#### `GET /api/admin/logs`
**Description:** Get system logs  
**Authentication:** Required  
**Parameters:**
- `level` (string: 'error'|'warning'|'info'|'debug')
- `limit` (number, default: 100)
- `since` (ISO timestamp)

#### `GET /api/admin/diagnostics`
**Description:** System diagnostic information  
**Authentication:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "system": {
      "memory": { "used": "150MB", "available": "850MB" },
      "cpu": { "usage": "25%" },
      "disk": { "used": "2.1GB", "available": "7.9GB" }
    },
    "database": {
      "connected": true,
      "responseTime": 45,
      "activeConnections": 5
    },
    "services": {
      "contentProcessor": "running",
      "scheduler": "running",
      "socialScanner": "running"
    }
  }
}
```

#### `POST /api/admin/recovery`
**Description:** System recovery operations  
**Authentication:** Required  
**Request:**
```json
{
  "action": "restart_scanner",
  "force": false
}
```

### Cron & Automation

#### `POST /api/cron/post-content`
**Description:** Automated content posting (for cron jobs)  
**Authentication:** Bearer token with CRON_SECRET  
**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```
**Response:**
```json
{
  "success": true,
  "data": {
    "posted": 3,
    "scheduled": 12,
    "nextRun": "2025-08-04T12:00:00Z"
  }
}
```

## Testing Endpoints

Several endpoints are available for testing API functionality:

- `POST /api/test-content-processor` - Test content processing
- `POST /api/admin/*/test-connection` - Test platform API connections
- `POST /api/admin/filters/test` - Test filtering rules

## Webhook Support

The API supports webhooks for external integrations:

- Content creation via `POST /api/content`
- Real-time notifications for content events
- Platform-specific webhook handlers

## SDK and Client Libraries

Official SDKs available for:
- JavaScript/TypeScript
- Python
- cURL examples in documentation

## Support and Resources

- **API Status:** Check `/api/health` for current status
- **Rate Limits:** Monitor response headers for limit information
- **Error Logging:** All errors logged with unique request IDs
- **Documentation Updates:** API versioned with backward compatibility