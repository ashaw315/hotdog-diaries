'use client'

import { useState, useRef, useEffect, TouchEvent } from 'react'

interface ImageCarouselProps {
  images: string[]
  alt?: string
  source_platform?: string
  original_url?: string
}

export default function ImageCarousel({ images, alt = 'Gallery image', source_platform, original_url }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Minimum swipe distance to trigger change (in pixels)
  const minSwipeDistance = 50

  const goToNext = () => {
    if (currentIndex < images.length - 1 && !isTransitioning) {
      setIsTransitioning(true)
      setCurrentIndex(currentIndex + 1)
      setTimeout(() => setIsTransitioning(false), 300)
    }
  }

  const goToPrevious = () => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true)
      setCurrentIndex(currentIndex - 1)
      setTimeout(() => setIsTransitioning(false), 300)
    }
  }

  const handleTouchStart = (e: TouchEvent) => {
    setTouchEnd(0) // Reset touch end
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      goToNext()
    }
    if (isRightSwipe) {
      goToPrevious()
    }
  }

  const goToSlide = (index: number) => {
    if (!isTransitioning) {
      setIsTransitioning(true)
      setCurrentIndex(index)
      setTimeout(() => setIsTransitioning(false), 300)
    }
  }

  // Get proxy URL if needed for Pixabay/Bluesky
  const getImageUrl = (url: string): string => {
    if (source_platform === 'pixabay' && original_url) {
      return `/api/proxy/pixabay-image?url=${encodeURIComponent(url)}&page=${encodeURIComponent(original_url)}`
    }
    if (source_platform === 'bluesky') {
      return `/api/proxy/bluesky-image?url=${encodeURIComponent(url)}`
    }
    return url
  }

  return (
    <div className="image-carousel-container" ref={containerRef}>
      <div
        className="image-carousel-track"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(-${currentIndex * 100}%)`,
          transition: isTransitioning ? 'transform 0.3s ease-out' : 'none'
        }}
      >
        {images.map((imageUrl, index) => (
          <div key={index} className="image-carousel-slide">
            <img
              src={getImageUrl(imageUrl)}
              alt={`${alt} ${index + 1}`}
              className="carousel-image"
              loading={index === 0 ? 'eager' : 'lazy'}
              onError={(e) => {
                const target = e.target as HTMLImageElement
                // Fallback to original URL if proxy fails
                if (target.src !== imageUrl && !target.src.includes('placeholder')) {
                  target.src = imageUrl
                }
              }}
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrows (Desktop) */}
      {images.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              className="carousel-nav carousel-nav-prev"
              onClick={goToPrevious}
              aria-label="Previous image"
            >
              ‹
            </button>
          )}
          {currentIndex < images.length - 1 && (
            <button
              className="carousel-nav carousel-nav-next"
              onClick={goToNext}
              aria-label="Next image"
            >
              ›
            </button>
          )}
        </>
      )}

      {/* Dot Indicators */}
      {images.length > 1 && (
        <div className="carousel-indicators">
          {images.map((_, index) => (
            <button
              key={index}
              className={`carousel-indicator ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Image Counter */}
      {images.length > 1 && (
        <div className="carousel-counter">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      <style jsx>{`
        .image-carousel-container {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #000;
        }

        .image-carousel-track {
          display: flex;
          height: 100%;
          width: 100%;
        }

        .image-carousel-slide {
          min-width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .carousel-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          user-select: none;
        }

        .carousel-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0, 0, 0, 0.5);
          color: white;
          border: none;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          font-size: 32px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: background 0.2s;
        }

        .carousel-nav:hover {
          background: rgba(0, 0, 0, 0.7);
        }

        .carousel-nav-prev {
          left: 10px;
        }

        .carousel-nav-next {
          right: 10px;
        }

        .carousel-indicators {
          position: absolute;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 10;
        }

        .carousel-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: all 0.2s;
          padding: 0;
        }

        .carousel-indicator.active {
          background: white;
          width: 24px;
          border-radius: 4px;
        }

        .carousel-counter {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          z-index: 10;
          backdrop-filter: blur(4px);
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .carousel-nav {
            display: none; /* Hide arrows on mobile, use swipe */
          }

          .carousel-indicators {
            bottom: 50px;
            gap: 6px;
          }

          .carousel-indicator {
            width: 6px;
            height: 6px;
          }

          .carousel-indicator.active {
            width: 20px;
          }

          .carousel-counter {
            top: 10px;
            right: 10px;
            font-size: 12px;
            padding: 3px 10px;
          }
        }
      `}</style>
    </div>
  )
}
