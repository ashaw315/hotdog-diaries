'use client'

import { useState } from 'react'

export default function SimpleTestPage() {
  const [value, setValue] = useState('')

  return (
    <div style={{ 
      padding: '50px', 
      backgroundColor: 'white',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>Minimal Input Test</h1>
      <p>This is the most basic input test possible.</p>
      
      {/* Zero CSS interference input */}
      <div style={{ margin: '20px 0' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Basic HTML Input (no CSS classes):
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type here..."
          style={{
            width: '300px',
            padding: '10px',
            fontSize: '16px',
            border: '2px solid #000',
            backgroundColor: '#fff',
            color: '#000'
          }}
        />
      </div>

      <div style={{ 
        padding: '15px', 
        backgroundColor: '#f0f0f0',
        border: '1px solid #ccc',
        marginTop: '20px'
      }}>
        <strong>Current Value:</strong> &quot;{value}&quot;
      </div>

      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={() => setValue('test123')}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Set Value Programmatically
        </button>
      </div>

      <div style={{ 
        marginTop: '30px',
        padding: '15px',
        backgroundColor: '#fffacd',
        border: '1px solid #ffd700'
      }}>
        <h3>Test Instructions:</h3>
        <ol>
          <li>Click in the input field above</li>
          <li>Type some characters</li>
          <li>Check if the &quot;Current Value&quot; updates</li>
          <li>Try the &quot;Set Value Programmatically&quot; button</li>
        </ol>
        <p><strong>If this doesn&apos;t work, the issue is fundamental browser/React configuration.</strong></p>
      </div>
    </div>
  )
}