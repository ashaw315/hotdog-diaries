export default function HomePage() {
  return (
    <div className="container py-12">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-primary mb-6">
          Welcome to Hotdog Diaries
        </h1>
        
        <p className="text-lg md:text-xl text-text opacity-80 mb-8 max-w-2xl mx-auto">
          Your premier destination for hotdog content from across social media. 
          We scan, curate, and serve up the best hotdog posts 6 times daily.
        </p>
        
        <div className="grid md:grid-cols-3 gap-8 mt-12">
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
        
        <div className="mt-16 p-8 bg-gray-50 rounded-lg border border-border">
          <h2 className="text-2xl font-semibold text-primary mb-4">Coming Soon</h2>
          <p className="text-text opacity-75">
            Hotdog content will start appearing here once our social media scanning system is active. 
            Check back soon for the latest and greatest hotdog posts!
          </p>
        </div>
      </div>
    </div>
  )
}