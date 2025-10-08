# Deterministic Content Scheduling System

## Overview

The Hotdog Diaries platform implements a sophisticated content scheduling system that automatically pre-schedules 6 posts per day with platform diversity enforcement. This system ensures consistent, engaging content delivery while preventing consecutive posts from the same platform.

## System Architecture

### Core Components

1. **Database Schema** (`content_queue` table)
   - `status`: Content status (`approved`, `scheduled`, `posted`, `failed`)
   - `priority`: Content priority score (0-100)
   - `scheduled_for`: Exact timestamp for scheduled posts
   - `posted_at`: Actual posting timestamp
   - `updated_at`: Last modification timestamp

2. **Scheduler Service** (`lib/services/schedule-content.ts`)
   - `scheduleNextBatch()`: Main scheduling function
   - `getUpcomingSchedule()`: Retrieve scheduled content
   - `cancelScheduledContent()`: Cancel scheduled posts
   - `rescheduleContent()`: Modify scheduling times

3. **Posting Pipeline** (`lib/services/posting-service.ts`)
   - `postNextContent()`: Post next available content
   - `postScheduledContentDue()`: Process scheduled posts
   - `getPostingStats()`: Analytics and metrics

4. **Admin API** (`app/api/admin/queue/schedule/`)
   - GET: View upcoming schedule
   - POST: Schedule new content batches
   - PUT: Modify scheduled content

## Scheduling Algorithm

### Time Slots (6 posts per day)
- **08:00** - Morning commute
- **10:30** - Mid-morning break
- **13:00** - Lunch time
- **15:30** - Afternoon break
- **18:00** - Evening commute
- **20:30** - Evening relaxation

### Platform Diversity Logic

1. **Content Selection**
   ```typescript
   // Priority scoring based on confidence and diversity
   const contentWithPriority = availableContent.map(content => ({
     ...content,
     diversityScore: recentPlatforms.includes(content.source_platform) ? 0.5 : 1.0,
     finalScore: content.confidence_score * diversityScore
   }))
   ```

2. **Platform Distribution**
   - Prevents consecutive posts from same platform
   - Tracks recent posting history (last 3 posts)
   - Balances content across all available platforms

3. **Deterministic Scheduling**
   - Consistent time slots for predictable engagement
   - Content scheduled up to 30 days in advance
   - Automatic rescheduling when content is consumed

## Usage

### Scheduling Content

```bash
# Schedule 7 days of content (42 posts)
curl -X POST /api/admin/queue/schedule \
  -H "Content-Type: application/json" \
  -d '{"daysAhead": 7, "postsPerDay": 6}'
```

### Viewing Schedule

```bash
# Get upcoming schedule for next 7 days
curl /api/admin/queue/schedule?days=7&limit=50
```

### Manual Posting

```bash
# Post next scheduled content
curl -X POST /api/admin/posting/execute \
  -H "Content-Type: application/json" \
  -d '{"type": "scheduled"}'
```

## Configuration

### Environment Variables

```bash
# Database configuration
DATABASE_URL_SQLITE="./hotdog_diaries_dev.db"
NODE_ENV="development"

# Admin authentication
JWT_SECRET="your-secret-key"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-secure-password"
```

### System Parameters

```typescript
// Time slots (can be modified in schedule-content.ts)
const POSTING_TIMES = [
  { hour: 8, minute: 0 },   // 08:00
  { hour: 10, minute: 30 }, // 10:30
  { hour: 13, minute: 0 },  // 13:00
  { hour: 15, minute: 30 }, // 15:30
  { hour: 18, minute: 0 },  // 18:00
  { hour: 20, minute: 30 }  // 20:30
]

// Scheduling limits
const MAX_DAYS_AHEAD = 30
const MAX_POSTS_PER_DAY = 12
```

## Database Queries

### Key Indexes for Performance

```sql
-- Scheduling performance
CREATE INDEX idx_content_scheduling ON content_queue(
  is_approved, status, confidence_score DESC, created_at ASC
);

-- Posted content tracking
CREATE INDEX idx_posted_content_platform ON posted_content(posted_at DESC);

-- Diversity enforcement
CREATE INDEX idx_recent_platforms ON posted_content(
  posted_at DESC, content_queue_id
);
```

### Content Status Flow

```sql
-- Content lifecycle
approved → scheduled → posted
     ↓         ↓         ↓
   (ready)  (timed)   (live)
```

## Monitoring and Analytics

### System Health Metrics

1. **Content Buffer**: Days of approved content remaining
2. **Platform Balance**: Distribution across platforms
3. **Scheduling Efficiency**: Success rate of scheduled posts
4. **Posting Accuracy**: On-time delivery statistics

### Key Queries

```sql
-- System health check
SELECT 
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as available,
  COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
  COUNT(CASE WHEN status = 'posted' THEN 1 END) as posted,
  ROUND(COUNT(CASE WHEN status = 'approved' THEN 1 END) / 6.0, 1) as days_remaining
FROM content_queue 
WHERE is_approved = TRUE;

-- Platform distribution
SELECT 
  source_platform,
  COUNT(*) as posts,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM posted_content pc
JOIN content_queue cq ON pc.content_queue_id = cq.id
WHERE pc.posted_at >= datetime('now', '-7 days')
GROUP BY source_platform
ORDER BY posts DESC;
```

## Troubleshooting

### Common Issues

1. **No Available Content**
   ```bash
   # Check content queue status
   curl /api/admin/metrics | jq '.data.contentQueue'
   
   # Approve pending content
   curl -X PUT /api/admin/content/{id}/review \
     -d '{"decision": "approve"}'
   ```

2. **Platform Imbalance**
   ```bash
   # Check platform distribution
   curl /api/admin/posting/execute | jq '.data.stats.platformDistribution'
   
   # Manually schedule specific platforms
   curl -X POST /api/admin/queue/schedule \
     -d '{"daysAhead": 3, "postsPerDay": 6, "platformFilter": ["reddit", "youtube"]}'
   ```

3. **Scheduling Failures**
   ```bash
   # Check system logs
   curl /api/admin/logs?component=scheduler&level=error
   
   # Reset failed scheduled content
   curl -X PUT /api/admin/queue/schedule \
     -d '{"contentId": 123, "action": "cancel"}'
   ```

### Emergency Procedures

1. **Manual Content Generation**
   ```bash
   # Create emergency content
   npm run emergency:content-create
   
   # Approve emergency content
   npm run emergency:content-approve
   ```

2. **Schedule Reset**
   ```bash
   # Clear all scheduled content
   npm run schedule:reset
   
   # Reschedule next 7 days
   npm run schedule:init 7
   ```

## Performance Considerations

### Database Optimization

- Indexes on scheduling columns for fast lookups
- Batched updates for large scheduling operations
- Connection pooling for concurrent requests

### Memory Usage

- Streaming results for large content sets
- Pagination for admin interfaces
- Efficient TypeScript typing for reduced overhead

### Scalability

- Stateless scheduler service for horizontal scaling
- Database-driven configuration for runtime changes
- Event-driven architecture for real-time updates

## Security

### Authentication

- JWT-based admin authentication
- Time-limited tokens for API access
- Role-based permissions for scheduling operations

### Data Protection

- Sanitized content handling
- SQL injection prevention via parameterized queries
- Rate limiting on scheduling endpoints

## Future Enhancements

### Planned Features

1. **Dynamic Time Slots**: User-configurable posting times
2. **Content Themes**: Scheduling based on content categories
3. **Engagement Analytics**: Performance-based scheduling optimization
4. **Multi-Platform Publishing**: Direct social media integration
5. **A/B Testing**: Automated testing of posting strategies

### API Extensions

```typescript
// Future endpoint examples
POST /api/admin/schedule/themes    // Theme-based scheduling
GET  /api/admin/analytics/optimal  // Best posting times
PUT  /api/admin/schedule/bulk      // Bulk schedule modifications
```

## Testing

### Integration Tests

```bash
# Run complete system test
npm run test:integration

# Test specific components
npm run test:scheduler
npm run test:posting
```

### Performance Tests

```bash
# Load testing
npm run test:load

# Stress testing
npm run test:stress
```

## Conclusion

The deterministic content scheduling system provides Hotdog Diaries with:

- **Consistency**: 6 posts daily at optimal times
- **Diversity**: Balanced platform distribution
- **Reliability**: Automated scheduling with fallbacks
- **Scalability**: Efficient algorithms for growth
- **Maintainability**: Clear APIs and monitoring

This system ensures continuous, engaging content delivery while maintaining platform diversity and user engagement optimization.