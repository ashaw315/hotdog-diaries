'use client'

import { useState, useEffect } from 'react'

export default function UltraSimplePage() {
  const [value, setValue] = useState('')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${time}] ${msg}`])
    console.log(`[ULTRA-SIMPLE] ${msg}`)
  }

  useEffect(() => {
    addLog('Component mounted')
    
    // Check for JavaScript errors
    window.addEventListener('error', (e) => {
      addLog(`JavaScript Error: ${e.message}`)
    })
    
    return () => {
      window.removeEventListener('error', () => {})
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addLog(`Input change event: "${e.target.value}"`)
    setValue(e.target.value)
  }

  const handleClick = () => {
    addLog('Input clicked')
  }

  const handleFocus = () => {
    addLog('Input focused')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    addLog(`Key pressed: ${e.key}`)
  }

  return (
    <html>
      <head>
        <title>Ultra Simple Test</title>
        <meta charSet="utf-8" />
      </head>
      <body style={{ 
        margin: 0, 
        padding: '20px', 
        fontFamily: 'Arial, sans-serif',
        backgroundColor: 'white'
      }}>
        <h1>Ultra Simple Input Test</h1>
        <p>This bypasses ALL Next.js/React complexity</p>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Raw HTML Input:
          </label>
          <input
            type="text"
            value={value}
            onChange={handleChange}
            onClick={handleClick}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Type here to test..."
            style={{
              width: '300px',
              padding: '10px',
              fontSize: '16px',
              border: '3px solid red',
              backgroundColor: 'yellow',
              color: 'black',
              fontFamily: 'monospace'
            }}
          />
        </div>

        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f0f0f0',
          border: '2px solid #333',
          marginBottom: '20px'
        }}>
          <strong>Current Value:</strong> "{value}" (length: {value.length})
        </div>

        <div style={{
          height: '200px',
          overflow: 'auto',
          backgroundColor: 'black',
          color: 'lime',
          padding: '10px',
          fontFamily: 'monospace',
          fontSize: '12px',
          border: '2px solid green'
        }}>
          <div><strong>Event Log:</strong></div>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>

        <div style={{ marginTop: '20px' }}>
          <button
            onClick={() => {
              addLog('Button clicked - setting value programmatically')
              setValue('PROGRAMMATIC_TEST')
            }}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: 'blue',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Set Value via JavaScript
          </button>
        </div>

        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#ffcccc',
          border: '2px solid red'
        }}>
          <h3>Debug Instructions:</h3>
          <ol>
            <li>Click in the yellow input field above</li>
            <li>Try typing characters</li>
            <li>Watch the event log for activity</li>
            <li>Check browser console for errors (F12)</li>
            <li>If no events fire, there's a deeper browser/OS issue</li>
          </ol>
        </div>
      </body>
    </html>
  )
}