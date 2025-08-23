'use client'

import { useState } from 'react'

export default function TestLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = () => {
    alert(`Username: ${username}\nPassword: ${password}\n\nActual credentials:\nUsername: admin\nPassword: StrongAdminPass123!`)
  }

  return (
    <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Test Login Form</h1>
      <p>Can you type in these inputs?</p>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          Username:
          <br />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '16px',
              border: '1px solid #ccc'
            }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>
          Password:
          <br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '16px',
              border: '1px solid #ccc'
            }}
          />
        </label>
      </div>

      <button 
        onClick={handleLogin}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Test Login
      </button>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <p>Current values:</p>
        <p>Username: {username || '(empty)'}</p>
        <p>Password: {password || '(empty)'}</p>
      </div>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#fffacd' }}>
        <p><strong>Real Admin Credentials:</strong></p>
        <p>Username: admin</p>
        <p>Password: StrongAdminPass123!</p>
        <p>URL: http://localhost:3001/admin/login</p>
      </div>
    </div>
  )
}