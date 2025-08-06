'use client'

import ContentFeed from '@/components/ui/ContentFeed'

export default function HomePage() {
  return (
    <div className="container content-area">
      <div className="text-center mb-lg">
        <h1>Welcome to Hotdog Diaries</h1>
        
        <p className="text-muted mb-md">
          Your premier destination for hotdog content from across social media. 
          We scan, curate, and serve up the best hotdog posts 6 times daily.
        </p>
      </div>

      <div className="grid grid-3 gap-md mb-lg">
        <div className="card">
          <div className="card-body text-center">
            <div className="mb-sm">🌭</div>
            <h3>Daily Content</h3>
            <p className="text-muted">
              Fresh hotdog posts delivered 6 times per day from across social media platforms.
            </p>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <div className="mb-sm">🔍</div>
            <h3>Smart Scanning</h3>
            <p className="text-muted">
              Our intelligent system finds and curates the most interesting hotdog content.
            </p>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <div className="mb-sm">📱</div>
            <h3>Mobile Ready</h3>
            <p className="text-muted">
              Optimized for all devices so you never miss a great hotdog moment.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-center mb-md">Latest Hotdog Posts</h2>
        
        <ContentFeed
          type="posted"
          limit={6}
          showActions={false}
        />
      </div>
    </div>
  )
}