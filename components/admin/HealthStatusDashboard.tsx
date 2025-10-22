'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react'

interface HealthEndpointStatus {
  name: string
  endpoint: string
  status: 'healthy' | 'warning' | 'error' | 'loading' | 'unknown'
  message: string
  lastCheck: string
  details?: any
}

export default function HealthStatusDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthEndpointStatus[]>([
    {
      name: 'Timezone Handling',
      endpoint: '/api/health/schedule-tz',
      status: 'loading',
      message: 'Checking timezone conversions...',
      lastCheck: new Date().toISOString()
    },
    {
      name: 'Posting Source of Truth',
      endpoint: '/api/health/posting-source-of-truth',
      status: 'loading',
      message: 'Checking posting system integrity...',
      lastCheck: new Date().toISOString()
    }
  ])

  // Safe fetch with defensive null checks
  const safeFetchJson = async (url: string, options: RequestInit = {}) => {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options
      })
      
      if (!response) {
        return { data: null, error: 'No response received', status: 0 }
      }
      
      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}`, status: response.status }
      }
      
      const data = await response.json()
      return { data: data || null, error: null, status: response.status }
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error', status: 0 }
    }
  }

  const checkHealthEndpoint = async (endpoint: HealthEndpointStatus) => {
    const result = await safeFetchJson(endpoint.endpoint)
    
    if (result.error) {
      return {
        ...endpoint,
        status: 'error' as const,
        message: `Connection failed: ${result.error}`,
        lastCheck: new Date().toISOString(),
        details: null
      }
    }
    
    // Defensive null checks on the response data
    const data = result.data || {}
    const issues = Array.isArray(data.issues) ? data.issues : []
    const dataStatus = typeof data.status === 'string' ? data.status : null
    
    return {
      ...endpoint,
      status: dataStatus || (result.status === 200 ? 'healthy' : 'error'),
      message: issues.length > 0 
        ? `${issues.length} issues found`
        : result.status === 200 
          ? 'All checks passed' 
          : 'Health check failed',
      lastCheck: new Date().toISOString(),
      details: data
    }
  }

  const checkAllHealth = async () => {
    console.log('🔍 Checking system health endpoints...')
    
    const promises = healthStatus.map(endpoint => checkHealthEndpoint(endpoint))
    const results = await Promise.all(promises)
    
    setHealthStatus(results)
    console.log('🔍 Health check completed:', results.map(r => ({ name: r.name, status: r.status })))
  }

  useEffect(() => {
    checkAllHealth()
    
    // Refresh every 2 minutes
    const interval = setInterval(checkAllHealth, 120000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'loading':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-green-200 bg-green-50'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50'
      case 'error':
        return 'border-red-200 bg-red-50'
      case 'loading':
        return 'border-blue-200 bg-blue-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const overallStatus = healthStatus.every(h => h.status === 'healthy') ? 'healthy' :
                      healthStatus.some(h => h.status === 'error') ? 'error' : 'warning'

  return (
    <>
      <style jsx>{`
        .health-dashboard {
          margin-bottom: 20px;
        }
        
        .health-summary {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding: 16px;
          border-radius: 8px;
          font-weight: 500;
        }
        
        .health-summary.healthy {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #10b981;
        }
        
        .health-summary.warning {
          background-color: #fef3c7;
          color: #92400e;
          border: 1px solid #f59e0b;
        }
        
        .health-summary.error {
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #ef4444;
        }
        
        .health-checks {
          display: grid;
          gap: 16px;
        }
        
        .health-check {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border: 1px solid;
          border-radius: 8px;
          transition: all 0.2s ease;
        }
        
        .health-check:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .health-check-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .health-check-name {
          font-weight: 600;
          color: #111827;
        }
        
        .health-check-message {
          font-size: 14px;
          color: #6b7280;
        }
        
        .health-check-time {
          font-size: 12px;
          color: #9ca3af;
        }
        
        .refresh-btn {
          padding: 8px 16px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        
        .refresh-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
        
        .details-btn {
          padding: 4px 8px;
          background: transparent;
          color: #6b7280;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .details-btn:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
        
        @media (max-width: 768px) {
          .health-check {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          
          .health-check-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
          
          .health-summary {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
      `}</style>
      
      <div className="health-dashboard" data-testid="health-dashboard">
        {/* Overall Status Summary */}
        <div className={`health-summary ${overallStatus}`} data-testid="health-summary">
          {getStatusIcon(overallStatus)}
          <span>
            System Health: {overallStatus === 'healthy' ? 'All Systems Operational' :
                          overallStatus === 'warning' ? 'Some Issues Detected' :
                          'Critical Issues Found'}
          </span>
          <button 
            className="refresh-btn" 
            onClick={checkAllHealth}
            data-testid="health-refresh-btn"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Individual Health Checks */}
        <div className="health-checks" data-testid="health-checks">
          {healthStatus.map((check, index) => (
            <div 
              key={index} 
              className={`health-check ${getStatusColor(check.status)}`}
              data-testid={`health-check-${index}`}
            >
              <div className="health-check-info">
                {getStatusIcon(check.status)}
                <div>
                  <div className="health-check-name" data-testid={`health-check-name-${index}`}>
                    {check.name}
                  </div>
                  <div className="health-check-message" data-testid={`health-check-message-${index}`}>
                    {check.message}
                  </div>
                  <div className="health-check-time" data-testid={`health-check-time-${index}`}>
                    Last checked: {new Date(check.lastCheck).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {check.details && (
                  <button 
                    className="details-btn"
                    onClick={() => {
                      console.log(`Health details for ${check.name}:`, check.details)
                      // In a real implementation, this might open a modal or navigate to a details page
                    }}
                    data-testid={`health-details-btn-${index}`}
                  >
                    Details
                  </button>
                )}
                
                {check.status === 'error' && (
                  <button 
                    className="refresh-btn"
                    onClick={() => checkHealthEndpoint(check).then(result => {
                      const newStatus = [...healthStatus]
                      newStatus[index] = result
                      setHealthStatus(newStatus)
                    })}
                    data-testid={`health-retry-btn-${index}`}
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* System Recommendations */}
        {overallStatus !== 'healthy' && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px'
          }} data-testid="health-recommendations">
            <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
              🔧 System Recommendations
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e' }}>
              {healthStatus
                .filter(check => check.details?.recommendations?.length > 0)
                .flatMap(check => check.details.recommendations)
                .slice(0, 3) // Limit to 3 most important recommendations
                .map((rec: string, i: number) => (
                  <li key={i} style={{ marginBottom: '4px', fontSize: '14px' }}>{rec}</li>
                ))
              }
            </ul>
          </div>
        )}
      </div>
    </>
  )
}