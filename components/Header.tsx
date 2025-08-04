'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="container">
        <div className="flex justify-between align-center">
          <Link href="/" className="site-title">
            🌭 Hotdog Diaries
          </Link>
          
          <nav className="nav nav-horizontal mobile-menu-hidden">
            <Link href="/" className="nav-link">
              Home
            </Link>
            <Link href="/admin" className="nav-link">
              Admin
            </Link>
          </nav>

          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {isMenuOpen && (
          <nav className={`nav nav-vertical mobile-menu-hidden ${isMenuOpen ? '' : 'hidden'}`} style={{ borderTop: '1px solid var(--color-gray-light)', paddingTop: 'var(--spacing-sm)' }}>
            <Link 
              href="/" 
              className="nav-link"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link 
              href="/admin" 
              className="nav-link"
              onClick={() => setIsMenuOpen(false)}
            >
              Admin
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}