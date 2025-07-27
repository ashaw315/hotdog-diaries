'use client'

import ContentFeed from '@/components/ui/ContentFeed'

export default function HomePage() {
  return (
    <div className="container py-12">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-primary mb-6">
            Welcome to Hotdog Diaries
          </h1>
          
          <p className="text-lg md:text-xl text-text opacity-80 mb-8 max-w-2xl mx-auto">
            Your premier destination for hotdog content from across social media. 
            We scan, curate, and serve up the best hotdog posts 6 times daily.
          </p>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="p-6 border border-border rounded-lg">
            <div className="text-4xl mb-4">🌭</div>
            <h3 className="text-xl font-semibold text-primary mb-2">Daily Content</h3>
            <p className="text-text opacity-75">
              Fresh hotdog posts delivered 6 times per day from across social media platforms.
            </p>
          </div>
          
          <div className="p-6 border border-border rounded-lg">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-primary mb-2">Smart Scanning</h3>
            <p className="text-text opacity-75">
              Our intelligent system finds and curates the most interesting hotdog content.
            </p>
          </div>
          
          <div className="p-6 border border-border rounded-lg">
            <div className="text-4xl mb-4">📱</div>
            <h3 className="text-xl font-semibold text-primary mb-2">Mobile Ready</h3>
            <p className="text-text opacity-75">
              Optimized for all devices so you never miss a great hotdog moment.
            </p>
          </div>
        </div>

        {/* Latest Content Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-primary mb-6 text-center">
            Latest Hotdog Posts
          </h2>
          
          <ContentFeed
            apiEndpoint="/api/content"
            pageSize={6}
            emptyMessage="No hotdog content posted yet. Check back soon for the latest posts!"
            errorMessage="Failed to load hotdog content. Please try again later."
          />
        </div>
      </div>
    </div>
  )
}