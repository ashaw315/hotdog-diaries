'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminDebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [cookies, setCookies] = useState('')
  const auth = useAuth()

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(`[ADMIN-DEBUG] ${message}`)
  }

  useEffect(() => {
    addLog('🔄 AdminDebugPage mounted')
    addLog(`🔄 Auth state: isLoading=${auth.isLoading}, isAuthenticated=${auth.isAuthenticated}, user=${auth.user?.username || 'null'}`)
    
    // Get cookies
    setCookies(document.cookie)
    addLog(`🍪 Document cookies: ${document.cookie}`)
  }, [auth.isLoading, auth.isAuthenticated, auth.user])

  const testLogout = async () => {
    try {
      addLog('🚪 Testing AuthContext logout...')
      await auth.logout()
      addLog('🚪 AuthContext logout completed')
    } catch (error) {
      addLog(`❌ AuthContext logout error: ${error}`)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
      <h1>🔍 Admin Authentication Debug</h1>
      
      <div style={{ background: '#f0f0f0', padding: '15px', margin: '10px 0', borderRadius: '5px' }}>
        <h3>🔄 AuthContext State</h3>
        <p><strong>Loading:</strong> {auth.isLoading.toString()}</p>
        <p><strong>Authenticated:</strong> {auth.isAuthenticated.toString()}</p>
        <p><strong>User:</strong> {auth.user?.username || 'null'}</p>
        <p><strong>User ID:</strong> {auth.user?.id || 'null'}</p>
        <p><strong>User Email:</strong> {auth.user?.email || 'null'}</p>
      </div>

      <div style={{ background: '#e8f4f8', padding: '15px', margin: '10px 0', borderRadius: '5px' }}>
        <h3>🍪 Browser Cookies</h3>
        <div style={{ background: 'white', padding: '10px', borderRadius: '3px', wordBreak: 'break-all' }}>
          {cookies || 'No cookies found'}
        </div>
        <button onClick={() => setCookies(document.cookie)} style={{ marginTop: '10px', padding: '5px 10px' }}>
          🔄 Refresh Cookies
        </button>
      </div>

      <div style={{ background: '#f0f8e8', padding: '15px', margin: '10px 0', borderRadius: '5px' }}>
        <h3>🧪 AuthContext Tests</h3>
        
        <button onClick={testLogout} style={{ padding: '10px 15px', marginRight: '10px' }}>
          🚪 Test AuthContext Logout
        </button>
        
        <button onClick={() => auth.refreshUser()} style={{ padding: '10px 15px', marginRight: '10px' }}>
          🔄 Refresh User Data
        </button>
      </div>

      <div style={{ background: '#f8f8f0', padding: '15px', margin: '10px 0', borderRadius: '5px' }}>
        <h3>📋 Debug Logs</h3>
        <button onClick={clearLogs} style={{ padding: '5px 10px', marginBottom: '10px' }}>
          🗑️ Clear Logs
        </button>
        <div style={{ 
          background: 'black', 
          color: 'green', 
          padding: '15px', 
          borderRadius: '3px', 
          height: '300px', 
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '11px'
        }}>
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Admin Debug - Hotdog Diaries',
  description: 'Authentication debugging tools'
}