export default function MinimalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-center">
        <div className="text-8xl mb-6">🌭</div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          Hotdog Diaries
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          Deployment Test - Minimal Page
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>✅ Next.js App Router Working</p>
          <p>✅ Tailwind CSS Loading</p>
          <p>✅ Basic Routing Functional</p>
        </div>
        <div className="mt-6">
          <a 
            href="/api/ping" 
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Test API Endpoint
          </a>
        </div>
      </div>
    </div>
  );
}