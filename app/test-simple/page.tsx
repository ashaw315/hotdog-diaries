'use client'

export default function TestSimplePage() {
  return (
    <div style={{ 
      padding: '2rem',
      fontFamily: 'Arial, sans-serif',
      lineHeight: '1.6'
    }}>
      <h1>🌭 Simple Scrolling Test</h1>
      <p>This page should scroll vertically if it has enough content.</p>
      
      {Array.from({ length: 50 }, (_, i) => (
        <div key={i} style={{ 
          padding: '1rem', 
          marginBottom: '1rem',
          backgroundColor: i % 2 === 0 ? '#f0f0f0' : '#e0e0e0',
          borderRadius: '8px'
        }}>
          <h3>Content Block {i + 1}</h3>
          <p>This is test content block number {i + 1}. If the page is scrolling properly, you should be able to scroll down to see all 50 blocks.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        </div>
      ))}
      
      <div style={{ 
        padding: '2rem',
        backgroundColor: '#4ade80',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '1.2rem',
        fontWeight: 'bold'
      }}>
        🎉 If you can see this, the page scrolls correctly!
      </div>
    </div>
  )
}