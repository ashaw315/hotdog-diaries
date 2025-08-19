import { useEffect, useRef } from "react";

/**
 * Hotdog Diaries — Mouse-Reactive Logo (Top-Left)
 * -------------------------------------------------------------
 * Changes from previous version:
 * - Positions the logo as a small, upper-left corner lockup
 * - Removes near-black; uses hotdog palette (ketchup/mustard/bun/relish)
 * - Gradient axis biased to the logo area (not screen center)
 * - Lightweight, no deps
 */

export default function HotdogDiariesLogoMouseGradient() {
  const wrapRef = useRef(null);

  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;

    let rafId = 0;
    let lastEvt = null;

    // bias target around the logo itself rather than screen center
    // anchor ~10% x, 12% y (near top-left), and mix with pointer
    const ANCHOR_X = 0.12;
    const ANCHOR_Y = 0.10;
    const MIX = 0.55; // 0..1 (higher = more mouse influence)

    const update = () => {
      rafId = 0;
      if (!lastEvt) return;
      const rect = document.documentElement.getBoundingClientRect();
      const px = lastEvt.clientX / window.innerWidth; // 0..1
      const py = lastEvt.clientY / window.innerHeight; // 0..1
      const x = (1 - MIX) * ANCHOR_X + MIX * px;
      const y = (1 - MIX) * ANCHOR_Y + MIX * py;
      const ang = Math.atan2(y - ANCHOR_Y, x - ANCHOR_X) * (180 / Math.PI);
      root.style.setProperty("--mx", `${(x * 100).toFixed(2)}%`);
      root.style.setProperty("--my", `${(y * 100).toFixed(2)}%`);
      root.style.setProperty("--ang", `${ang.toFixed(2)}deg`);
    };

    const onPointerMove = (e) => {
      lastEvt = e;
      if (!rafId) rafId = requestAnimationFrame(update);
    };

    const onPointerLeave = () => {
      // ease toward anchor near the logo
      root.style.setProperty("--mx", `${ANCHOR_X * 100}%`);
      root.style.setProperty("--my", `${ANCHOR_Y * 100}%`);
      root.style.setProperty("--ang", `0deg`);
    };

    // Listen to mouse events on the document instead of the root element
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerleave", onPointerLeave);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="logo-stage fixed top-5 left-6 w-fit h-fit pointer-events-none z-50"
      aria-label="Hotdog Diaries logo with mouse-reactive colors"
    >
      {/* Logo lockup in the top-left */}
      <div className="relative pointer-events-auto"
        style={{
          lineHeight: 0.86,
          letterSpacing: "-0.025em",
          fontFamily:
            "'Futura-PT','Futura','Avenir Next Heavy','Helvetica Neue','Arial Black',system-ui,sans-serif",
        }}
      >
        <h1
          className="font-black uppercase select-none"
          style={{
            fontSize: "clamp(1.25rem, 4vw, 3rem)", // logo scale
            background:
              "conic-gradient(from var(--ang,0deg) at var(--mx,12%) var(--my,10%), var(--ketchup) 0 18%, var(--mustard) 18% 40%, var(--bun) 40% 70%, var(--relish) 70% 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          HOTDOG
          <br />
          DIARIES
        </h1>
      </div>

      {/* Local styles */}
      <style>{`
        .logo-stage {
          /* Hotdog palette (no near-black in the gradient) */
          --ketchup: #e52b2b;
          --mustard: #ffd21f;
          --bun: #d9a86c;
          --relish: #3fa652;
          --mx: 12%;
          --my: 10%;
          --ang: 0deg;
          pointer-events: none;
        }

        /* Subtle idle shimmer on the logo only */
        @media (prefers-reduced-motion: no-preference) {
          .logo-stage h1 { 
            animation: idleShimmer 7s ease-in-out infinite; 
            will-change: background; 
          }
        }
        @keyframes idleShimmer {
          0%, 100% { filter: saturate(1) contrast(1); }
          50% { filter: saturate(1.15) contrast(1.08); }
        }
      `}</style>
    </div>
  );
}