'use client'

import { useState, useEffect } from 'react'

export default function AuthDebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [cookies, setCookies] = useState('')
  const [apiResponse, setApiResponse] = useState<any>(null)
  const [manualLogin, setManualLogin] = useState({ username: '', password: '' })
  const [authState, setAuthState] = useState({ isLoading: true, isAuthenticated: false, user: null })

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(`[AUTH-DEBUG] ${message}`)
  }

  useEffect(() => {
    addLog('🔄 AuthDebugPage mounted')
    
    // Test auth state by calling /api/admin/me
    testApiMe()
    
    // Get cookies
    setCookies(document.cookie)
    addLog(`🍪 Document cookies: ${document.cookie}`)
  }, [])
  
  // Test auth state independently
  const checkAuthState = async () => {
    try {
      const response = await fetch('/api/admin/me', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setAuthState({
          isLoading: false,
          isAuthenticated: true,
          user: data.data
        })
        addLog(`🔄 Auth check: authenticated as ${data.data?.username}`)
      } else {
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          user: null
        })
        addLog(`🔄 Auth check: not authenticated (${response.status})`)
      }
    } catch (error) {
      setAuthState({
        isLoading: false,
        isAuthenticated: false,
        user: null
      })
      addLog(`🔄 Auth check failed: ${error}`)
    }
  }

  const testApiMe = async () => {
    try {
      addLog('🌐 Testing /api/admin/me...')
      const response = await fetch('/api/admin/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      addLog(`📡 Response status: ${response.status}`)
      addLog(`📡 Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`)
      
      const data = await response.json()
      setApiResponse(data)
      addLog(`📊 Response data: ${JSON.stringify(data)}`)
    } catch (error) {
      addLog(`❌ API error: ${error}`)
    }
  }

  const manualLoginTest = async () => {
    try {
      addLog('🔐 Manual login test...')
      
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(manualLogin)
      })

      addLog(`🔐 Login response status: ${response.status}`)
      addLog(`🔐 Login response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`)
      
      const data = await response.json()
      addLog(`🔐 Login response data: ${JSON.stringify(data)}`)
      
      // Update cookies display (note: HttpOnly cookies won't show here!)
      setCookies(document.cookie)
      addLog(`🍪 Cookies after login (HttpOnly won't show): ${document.cookie}`)
      
      // IMMEDIATELY test /api/admin/me to see if cookies are working
      if (response.ok) {
        addLog('🧪 Immediately testing /api/admin/me after login...')
        setTimeout(async () => {
          try {
            const meResponse = await fetch('/api/admin/me', {
              method: 'GET',
              credentials: 'include'
            })
            addLog(`🧪 Immediate /api/admin/me status: ${meResponse.status}`)
            if (meResponse.ok) {
              const meData = await meResponse.json()
              addLog(`🎉 SUCCESS! Cookies work: user ${meData.data?.username}`)
              setAuthState({
                isLoading: false,
                isAuthenticated: true,
                user: meData.data
              })
            } else {
              const errorData = await meResponse.json()
              addLog(`❌ /api/admin/me failed: ${JSON.stringify(errorData)}`)
            }
          } catch (error) {
            addLog(`❌ Immediate /api/admin/me error: ${error}`)
          }
        }, 100)
      }
      
    } catch (error) {
      addLog(`❌ Manual login error: ${error}`)
    }
  }

  const testLogout = async () => {
    try {
      addLog('🚪 Testing logout...')
      
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include'
      })

      addLog(`🚪 Logout response status: ${response.status}`)
      
      // Update cookies display
      setCookies(document.cookie)
      addLog(`🍪 Cookies after logout: ${document.cookie}`)
      
    } catch (error) {
      addLog(`❌ Logout error: ${error}`)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
      <h1>🔍 Authentication Debug Tool</h1>
      
      <div style={{ background: '#f0f0f0', padding: '15px', margin: '10px 0', borderRadius: '5px' }}>
        <h3>🔄 Current Auth State (Independent)</h3>
        <p><strong>Loading:</strong> {authState.isLoading.toString()}</p>
        <p><strong>Authenticated:</strong> {authState.isAuthenticated.toString()}</p>
        <p><strong>User:</strong> {authState.user?.username || 'null'}</p>
        <p><strong>User ID:</strong> {authState.user?.id || 'null'}</p>
        <button onClick={checkAuthState} style={{ padding: '5px 10px', marginTop: '10px' }}>
          🔄 Refresh Auth State
        </button>
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
        <h3>🧪 Manual Tests</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <h4>🔐 Manual Login</h4>
          <input
            type="text"
            placeholder="Username"
            value={manualLogin.username}
            onChange={(e) => setManualLogin(prev => ({ ...prev, username: e.target.value }))}
            style={{ padding: '5px', marginRight: '10px', border: '1px solid #ccc' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={manualLogin.password}
            onChange={(e) => setManualLogin(prev => ({ ...prev, password: e.target.value }))}
            style={{ padding: '5px', marginRight: '10px', border: '1px solid #ccc' }}
          />
          <button onClick={manualLoginTest} style={{ padding: '5px 10px' }}>
            🔐 Test Login
          </button>
        </div>

        <button onClick={testApiMe} style={{ padding: '10px 15px', marginRight: '10px' }}>
          🌐 Test /api/admin/me
        </button>
        
        <button onClick={testLogout} style={{ padding: '10px 15px', marginRight: '10px' }}>
          🚪 Test Logout
        </button>

        <button onClick={checkAuthState} style={{ padding: '10px 15px', marginRight: '10px' }}>
          🔄 Check Auth State
        </button>
      </div>

      {apiResponse && (
        <div style={{ background: '#f8f0e8', padding: '15px', margin: '10px 0', borderRadius: '5px' }}>
          <h3>📊 API Response</h3>
          <pre style={{ background: 'white', padding: '10px', borderRadius: '3px', overflow: 'auto' }}>
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        </div>
      )}

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