export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="mb-6">
          <div className="text-8xl mb-4">🌭</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">404</h1>
          <p className="text-xl text-gray-600 mb-4">Page not found</p>
          <p className="text-gray-500">This hotdog wandered off somewhere else</p>
        </div>
        
        <div className="space-y-3">
          <a
            href="/"
            className="block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Back to Hotdog Feed
          </a>
          
          <a
            href="/admin"
            className="block text-orange-600 hover:text-orange-700 text-sm underline"
          >
            Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}