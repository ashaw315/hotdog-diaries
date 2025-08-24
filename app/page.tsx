'use client'

import { useState, useEffect, Suspense } from 'react'
import CinematicIntro from '@/components/CinematicIntro'
import AdaptiveTikTokFeed from '@/components/AdaptiveTikTokFeed'
import HandwrittenSVG from '@/components/HandwrittenSVG'
import HotdogDiariesLogoMouseGradient from '@/components/HotdogDiariesLogoMouseGradient'
import ErrorBoundary from '@/components/ErrorBoundary'

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">🌭</div>
        <p className="text-xl text-gray-700">Loading Hotdog Content...</p>
      </div>
    </div>
  );
}

export default function Page() {
  const [showIntro, setShowIntro] = useState(false) // Skip intro, show loader immediately
  const [showCover, setShowCover] = useState(false) // Skip cover, show loader immediately
  
  useEffect(() => {
    try {
      // Check if user has seen the cinematic intro
      const hasSeenIntro = localStorage.getItem('hasSeenCinematicIntro')
      if (hasSeenIntro) {
        setShowIntro(false)
      }
      
      // Auto-hide intro after 6 seconds (cinematic intro duration)
      const timer = setTimeout(() => setShowIntro(false), 6000)
      return () => clearTimeout(timer)
    } catch (error) {
      console.error('Error initializing page:', error);
      // Continue with default values
    }
  }, [])

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        {/* Feed loads immediately in background */}
        <main 
          className="min-h-screen transition-all duration-1000 feed-container opacity-100 scale-100"
          style={{ zIndex: 1 }}
        >
          <ErrorBoundary>
            <AdaptiveTikTokFeed />
          </ErrorBoundary>
        </main>
        
        {/* Cover overlays on top while feed loads behind */}
        {showCover && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
            <ErrorBoundary>
              <HandwrittenSVG onHide={() => setShowCover(false)} />
            </ErrorBoundary>
          </div>
        )}
        
        {/* Intro overlays after cover is dismissed */}
        {!showCover && showIntro && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }}>
            <ErrorBoundary>
              <CinematicIntro />
            </ErrorBoundary>
          </div>
        )}
        
        {/* Logo overlays after intro */}
        {!showCover && !showIntro && (
          <ErrorBoundary>
            <HotdogDiariesLogoMouseGradient />
          </ErrorBoundary>
        )}
      </Suspense>
    </ErrorBoundary>
  )
}