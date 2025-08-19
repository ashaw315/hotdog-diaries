"use client";

import React, { useState } from "react";

interface FullPageCoverProps {
  onHide?: () => void;
}

export default function FullPageCover({ onHide }: FullPageCoverProps) {
  const [isSliding, setIsSliding] = useState(false);

  const handleClick = () => {
    setIsSliding(true);
    // Hide the component after animation completes
    setTimeout(() => {
      onHide?.();
    }, 800);
  };

  return (
    <>
      <style>{`
        .text-blend {
          mix-blend-mode: difference;
        }
        
        @media (min-width: 1050px) {
          .text-blend {
            mix-blend-mode: normal;
          }
        }
      `}</style>
      <div 
        onClick={handleClick}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#8B4513',
          cursor: 'pointer',
          transform: isSliding ? 'translateY(-100vh)' : 'translateY(0)',
          transition: 'transform 0.8s ease-in-out',
          zIndex: 9999,
          overflow: 'hidden'
        }}
      >
      {/* Blurred background layer */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'url(/hotdogwithmustard.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'blur(20px) grayscale(100%)',
          transform: 'scale(1.1)'
        }}
      />
      
      {/* Main image layer */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'url(/hotdogwithmustard.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          WebkitMask: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
          mask: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)'
        }}
      />
      
      {/* Left vertical text - HOTDOG */}
      <div
        className="text-blend"
        style={{
          position: 'absolute',
          left: '4vw',
          top: '50%',
          transform: 'translateY(-50%) translateX(-50%) rotate(-90deg)',
          transformOrigin: 'center center',
          fontFamily: "'Futura', 'Futura-PT', 'Avenir Next Heavy', 'Helvetica Neue', 'Arial Black', sans-serif",
          fontSize: '20vh',
          fontWeight: 900,
          color: 'white',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        HOTDOG
      </div>
      
      {/* Right vertical text - DIARIES */}
      <div
        className="text-blend"
        style={{
          position: 'absolute',
          right: '4vw',
          top: '50%',
          transform: 'translateY(-50%) translateX(50%) rotate(90deg)',
          transformOrigin: 'center center',
          fontFamily: "'Futura', 'Futura-PT', 'Avenir Next Heavy', 'Helvetica Neue', 'Arial Black', sans-serif",
          fontSize: '20vh',
          fontWeight: 900,
          color: 'white',
          letterSpacing: '0.1em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        DIARIES
      </div>
      </div>
    </>
  );
}
