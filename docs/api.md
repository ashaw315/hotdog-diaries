# Hotdog Diaries API Documentation

## Overview

The Hotdog Diaries API provides programmatic access to content scheduling, health monitoring, and system metrics. All admin endpoints require authentication.

**Base URLs:**
- Production: `https://hotdog-diaries.vercel.app/api`
- Development: `http://localhost:3000/api`

**Interactive Documentation:** [/admin/docs](https://hotdog-diaries.vercel.app/admin/docs) (authentication required)

## Authentication

Admin endpoints require authentication via one of these methods:

### Method 1: Bearer Token (Recommended)
```bash
Authorization: Bearer <your-admin-token>
```

### Method 2: Custom Header
```bash
x-admin-token: <your-admin-token>
```

### Getting Your Auth Token

1. Log into the admin panel at `/admin/login`
2. Your token is automatically stored and used by the documentation interface
3. For API access, you can extract it from browser localStorage: `localStorage.getItem('adminToken')`

## Error Handling

All endpoints return errors in a consistent envelope format:

```json
{
  "ok": false,
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "rid": "request-id-for-debugging"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Internal server error |

## Core Endpoints

### 1. Schedule Forecast

Get the daily schedule forecast showing all 6 time slots with content and status.

**Endpoint:** `GET /admin/schedule/forecast`

**Authentication:** Required

**Parameters:**
- `date` (required): Date in YYYY-MM-DD format

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=2023-10-15"
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "date": "2023-10-15",
    "slots": [
      {
        "slot_index": 0,
        "time": "08:00",
        "utc_time": "2023-10-15T13:00:00.000Z",
        "content_id": 1234,
        "content_preview": "Delicious hotdog with mustard and relish",
        "platform": "reddit",
        "content_type": "image",
        "status": "upcoming"
      }
      // ... 5 more slots
    ],
    "summary": {
      "posted": 2,
      "upcoming": 3,
      "missed": 1,
      "diversity": {
        "diversity_score": 0.83,
        "platform_distribution": {
          "reddit": 2,
          "youtube": 1,
          "giphy": 1,
          "imgur": 1,
          "bluesky": 1
        },
        "total_platforms": 5,
        "total_content": 6
      }
    }
  }
}
```

### 2. Refill Schedule

Fill empty schedule slots with new content, applying platform diversity rules.

**Endpoint:** `POST /admin/schedule/forecast/refill`

**Authentication:** Required

**Body Parameters:**
- `date` (required): Date to refill (YYYY-MM-DD)
- `mode` (optional): Refill mode - `create-only`, `create-or-reuse`, `force-recreate` (default: `create-or-reuse`)
- `twoDays` (optional): Refill today and tomorrow (default: `false`)

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2023-10-15",
    "mode": "create-or-reuse",
    "twoDays": true
  }' \
  "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast/refill"
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "date": "2023-10-15",
    "filled": 4,
    "mode": "create-or-reuse",
    "twoDays": true,
    "debug": {
      "environment": "production",
      "candidates_found": 25,
      "platform_distribution": {
        "reddit": 8,
        "youtube": 5,
        "giphy": 4,
        "imgur": 4,
        "bluesky": 2,
        "tumblr": 2
      }
    }
  }
}
```

### 3. Reconcile Schedule

Reconcile the schedule with actually posted content, correcting discrepancies.

**Endpoint:** `POST /admin/schedule/forecast/reconcile`

**Authentication:** Required

**Body Parameters:**
- `date` (required): Date to reconcile (YYYY-MM-DD)

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date": "2023-10-15"}' \
  "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast/reconcile"
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "date": "2023-10-15",
    "reconciled_slots": 3,
    "corrections_made": 1,
    "discrepancies_found": [
      {
        "slot_index": 2,
        "issue": "Content marked as posted but not in posted_content table",
        "resolution": "Corrected schedule status"
      }
    ]
  }
}
```

### 4. Deep Health Check

Comprehensive health check of all system components.

**Endpoint:** `GET /admin/health/deep`

**Authentication:** Required

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://hotdog-diaries.vercel.app/api/admin/health/deep"
```

**Response:**
```json
{
  "ok": true,
  "timestamp": "2023-10-15T14:30:00.000Z",
  "environment": "production",
  "version": "1.0.0",
  "components": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful",
      "response_time_ms": 45.2,
      "last_checked": "2023-10-15T14:30:00.000Z"
    },
    "scheduler": {
      "status": "healthy",
      "message": "Scheduler functioning normally",
      "response_time_ms": 12.1,
      "last_checked": "2023-10-15T14:30:00.000Z"
    },
    "content_queue": {
      "status": "healthy",
      "message": "Content queue operational",
      "response_time_ms": 23.4,
      "last_checked": "2023-10-15T14:30:00.000Z"
    },
    "external_apis": {
      "status": "degraded",
      "message": "Some external APIs responding slowly",
      "response_time_ms": 1250.0,
      "last_checked": "2023-10-15T14:30:00.000Z"
    }
  }
}
```

### 5. Auth Token Validation

Validate authentication token and get user information.

**Endpoint:** `GET /admin/health/auth-token`

**Authentication:** Required

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://hotdog-diaries.vercel.app/api/admin/health/auth-token"
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "valid": true,
    "user_id": 1,
    "username": "admin",
    "expires_at": "2023-10-16T14:30:00.000Z",
    "permissions": ["admin", "schedule", "content"]
  }
}
```

### 6. System Metrics

Get system-wide metrics and health indicators. **No authentication required.**

**Endpoint:** `GET /system/metrics`

**Authentication:** None

**Example:**
```bash
curl "https://hotdog-diaries.vercel.app/api/system/metrics"
```

**Response:**
```json
{
  "timestamp": "2023-10-15T14:30:00.000Z",
  "health_status": "healthy",
  "queue_depth_by_platform": {
    "reddit": 45,
    "youtube": 23,
    "giphy": 12,
    "imgur": 18,
    "bluesky": 8
  },
  "posts_today": 4,
  "posts_this_week": 28,
  "approved_content_count": 156,
  "pending_approval_count": 23,
  "last_scan_times": {
    "reddit": "2023-10-15T13:45:00.000Z",
    "youtube": "2023-10-15T12:30:00.000Z"
  },
  "scheduler_metrics": {
    "last_refill": "2023-10-15T12:00:00.000Z",
    "next_scheduled_post": "2023-10-15T17:00:00.000Z",
    "fill_rate_7d": 0.95
  }
}
```

## End-to-End Example: Refill Two Days

Here's a complete example showing how to refill the schedule for today and tomorrow:

### Step 1: Check Current Schedule
```bash
# Get today's forecast
TODAY=$(date +%Y-%m-%d)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=$TODAY"
```

### Step 2: Refill Schedule
```bash
# Refill today and tomorrow
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"date\": \"$TODAY\",
    \"mode\": \"create-or-reuse\",
    \"twoDays\": true
  }" \
  "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast/refill"
```

### Step 3: Verify Results
```bash
# Check today's updated forecast
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=$TODAY"

# Check tomorrow's forecast
TOMORROW=$(date -d "+1 day" +%Y-%m-%d)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=$TOMORROW"
```

### Expected Flow
1. **Current Schedule Check**: Shows current fill status and diversity
2. **Refill Operation**: Fills empty slots with diverse content
3. **Verification**: Confirms slots are filled with appropriate content diversity

### Success Indicators
- **Filled slots**: Should show 6/6 slots filled for each day
- **Platform diversity**: Multiple platforms represented (diversity score > 0.7)
- **Content types**: Mix of text, images, videos, and GIFs
- **No duplicates**: Each piece of content used only once

## Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Schedule operations | 30 requests | 1 minute |
| Health checks | 60 requests | 1 minute |
| System metrics | 100 requests | 1 minute |

## Time Zones

- All timestamps in API responses are in UTC
- The system operates on Eastern Time (ET) for scheduling
- Time slots are: 08:00, 12:00, 15:00, 18:00, 21:00, 23:30 ET

## SDKs and Tools

### cURL Examples Collection
Save these as a script for easy testing:

```bash
#!/bin/bash
export API_BASE="https://hotdog-diaries.vercel.app/api"
export AUTH_TOKEN="your-token-here"
export TODAY=$(date +%Y-%m-%d)

# Health check
curl -H "Authorization: Bearer $AUTH_TOKEN" "$API_BASE/admin/health/deep"

# Get forecast
curl -H "Authorization: Bearer $AUTH_TOKEN" "$API_BASE/admin/schedule/forecast?date=$TODAY"

# Refill schedule
curl -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$TODAY\",\"mode\":\"create-or-reuse\",\"twoDays\":true}" \
  "$API_BASE/admin/schedule/forecast/refill"

# System metrics (no auth required)
curl "$API_BASE/system/metrics"
```

### JavaScript/TypeScript
```typescript
const API_BASE = 'https://hotdog-diaries.vercel.app/api'
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}

// Get forecast
const forecast = await fetch(`${API_BASE}/admin/schedule/forecast?date=2023-10-15`, {
  headers
}).then(r => r.json())

// Refill schedule
const refill = await fetch(`${API_BASE}/admin/schedule/forecast/refill`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    date: '2023-10-15',
    mode: 'create-or-reuse',
    twoDays: true
  })
}).then(r => r.json())
```

## Support

- **Interactive Docs**: [/admin/docs](https://hotdog-diaries.vercel.app/admin/docs)
- **OpenAPI Spec**: [docs/openapi.yaml](./openapi.yaml)
- **Health Dashboard**: [/admin/health](https://hotdog-diaries.vercel.app/admin/health)
- **System Metrics**: [/api/system/metrics](https://hotdog-diaries.vercel.app/api/system/metrics)

For technical issues or API questions, check the health endpoints first, then review the interactive documentation for detailed schemas and examples.