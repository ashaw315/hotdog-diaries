# Comprehensive Endpoint and Platform Analysis
## Hotdog Diaries API Structure

---

## 📊 **Current State Summary**

**Total Admin Endpoints:** 143 route files  
**Consolidated Endpoints:** 25 RESTful routes (implemented)  
**Content Source Platforms:** 10 active platforms  
**Legacy Endpoints:** 118 endpoints marked for deprecation  

---

## 🔗 **NEW CONSOLIDATED API ENDPOINTS (25 Routes)**

### **1. Authentication & Session Management (4 endpoints)**

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/api/admin/auth` | POST | User login | `{ username, password }` |
| `/api/admin/auth` | DELETE | User logout | `{}` |
| `/api/admin/auth/me` | GET | Get current user info | `{}` |
| `/api/admin/auth/refresh` | POST | Refresh access token | `{ refreshToken }` |

**Usage:** Handles all admin authentication flows, JWT token management, and session validation.

---

### **2. Content Management (6 endpoints)**

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/api/admin/content` | GET | List/filter content | Query: `?status=pending&page=1&limit=20&platform=reddit` |
| `/api/admin/content` | POST | Create new content | `{ content_text, content_type, source_platform }` |
| `/api/admin/content/[id]` | GET | Get specific content item | `{}` |
| `/api/admin/content/[id]` | PATCH | Update content status | `{ status: "approved/rejected/scheduled", reason?, scheduledAt? }` |
| `/api/admin/content/bulk` | PATCH | Bulk operations | `{ ids: [1,2,3], action: "approve/reject/delete" }` |
| `/api/admin/content/export` | GET | Export content data | Query: `?format=csv&filter=approved` |

**Usage:** Complete content lifecycle management - review, approve, reject, schedule, and bulk operations.

---

### **3. Platform Scanning & Management (3 endpoints)**

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/api/admin/platforms/scan` | POST | Trigger platform content scans | `{ platform: "reddit/youtube/bluesky/all", maxPosts: 25 }` |
| `/api/admin/platforms/status` | GET | Get platform health status | Query: `?platform=reddit` (optional) |
| `/api/admin/platforms/[platform]/config` | GET/PUT | Platform configuration | GET: `{}`, PUT: platform-specific config |

**Usage:** Unified platform management - scan content, check health, configure settings for all platforms.

---

### **4. Dashboard & Analytics (3 endpoints)**

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/api/admin/dashboard` | GET | Main dashboard data | Query: `?refresh=true` (optional) |
| `/api/admin/analytics` | GET | Analytics with filtering | Query: `?category=social&type=performance&timeframe=7d` |
| `/api/admin/queue` | GET | Queue management & analytics | Query: `?view=health/alerts/recommendations` |

**Usage:** Real-time monitoring, performance analytics, and queue health management.

---

### **5. Scheduling & Posting (3 endpoints)**

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/api/admin/schedule` | GET | Get schedule configuration | `{}` |
| `/api/admin/schedule` | PUT | Update schedule settings | `{ meal_times: ["08:00", "12:00", "18:00"], timezone: "America/New_York" }` |
| `/api/admin/schedule` | POST | Schedule operations | `{ action: "trigger/post_now/test", contentId?: 123 }` |

**Usage:** Automated posting schedule management and manual posting triggers.

---

### **6. System Health & Monitoring (3 endpoints)**

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/api/admin/health` | GET | System health check | Query: `?view=diagnostics/recovery/cron` |
| `/api/admin/health` | POST | Run health diagnostics | `{ checkType: "full/quick/platform" }` |
| `/api/admin/metrics` | GET | System metrics | Query: `?timeframe=24h&platform=reddit` |

**Usage:** Comprehensive system monitoring, health diagnostics, and performance metrics.

---

### **7. Maintenance & Operations (3 endpoints)**

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/api/admin/maintenance` | POST | Data maintenance operations | `{ action: "cleanup_duplicates/rebalance/auto_approve" }` |
| `/api/admin/debug` | GET | Debug information | Query: `?type=scan/hashes/duplicates` |
| `/api/admin/debug` | POST | Debug operations | `{ action: "test_duplicate_prevention" }` |

**Usage:** Database maintenance, duplicate cleanup, and system debugging.

---

## 🌐 **CONTENT SOURCE PLATFORMS**

### **Active Platforms (10 platforms)**

| Platform | Service File | Status | Content Types | Scanning Endpoint |
|----------|-------------|--------|---------------|-------------------|
| **Reddit** | `reddit-scanning.ts` | ✅ Fully Active | Text posts, images, videos | `/api/admin/platforms/scan` |
| **YouTube** | `youtube-scanning.ts` | ✅ Fully Active | Video content, descriptions | `/api/admin/platforms/scan` |
| **Bluesky** | `bluesky-scanning.ts` | ✅ Fully Active | Text posts, images | `/api/admin/platforms/scan` |
| **Imgur** | `imgur-scanning.ts` | ✅ Fully Active | Images, GIFs | `/api/admin/platforms/scan` |
| **Pixabay** | `pixabay-scanning.ts` | ✅ Implemented | Stock images | `/api/admin/platforms/scan` |
| **Giphy** | `giphy-scanning.ts` | ✅ Implemented | GIFs, animations | `/api/admin/platforms/scan` |
| **Tumblr** | `tumblr-scanning.ts` | ✅ Implemented | Text, images, GIFs | `/api/admin/platforms/scan` |
| **Lemmy** | `lemmy-scanning.ts` | ✅ Implemented | Text posts, images | `/api/admin/platforms/scan` |
| **Unsplash** | `unsplash-scanning.ts` | ✅ Implemented | High-quality images | `/api/admin/platforms/scan` |
| **Mastodon** | `mastodon-scanning.ts` | ⚠️ Partial | Social media posts | `/api/admin/platforms/scan` |

### **Legacy Platforms (2 platforms)**

| Platform | Service File | Status | Notes |
|----------|-------------|--------|-------|
| **Flickr** | `flickr-scanning.ts` | 🚫 Deprecated | Limited API access |
| **Twitter/X** | None | 🚫 Removed | API access restrictions |

---

## 📍 **PLATFORM-SPECIFIC ENDPOINTS**

### **Reddit Integration**
- **Primary Endpoint:** `POST /api/admin/platforms/scan` with `{ platform: "reddit" }`
- **Legacy Endpoints:** 
  - `/api/admin/reddit/scan` 
  - `/api/admin/reddit/test-connection`
  - `/api/admin/reddit/status`
  - `/api/admin/reddit/stats`
- **Content Types:** Text posts, image posts, video posts from hotdog-related subreddits
- **API Integration:** Reddit API with OAuth authentication

### **YouTube Integration**
- **Primary Endpoint:** `POST /api/admin/platforms/scan` with `{ platform: "youtube" }`
- **Legacy Endpoints:**
  - `/api/admin/youtube/scan`
  - `/api/admin/youtube/test`
  - `/api/admin/youtube/status`
- **Content Types:** Video content with hotdog-related keywords
- **API Integration:** YouTube Data API v3

### **Bluesky Integration**
- **Primary Endpoint:** `POST /api/admin/platforms/scan` with `{ platform: "bluesky" }`
- **Legacy Endpoints:**
  - `/api/admin/bluesky/scan`
  - `/api/admin/bluesky/test`
  - `/api/admin/bluesky/status`
- **Content Types:** Social media posts and images
- **API Integration:** AT Protocol API

### **Imgur Integration**
- **Primary Endpoint:** `POST /api/admin/platforms/scan` with `{ platform: "imgur" }`
- **Legacy Endpoints:**
  - `/api/admin/imgur/scan`
  - `/api/admin/imgur/test-connection`
  - `/api/admin/imgur/status`
- **Content Types:** Images and GIFs
- **API Integration:** Imgur API v3

### **Universal Platform Scanning**
- **Endpoint:** `POST /api/admin/platforms/scan` with `{ platform: "all" }`
- **Functionality:** Runs parallel scans across Reddit, YouTube, Bluesky, and Imgur
- **Usage:** Comprehensive content gathering from all active platforms

---

## 🗂️ **LEGACY ENDPOINTS (118 endpoints - marked for deprecation)**

### **Authentication Legacy (3 endpoints)**
- `/api/admin/login` → Use `/api/admin/auth` POST
- `/api/admin/simple-login` → Use `/api/admin/auth` POST  
- `/api/admin/test-login` → Use `/api/admin/auth` GET

### **Content Management Legacy (25 endpoints)**
- `/api/admin/content/[id]/approve` → Use `/api/admin/content/[id]` PATCH
- `/api/admin/content/[id]/reject` → Use `/api/admin/content/[id]` PATCH
- `/api/admin/content/[id]/review` → Use `/api/admin/content/[id]` PATCH
- `/api/admin/content/queue` → Use `/api/admin/content` GET
- `/api/admin/content/bulk-review` → Use `/api/admin/content/bulk` PATCH
- *...and 20 more content-related endpoints*

### **Platform-Specific Legacy (60+ endpoints)**
- `/api/admin/reddit/scan` → Use `/api/admin/platforms/scan`
- `/api/admin/youtube/scan` → Use `/api/admin/platforms/scan`
- `/api/admin/bluesky/scan` → Use `/api/admin/platforms/scan`
- `/api/admin/scan-reddit-now` → Use `/api/admin/platforms/scan`
- `/api/admin/scan-youtube-now` → Use `/api/admin/platforms/scan`
- *...and 55+ more platform-specific endpoints*

### **Dashboard & Analytics Legacy (15 endpoints)**
- `/api/admin/dashboard/stats` → Use `/api/admin/dashboard` GET
- `/api/admin/metrics/performance` → Use `/api/admin/analytics` GET
- `/api/admin/analytics` → Use consolidated `/api/admin/analytics` GET
- *...and 12 more analytics endpoints*

### **System Management Legacy (15+ endpoints)**
- `/api/admin/health` → Use `/api/admin/health` GET (already consolidated)
- `/api/admin/diagnostics` → Use `/api/admin/health` GET with query
- `/api/admin/cron-status` → Use `/api/admin/health` GET
- *...and 12+ more system endpoints*

---

## 🎯 **API USAGE PATTERNS**

### **Content Processing Flow**
1. **Scan Platform:** `POST /api/admin/platforms/scan { platform: "reddit", maxPosts: 25 }`
2. **Review Content:** `GET /api/admin/content?status=pending&limit=20`
3. **Approve Content:** `PATCH /api/admin/content/[id] { status: "approved", reason: "Good quality" }`
4. **Monitor Queue:** `GET /api/admin/queue?view=health`
5. **Check Dashboard:** `GET /api/admin/dashboard`

### **Bulk Operations Flow**
1. **Get Pending Items:** `GET /api/admin/content?status=pending&page=1`
2. **Bulk Approve:** `PATCH /api/admin/content/bulk { ids: [1,2,3,4,5], action: "approve" }`
3. **Export Results:** `GET /api/admin/content/export?format=csv&filter=approved`

### **System Monitoring Flow**
1. **Health Check:** `GET /api/admin/health`
2. **Platform Status:** `GET /api/admin/platforms/status`
3. **Analytics Review:** `GET /api/admin/analytics?category=social&timeframe=7d`
4. **Debug Issues:** `GET /api/admin/debug?type=scan`

---

## 🔄 **MIGRATION STATUS**

### ✅ **Completed**
- **Phase 1:** All 25 consolidated endpoints implemented
- **Phase 2:** Frontend migrated to use new API client
- **Testing:** Build successful, development server running
- **Documentation:** Comprehensive mapping created

### 🔄 **In Progress**
- **Phase 3:** Mark legacy endpoints as deprecated (pending)
- **Phase 4:** Remove legacy endpoints (pending)

### 📈 **Results Achieved**
- **85% API reduction:** 143 → 25 endpoints
- **Consistent REST patterns** across all routes
- **Type-safe API client** with comprehensive error handling
- **Unified authentication** and middleware
- **Platform-agnostic scanning** with flexible parameters

---

This comprehensive analysis shows the current state of the Hotdog Diaries API structure, with 10 active content source platforms feeding into a streamlined 25-endpoint RESTful API that maintains all functionality while dramatically reducing complexity.