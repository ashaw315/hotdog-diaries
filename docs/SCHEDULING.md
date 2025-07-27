# Automated Content Scheduling System

## Overview

The Hotdog Diaries automated content scheduling system provides complete control over when and how content is posted to the website. The system supports configurable meal times, queue monitoring, and comprehensive admin controls.

## Features

- **Configurable Meal Times**: Set custom posting times (default: 8am, 10am, 12pm, 3pm, 6pm, 8pm)
- **Timezone Support**: Configure timezone for accurate scheduling
- **Queue Monitoring**: Real-time monitoring of content queue health
- **Manual Posting**: Trigger posts manually when needed
- **Pause/Resume**: Temporarily disable automatic posting
- **Comprehensive Logging**: Track all scheduling activities
- **Alert System**: Get notified when queue runs low or encounters issues

## Architecture

### Core Services

#### SchedulingService (`lib/services/scheduling.ts`)
- `getScheduleConfig()`: Get current scheduling configuration
- `updateScheduleConfig()`: Update meal times, timezone, and enabled state
- `getNextScheduledTime()`: Calculate next posting time
- `isPostingTime()`: Check if current time matches a meal time
- `selectRandomContent()`: Choose random approved content for posting
- `getPostingSchedule()`: Get complete schedule information
- `pauseScheduling()` / `resumeScheduling()`: Control scheduling state

#### PostingService (`lib/services/posting.ts`)
- `postContent()`: Post content and update database
- `processScheduledPost()`: Complete scheduled posting workflow
- `getQueueStatus()`: Monitor queue health
- `getPostingStats()`: Get posting statistics
- `getPostingHistory()`: Retrieve posting history

#### QueueMonitorService (`lib/services/queue-monitor.ts`)
- `checkQueueHealth()`: Monitor queue and create alerts
- `getActiveAlerts()`: Get unacknowledged alerts
- `acknowledgeAlert()`: Mark alerts as acknowledged
- `createPostingFailureAlert()`: Create alerts for posting failures

### Database Schema

#### schedule_config Table
```sql
CREATE TABLE schedule_config (
    id SERIAL PRIMARY KEY,
    meal_times TEXT[] NOT NULL DEFAULT ARRAY['08:00', '10:00', '12:00', '15:00', '18:00', '20:00'],
    timezone VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### queue_alerts Table
```sql
CREATE TABLE queue_alerts (
    id SERIAL PRIMARY KEY,
    alert_type alert_type NOT NULL,
    message TEXT NOT NULL,
    severity alert_severity NOT NULL,
    metadata JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE NULL
);
```

## API Endpoints

### Admin Endpoints

#### GET /api/admin/schedule
Get complete schedule information including config, next post time, queue status, and statistics.

```javascript
const response = await fetch('/api/admin/schedule')
const data = await response.json()
// Returns: { config, schedule, queueStatus, stats }
```

#### PUT /api/admin/schedule
Update scheduling configuration.

```javascript
const response = await fetch('/api/admin/schedule', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    meal_times: ['09:00', '13:00', '19:00'],
    timezone: 'America/Los_Angeles',
    is_enabled: true
  })
})
```

#### POST /api/admin/schedule/trigger
Manually trigger a post.

```javascript
const response = await fetch('/api/admin/schedule/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contentId: 123 }) // Optional specific content ID
})
```

#### GET /api/admin/schedule/next
Get next scheduled posting time.

#### PUT /api/admin/schedule/pause
Pause or resume scheduling.

```javascript
const response = await fetch('/api/admin/schedule/pause', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ paused: true })
})
```

### Cron Endpoint

#### POST /api/cron/post-content
Webhook endpoint for external cron services. Requires authorization header.

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://your-domain.com/api/cron/post-content
```

#### GET /api/cron/post-content
Get current schedule and queue status (for monitoring).

### Queue Monitoring

#### GET /api/admin/queue/alerts
Get queue alerts.

Query Parameters:
- `active=true`: Only return unacknowledged alerts
- `limit=50`: Maximum number of alerts to return

#### POST /api/admin/queue/alerts
Manage queue alerts.

Actions:
- `acknowledge`: Acknowledge specific alert or all alerts
- `check`: Perform immediate queue health check

## Admin Interface

### Schedule Management Page (`/admin/schedule`)

The admin interface provides:

1. **Schedule Overview**
   - Current schedule status (active/paused)
   - Next posting time and countdown
   - Today's posting schedule with completion status

2. **Schedule Configuration**
   - Edit meal times
   - Change timezone
   - Enable/disable scheduling

3. **Queue Monitoring**
   - Real-time queue status
   - Health indicators and alerts
   - Posting statistics

4. **Manual Controls**
   - Trigger manual posts
   - Pause/resume scheduling
   - View posting history

## Setup and Configuration

### Environment Variables

```bash
# Required for cron webhook security
CRON_SECRET=your-secure-random-string

# Database configuration (already configured)
DATABASE_URL=postgresql://...
```

### Database Migration

Run the scheduling migrations:

```bash
npm run migrate
```

This will create:
- `schedule_config` table
- `queue_alerts` table
- Related indexes and constraints

### Cron Job Setup

#### Option 1: Vercel Cron Jobs (Recommended)
Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/post-content",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

#### Option 2: External Cron Service
Use a service like cron-job.org (free tier) to call your webhook:

- URL: `https://your-domain.com/api/cron/post-content`
- Method: POST
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`
- Schedule: Every 5 minutes

### Initial Configuration

1. **Set Default Configuration**
   The system creates a default configuration automatically:
   - Meal times: 8am, 10am, 12pm, 3pm, 6pm, 8pm
   - Timezone: America/New_York
   - Enabled: true

2. **Customize Settings**
   Use the admin interface at `/admin/schedule` to:
   - Adjust meal times for your audience
   - Set appropriate timezone
   - Configure alert thresholds

## Monitoring and Alerts

### Queue Health Monitoring

The system monitors queue health and creates alerts for:

- **Empty Queue**: No approved content available
- **Low Queue**: Fewer than 5 approved items
- **Critical Queue**: Fewer than 2 approved items
- **High Pending**: More than 50 pending items
- **Posting Failures**: When posts fail to process

### Alert Severity Levels

- **Low**: Informational alerts
- **Medium**: Warning conditions
- **High**: Important issues requiring attention
- **Critical**: Urgent problems that may stop posting

### Logging

All scheduling activities are logged to the database with:
- Component identification
- Structured metadata
- Timestamp information
- Log levels (debug, info, warn, error, fatal)

## Best Practices

### Content Queue Management

1. **Maintain Queue Health**
   - Keep at least 10 approved items in queue
   - Review and approve pending content regularly
   - Monitor queue alerts and respond promptly

2. **Scheduling Configuration**
   - Choose meal times that match your audience's activity
   - Consider timezone differences for global audiences
   - Test schedule changes during low-traffic periods

3. **Monitoring**
   - Check admin dashboard daily
   - Acknowledge alerts promptly
   - Review posting statistics regularly

### Error Handling

The system includes comprehensive error handling:

- **Database Errors**: Graceful fallbacks and logging
- **Network Issues**: Retry logic and timeout handling
- **Service Failures**: Automatic pause and alerting
- **Invalid Data**: Validation and error messages

### Security

- **Cron Secret**: Secure random string for webhook authentication
- **Admin Authentication**: Existing admin system integration
- **Input Validation**: All user inputs are validated
- **SQL Injection Prevention**: Parameterized queries

## Troubleshooting

### Common Issues

1. **Posts Not Scheduling**
   - Check if scheduling is enabled
   - Verify meal times are correct
   - Ensure approved content is available
   - Check cron job configuration

2. **Queue Running Low**
   - Review and approve pending content
   - Check content scraping services
   - Temporarily adjust posting frequency

3. **Timezone Issues**
   - Verify timezone setting in admin
   - Check server timezone configuration
   - Test with known meal times

### Debugging

1. **Check Logs**
   ```sql
   SELECT * FROM system_logs 
   WHERE component IN ('SchedulingService', 'PostingService', 'QueueMonitor')
   ORDER BY created_at DESC 
   LIMIT 50;
   ```

2. **Monitor Queue Status**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE is_approved = true AND is_posted = false) as approved,
     COUNT(*) FILTER (WHERE is_approved = false) as pending,
     COUNT(*) FILTER (WHERE is_posted = true) as posted
   FROM content_queue;
   ```

3. **Check Active Alerts**
   ```sql
   SELECT * FROM queue_alerts 
   WHERE acknowledged = false 
   ORDER BY created_at DESC;
   ```

## Testing

The system includes comprehensive tests:

- **Unit Tests**: Service logic and error handling
- **Integration Tests**: API endpoints and database operations
- **Mock Tests**: External service dependencies
- **Edge Case Tests**: Error conditions and boundary cases

Run tests:
```bash
npm test -- --testPathPattern=scheduling
npm test -- --testPathPattern=posting
npm test -- --testPathPattern=queue-monitor
```

## Performance Considerations

- **Database Indexes**: Optimized for common queries
- **Caching**: Configuration caching for frequently accessed data
- **Batch Operations**: Efficient bulk operations where possible
- **Connection Pooling**: Proper database connection management

## Future Enhancements

Potential improvements:
- **Multiple Schedules**: Different schedules for different content types
- **A/B Testing**: Test different posting times
- **Analytics Integration**: Track posting performance
- **AI-Powered Scheduling**: Optimize posting times based on engagement
- **Multi-Platform**: Support for social media platform posting