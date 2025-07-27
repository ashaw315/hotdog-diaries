export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <h2 className="text-xl font-semibold text-primary mb-2">Loading Hotdog Diaries</h2>
        <p className="text-text opacity-60">Getting your hotdog content ready...</p>
      </div>
    </div>
  )
}