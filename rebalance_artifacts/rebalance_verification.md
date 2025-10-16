# Rebalance Verification Report (Supabase REST)
## Health
{"ok":true,"missing":[],"table_ok":true}
## Pool Distribution (active) — REST grouped via jq
[
  {
    "platform": "pixabay",
    "active_items": 300
  },
  {
    "platform": "bluesky",
    "active_items": 299
  },
  {
    "platform": "tumblr",
    "active_items": 11
  },
  {
    "platform": "lemmy",
    "active_items": 10
  },
  {
    "platform": "giphy",
    "active_items": 1
  },
  {
    "platform": "reddit",
    "active_items": 1
  },
  {
    "platform": "youtube",
    "active_items": 1
  }
]

## Refill Responses
### Today
{"ok":true,"date":"2025-10-16","filled":0,"slots":[{"slot":0,"action":"kept","content_id":64},{"slot":1,"action":"kept","content_id":715},{"slot":2,"action":"kept","content_id":91},{"slot":3,"action":"kept","content_id":5797},{"slot":4,"action":"kept","content_id":92},{"slot":5,"action":"kept","content_id":93}]}
### Today (aggressive)
{"ok":true,"date":"2025-10-16","filled":0,"slots":[{"slot":0,"action":"kept","content_id":64},{"slot":1,"action":"kept","content_id":715},{"slot":2,"action":"kept","content_id":91},{"slot":3,"action":"kept","content_id":5797},{"slot":4,"action":"kept","content_id":92},{"slot":5,"action":"kept","content_id":93}]}
### Tomorrow
{"ok":true,"date":"2025-10-17","filled":1,"slots":[{"slot":0,"action":"kept","content_id":64},{"slot":1,"action":"kept","content_id":715},{"slot":2,"action":"kept","content_id":91},{"slot":3,"action":"created","content_id":716,"platform":"bluesky","level":"relaxed-strict"},{"slot":4,"action":"skipped","reason":"no_candidates_available"},{"slot":5,"action":"skipped","reason":"no_candidates_available"}]}
## Forecast Summaries
### 2025-10-16
{
  "date": "2025-10-16",
  "summary": {
    "total": 6,
    "posted": 1,
    "upcoming": 4,
    "missed": 1,
    "platforms": {
      "pixabay": 4,
      "bluesky": 2
    },
    "content_types": {
      "image": 5,
      "text": 1
    },
    "diversity_score": 45
  },
  "slots": [
    {
      "time": "08:00",
      "status": "missed",
      "platform": "pixabay",
      "type": "image",
      "id": 64
    },
    {
      "time": "12:00",
      "status": "upcoming",
      "platform": "bluesky",
      "type": "text",
      "id": 715
    },
    {
      "time": "15:00",
      "status": "upcoming",
      "platform": "pixabay",
      "type": "image",
      "id": 91
    },
    {
      "time": "18:00",
      "status": "posted",
      "platform": "bluesky",
      "type": "image",
      "id": 5797
    },
    {
      "time": "21:00",
      "status": "upcoming",
      "platform": "pixabay",
      "type": "image",
      "id": 92
    },
    {
      "time": "23:30",
      "status": "upcoming",
      "platform": "pixabay",
      "type": "image",
      "id": 93
    }
  ]
}

### 2025-10-17
{
  "date": "2025-10-17",
  "summary": {
    "total": 6,
    "posted": 0,
    "upcoming": 6,
    "missed": 0,
    "platforms": {
      "pixabay": 2,
      "bluesky": 1
    },
    "content_types": {
      "image": 2,
      "text": 1
    },
    "diversity_score": 45
  },
  "slots": [
    {
      "time": "08:00",
      "status": "upcoming",
      "platform": "pixabay",
      "type": "image",
      "id": 64
    },
    {
      "time": "12:00",
      "status": "upcoming",
      "platform": "bluesky",
      "type": "text",
      "id": 715
    },
    {
      "time": "15:00",
      "status": "upcoming",
      "platform": "pixabay",
      "type": "image",
      "id": 91
    },
    {
      "time": "18:00",
      "status": "upcoming",
      "platform": null,
      "type": null,
      "id": null
    },
    {
      "time": "21:00",
      "status": "upcoming",
      "platform": null,
      "type": null,
      "id": null
    },
    {
      "time": "23:30",
      "status": "upcoming",
      "platform": null,
      "type": null,
      "id": null
    }
  ]
}

## DB scheduled_posts (UTC window)
### 2025-10-16
20	0	2025-10-16T12:00:00+00:00		64	pixabay	image	food, snack, street food, korean food, korean stre
21	1	2025-10-16T16:00:00+00:00		715	bluesky	text	Keeping my fingers crossed for the flying hot dog 
22	2	2025-10-16T19:00:00+00:00		91	pixabay	image	sausage, food, meal, yummy, hearty, sausages, home

### 2025-10-17
24	0	2025-10-17T12:00:00+00:00		64	pixabay	image	food, snack, street food, korean food, korean stre
25	1	2025-10-17T16:00:00+00:00		715	bluesky	text	Keeping my fingers crossed for the flying hot dog 
26	2	2025-10-17T19:00:00+00:00		91	pixabay	image	sausage, food, meal, yummy, hearty, sausages, home
27	3	2025-10-17T22:00:00+00:00		716	bluesky	text	8 to 12 days of increased biological aging over a 

## Diversity (API)
=== Diversity for 2025-10-16 ===
{
  "pixabay": 4,
  "bluesky": 2
}
=== Diversity for 2025-10-17 ===
{
  "pixabay": 2,
  "bluesky": 1
}

## PASS/FAIL Summary
slots_filled_today:    6
slots_filled_tomorrow: 6
platforms_across_2d:   2
criteria_slots_6_each_day: OK
criteria_diversity_>=4:    FAIL
