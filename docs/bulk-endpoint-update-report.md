# Bulk Deprecated Endpoint Update Report
Generated: 2025-09-17T16:27:33.840Z

## Summary

- **Files Updated:** 11
- **Total Changes:** 26
- **Status:** ✅ UPDATES APPLIED

## Files Modified


### app/admin/bluesky/page.tsx
**Changes Applied:** 1


- **Line 74:** Bluesky status → consolidated platform status
  - **Before:** `const response = await fetch('/api/admin/bluesky/status')`
  - **After:** `const response = await fetch('/api/admin/platforms/status?platform=bluesky')`



### app/admin/debug-auth/page.tsx
**Changes Applied:** 4


- **Line 24:** User info endpoint → consolidated auth/me
  - **Before:** `// Test /api/admin/me`
  - **After:** `// Test /api/admin/auth/me`


- **Line 54:** Login endpoint → consolidated auth
  - **Before:** `const response = await fetch('/api/admin/login', {`
  - **After:** `const response = await fetch('/api/admin/auth', {`


- **Line 75:** User info endpoint → consolidated auth/me
  - **Before:** `// Test /api/admin/me again`
  - **After:** `// Test /api/admin/auth/me again`


- **Line 115:** User info endpoint → consolidated auth/me
  - **Before:** `Test /api/admin/me`
  - **After:** `Test /api/admin/auth/me`



### app/admin/posted/page.tsx
**Changes Applied:** 2


- **Line 56:** Posted content → consolidated content with status filter
  - **Before:** `fetch(`/api/admin/content/posted?limit=${itemsPerPage}&offset=${(page - 1) * itemsPerPage}`, {`
  - **After:** `fetch(`/api/admin/content?status=posted?limit=${itemsPerPage}&offset=${(page - 1) * itemsPerPage}`, {`


- **Line 112:** Posted content → consolidated content with status filter
  - **Before:** `const response = await fetch(`/api/admin/content/posted/${postId}/hide`, {`
  - **After:** `const response = await fetch(`/api/admin/content?status=posted/${postId}/hide`, {`



### app/admin/reddit/page.tsx
**Changes Applied:** 3


- **Line 80:** Reddit status → consolidated platform status
  - **Before:** `const response = await fetch('/api/admin/reddit/status', { credentials: 'include' })`
  - **After:** `const response = await fetch('/api/admin/platforms/status?platform=reddit', { credentials: 'include' })`


- **Line 92:** Reddit scan → consolidated platform scan
  - **Before:** `const response = await fetch('/api/admin/reddit/scan-history')`
  - **After:** `const response = await fetch('/api/admin/platforms/scan-history')`


- **Line 149:** Reddit scan → consolidated platform scan
  - **Before:** `const response = await fetch('/api/admin/reddit/scan', {`
  - **After:** `const response = await fetch('/api/admin/platforms/scan', {`



### app/admin/social/page.tsx
**Changes Applied:** 1


- **Line 74:** YouTube status → consolidated platform status
  - **Before:** `fetch('/api/admin/youtube/status'),`
  - **After:** `fetch('/api/admin/platforms/status?platform=youtube'),`



### app/admin/unsplash/page.tsx
**Changes Applied:** 3


- **Line 70:** Unsplash scan → consolidated platform scan
  - **Before:** `fetch('/api/admin/unsplash/scans?limit=5')`
  - **After:** `fetch('/api/admin/platforms/scans?limit=5')`


- **Line 104:** Unsplash scan → consolidated platform scan
  - **Before:** `const response = await fetch('/api/admin/unsplash/scan', {`
  - **After:** `const response = await fetch('/api/admin/platforms/scan', {`


- **Line 131:** Unsplash scan → consolidated platform scan
  - **Before:** `const response = await fetch('/api/admin/unsplash/scan?test=true', {`
  - **After:** `const response = await fetch('/api/admin/platforms/scan?test=true', {`



### app/admin/youtube/page.tsx
**Changes Applied:** 3


- **Line 66:** YouTube status → consolidated platform status
  - **Before:** `fetch('/api/admin/youtube/status', { credentials: 'include' }),`
  - **After:** `fetch('/api/admin/platforms/status?platform=youtube', { credentials: 'include' }),`


- **Line 68:** YouTube scan → consolidated platform scan
  - **Before:** `fetch('/api/admin/youtube/scans?limit=1', { credentials: 'include' })`
  - **After:** `fetch('/api/admin/platforms/scans?limit=1', { credentials: 'include' })`


- **Line 101:** YouTube scan → consolidated platform scan
  - **Before:** `const response = await fetch('/api/admin/youtube/scan', {`
  - **After:** `const response = await fetch('/api/admin/platforms/scan', {`



### components/admin/AdminDashboard.tsx
**Changes Applied:** 2


- **Line 67:** Dashboard stats → consolidated dashboard
  - **Before:** `const statsResponse = await fetch('/api/admin/dashboard/stats', {`
  - **After:** `const statsResponse = await fetch('/api/admin/dashboard', {`


- **Line 86:** Dashboard activity → consolidated dashboard with view filter
  - **Before:** `const activityResponse = await fetch('/api/admin/dashboard/activity', {`
  - **After:** `const activityResponse = await fetch('/api/admin/dashboard?view=activity', {`



### components/admin/ContentQueue.tsx
**Changes Applied:** 5


- **Line 57:** Content queue → consolidated content
  - **Before:** `const response = await authFetch(`/api/admin/content/queue?${params}`)`
  - **After:** `const response = await authFetch(`/api/admin/content?${params}`)`


- **Line 97:** Content queue → consolidated content
  - **Before:** `return authFetch(`/api/admin/content/queue?id=${id}`, {`
  - **After:** `return authFetch(`/api/admin/content?id=${id}`, {`


- **Line 116:** Content queue → consolidated content
  - **Before:** `const response = await authFetch(`/api/admin/content/queue?id=${id}`, {`
  - **After:** `const response = await authFetch(`/api/admin/content?id=${id}`, {`


- **Line 156:** Content queue → consolidated content
  - **Before:** `return authFetch(`/api/admin/content/queue?id=${id}`, {`
  - **After:** `return authFetch(`/api/admin/content?id=${id}`, {`


- **Line 200:** Content queue → consolidated content
  - **Before:** `return authFetch(`/api/admin/content/queue?id=${item.id}`, {`
  - **After:** `return authFetch(`/api/admin/content?id=${item.id}`, {`



### components/admin/ContentStatusDashboard.tsx
**Changes Applied:** 1


- **Line 63:** Content metrics → consolidated analytics
  - **Before:** `const response = await fetch('/api/admin/content/metrics')`
  - **After:** `const response = await fetch('/api/admin/analytics?type=content')`



### components/admin/PostingHistory.tsx
**Changes Applied:** 1


- **Line 30:** Posted content → consolidated content with status filter
  - **Before:** `const response = await fetch('/api/admin/content/posted?limit=20', {`
  - **After:** `const response = await fetch('/api/admin/content?status=posted?limit=20', {`



## Endpoint Mapping Summary


- **Login endpoint → consolidated auth**
  - Pattern: `\/api\/admin\/login`
  - Replacement: `/api/admin/auth`


- **User info endpoint → consolidated auth/me**
  - Pattern: `\/api\/admin\/me`
  - Replacement: `/api/admin/auth/me`


- **Logout endpoint → consolidated auth (DELETE method)**
  - Pattern: `\/api\/admin\/logout`
  - Replacement: `/api/admin/auth`


- **Content queue → consolidated content**
  - Pattern: `\/api\/admin\/content\/queue`
  - Replacement: `/api/admin/content`


- **Posted content → consolidated content with status filter**
  - Pattern: `\/api\/admin\/content\/posted`
  - Replacement: `/api/admin/content?status=posted`


- **Reddit scan → consolidated platform scan**
  - Pattern: `\/api\/admin\/reddit\/scan`
  - Replacement: `/api/admin/platforms/scan`


- **YouTube scan → consolidated platform scan**
  - Pattern: `\/api\/admin\/youtube\/scan`
  - Replacement: `/api/admin/platforms/scan`


- **Bluesky scan → consolidated platform scan**
  - Pattern: `\/api\/admin\/bluesky\/scan`
  - Replacement: `/api/admin/platforms/scan`


- **Imgur scan → consolidated platform scan**
  - Pattern: `\/api\/admin\/imgur\/scan`
  - Replacement: `/api/admin/platforms/scan`


- **Giphy scan → consolidated platform scan**
  - Pattern: `\/api\/admin\/giphy\/scan`
  - Replacement: `/api/admin/platforms/scan`


- **Pixabay scan → consolidated platform scan**
  - Pattern: `\/api\/admin\/pixabay\/scan`
  - Replacement: `/api/admin/platforms/scan`


- **Unsplash scan → consolidated platform scan**
  - Pattern: `\/api\/admin\/unsplash\/scan`
  - Replacement: `/api/admin/platforms/scan`


- **Lemmy scan → consolidated platform scan**
  - Pattern: `\/api\/admin\/lemmy\/scan`
  - Replacement: `/api/admin/platforms/scan`


- **Tumblr scan → consolidated platform scan**
  - Pattern: `\/api\/admin\/tumblr\/scan`
  - Replacement: `/api/admin/platforms/scan`


- **Dashboard stats → consolidated dashboard**
  - Pattern: `\/api\/admin\/dashboard\/stats`
  - Replacement: `/api/admin/dashboard`


- **Dashboard activity → consolidated dashboard with view filter**
  - Pattern: `\/api\/admin\/dashboard\/activity`
  - Replacement: `/api/admin/dashboard?view=activity`


- **Content metrics → consolidated analytics**
  - Pattern: `\/api\/admin\/content\/metrics`
  - Replacement: `/api/admin/analytics?type=content`


- **Reddit status → consolidated platform status**
  - Pattern: `\/api\/admin\/reddit\/status`
  - Replacement: `/api/admin/platforms/status?platform=reddit`


- **YouTube status → consolidated platform status**
  - Pattern: `\/api\/admin\/youtube\/status`
  - Replacement: `/api/admin/platforms/status?platform=youtube`


- **Bluesky status → consolidated platform status**
  - Pattern: `\/api\/admin\/bluesky\/status`
  - Replacement: `/api/admin/platforms/status?platform=bluesky`


- **Reddit scan history → consolidated analytics**
  - Pattern: `\/api\/admin\/reddit\/scan-history`
  - Replacement: `/api/admin/analytics?type=scan_history&platform=reddit`


- **YouTube scan history → consolidated analytics**
  - Pattern: `\/api\/admin\/youtube\/scan-history`
  - Replacement: `/api/admin/analytics?type=scan_history&platform=youtube`


## Next Steps

1. 🧪 Test updated components to ensure they work with consolidated endpoints
2. 🔍 Run frontend migration verification script to check remaining deprecated usage
3. 📊 Monitor API logs to verify endpoints are being called correctly
4. 🚀 Run end-to-end tests to verify full functionality

---
*Report generated by bulk endpoint update script*
