export default function SettingsPage() {
  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Configure system settings and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Posting Schedule</h2>
            <p className="text-sm text-gray-600 mb-4">
              Configure when and how often content is posted
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Posts per day</span>
                <span className="text-sm font-medium text-gray-900">6</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Posting interval</span>
                <span className="text-sm font-medium text-gray-900">4 hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Auto-posting</span>
                <span className="text-sm font-medium text-green-600">Enabled</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Content Sources</h2>
            <p className="text-sm text-gray-600 mb-4">
              Manage social media scanning and content sources
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Twitter scanning</span>
                <span className="text-sm font-medium text-green-600">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Instagram scanning</span>
                <span className="text-sm font-medium text-yellow-600">Paused</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Reddit scanning</span>
                <span className="text-sm font-medium text-green-600">Active</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
            <p className="text-sm text-gray-600 mb-4">
              Configure alerts and notifications
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Email notifications</span>
                <span className="text-sm font-medium text-green-600">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Error alerts</span>
                <span className="text-sm font-medium text-green-600">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Daily reports</span>
                <span className="text-sm font-medium text-red-600">Disabled</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health</h2>
            <p className="text-sm text-gray-600 mb-4">
              Monitor system performance and health
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Database status</span>
                <span className="text-sm font-medium text-green-600">Healthy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">API response time</span>
                <span className="text-sm font-medium text-gray-900">125ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Last backup</span>
                <span className="text-sm font-medium text-gray-900">2 hours ago</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Advanced Configuration</h2>
          <p className="text-sm text-gray-600 mb-6">
            Advanced settings and configuration options will be available here.
          </p>
          <div className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-gray-50">
            Coming in Future Update
          </div>
        </div>
    </div>
  )
}