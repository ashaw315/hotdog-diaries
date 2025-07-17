import Layout from '@/components/Layout'

export default function AdminPage() {
  return (
    <Layout>
      <div className="container py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold text-primary mb-8">
            Admin Panel
          </h1>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 border border-border rounded-lg">
              <h2 className="text-xl font-semibold text-primary mb-4">Content Management</h2>
              <p className="text-text opacity-75 mb-4">
                Manage hotdog posts, scheduling, and content curation settings.
              </p>
              <button className="px-4 py-2 bg-primary text-white rounded hover:opacity-80 transition-opacity">
                Coming Soon
              </button>
            </div>
            
            <div className="p-6 border border-border rounded-lg">
              <h2 className="text-xl font-semibold text-primary mb-4">Social Media Settings</h2>
              <p className="text-text opacity-75 mb-4">
                Configure social media scanning parameters and posting frequency.
              </p>
              <button className="px-4 py-2 bg-primary text-white rounded hover:opacity-80 transition-opacity">
                Coming Soon
              </button>
            </div>
            
            <div className="p-6 border border-border rounded-lg">
              <h2 className="text-xl font-semibold text-primary mb-4">Analytics</h2>
              <p className="text-text opacity-75 mb-4">
                View engagement metrics and content performance statistics.
              </p>
              <button className="px-4 py-2 bg-primary text-white rounded hover:opacity-80 transition-opacity">
                Coming Soon
              </button>
            </div>
            
            <div className="p-6 border border-border rounded-lg">
              <h2 className="text-xl font-semibold text-primary mb-4">System Health</h2>
              <p className="text-text opacity-75 mb-4">
                Monitor system status, API health, and scanning operations.
              </p>
              <button className="px-4 py-2 bg-primary text-white rounded hover:opacity-80 transition-opacity">
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}