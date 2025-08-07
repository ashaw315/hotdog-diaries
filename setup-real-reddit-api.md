# Setting Up Real Reddit API Integration

## 1. Create Reddit Application

1. Go to https://www.reddit.com/prefs/apps
2. Click "Create App" or "Create Another App"
3. Fill out the form:
   - **Name**: HotdogDiaries
   - **App type**: Select "script" 
   - **Description**: Automated hotdog content aggregator
   - **About URL**: http://localhost:3000
   - **Redirect URI**: http://localhost:3000
4. Click "Create app"
5. Note the Client ID (under the app name) and Client Secret

## 2. Update Environment Variables

Add these to your `.env` file:

```bash
# Reddit API Configuration
REDDIT_CLIENT_ID="your_14_character_client_id"
REDDIT_CLIENT_SECRET="your_27_character_client_secret"
REDDIT_USERNAME="your_reddit_username"
REDDIT_PASSWORD="your_reddit_account_password"
REDDIT_USER_AGENT="HotdogDiaries/1.0.0 by /u/your_username"
```

## 3. Expected Real Data Structure

When the API works, it will return data like this:

```json
{
  "id": "abc123",
  "title": "Amazing Chicago-style hot dog I made today",
  "selftext": "Used all the classic toppings except ketchup of course!",
  "subreddit": "food", 
  "author": "realuser123",
  "score": 847,
  "url": "https://i.redd.it/realimage123.jpg",
  "permalink": "/r/food/comments/abc123/amazing_chicagostyle_hot_dog_i_made_today/",
  "created_utc": 1691234567,
  "upvote_ratio": 0.96,
  "num_comments": 23
}
```

## 4. Subreddits That Will Be Scanned

- r/food - General food posts (search: "hot dog" OR "hotdog")
- r/FoodPorn - High quality food photos
- r/shittyfoodporn - Casual food photos (often has hotdog content)
- r/hotdogs - Dedicated hotdog subreddit (if it exists)

## 5. What Happens Without Real Credentials

The system falls back to mock data with fake URLs like:
- `https://reddit.com/r/hotdogs/comments/hd001/fake_post`
- Same 3 duplicate posts recycled endlessly
- No real Reddit usernames or scores
- No real images from Reddit's CDN

## 6. Testing Real Integration

Once credentials are added:

1. Clear fake data: `npm run db:clear-fake-content`
2. Run real scan: `npm run scan:reddit` 
3. Verify real URLs: Check for `reddit.com/r/[subreddit]/comments/[real_id]`
4. Check real images: URLs should be `i.redd.it/[hash].jpg`
5. Validate real usernames: Format `u/[actual_username]`

## 7. Rate Limiting

Reddit API allows:
- 60 requests per minute
- 600 requests per 10 minutes
- System implements automatic rate limiting and retries