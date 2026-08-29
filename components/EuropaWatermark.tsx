import { Star } from 'lucide-react'

/**
 * Decorative ring of stars echoing the EU flag, used as a faint background
 * texture on dark sections. Pure server-render (no hooks) — the drift comes
 * from a CSS keyframe on the wrapper, not JS animation.
 */
export function EuropaWatermark({
  size = 480,
  color = '#FFCC00',
  opacity = 0.08,
  className = '',
}: {
  size?: number
  color?: string
  opacity?: number
  className?: string
}) {
  const starCount = 12
  const radius = size * 0.42
  const starSize = size * 0.09

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ width: size, height: size, zIndex: 0 }}
    >
      <div className="watermark-spin" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: starCount }).map((_, i) => {
          const angle = (i / starCount) * 2 * Math.PI - Math.PI / 2
          // Fixed precision so the server-rendered and client-hydrated
          // inline style strings match exactly — raw float output can
          // otherwise differ by a trailing digit and trip a hydration warning.
          const x = (size / 2 + radius * Math.cos(angle) - starSize / 2).toFixed(2)
          const y = (size / 2 + radius * Math.sin(angle) - starSize / 2).toFixed(2)
          return (
            <Star
              key={i}
              width={starSize}
              height={starSize}
              fill={color}
              strokeWidth={0}
              style={{ position: 'absolute', left: `${x}px`, top: `${y}px`, color, opacity }}
            />
          )
        })}
      </div>
    </div>
  )
}
