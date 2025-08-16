import './admin-settings.css'

export default function SettingsPage() {
  return (
    <div className="settings-admin-container">
      {/* Header */}
      <div className="settings-admin-header">
        <h1>⚙️ System Settings</h1>
        <p>Configure system settings and preferences for Hotdog Diaries</p>
      </div>

      {/* Settings Grid */}
      <div className="settings-grid">
        {/* Posting Schedule */}
        <div className="settings-admin-card">
          <div className="settings-admin-card-header">
            <h2>📅 Posting Schedule</h2>
          </div>
          <div className="settings-admin-card-body">
            <p>Configure when and how often content is posted automatically</p>
            <div className="settings-list">
              <div className="settings-item">
                <span className="settings-item-label">Posts per day</span>
                <span className="settings-item-value status-neutral">6</span>
              </div>
              <div className="settings-item">
                <span className="settings-item-label">Posting interval</span>
                <span className="settings-item-value status-neutral">4 hours</span>
              </div>
              <div className="settings-item">
                <span className="settings-item-label">Auto-posting</span>
                <div className="settings-status">
                  <span className="settings-status-dot enabled"></span>
                  <span className="settings-item-value status-enabled">Enabled</span>
                </div>
              </div>
            </div>
            <div className="settings-actions">
              <button className="settings-btn settings-btn-primary">Configure Schedule</button>
            </div>
          </div>
        </div>

        {/* Content Sources */}
        <div className="settings-admin-card">
          <div className="settings-admin-card-header">
            <h2>🔗 Content Sources</h2>
          </div>
          <div className="settings-admin-card-body">
            <p>Manage social media scanning and content source integrations</p>
            <div className="settings-list">
              <div className="settings-item">
                <span className="settings-item-label">Reddit scanning</span>
                <div className="settings-status">
                  <span className="settings-status-dot active"></span>
                  <span className="settings-item-value status-active">Active</span>
                </div>
              </div>
              <div className="settings-item">
                <span className="settings-item-label">Bluesky scanning</span>
                <div className="settings-status">
                  <span className="settings-status-dot active"></span>
                  <span className="settings-item-value status-active">Active</span>
                </div>
              </div>
              <div className="settings-item">
                <span className="settings-item-label">YouTube scanning</span>
                <div className="settings-status">
                  <span className="settings-status-dot paused"></span>
                  <span className="settings-item-value status-paused">Paused</span>
                </div>
              </div>
            </div>
            <div className="settings-actions">
              <a href="/admin/reddit" className="settings-btn">Configure Reddit</a>
              <a href="/admin/bluesky" className="settings-btn">Configure Bluesky</a>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-admin-card">
          <div className="settings-admin-card-header">
            <h2>🔔 Notifications</h2>
          </div>
          <div className="settings-admin-card-body">
            <p>Configure alerts and notification preferences</p>
            <div className="settings-list">
              <div className="settings-item">
                <span className="settings-item-label">Email notifications</span>
                <div className="settings-status">
                  <span className="settings-status-dot enabled"></span>
                  <span className="settings-item-value status-enabled">Enabled</span>
                </div>
              </div>
              <div className="settings-item">
                <span className="settings-item-label">Error alerts</span>
                <div className="settings-status">
                  <span className="settings-status-dot enabled"></span>
                  <span className="settings-item-value status-enabled">Enabled</span>
                </div>
              </div>
              <div className="settings-item">
                <span className="settings-item-label">Daily reports</span>
                <div className="settings-status">
                  <span className="settings-status-dot disabled"></span>
                  <span className="settings-item-value status-disabled">Disabled</span>
                </div>
              </div>
            </div>
            <div className="settings-actions">
              <button className="settings-btn">Configure Notifications</button>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="settings-admin-card">
          <div className="settings-admin-card-header">
            <h2>💚 System Health</h2>
          </div>
          <div className="settings-admin-card-body">
            <p>Monitor system performance and operational health</p>
            <div className="settings-list">
              <div className="settings-item">
                <span className="settings-item-label">Database status</span>
                <div className="settings-status">
                  <span className="settings-status-dot healthy"></span>
                  <span className="settings-item-value status-healthy">Healthy</span>
                </div>
              </div>
              <div className="settings-item">
                <span className="settings-item-label">API response time</span>
                <span className="settings-item-value status-neutral">125ms</span>
              </div>
              <div className="settings-item">
                <span className="settings-item-label">Last backup</span>
                <span className="settings-item-value status-neutral">2 hours ago</span>
              </div>
            </div>
            <div className="settings-actions">
              <a href="/admin/monitoring" className="settings-btn">View Monitoring</a>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Configuration - Full Width */}
      <div className="settings-admin-card settings-full-card">
        <div className="settings-admin-card-header">
          <h2>🔧 Advanced Configuration</h2>
        </div>
        <div className="settings-admin-card-body">
          <p>Advanced settings and configuration options for power users and system administrators.</p>
          <div className="settings-coming-soon">
            🚧 Coming in Future Update
          </div>
        </div>
      </div>
    </div>
  )
}