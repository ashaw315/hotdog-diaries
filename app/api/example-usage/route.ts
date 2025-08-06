import { NextResponse } from 'next/server'

export async function GET() {
  const exampleUsage = {
    title: "Hotdog Diaries API Usage Examples",
    description: "Examples of how to use the automated posting system and public APIs",
    
    endpoints: {
      public: {
        "Get all posts": {
          url: "/api/posts",
          method: "GET",
          description: "Get paginated list of published hotdog posts",
          parameters: {
            page: "Page number (default: 1)",
            limit: "Items per page (max: 100, default: 20)",
            featured: "true/false - only featured posts",
            platform: "reddit/instagram/tiktok/mastodon/flickr/youtube",
            type: "image/video/text/mixed"
          },
          example: "/api/posts?page=1&limit=10&platform=reddit&featured=true"
        },
        
        "Get single post": {
          url: "/api/posts/[slug]",
          method: "GET",
          description: "Get specific post by slug with related content",
          example: "/api/posts/hot-dog-photo-from-reddit-123"
        },
        
        "Update post stats": {
          url: "/api/posts?id=[id]&action=[action]",
          method: "PATCH",
          description: "Increment view/like/share counts",
          parameters: {
            id: "Post ID",
            action: "view/like/share"
          },
          example: "/api/posts?id=123&action=view"
        }
      },
      
      admin: {
        "Manual posting": {
          url: "/api/admin/posting/manual",
          method: "POST",
          description: "Trigger manual posting with specific content or auto-selection",
          authentication: "JWT Bearer token required",
          body_examples: {
            auto_select: {
              mode: "auto",
              maxItems: 1,
              platformBalance: true,
              qualityThreshold: 0.6
            },
            specific_content: {
              contentIds: [123, 456, 789]
            }
          }
        },
        
        "Posting status": {
          url: "/api/admin/posting/manual",
          method: "GET",
          description: "Get current posting stats and available content",
          authentication: "JWT Bearer token required"
        },
        
        "Bulk scheduling": {
          url: "/api/admin/content/bulk-schedule",
          method: "POST",
          description: "Schedule multiple content items for posting",
          authentication: "JWT Bearer token required",
          body: {
            contentIds: [123, 456],
            scheduleType: "next_meal", // immediate/next_meal/distribute/custom
            customDateTime: "2025-08-06T18:00:00Z", // for custom type
            distributionHours: 24 // for distribute type
          }
        }
      },
      
      automation: {
        "Automated posting": {
          url: "/api/cron/automated-post",
          method: "POST",
          description: "Trigger automated meal-time posting (for cron jobs)",
          authentication: "CRON_SECRET bearer token required",
          note: "Only posts if current time matches meal times (±5 minutes)"
        },
        
        "Health check": {
          url: "/api/cron/automated-post",
          method: "GET",
          description: "Check automated posting system health",
          authentication: "CRON_SECRET bearer token required"
        }
      }
    },
    
    workflow: {
      "Complete automation flow": [
        "1. Content discovered via scanning (Reddit, Instagram, TikTok, etc.)",
        "2. Content analyzed and filtered for quality",
        "3. Content queued with status 'discovered'",
        "4. Admin reviews content (/admin/review) → status: 'pending_review'",
        "5. Approved content → status: 'approved'",
        "6. Content scheduled (manual or automatic) → status: 'scheduled'",
        "7. Automated posting at meal times → status: 'posted'",
        "8. Posted content appears in public API /api/posts",
        "9. Public site displays hotdog content with attribution"
      ]
    },
    
    meal_times: [
      { time: "07:00", name: "breakfast", description: "Morning hotdog content" },
      { time: "12:00", name: "lunch", description: "Midday hotdog content" },
      { time: "15:00", name: "snack", description: "Afternoon hotdog content" },
      { time: "18:00", name: "dinner", description: "Evening hotdog content" },
      { time: "20:00", name: "evening", description: "Evening snack content" },
      { time: "22:00", name: "late_night", description: "Late night hotdog content" }
    ],
    
    content_selection: {
      platform_weights: {
        reddit: "40% - Discussion and community content",
        instagram: "20% - Photo content",
        tiktok: "15% - Video content", 
        mastodon: "15% - Social media posts",
        flickr: "5% - Professional photography",
        youtube: "5% - Video content"
      },
      quality_factors: [
        "Confidence score from content analysis",
        "Original source credibility",
        "Content freshness and relevance",
        "Avoid recent duplicates (24h window)",
        "Platform diversity for balanced posting"
      ]
    },
    
    example_cron_setup: {
      description: "Set up automated posting with cron",
      cron_expression: "0 7,12,15,18,20,22 * * *",
      command: `curl -X POST "https://yourdomain.com/api/cron/automated-post" -H "Authorization: Bearer $CRON_SECRET"`,
      note: "Runs every day at meal times: 7am, 12pm, 3pm, 6pm, 8pm, 10pm"
    }
  }

  return NextResponse.json(exampleUsage, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}