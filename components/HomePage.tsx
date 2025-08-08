'use client'

import MobileFeedContent from '@/components/ui/MobileFeedContent'

export default function HomePage() {
  return (
    <div className="mobile-feed-container">
      <MobileFeedContent />
      
      {/* Mini features footer */}
      <footer className="feed-features">
        <div className="features-mini">
          <span>🌭 6x Daily</span>
          <span>🔍 Smart Curation</span>
          <span>📱 Mobile Ready</span>
        </div>
      </footer>
      
      <style jsx>{`
        .mobile-feed-container {
          max-width: var(--max-width);
          margin: 0 auto;
          padding: 0;
        }

        .feed-features {
          margin-top: 40px;
          padding: 20px;
          background: #f5f5f5;
          text-align: center;
        }

        .features-mini {
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
          font-size: 12px;
          color: #666;
        }

        @media (max-width: 768px) {
          .mobile-feed-container {
            padding: 0;
          }
          
          .feed-features {
            margin-top: 20px;
            padding: 15px;
          }

          .features-mini {
            gap: 15px;
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  )
}