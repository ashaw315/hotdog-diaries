'use client'

import { useEffect, useRef, useState } from 'react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
}

export default function LazyImage({ src, alt, className }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!imgRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { 
        threshold: 0.1, 
        rootMargin: '50px' // Start loading 50px before the image comes into view
      }
    )

    observer.observe(imgRef.current)

    return () => observer.disconnect()
  }, [])

  const handleLoad = () => {
    setIsLoaded(true)
  }

  const handleError = () => {
    setHasError(true)
    setIsLoaded(true) // Stop showing loading state
  }

  return (
    <div ref={imgRef} className={`lazy-image-container ${className || ''}`}>
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          className={`lazy-image ${isLoaded ? 'loaded' : 'loading'}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {isInView && hasError && (
        <div className="image-error">
          <div className="error-content">
            <span>📷</span>
            <span>Image unavailable</span>
          </div>
        </div>
      )}
      
      {!isLoaded && isInView && !hasError && (
        <div className="image-placeholder">
          <div className="shimmer"></div>
        </div>
      )}

      <style jsx>{`
        .lazy-image-container {
          position: relative;
          width: 100%;
          background: #f0f0f0;
          overflow: hidden;
          aspect-ratio: 16/9;
        }

        .lazy-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: opacity 0.3s ease;
        }

        .lazy-image.loading {
          opacity: 0;
        }

        .lazy-image.loaded {
          opacity: 1;
        }

        .image-placeholder {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .shimmer {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        .image-error {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          font-size: 14px;
        }

        .error-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .error-content span:first-child {
          font-size: 24px;
          opacity: 0.5;
        }

        @keyframes shimmer {
          0% { 
            background-position: -200% 0; 
          }
          100% { 
            background-position: 200% 0; 
          }
        }

        /* Ensure the container maintains aspect ratio */
        @supports not (aspect-ratio: 16/9) {
          .lazy-image-container {
            padding-bottom: 56.25%; /* 16:9 aspect ratio fallback */
            height: 0;
          }

          .lazy-image,
          .image-placeholder,
          .image-error {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
        }
      `}</style>
    </div>
  )
}