# API Consolidation Mapping: 186 → 25 RESTful Routes

## Executive Summary

This document maps the current 139 admin API endpoints (186 total when including HTTP method variations) to 25 consolidated RESTful routes. The consolidation follows REST principles, groups related functionality, and maintains all existing capabilities while significantly reducing API surface area.

## Current State Analysis

**Current Structure Problems:**
- 139 separate route files with inconsistent patterns
- Multiple endpoints for single resource actions (approve/reject/review)
- Platform-specific scan endpoints duplicated across 10+ platforms
- Inconsistent HTTP method usage (mostly POST for everything)
- No consistent resource-based routing

**Proposed Solution:**
- Resource-based RESTful design
- Consistent HTTP method semantics
- Unified payload structures
- Platform-agnostic endpoints with platform parameters

## Consolidation Mapping

### 1. Authentication & Admin Session Management
**Consolidates:** 4 endpoints → 1 endpoint

| Current Endpoints | New Endpoint | HTTP Methods | Payload |
|-------------------|--------------|--------------|---------|
| `/admin/login` | `/api/admin/auth` | POST | `{ username, password }` |
| `/admin/logout` | `/api/admin/auth` | DELETE | `{}` |
| `/admin/simple-login` | `/api/admin/auth` | POST | `{ username, password }` |
| `/admin/test-login` | `/api/admin/auth` | GET | Query: `?validate=true` |
| `/admin/refresh` | `/api/admin/auth/refresh` | POST | `{ refreshToken }` |
| `/admin/me` | `/api/admin/auth/me` | GET | `{}` |

**New Routes:**
- `POST /api/admin/auth` - Login
- `DELETE /api/admin/auth` - Logout  
- `GET /api/admin/auth/me` - Get current user
- `POST /api/admin/auth/refresh` - Refresh token

---

### 2. Content Management
**Consolidates:** 25 endpoints → 4 endpoints

| Current Endpoints | New Endpoint | HTTP Methods | Payload |
|-------------------|--------------|--------------|---------|
| `/admin/content/[id]/approve` | `/api/admin/content/[id]` | PATCH | `{ status: "approved", reason?: string }` |
| `/admin/content/[id]/reject` | `/api/admin/content/[id]` | PATCH | `{ status: "rejected", reason?: string }` |
| `/admin/content/[id]/review` | `/api/admin/content/[id]` | PATCH | `{ status: "pending", notes?: string }` |
| `/admin/content/[id]/schedule` | `/api/admin/content/[id]` | PATCH | `{ scheduledAt: "2024-01-01T12:00:00Z" }` |
| `/admin/content/[id]/post` | `/api/admin/content/[id]` | PATCH | `{ status: "posted" }` |
| `/admin/content/[id]` (GET) | `/api/admin/content/[id]` | GET | `{}` |
| `/admin/content/queue` | `/api/admin/content` | GET | Query: `?status=pending&page=1&limit=20` |
| `/admin/content/simple-queue` | `/api/admin/content` | GET | Query: `?simple=true` |
| `/admin/content/posted` | `/api/admin/content` | GET | Query: `?status=posted` |
| `/admin/content/posted/[id]/hide` | `/api/admin/content/[id]` | PATCH | `{ hidden: true }` |
| `/admin/content/bulk-review` | `/api/admin/content/bulk` | PATCH | `{ ids: [1,2,3], status: "approved" }` |
| `/admin/content/bulk-schedule` | `/api/admin/content/bulk` | PATCH | `{ ids: [1,2,3], scheduledAt: "..." }` |
| `/admin/content/bulk` | `/api/admin/content/bulk` | PATCH | `{ ids: [1,2,3], action: "approve" }` |
| `/admin/content/export` | `/api/admin/content/export` | GET | Query: `?format=csv&filter=approved` |
| `/admin/content/metrics` | `/api/admin/content/metrics` | GET | `{}` |
| `/admin/content/history` | `/api/admin/content/history` | GET | Query: `?page=1&limit=20` |
| `/admin/content/stats` | `/api/admin/content/stats` | GET | `{}` |
| `/admin/content/process` | `/api/admin/content/process` | POST | `{ action: "reprocess" }` |
| `/admin/content` | `/api/admin/content` | GET, POST | GET: query params, POST: new content |

**New Routes:**
- `GET /api/admin/content` - List content with filtering
- `POST /api/admin/content` - Create new content
- `GET /api/admin/content/[id]` - Get specific content
- `PATCH /api/admin/content/[id]` - Update content (approve/reject/schedule/etc)
- `PATCH /api/admin/content/bulk` - Bulk operations
- `GET /api/admin/content/export` - Export content
- `GET /api/admin/content/metrics` - Content metrics
- `GET /api/admin/content/history` - Content history

---

### 3. Platform Social Media Management  
**Consolidates:** 60+ endpoints → 3 endpoints

| Current Platform Endpoints | New Endpoint | HTTP Methods | Payload |
|----------------------------|--------------|--------------|---------|
| `/admin/reddit/scan` | `/api/admin/platforms/scan` | POST | `{ platform: "reddit", maxPosts?: 25 }` |
| `/admin/youtube/scan` | `/api/admin/platforms/scan` | POST | `{ platform: "youtube", maxPosts?: 25 }` |
| `/admin/bluesky/scan` | `/api/admin/platforms/scan` | POST | `{ platform: "bluesky", maxPosts?: 25 }` |
| `/admin/giphy/scan` | `/api/admin/platforms/scan` | POST | `{ platform: "giphy", maxPosts?: 25 }` |
| `/admin/imgur/scan` | `/api/admin/platforms/scan` | POST | `{ platform: "imgur", maxPosts?: 25 }` |
| `/admin/pixabay/scan` | `/api/admin/platforms/scan` | POST | `{ platform: "pixabay", maxPosts?: 25 }` |
| `/admin/unsplash/scan` | `/api/admin/platforms/scan` | POST | `{ platform: "unsplash", maxPosts?: 25 }` |
| All `/admin/{platform}/status` | `/api/admin/platforms/status` | GET | Query: `?platform=reddit` or none for all |
| All `/admin/{platform}/settings` | `/api/admin/platforms/[platform]/config` | GET, PUT | GET: {}, PUT: platform-specific config |
| All `/admin/{platform}/stats` | `/api/admin/platforms/stats` | GET | Query: `?platform=reddit` or none for all |
| All `/admin/{platform}/test` | `/api/admin/platforms/test` | POST | `{ platform: "reddit" }` |
| All `/admin/scan-{platform}-now` | `/api/admin/platforms/scan` | POST | `{ platform: "{platform}" }` |
| `/admin/social/scan-all` | `/api/admin/platforms/scan` | POST | `{ platform: "all" }` |
| `/admin/scan-all` | `/api/admin/platforms/scan` | POST | `{ platform: "all" }` |

**New Routes:**
- `POST /api/admin/platforms/scan` - Trigger platform scans
- `GET /api/admin/platforms/status` - Get platform status
- `GET /api/admin/platforms/stats` - Get platform statistics  
- `POST /api/admin/platforms/test` - Test platform connections
- `GET /api/admin/platforms/[platform]/config` - Get platform config
- `PUT /api/admin/platforms/[platform]/config` - Update platform config

---

### 4. Scheduling & Posting
**Consolidates:** 12 endpoints → 2 endpoints

| Current Endpoints | New Endpoint | HTTP Methods | Payload |
|-------------------|--------------|--------------|---------|
| `/admin/schedule/trigger` | `/api/admin/schedule` | POST | `{ action: "trigger" }` |
| `/admin/schedule/pause` | `/api/admin/schedule` | PATCH | `{ enabled: false }` |
| `/admin/schedule/next` | `/api/admin/schedule/next` | GET | `{}` |
| `/admin/schedule` | `/api/admin/schedule` | GET, PUT | GET: current config, PUT: update config |
| `/admin/posting/manual` | `/api/admin/schedule` | POST | `{ action: "post_now", contentId?: 123 }` |
| `/admin/posting/post-now` | `/api/admin/schedule` | POST | `{ action: "post_now" }` |
| `/admin/posting/test` | `/api/admin/schedule` | POST | `{ action: "test" }` |
| `/admin/posting/status` | `/api/admin/schedule/status` | GET | `{}` |
| `/admin/posting/stats` | `/api/admin/schedule/stats` | GET | `{}` |
| `/admin/post/trigger` | `/api/admin/schedule` | POST | `{ action: "trigger" }` |

**New Routes:**
- `GET /api/admin/schedule` - Get schedule configuration
- `PUT /api/admin/schedule` - Update schedule configuration
- `POST /api/admin/schedule` - Schedule actions (trigger, post_now, test)
- `GET /api/admin/schedule/status` - Get current schedule status
- `GET /api/admin/schedule/next` - Get next scheduled post time

---

### 5. Dashboard & Analytics
**Consolidates:** 15 endpoints → 3 endpoints

| Current Endpoints | New Endpoint | HTTP Methods | Payload |
|-------------------|--------------|--------------|---------|
| `/admin/dashboard/stats` | `/api/admin/dashboard` | GET | `{}` |
| `/admin/dashboard/activity` | `/api/admin/dashboard` | GET | Query: `?view=activity` |
| `/admin/dashboard` | `/api/admin/dashboard` | GET | `{}` |
| `/admin/metrics` | `/api/admin/analytics/metrics` | GET | `{}` |
| `/admin/metrics/performance` | `/api/admin/analytics/metrics` | GET | Query: `?type=performance` |
| `/admin/metrics/summary` | `/api/admin/analytics/metrics` | GET | Query: `?type=summary` |
| `/admin/analytics` | `/api/admin/analytics` | GET | `{}` |
| `/admin/social/stats` | `/api/admin/analytics` | GET | Query: `?category=social` |
| `/admin/social/performance` | `/api/admin/analytics` | GET | Query: `?category=social&type=performance` |
| `/admin/social/distribution` | `/api/admin/analytics` | GET | Query: `?category=social&type=distribution` |

**New Routes:**
- `GET /api/admin/dashboard` - Main dashboard data
- `GET /api/admin/analytics` - Analytics data with filtering
- `GET /api/admin/analytics/metrics` - Detailed metrics

---

### 6. Queue Management
**Consolidates:** 8 endpoints → 2 endpoints

| Current Endpoints | New Endpoint | HTTP Methods | Payload |
|-------------------|--------------|--------------|---------|
| `/admin/queue/stats` | `/api/admin/queue` | GET | `{}` |
| `/admin/queue/health` | `/api/admin/queue` | GET | Query: `?view=health` |
| `/admin/queue/alerts` | `/api/admin/queue` | GET | Query: `?view=alerts` |
| `/admin/queue/recommendations` | `/api/admin/queue` | GET | Query: `?view=recommendations` |
| `/admin/queue/schedule` | `/api/admin/queue` | GET | Query: `?view=schedule` |
| `/admin/review-queue` | `/api/admin/queue` | GET | Query: `?status=review` |

**New Routes:**
- `GET /api/admin/queue` - Queue status and management
- `POST /api/admin/queue` - Queue operations

---

### 7. System Health & Monitoring  
**Consolidates:** 20 endpoints → 2 endpoints

| Current Endpoints | New Endpoint | HTTP Methods | Payload |
|-------------------|--------------|--------------|---------|
| `/admin/health` | `/api/admin/system/health` | GET | `{}` |
| `/admin/diagnostics` | `/api/admin/system/health` | GET | Query: `?view=diagnostics` |
| `/admin/recovery` | `/api/admin/system/health` | GET | Query: `?view=recovery` |
| `/admin/cron-status` | `/api/admin/system/health` | GET | Query: `?view=cron` |
| `/admin/automation-status` | `/api/admin/system/health` | GET | Query: `?view=automation` |
| `/admin/automation-health` | `/api/admin/system/health` | GET | Query: `?view=automation` |
| `/admin/logs` | `/api/admin/system/logs` | GET | Query: `?level=error&limit=100` |
| `/admin/alerts` | `/api/admin/system/alerts` | GET | `{}` |
| `/admin/alerts/history` | `/api/admin/system/alerts` | GET | Query: `?view=history` |
| `/admin/monitoring/init` | `/api/admin/system` | POST | `{ action: "init_monitoring" }` |

**New Routes:**
- `GET /api/admin/system/health` - System health and diagnostics
- `GET /api/admin/system/logs` - System logs with filtering
- `GET /api/admin/system/alerts` - System alerts
- `POST /api/admin/system` - System operations

---

### 8. Data Management & Utilities
**Consolidates:** 25 endpoints → 3 endpoints

| Current Endpoints | New Endpoint | HTTP Methods | Payload |
|-------------------|--------------|--------------|---------|
| `/admin/cleanup-duplicates` | `/api/admin/maintenance` | POST | `{ action: "cleanup_duplicates" }` |
| `/admin/analyze-duplicates` | `/api/admin/maintenance` | POST | `{ action: "analyze_duplicates" }` |
| `/admin/debug-duplicates` | `/api/admin/maintenance` | POST | `{ action: "debug_duplicates" }` |
| `/admin/fix-duplicate-content` | `/api/admin/maintenance` | POST | `{ action: "fix_duplicates" }` |
| `/admin/fix-chicago-duplicate` | `/api/admin/maintenance` | POST | `{ action: "fix_specific_duplicate", target: "chicago" }` |
| `/admin/emergency-rebalance` | `/api/admin/maintenance` | POST | `{ action: "emergency_rebalance" }` |
| `/admin/fix-content-balance` | `/api/admin/maintenance` | POST | `{ action: "fix_content_balance" }` |
| `/admin/auto-approve` | `/api/admin/maintenance` | POST | `{ action: "auto_approve", criteria: {...} }` |
| `/admin/sync/posted-flags` | `/api/admin/maintenance` | POST | `{ action: "sync_posted_flags" }` |
| `/admin/migrate-db` | `/api/admin/maintenance` | POST | `{ action: "migrate_db" }` |
| `/admin/create-tables` | `/api/admin/maintenance` | POST | `{ action: "create_tables" }` |
| `/admin/debug-db` | `/api/admin/debug` | GET | `{}` |
| `/admin/debug-scan` | `/api/admin/debug` | GET | Query: `?type=scan` |
| `/admin/debug-hashes` | `/api/admin/debug` | GET | Query: `?type=hashes` |
| `/admin/test-duplicate-prevention` | `/api/admin/debug` | POST | `{ action: "test_duplicate_prevention" }` |

**New Routes:**
- `POST /api/admin/maintenance` - Data maintenance operations
- `GET /api/admin/debug` - Debug information
- `POST /api/admin/debug` - Debug operations

---

### 9. Content Filtering & Processing
**Consolidates:** 8 endpoints → 2 endpoints

| Current Endpoints | New Endpoint | HTTP Methods | Payload |
|-------------------|--------------|--------------|---------|
| `/admin/filters` | `/api/admin/filters` | GET, PUT | GET: current filters, PUT: update filters |
| `/admin/filters/test` | `/api/admin/filters` | POST | `{ action: "test", content: "test content" }` |
| `/admin/filtering/stats` | `/api/admin/filters/stats` | GET | `{}` |

**New Routes:**
- `GET /api/admin/filters` - Get content filters
- `PUT /api/admin/filters` - Update content filters  
- `POST /api/admin/filters` - Test filters
- `GET /api/admin/filters/stats` - Filter statistics

---

### 10. Legacy & Special Operations
**Consolidates:** 15 endpoints → 1 endpoint

| Current Endpoints | New Endpoint | HTTP Methods | Payload |
|-------------------|--------------|--------------|---------|
| `/admin/emergency-scan` | `/api/admin/operations` | POST | `{ action: "emergency_scan" }` |
| `/admin/initial-scan` | `/api/admin/operations` | POST | `{ action: "initial_scan" }` |
| `/admin/system-verification` | `/api/admin/operations` | POST | `{ action: "system_verification" }` |
| `/admin/platform-audit` | `/api/admin/operations` | POST | `{ action: "platform_audit" }` |
| `/admin/platform-diversity` | `/api/admin/operations` | POST | `{ action: "platform_diversity" }` |
| `/admin/platform-balance-report` | `/api/admin/operations` | POST | `{ action: "platform_balance_report" }` |
| `/admin/production-platform-analysis` | `/api/admin/operations` | POST | `{ action: "production_platform_analysis" }` |
| `/admin/video-errors` | `/api/admin/operations` | GET | Query: `?type=video_errors` |
| `/admin/youtube-quota` | `/api/admin/operations` | GET | Query: `?type=youtube_quota` |

**New Routes:**
- `POST /api/admin/operations` - Special operations and emergency functions
- `GET /api/admin/operations` - Get operation results/status

## Final Consolidated API Structure (25 Routes)

### Core Admin Routes (4)
1. `POST /api/admin/auth` - Authentication  
2. `DELETE /api/admin/auth` - Logout
3. `GET /api/admin/auth/me` - Current user
4. `POST /api/admin/auth/refresh` - Refresh token

### Content Management (4)  
5. `GET /api/admin/content` - List/filter content
6. `POST /api/admin/content` - Create content
7. `GET /api/admin/content/[id]` - Get specific content
8. `PATCH /api/admin/content/[id]` - Update content (approve/reject/schedule)
9. `PATCH /api/admin/content/bulk` - Bulk operations
10. `GET /api/admin/content/export` - Export content  

### Platform Management (3)
11. `POST /api/admin/platforms/scan` - Platform scanning
12. `GET /api/admin/platforms/status` - Platform status
13. `GET /api/admin/platforms/[platform]/config` - Platform configuration
14. `PUT /api/admin/platforms/[platform]/config` - Update platform config

### Scheduling (3)
15. `GET /api/admin/schedule` - Schedule configuration
16. `PUT /api/admin/schedule` - Update schedule
17. `POST /api/admin/schedule` - Schedule operations

### Analytics & Dashboard (3)  
18. `GET /api/admin/dashboard` - Dashboard data
19. `GET /api/admin/analytics` - Analytics with filtering
20. `GET /api/admin/queue` - Queue management

### System Management (4)
21. `GET /api/admin/system/health` - System health
22. `GET /api/admin/system/logs` - System logs  
23. `POST /api/admin/maintenance` - Maintenance operations
24. `POST /api/admin/operations` - Special operations

### Content Filtering (1)
25. `GET /api/admin/filters` - Content filtering management

## Implementation Strategy

### Phase 1: Create New Consolidated Routes (Week 1)
1. Implement all 25 new routes in `/app/api/admin/` 
2. Ensure backward compatibility by keeping old routes functioning
3. Add comprehensive TypeScript types for all new endpoints
4. Create unified middleware for authentication, validation, and error handling

### Phase 2: Update Frontend (Week 2)  
1. Update admin dashboard to use new consolidated endpoints
2. Create new service layer abstractions for unified API calls
3. Update all form submissions and data fetching to use new routes
4. Add loading states and error handling for new API structure

### Phase 3: Deprecation & Cleanup (Week 3)
1. Mark all old endpoints as deprecated with console warnings
2. Add deprecation headers to old endpoint responses  
3. Update documentation to reflect new API structure
4. Monitor usage to ensure all old endpoints can be safely removed

### Phase 4: Remove Legacy Routes (Week 4)
1. Remove all old route files
2. Clean up unused middleware and utilities  
3. Update tests to use new endpoint structure
4. Final verification that all functionality is preserved

## Benefits of Consolidation

### Developer Experience
- **Consistency**: All endpoints follow RESTful conventions
- **Discoverability**: Resource-based URLs are intuitive
- **Maintainability**: 85% fewer endpoint files to maintain
- **Type Safety**: Unified TypeScript interfaces

### Performance  
- **Reduced Bundle Size**: Fewer route handlers and middleware
- **Simpler Routing**: Next.js router has fewer routes to match
- **Caching**: RESTful patterns enable better HTTP caching

### API Design
- **RESTful**: Proper HTTP method semantics
- **Flexible**: Query parameters and payloads allow fine-grained control  
- **Versioned**: Clear path for future API versioning
- **Documented**: Self-documenting resource-based URLs

## Backward Compatibility

During the transition period, both old and new endpoints will function. The old endpoints will internally redirect to new consolidated handlers, ensuring zero downtime during migration.

## Risk Mitigation

1. **Staged Rollout**: Phase-based implementation minimizes risk
2. **Feature Flags**: New endpoints can be toggled on/off  
3. **Monitoring**: Comprehensive logging during transition
4. **Rollback Plan**: Old endpoints remain until new ones are fully validated
5. **Testing**: Comprehensive test suite ensures feature parity

This consolidation reduces the API surface from 186 endpoints to 25 while maintaining all functionality and improving consistency, maintainability, and developer experience.