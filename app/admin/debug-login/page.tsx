'use client'

import { useState, useEffect, useRef } from 'react'

export default function DebugLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(`[DEBUG] ${message}`)
  }

  useEffect(() => {
    addLog('Component mounted')
    
    // Check if refs are attached
    if (usernameRef.current) {
      addLog(`Username input ref attached: ${usernameRef.current.tagName}`)
      
      // Check computed styles
      const styles = window.getComputedStyle(usernameRef.current)
      addLog(`Username input styles:`)
      addLog(`  - display: ${styles.display}`)
      addLog(`  - visibility: ${styles.visibility}`)
      addLog(`  - opacity: ${styles.opacity}`)
      addLog(`  - pointerEvents: ${styles.pointerEvents}`)
      addLog(`  - userSelect: ${styles.userSelect}`)
      addLog(`  - position: ${styles.position}`)
      addLog(`  - zIndex: ${styles.zIndex}`)
      addLog(`  - backgroundColor: ${styles.backgroundColor}`)
      addLog(`  - color: ${styles.color}`)
      addLog(`  - disabled: ${usernameRef.current.disabled}`)
      addLog(`  - readOnly: ${usernameRef.current.readOnly}`)
      
      // Check for overlapping elements
      const rect = usernameRef.current.getBoundingClientRect()
      const elementsAtPoint = document.elementsFromPoint(rect.left + rect.width/2, rect.top + rect.height/2)
      addLog(`Elements at input center: ${elementsAtPoint.length}`)
      elementsAtPoint.forEach((el, i) => {
        addLog(`  ${i}: ${el.tagName}.${el.className}`)
      })
    }
    
    // Add event listeners to detect events
    const handleFocus = () => addLog('Input focused')
    const handleBlur = () => addLog('Input blurred')
    const handleClick = () => addLog('Input clicked')
    const handleKeyDown = (e: KeyboardEvent) => addLog(`Key pressed: ${e.key}`)
    const handleInput = () => addLog('Input event fired')
    const handleChange = () => addLog('Change event fired')
    
    if (usernameRef.current) {
      usernameRef.current.addEventListener('focus', handleFocus)
      usernameRef.current.addEventListener('blur', handleBlur)
      usernameRef.current.addEventListener('click', handleClick)
      usernameRef.current.addEventListener('keydown', handleKeyDown)
      usernameRef.current.addEventListener('input', handleInput)
      usernameRef.current.addEventListener('change', handleChange)
    }
    
    // Check for global event blockers
    const globalClickHandler = (e: MouseEvent) => {
      if (e.defaultPrevented) {
        addLog(`Global click prevented at ${e.target}`)
      }
    }
    document.addEventListener('click', globalClickHandler, true)
    
    return () => {
      if (usernameRef.current) {
        usernameRef.current.removeEventListener('focus', handleFocus)
        usernameRef.current.removeEventListener('blur', handleBlur)
        usernameRef.current.removeEventListener('click', handleClick)
        usernameRef.current.removeEventListener('keydown', handleKeyDown)
        usernameRef.current.removeEventListener('input', handleInput)
        usernameRef.current.removeEventListener('change', handleChange)
      }
      document.removeEventListener('click', globalClickHandler, true)
    }
  }, [])

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addLog(`Username onChange triggered: "${e.target.value}"`)
    setUsername(e.target.value)
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addLog(`Password onChange triggered: "${e.target.value}"`)
    setPassword(e.target.value)
  }

  const testProgrammaticInput = () => {
    if (usernameRef.current) {
      addLog('Testing programmatic input...')
      usernameRef.current.value = 'test123'
      addLog(`Programmatically set value to: ${usernameRef.current.value}`)
      
      // Try to trigger change event
      const event = new Event('input', { bubbles: true })
      usernameRef.current.dispatchEvent(event)
      addLog('Dispatched input event')
    }
  }

  const focusInput = () => {
    if (usernameRef.current) {
      addLog('Attempting to focus input...')
      usernameRef.current.focus()
      addLog(`Input is focused: ${document.activeElement === usernameRef.current}`)
    }
  }

  const checkForBlockingElements = () => {
    if (usernameRef.current) {
      const rect = usernameRef.current.getBoundingClientRect()
      const element = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2)
      addLog(`Element at input position: ${element?.tagName}.${element?.className}`)
      addLog(`Is it the input? ${element === usernameRef.current}`)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Debug Login Form</h1>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px',
        marginTop: '20px'
      }}>
        {/* Left side - Form */}
        <div style={{ 
          border: '2px solid blue', 
          padding: '20px',
          backgroundColor: 'white'
        }}>
          <h2>Input Form</h2>
          
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="debug-username">Username:</label>
            <br />
            <input
              ref={usernameRef}
              id="debug-username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="Type here..."
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '2px solid red',
                backgroundColor: 'white',
                color: 'black',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="debug-password">Password:</label>
            <br />
            <input
              ref={passwordRef}
              id="debug-password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="Type here..."
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '2px solid red',
                backgroundColor: 'white',
                color: 'black',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ 
            padding: '10px', 
            backgroundColor: '#f0f0f0',
            marginTop: '10px'
          }}>
            <strong>Current Values:</strong>
            <br />
            Username: &quot;{username}&quot;
            <br />
            Password: &quot;{password}&quot;
          </div>

          <div style={{ marginTop: '15px' }}>
            <button 
              onClick={testProgrammaticInput}
              style={{
                padding: '8px 16px',
                marginRight: '10px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Test Programmatic Input
            </button>
            
            <button 
              onClick={focusInput}
              style={{
                padding: '8px 16px',
                marginRight: '10px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Focus Input
            </button>
            
            <button 
              onClick={checkForBlockingElements}
              style={{
                padding: '8px 16px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Check Blocking Elements
            </button>
          </div>
        </div>

        {/* Right side - Logs */}
        <div style={{ 
          border: '2px solid green', 
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2>Debug Logs</h2>
          <div style={{
            height: '400px',
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

      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#fffacd',
        border: '1px solid #ffd700'
      }}>
        <h3>Instructions:</h3>
        <ol>
          <li>Try clicking on the username input (red border)</li>
          <li>Try typing - watch the logs on the right</li>
          <li>Click &quot;Test Programmatic Input&quot; to see if JS can set values</li>
          <li>Click &quot;Focus Input&quot; to programmatically focus</li>
          <li>Click &quot;Check Blocking Elements&quot; to see what&apos;s at the input position</li>
        </ol>
        <p><strong>Check browser console for additional &quot;[DEBUG]&quot; messages</strong></p>
      </div>
    </div>
  )
}