# Hotdog Diaries - Complete Developer Handoff Documentation

## Quick Start Guide

### Prerequisites
1. Node.js 18+ and npm installed
2. Git for version control
3. SQLite3 for local development
4. Text editor (VS Code recommended)

### Initial Setup
```bash
# Clone the repository
git clone [repository-url]
cd hotdog-diaries

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Initialize database
npm run db:init
npm run db:migrate

# Start development server
npm run dev
```

### Essential Configuration
Create `.env.local` with minimum required variables:
```env
# Database (SQLite for development)
NODE_ENV=development
DATABASE_USER=your_username
DATABASE_PASSWORD=""

# Authentication
JWT_SECRET=your-64-character-secret-key

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=StrongAdminPass123!
```

---

## 1. PROJECT OVERVIEW

### What is Hotdog Diaries?
Hotdog Diaries is an automated content aggregation platform that:
- Scans multiple social media platforms for hotdog-related content
- Filters and approves content using confidence scoring
- Posts content automatically 6 times daily
- Provides a TikTok-style vertical feed interface
- Includes comprehensive admin controls

### Core Functionality
1. **Multi-platform content scanning** (Reddit, YouTube, Giphy, Pixabay, Bluesky, Tumblr, Imgur, Lemmy)
2. **Intelligent content filtering** with confidence scores
3. **Automated posting system** (6 posts daily at scheduled times)
4. **Admin dashboard** for content management
5. **Mobile-first responsive feed** with swipe navigation

### Tech Stack
- **Frontend**: Next.js 15.4+, React 19.1+, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: SQLite (dev) / PostgreSQL (production)
- **Authentication**: JWT with bcryptjs
- **Deployment**: Vercel-ready

---

## 2. SYSTEM ARCHITECTURE

### Directory Structure
```
hotdog-diaries/
├── app/                      # Next.js App Router pages
│   ├── api/                  # API routes (175+ endpoints)
│   │   ├── admin/           # Admin endpoints
│   │   ├── cron/            # Scheduled jobs
│   │   └── test/            # Testing endpoints
│   ├── admin/               # Admin interface pages
│   └── page.tsx             # Main homepage
├── components/              # React components
│   ├── admin/              # Admin-specific components
│   └── ui/                 # Shared UI components
├── lib/                    # Core logic
│   ├── services/          # Service layer (40+ services)
│   ├── migrations/        # Database migrations
│   └── db.ts             # Database connection
├── public/               # Static assets
└── types/               # TypeScript definitions
```

### Service Architecture Pattern
```typescript
// Example service pattern (lib/services/reddit-scanning.ts)
export class RedditScanningService {
  private reddit: Snoowrap;
  
  async performScan(options: ScanOptions): Promise<ScanResult> {
    // 1. Fetch content from platform
    // 2. Process and filter
    // 3. Calculate confidence scores
    // 4. Store in database
    // 5. Return results
  }
}
```

### Database Adapter Pattern
The system uses a database adapter (`lib/db.ts`) that supports both SQLite and PostgreSQL:
```typescript
class DatabaseAdapter {
  async query(sql: string, params?: any[]): Promise<QueryResult> {
    // Handles both SQLite and PostgreSQL queries
  }
}
```

---

## 3. CONTENT PIPELINE

### Complete Flow Diagram
```
1. DISCOVERY
   ↓
   Platform APIs → Scanning Services → Raw Content
   
2. PROCESSING
   ↓
   Content Processor → Validation → Confidence Scoring
   
3. DEDUPLICATION
   ↓
   SHA-256 Hashing → Duplicate Detection → Unique Content
   
4. APPROVAL
   ↓
   Auto-approval (high confidence) OR Admin Review
   
5. QUEUING
   ↓
   content_queue table → Approved & Ready
   
6. SCHEDULING
   ↓
   6 daily time slots → Platform distribution
   
7. POSTING
   ↓
   Automated selection → Mark as posted → Display in feed
```

### Confidence Scoring System
```typescript
// Scoring factors (lib/services/reddit-scanning.ts)
- Keyword matching: "hotdog", "hot dog", "🌭"
- Subreddit relevance: r/hotdogs, r/food
- Post metrics: upvotes, comments
- Content type: image/video preferred
- Age: newer content scores higher

// Score ranges
0.9+ : Auto-approved
0.7-0.9 : High confidence (admin review)
0.5-0.7 : Medium confidence
< 0.5 : Auto-rejected
```

### Deduplication Process
- SHA-256 hashing of content URL + text
- Fuzzy matching for similar text (85% threshold)
- Image perceptual hashing for visual duplicates
- Cross-platform duplicate detection

---

## 4. PLATFORM INTEGRATIONS

### Reddit
- **Status**: ✅ Fully operational
- **API**: Snoowrap library
- **Required Keys**: 
  ```env
  REDDIT_CLIENT_ID=
  REDDIT_CLIENT_SECRET=
  REDDIT_USERNAME=
  REDDIT_PASSWORD=
  ```
- **Implementation**: `lib/services/reddit-scanning.ts`
- **Scan Strategy**: Hot posts from food subreddits
- **Approval Rate**: ~35%
- **Known Issues**: Rate limiting (60 requests/minute)

### YouTube
- **Status**: ✅ Fully operational
- **API**: YouTube Data API v3
- **Required Keys**:
  ```env
  YOUTUBE_API_KEY=
  ```
- **Implementation**: `lib/services/youtube-scanning.ts`
- **Scan Strategy**: Search API with relevance sorting
- **Approval Rate**: ~40%
- **Quota**: 10,000 units/day

### Giphy
- **Status**: ✅ Fully operational
- **API**: Giphy SDK
- **Required Keys**:
  ```env
  GIPHY_API_KEY=
  ```
- **Implementation**: `lib/services/giphy-scanning.ts`
- **Scan Strategy**: Trending + search
- **Approval Rate**: ~60%

### Pixabay
- **Status**: ✅ Fully operational
- **API**: REST API
- **Required Keys**:
  ```env
  PIXABAY_API_KEY=
  ```
- **Implementation**: `lib/services/pixabay-scanning.ts`
- **Special Handling**: Image optimization, CDN caching

### Bluesky
- **Status**: ⚠️ Experimental
- **API**: AT Protocol
- **Implementation**: `lib/services/bluesky-scanning.ts`
- **Authentication**: Handle + password
- **Known Issues**: Limited search API

### Tumblr
- **Status**: ⚠️ Limited
- **Implementation**: `lib/services/tumblr-scanning.ts`
- **Challenges**: API v2 deprecation

### Imgur
- **Status**: ✅ Operational
- **Implementation**: `lib/services/imgur.ts`
- **Special**: Gallery endpoint for viral content

### Lemmy
- **Status**: ⚠️ Experimental
- **Implementation**: `lib/services/lemmy-scanning.ts`
- **Federation**: Multiple instance support

---

## 5. AUTOMATED POSTING SYSTEM

### Scheduling Logic
```typescript
// Default schedule (lib/services/scheduling.ts)
const POSTING_TIMES = [
  "07:00", // Morning
  "10:00", // Mid-morning  
  "13:00", // Lunch
  "16:00", // Afternoon
  "19:00", // Dinner
  "22:00"  // Late night
];
```

### Platform Distribution Weights
```typescript
// lib/services/automated-posting.ts
const PLATFORM_WEIGHTS = {
  reddit: 0.25,    // 25% of posts
  youtube: 0.20,   // 20% of posts
  giphy: 0.20,     // 20% of posts
  pixabay: 0.15,   // 15% of posts
  bluesky: 0.10,   // 10% of posts
  other: 0.10      // 10% of posts
};
```

### Content Selection Algorithm
1. Query approved, unposted content
2. Apply platform diversity rules
3. Prefer high confidence scores
4. Ensure content type variety
5. Avoid repetitive sources
6. Select 6 posts for the day

### Posted Content Tracking
```sql
-- posted_content table tracks all published content
INSERT INTO posted_content (
  content_queue_id,
  post_order,
  scheduled_time,
  posted_at
) VALUES (?, ?, ?, NOW());
```

---

## 6. ADMIN SYSTEM

### Authentication Setup
```typescript
// JWT Configuration (lib/services/auth.ts)
- Access Token: 1 hour expiry
- Refresh Token: 7 days expiry
- Secure HTTP-only cookies
- bcrypt password hashing (10 rounds)
```

### Admin Routes
```
/admin                 → Dashboard
/admin/login          → Authentication
/admin/content        → Content management
/admin/queue          → Queue management
/admin/posted         → Posted history
/admin/platforms      → Platform controls
/admin/analytics      → Metrics & stats
/admin/monitoring     → System health
/admin/schedule       → Posting schedule
```

### Admin Functions
1. **Content Review**: Approve/reject pending content
2. **Manual Posting**: Override automated schedule
3. **Platform Control**: Enable/disable scanners
4. **Queue Management**: Reorder, edit, delete content
5. **Analytics**: View performance metrics
6. **System Monitoring**: Health checks, logs
7. **Schedule Override**: Modify posting times

### Dashboard Features
- Real-time content queue status
- Platform health indicators
- Approval rate metrics
- Posted content history
- System performance graphs
- Error logs and alerts

---

## 7. FRONTEND FEATURES

### Main Feed Implementation
```typescript
// components/AdaptiveTikTokFeed.tsx
- Vertical scrolling with snap points
- Mobile-first responsive design
- Video autoplay on mobile
- Lazy loading for performance
- Error boundaries for resilience
```

### Card Rendering System
```typescript
// components/ui/ContentCard.tsx
Platform-specific rendering:
- Reddit: Shows subreddit, author, score
- YouTube: Video player, channel info
- Giphy: Animated GIF with attribution
- Pixabay: High-res images with tags
```

### Navigation
- **Mobile**: Swipe up/down for next/previous
- **Desktop**: Arrow keys or click navigation
- **Keyboard**: Space (next), Shift+Space (previous)

### Responsive Breakpoints
```css
/* Mobile */ @media (max-width: 768px)
/* Tablet */ @media (max-width: 1024px)  
/* Desktop */ @media (min-width: 1025px)
```

### Special Features
- **HandwrittenSVG**: Animated intro cover
- **HotdogDiariesLogoMouseGradient**: Interactive logo
- **CinematicIntro**: First-visit animation
- **Size Debugging**: Development tools for layout

---

## 8. DATABASE DETAILS

### Current Configuration
- **Development**: SQLite (`hotdog_diaries_dev.db`)
- **Production**: PostgreSQL (Vercel Postgres)
- **Adapter**: Unified interface for both

### Key Tables

#### content_queue
```sql
CREATE TABLE content_queue (
  id SERIAL PRIMARY KEY,
  content_text TEXT,
  content_image_url TEXT,
  content_video_url TEXT,
  content_type VARCHAR(20),
  source_platform VARCHAR(50),
  original_url TEXT UNIQUE,
  original_author VARCHAR(255),
  content_hash VARCHAR(64) UNIQUE,
  confidence_score DECIMAL(3,2),
  is_approved BOOLEAN DEFAULT FALSE,
  is_posted BOOLEAN DEFAULT FALSE,
  scraped_at TIMESTAMP,
  posted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### admin_users
```sql
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);
```

#### posted_content
```sql
CREATE TABLE posted_content (
  id SERIAL PRIMARY KEY,
  content_queue_id INTEGER REFERENCES content_queue(id),
  post_order INTEGER,
  scheduled_time TIME,
  posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Important Queries
```sql
-- Get next posts to publish
SELECT * FROM content_queue 
WHERE is_approved = TRUE 
  AND is_posted = FALSE
  AND confidence_score > 0.7
ORDER BY confidence_score DESC
LIMIT 6;

-- Platform statistics
SELECT source_platform, 
       COUNT(*) as total,
       AVG(confidence_score) as avg_score
FROM content_queue
GROUP BY source_platform;
```

### Migration Procedures
```bash
# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:rollback

# Reset database
npm run db:reset
```

---

## 9. CURRENT STATE & METRICS

### Database Statistics
- **Total Content**: ~15,000+ items
- **Approved Content**: ~5,000 items
- **Posted Content**: ~500 items
- **Pending Review**: ~2,000 items

### Platform Performance
```
Platform    | Scan Rate | Approval % | Avg Confidence
----------- | --------- | ---------- | --------------
Reddit      | 200/scan  | 35%        | 0.72
YouTube     | 50/scan   | 40%        | 0.75
Giphy       | 100/scan  | 60%        | 0.81
Pixabay     | 100/scan  | 55%        | 0.78
Bluesky     | 50/scan   | 30%        | 0.65
```

### Recent Improvements
1. Fixed YouTube duplicate detection
2. Improved confidence scoring algorithm
3. Added platform quota management
4. Enhanced admin monitoring dashboard
5. Optimized database queries
6. Added error recovery systems

---

## 10. API KEYS & CONFIGURATION

### Essential Environment Variables
```env
# Database
NODE_ENV=development
DATABASE_USER=
DATABASE_PASSWORD=

# Authentication (generate 64-char random string)
JWT_SECRET=

# Admin (set your own)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=StrongAdminPass123!
ADMIN_EMAIL=admin@hotdogdiaries.com
```

### Platform API Keys
```env
# Reddit (https://www.reddit.com/prefs/apps)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USERNAME=
REDDIT_PASSWORD=

# YouTube (https://console.cloud.google.com)
YOUTUBE_API_KEY=

# Giphy (https://developers.giphy.com)
GIPHY_API_KEY=

# Pixabay (https://pixabay.com/api/docs/)
PIXABAY_API_KEY=

# Optional
UNSPLASH_ACCESS_KEY=
BLUESKY_HANDLE=
BLUESKY_PASSWORD=
```

### Rate Limits
- **Reddit**: 60 requests/minute
- **YouTube**: 10,000 quota units/day
- **Giphy**: 1,000 requests/hour
- **Pixabay**: 5,000 requests/hour

### Fallback Behavior
- Missing API keys disable respective platforms
- System continues with available platforms
- Admin dashboard shows platform status

---

## 11. CRON JOBS & AUTOMATION

### Scanning Schedule
```typescript
// Runs every 4 hours
0 */4 * * * → /api/cron/scan-content
```

### Posting Schedule
```typescript
// Runs at fixed times
0 7,10,13,16,19,22 * * * → /api/cron/post-content
```

### Manual Triggers
```bash
# Trigger scan manually
curl -X POST http://localhost:3000/api/admin/scan/trigger \
  -H "Authorization: Bearer $TOKEN"

# Force post content
curl -X POST http://localhost:3000/api/admin/post/trigger \
  -H "Authorization: Bearer $TOKEN"
```

### Automation Endpoints
- `POST /api/admin/scan/all` - Scan all platforms
- `POST /api/admin/scan/[platform]` - Scan specific platform
- `POST /api/admin/post/schedule` - Schedule posts
- `GET /api/admin/queue/status` - Queue health

---

## 12. KNOWN ISSUES & TODOS

### Current Bugs
1. ⚠️ Bluesky search API limitations
2. ⚠️ Tumblr API v2 deprecation issues
3. ⚠️ Lemmy federation inconsistencies
4. ✅ YouTube duplicate detection (FIXED)
5. ✅ Platform quota exceeded errors (FIXED)

### Performance Concerns
- Large content_queue table needs indexing
- Image CDN caching could be improved
- Video transcoding for mobile devices
- Database connection pooling needed

### Planned Improvements
1. Add Instagram integration
2. Implement content recommendations
3. Add user accounts and preferences
4. Create mobile app
5. Add content moderation ML
6. Implement content scheduling UI

### Technical Debt
- Refactor platform services to common interface
- Add comprehensive error tracking (Sentry)
- Implement proper logging aggregation
- Add database connection pooling
- Create platform service health checks

---

## 13. TESTING & DEBUGGING

### Test Endpoints
```bash
# Test platform scanning
GET /api/test/scan/reddit
GET /api/test/scan/youtube
GET /api/test/scan/giphy

# Test content processing
POST /api/test/process-content
POST /api/test/confidence-score

# Test posting system
GET /api/test/posting-system
POST /api/test/trigger-post
```

### Debug Modes
```typescript
// Enable debug logging
process.env.DEBUG = 'true'

// Platform-specific debugging
process.env.DEBUG_REDDIT = 'true'
process.env.DEBUG_YOUTUBE = 'true'
```

### Common Troubleshooting

#### Database Issues
```bash
# Check database connection
npm run db:test

# Reset database
npm run db:reset

# Check migrations
npm run db:status
```

#### Platform API Issues
```bash
# Test individual platform
curl http://localhost:3000/api/test/scan/[platform]

# Check API credentials
curl http://localhost:3000/api/admin/platforms/status \
  -H "Authorization: Bearer $TOKEN"
```

#### Content Not Posting
1. Check queue has approved content
2. Verify cron job is running
3. Check posting schedule configuration
4. Review system logs for errors

---

## 14. DEPLOYMENT CONSIDERATIONS

### Production Readiness Checklist
- [x] Environment variables configured
- [x] Database migrations run
- [x] Admin user created
- [x] SSL certificates (handled by Vercel)
- [x] Error monitoring setup
- [ ] CDN configuration
- [ ] Backup strategy implemented
- [ ] Load testing completed

### Required Infrastructure
- **Hosting**: Vercel (recommended) or any Node.js host
- **Database**: PostgreSQL (Vercel Postgres or Supabase)
- **Storage**: For media caching (optional)
- **CDN**: For image/video delivery (optional)

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add JWT_SECRET
vercel env add POSTGRES_URL
# ... add other variables
```

### Environment Setup Steps
1. Clone repository
2. Install dependencies
3. Configure environment variables
4. Initialize database
5. Run migrations
6. Create admin user
7. Configure cron jobs
8. Deploy to hosting platform

---

## 15. CODE PATTERNS & CONVENTIONS

### Service Class Pattern
```typescript
export class PlatformScanningService {
  private config: PlatformConfig;
  
  constructor() {
    this.config = this.loadConfig();
  }
  
  async performScan(options?: ScanOptions): Promise<ScanResult> {
    try {
      const content = await this.fetchContent();
      const processed = await this.processContent(content);
      const saved = await this.saveToDatabase(processed);
      return this.formatResult(saved);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
```

### Error Handling
```typescript
// Consistent error structure
class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
  }
}

// Usage
throw new ServiceError(
  'Platform API failed',
  'PLATFORM_API_ERROR',
  503,
  { platform: 'reddit', error: originalError }
);
```

### Component Structure
```typescript
// Functional component with TypeScript
interface ComponentProps {
  data: ContentItem;
  onAction: (action: string) => void;
}

export default function Component({ data, onAction }: ComponentProps) {
  const [state, setState] = useState<State>(initialState);
  
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  return <div>{/* JSX */}</div>;
}
```

### State Management
- Local state with useState for component state
- Context API for global auth state
- Server state with SWR/React Query patterns
- No external state management library

---

## 16. CRITICAL FILES REFERENCE

### Entry Points
- `/app/page.tsx` - Main application
- `/app/layout.tsx` - Root layout
- `/app/admin/page.tsx` - Admin dashboard

### Core Services
- `/lib/db.ts` - Database adapter
- `/lib/services/content.ts` - Content operations
- `/lib/services/automated-posting.ts` - Posting system
- `/lib/services/auth.ts` - Authentication

### Configuration
- `/next.config.js` - Next.js config
- `/tailwind.config.ts` - Styling config
- `/tsconfig.json` - TypeScript config
- `/.env.local` - Environment variables

### Database
- `/lib/migrations/*.sql` - Schema definitions
- `/scripts/init-sqlite.ts` - DB initialization
- `/scripts/restore-backup.ts` - Backup restoration

### Admin Interface
- `/components/admin/AdminDashboard.tsx` - Main dashboard
- `/components/admin/ContentQueue.tsx` - Queue management
- `/components/admin/PlatformStatus.tsx` - Platform monitoring

---

## Developer Quick Reference

### Common Commands
```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm test                # Run tests

# Database
npm run db:init         # Initialize database
npm run db:migrate      # Run migrations
npm run db:reset        # Reset database

# Admin
npm run admin:create    # Create admin user
npm run admin:token     # Generate JWT token

# Debugging
npm run scan:test       # Test scanners
npm run post:test       # Test posting
```

### API Authentication
```javascript
// Get admin token
const response = await fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'StrongAdminPass123!'
  })
});
const { accessToken } = await response.json();

// Use token for protected routes
fetch('/api/admin/content', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### Adding New Platform
1. Create service in `/lib/services/[platform]-scanning.ts`
2. Implement `ScanningService` interface
3. Add to platform enum in database schema
4. Create admin UI in `/app/admin/platforms/[platform]`
5. Add API endpoints in `/app/api/admin/[platform]`
6. Update platform weights in posting service
7. Add environment variables for API keys
8. Create tests in `/__tests__/services/`

### Debugging Production Issues
1. Check Vercel function logs
2. Review database connection status
3. Verify environment variables are set
4. Check platform API quotas
5. Review error logs in system_logs table
6. Test individual platform endpoints
7. Verify cron jobs are running

---

## Contact & Support

For questions about this codebase:
1. Check this documentation first
2. Review code comments and JSDoc
3. Check test files for usage examples
4. Review recent commits for context

This documentation represents the complete state of the Hotdog Diaries project as of the handoff date. The system is production-ready with comprehensive admin controls and monitoring capabilities.