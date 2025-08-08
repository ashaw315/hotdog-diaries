'use client'

import Link from 'next/link'

export default function Header() {
  return (
    <header className="feed-header">
      <div className="feed-header-content">
        <Link href="/" className="feed-logo">
          <span>🌭</span>
          <span>Hotdog Diaries</span>
        </Link>
      </div>
      
      <style jsx>{`
        .feed-header {
          background: linear-gradient(180deg, var(--bun-light) 0%, var(--bun-medium) 100%);
          padding: 8px 16px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .feed-header-content {
          max-width: var(--max-width);
          margin: 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .feed-logo {
          font-size: 20px;
          font-weight: bold;
          color: var(--text-on-bun);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: color 0.2s ease;
        }

        .feed-logo:hover {
          color: var(--bun-dark);
        }

        @media (max-width: 768px) {
          .feed-header {
            padding: 6px 12px;
          }
          
          .feed-logo {
            font-size: 18px;
          }
        }
      `}</style>
    </header>
  )
}