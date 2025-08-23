'use client'

import { useState, useEffect } from 'react'

export default function DebugAuthPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [cookies, setCookies] = useState<string>('')
  const [apiResponse, setApiResponse] = useState<any>(null)

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${time}] ${msg}`])
    console.log(`[AUTH-DEBUG] ${msg}`)
  }

  useEffect(() => {
    addLog('Auth debug page loaded')
    
    // Check cookies
    const allCookies = document.cookie
    setCookies(allCookies)
    addLog(`Document cookies: ${allCookies}`)
    
    // Test /api/admin/me
    testApiMe()
  }, [])

  const testApiMe = async () => {
    try {
      addLog('Testing /api/admin/me...')
      const response = await fetch('/api/admin/me', {
        method: 'GET',
        credentials: 'include', // Important for cookies
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      addLog(`Response status: ${response.status}`)
      
      const data = await response.json()
      setApiResponse(data)
      addLog(`Response data: ${JSON.stringify(data)}`)
      
    } catch (error) {
      addLog(`API error: ${error}`)
      setApiResponse({ error: error.message })
    }
  }

  const testLogin = async () => {
    try {
      addLog('Testing manual login...')
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'StrongAdminPass123!'
        })
      })
      
      addLog(`Login response status: ${response.status}`)
      const data = await response.json()
      addLog(`Login response: ${JSON.stringify(data)}`)
      
      // Check cookies after login
      const newCookies = document.cookie
      setCookies(newCookies)
      addLog(`Cookies after login: ${newCookies}`)
      
      // Test /api/admin/me again
      setTimeout(() => {
        testApiMe()
      }, 1000)
      
    } catch (error) {
      addLog(`Login error: ${error}`)
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Authentication Debug</h1>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px',
        marginTop: '20px'
      }}>
        {/* Left: Controls */}
        <div style={{ 
          border: '2px solid blue', 
          padding: '20px',
          backgroundColor: 'white'
        }}>
          <h2>Test Controls</h2>
          
          <button
            onClick={testApiMe}
            style={{
              padding: '10px 20px',
              marginBottom: '10px',
              marginRight: '10px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Test /api/admin/me
          </button>
          
          <button
            onClick={testLogin}
            style={{
              padding: '10px 20px',
              marginBottom: '10px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Test Login + API
          </button>
          
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc'
          }}>
            <h3>Current Cookies:</h3>
            <pre style={{ fontSize: '12px', wordBreak: 'break-all' }}>
              {cookies || '(no cookies)'}
            </pre>
          </div>
          
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#f0f8ff',
            border: '1px solid #ccc'
          }}>
            <h3>API Response:</h3>
            <pre style={{ fontSize: '12px' }}>
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          </div>
        </div>

        {/* Right: Logs */}
        <div style={{ 
          border: '2px solid green', 
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2>Debug Logs</h2>
          <div style={{
            height: '500px',
            overflow: 'auto',
            backgroundColor: 'black',
            color: 'lime',
            padding: '10px',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
          
          <button 
            onClick={() => setLogs([])}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Clear Logs
          </button>
        </div>
      </div>
    </div>
  )
}