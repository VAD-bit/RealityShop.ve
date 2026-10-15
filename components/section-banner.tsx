'use client'

import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

interface SectionBannerProps {
  images: string[]
  eyebrow?: string
  title: string
  highlight?: string
  subtitle?: string
  ctaLabel?: string
  ctaHref?: string
  height?: 'sm' | 'md' | 'lg'
  background?: string
}

const HEIGHTS = {
  sm: 'min-h-[320px] md:min-h-[360px]',
  md: 'min-h-[400px] md:min-h-[440px]',
  lg: 'min-h-[500px] md:min-h-[560px]',
}

export function SectionBanner({
  images,
  eyebrow,
  title,
  highlight,
  subtitle,
  ctaLabel,
  ctaHref,
  height = 'md',
  background = '/banner-fondo.png',
}: SectionBannerProps) {
  const clean = images.filter(Boolean).slice(0, 8)
  const [current, setCurrent] = useState(0)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    if (clean.length <= 1) return
    const timer = setInterval(() => {
      setIsFading(true)
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % clean.length)
        setIsFading(false)
      }, 600)
    }, 4500)
    return () => clearInterval(timer)
  }, [clean.length])

  return (
    <section className={`relative overflow-hidden ${HEIGHTS[height]}`}>
      {/* Fondo extendido horizontalmente */}
      <div
        className="absolute inset-0 bg-[#0c0c0e]"
        aria-hidden="true"
        style={{
          backgroundImage: `url('${background}')`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Slideshow de zapatos encima (+20% de tamaño) */}
      {clean.length > 0 && (
        <div className="absolute inset-0" aria-hidden="true">
          {clean.map((img, i) => (
            <div
              key={`${img}-${i}`}
              className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${
                i === current ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div
                className="absolute inset-0 transition-transform duration-[1400ms] ease-out"
                style={{
                  backgroundImage: `url('${img}')`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center right 8%',
                  backgroundRepeat: 'no-repeat',
                  transform: i === current ? 'scale(1.2)' : 'scale(1.25)',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Scrim para legibilidad */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-background/30"
        aria-hidden="true"
      />

      {/* Indicadores */}
      {clean.length > 1 && (
        <div className="absolute bottom-5 right-6 z-10 flex items-center gap-2 md:right-10">
          {clean.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setIsFading(true)
                setTimeout(() => {
                  setCurrent(idx)
                  setIsFading(false)
                }, 300)
              }}
              aria-label={`Slide ${idx + 1}`}
              className={`h-[3px] rounded-full transition-all duration-500 ${
                idx === current ? 'w-8 bg-primary' : 'w-3 bg-white/25 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}

      {/* Contenido */}
      <div className="relative mx-auto flex h-full max-w-[1600px] items-center px-5 py-16 md:px-8 md:py-20">
        <div
          className={`max-w-xl transition-opacity duration-500 ${isFading ? 'opacity-40' : 'opacity-100'}`}
        >
          {eyebrow && (
            <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-primary">
              <span className="h-px w-8 bg-primary" />
              {eyebrow}
            </p>
          )}

          <h2 className="mt-3 font-heading text-4xl font-black uppercase leading-none tracking-tight md:text-5xl lg:text-6xl">
            {title}
            {highlight && (
              <>
                <br />
                <span className="text-primary">{highlight}</span>
              </>
            )}
          </h2>

          {subtitle && (
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}

          {ctaLabel && ctaHref && (
            <a
              href={ctaHref}
              className="group mt-7 inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-3.5 font-heading text-xs font-black uppercase tracking-widest text-background transition-all duration-300 hover:bg-primary hover:text-white"
            >
              {ctaLabel}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
