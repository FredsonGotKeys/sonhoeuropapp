'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/**
 * Wraps a section so it settles into place (fade + rise) the moment it
 * scrolls into view, instead of appearing already-rendered above the fold.
 * Falls back to instantly visible when reduced motion is requested.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  style,
}: {
  children: ReactNode
  delay?: number
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Movimento reduzido é tratado inteiramente em CSS (.reveal dentro de
    // @media prefers-reduced-motion fica logo opaco e sem transição), por isso
    // aqui não é preciso mexer em estado: chamar setState em linha no corpo do
    // efeito só provocava um render extra em cadeia.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ ...style, transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}
