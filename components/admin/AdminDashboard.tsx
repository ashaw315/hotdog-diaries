'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useDashboardData } from '@/hooks/useAdminData'
import { ContentStatusDashboard } from './ContentStatusDashboard'
import DiversityAlerts from './DiversityAlerts'
import HealthStatusDashboard from './HealthStatusDashboard'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { data: dashboardData, loading: isLoading, error: dashboardError, refresh } = useDashboardData(30000) // 30 second refresh

  // Extract key metrics from dashboard data
  const totalApproved = dashboardData?.queueStats?.totalApproved || 0
  const totalDiscovered = dashboardData?.queueStats?.totalPending || 0
  const postedToday = dashboardData?.postingSchedule?.todaysPosts || 0
  const activePlatforms = dashboardData?.platformStatus ?
    Object.values(dashboardData.platformStatus).filter((p: any) => p.operational).length : 8

  // Error state with retry option
  if (dashboardError) {
    return (
      <div className="admin-dashboard">
        <div className="dashboard-main">
          <div className="metric-card" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ color: '#dc2626', marginBottom: '12px' }}>Dashboard Error</h2>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>{dashboardError}</p>
            <button
              onClick={refresh}
              className="refresh-btn"
              style={{ 
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🔄 Retry Loading
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="admin-dashboard">
        <div className="dashboard-main">
          <div className="stats-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="metric-card" style={{ textAlign: 'center' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #e5e7eb',
                  borderTop: '3px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '20px auto'
                }}></div>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading...</div>
              </div>
            ))}
          </div>
        </div>
        
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <>
      <style jsx>{`
        .admin-dashboard {
          background-color: #f3f4f6;
        }
        
        .dashboard-main {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }
        
        .metric-card {
          background-color: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .metric-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        
        .metric-label {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .metric-icon {
          font-size: 24px;
        }
        
        .metric-value {
          font-size: 32px;
          font-weight: 700;
          color: #111827;
        }
        
        .metric-updated {
          font-size: 12px;
          color: #9ca3af;
          margin-top: 8px;
        }
        
        .platform-section {
          background-color: white;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 32px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .section-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 20px;
          color: #111827;
        }
        
        .platform-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .table-header {
          border-bottom: 2px solid #e5e7eb;
        }
        
        .table-header th {
          padding: 12px;
          text-align: left;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .table-row {
          border-bottom: 1px solid #f3f4f6;
        }
        
        .table-cell {
          padding: 16px;
          font-weight: 500;
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        
        .scan-btn {
          padding: 6px 12px;
          background-color: #667eea;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .scan-btn:hover {
          background-color: #5a67d8;
        }
        
        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        
        .action-link {
          padding: 16px;
          background-color: white;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: inherit;
        }
        
        .action-icon {
          font-size: 24px;
        }
        
        .action-label {
          font-size: 14px;
          font-weight: 500;
          text-align: center;
        }
        
        @media (max-width: 768px) {
          .dashboard-main {
            padding: 16px;
          }
          
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-bottom: 24px;
          }
          
          .metric-card {
            padding: 16px;
          }
          
          .metric-label {
            font-size: 12px;
          }
          
          .metric-icon {
            font-size: 20px;
          }
          
          .metric-value {
            font-size: 24px;
          }
          
          .platform-section {
            padding: 16px;
            margin-bottom: 24px;
          }
          
          .section-title {
            font-size: 16px;
          }
          
          .platform-table {
            min-width: 600px;
          }
          
          .table-header th {
            padding: 8px;
            font-size: 10px;
          }
          
          .table-cell {
            padding: 12px 8px;
            font-size: 14px;
          }
          
          .status-badge {
            font-size: 10px;
          }
          
          .scan-btn {
            padding: 4px 8px;
            font-size: 10px;
          }
          
          .quick-actions-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          
          .action-link {
            padding: 12px;
          }
          
          .action-icon {
            font-size: 20px;
          }
          
          .action-label {
            font-size: 12px;
          }
        }
      `}</style>
      
      <div className="admin-dashboard" data-testid="admin-dashboard">
        {/* Main Content */}
        <main className="dashboard-main" data-testid="dashboard-main">
          {/* Key Metrics */}
          <div className="stats-grid" data-testid="stats-grid">
            {[
              { label: 'Approved', value: totalApproved, color: '#10b981', icon: '✅', testId: 'metric-approved' },
              { label: 'Discovered', value: totalDiscovered, color: '#f59e0b', icon: '🔍', testId: 'metric-discovered' },
              { label: 'Posted Today', value: postedToday, color: '#8b5cf6', icon: '📤', testId: 'metric-posted-today' },
              { label: 'Active Platforms', value: activePlatforms, color: '#3b82f6', icon: '🌐', testId: 'metric-platforms' }
            ].map((stat, index) => (
              <div key={index} className="metric-card" style={{ borderLeft: `4px solid ${stat.color}` }} data-testid={stat.testId}>
                <div className="metric-header">
                  <span className="metric-label" data-testid={`${stat.testId}-label`}>{stat.label}</span>
                  <span className="metric-icon" data-testid={`${stat.testId}-icon`}>{stat.icon}</span>
                </div>
                <div className="metric-value" data-testid={`${stat.testId}-value`}>{stat.value.toLocaleString()}</div>
                <div className="metric-updated" data-testid={`${stat.testId}-updated`}>
                  Updated {new Date().toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>

          {/* Platform Status */}
          <div className="platform-section" data-testid="platform-status-section">
            <h2 className="section-title" data-testid="platform-status-title">Platform Status</h2>
            
            <div style={{ overflowX: 'auto' }} data-testid="platform-table-container">
              <table className="platform-table" data-testid="platform-table">
                <thead>
                  <tr className="table-header">
                    <th>Platform</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Content Found</th>
                    <th style={{ textAlign: 'center' }}>Last Scan</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: '🔴 Reddit', key: 'reddit', status: dashboardData?.platformStatus?.reddit?.operational ? 'active' : 'inactive' },
                    { name: '📺 YouTube', key: 'youtube', status: dashboardData?.platformStatus?.youtube?.operational ? 'active' : 'inactive' },
                    { name: '🖼️ Pixabay', key: 'pixabay', status: dashboardData?.platformStatus?.pixabay?.operational ? 'active' : 'inactive' },
                    { name: '🎬 Giphy', key: 'giphy', status: dashboardData?.platformStatus?.giphy?.operational ? 'active' : 'inactive' },
                    { name: '🦋 Bluesky', key: 'bluesky', status: dashboardData?.platformStatus?.bluesky?.operational ? 'active' : 'inactive' },
                    { name: '🎨 Tumblr', key: 'tumblr', status: dashboardData?.platformStatus?.tumblr?.operational ? 'active' : 'inactive' },
                    { name: '📱 Imgur', key: 'imgur', status: dashboardData?.platformStatus?.imgur?.operational ? 'active' : 'inactive' },
                    { name: '🌐 Lemmy', key: 'lemmy', status: dashboardData?.platformStatus?.lemmy?.operational ? 'active' : 'inactive' }
                  ].map((platform, index) => (
                    <tr key={index} className="table-row" data-testid={`platform-row-${platform.key}`}>
                      <td className="table-cell" data-testid={`platform-name-${platform.key}`}>{platform.name}</td>
                      <td className="table-cell">
                        <span className="status-badge" style={{
                          backgroundColor: platform.status === 'active' ? '#d1fae5' : '#fee2e2',
                          color: platform.status === 'active' ? '#065f46' : '#991b1b'
                        }} data-testid={`platform-status-${platform.key}`}>
                          <span className="status-dot" style={{
                            backgroundColor: platform.status === 'active' ? '#10b981' : '#ef4444'
                          }} />
                          {platform.status}
                        </span>
                      </td>
                      <td className="table-cell" style={{ textAlign: 'center' }} data-testid={`platform-content-count-${platform.key}`}>
                        {dashboardData?.platformStatus?.[platform.key]?.itemCount || 0}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280' }} data-testid={`platform-last-scan-${platform.key}`}>
                        {dashboardData?.platformStatus?.[platform.key]?.lastScan ? 
                          new Date(dashboardData.platformStatus[platform.key].lastScan).toLocaleDateString() : 
                          'Never'
                        }
                      </td>
                      <td className="table-cell" style={{ textAlign: 'center' }}>
                        <button className="scan-btn" data-testid={`platform-scan-btn-${platform.key}`}>
                          Scan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Diversity Alerts */}
          <DiversityAlerts refreshInterval={30000} />

          {/* Health Status */}
          <div className="platform-section" data-testid="health-status-section">
            <h2 className="section-title" data-testid="health-status-title">System Health</h2>
            <HealthStatusDashboard />
          </div>

          {/* Content Status Dashboard */}
          <div style={{ marginBottom: '32px' }}>
            <ContentStatusDashboard />
          </div>

          {/* Quick Actions */}
          <div className="platform-section" data-testid="quick-actions-section">
            <h2 className="section-title" data-testid="quick-actions-title">Quick Actions</h2>
            
            <div className="quick-actions-grid" data-testid="quick-actions-grid">
              {[
                { label: 'Scan All Platforms', icon: '🔄', color: '#3b82f6', href: '/admin/social', testId: 'action-scan-all' },
                { label: 'Review Content', icon: '👁️', color: '#10b981', href: '/admin/queue', testId: 'action-review-content' },
                { label: 'View Analytics', icon: '📊', color: '#8b5cf6', href: '/admin/analytics', testId: 'action-view-analytics' },
                { label: 'System Settings', icon: '⚙️', color: '#6b7280', href: '/admin/settings', testId: 'action-system-settings' }
              ].map((action, index) => (
                <a key={index} href={action.href} className="action-link" style={{
                  border: `2px solid ${action.color}`
                }}
                data-testid={action.testId}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = action.color;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.color = 'inherit';
                }}>
                  <span className="action-icon" data-testid={`${action.testId}-icon`}>{action.icon}</span>
                  <span className="action-label" data-testid={`${action.testId}-label`}>{action.label}</span>
                </a>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}