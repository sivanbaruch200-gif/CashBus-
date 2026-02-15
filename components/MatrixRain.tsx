'use client'

// Ambient gradient mesh background — replaces the old canvas MatrixRain
// Provides a subtle, premium visual layer without distracting animations

interface AmbientBackgroundProps {
  opacity?: number
}

export default function MatrixRain({ opacity = 0.6 }: AmbientBackgroundProps) {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ opacity, zIndex: 0 }}
    >
      {/* Primary radial gradient — warm amber glow */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(217, 119, 6, 0.08) 0%, transparent 60%)',
        }}
      />
      {/* Secondary gradient — subtle cool balance */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 70% 80%, rgba(113, 113, 122, 0.06) 0%, transparent 50%)',
        }}
      />
      {/* Fine noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
