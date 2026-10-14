'use client'

import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function Hero() {
  const [images, setImages] = useState<string[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    async function fetchFeaturedImages() {
      const { data, error } = await supabase
        .from('products')
        .select('image')
        .order('created_at', { ascending: false })
        .limit(6)

      const withImage = (data || []).filter((p) => Boolean(p.image))
      if (!error && withImage.length > 0) {
        setImages(withImage.map((p) => p.image))
      } else {
        setImages(['/hero-texture.jpeg'])
      }
    }
    fetchFeaturedImages()
  }, [])

  useEffect(() => {
    if (images.length <= 1) return
    const interval = setInterval(() => {
      setIsFading(true)
      setTimeout(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length)
        setIsFading(false)
      }, 500)
    }, 4500)
    return () => clearInterval(interval)
  }, [images])

  return (
    <section id="home" className="relative min-h-[92vh] overflow-hidden border-b border-white/5">
      {/* Imágenes de fondo full-bleed con crossfade */}
      {images.map((img, index) => (
        <div
          key={img + index}
          className={`absolute inset-0 transition-all duration-[1200ms] ease-out ${
            index === currentImageIndex
              ? 'scale-100 opacity-100'
              : 'scale-105 opacity-0'
          }`}
          style={{
            backgroundImage: `url('${img}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
          }}
          aria-hidden="true"
        />
      ))}

      {/* Scrim editorial: oscuro abajo/izquierda para tipografía legible */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent"
        aria-hidden="true"
      />

      {/* Contenido */}
      <div className="relative mx-auto flex min-h-[92vh] max-w-[1600px] flex-col justify-end px-5 pb-16 md:px-8 md:pb-24">
        <div className={`max-w-3xl transition-all duration-500 ${isFading ? 'opacity-40' : 'opacity-100'}`}>
          <p className="rs-fade-up inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-primary">
            <span className="h-px w-8 bg-primary" />
            Colección 2026
          </p>

          <h1
            className="rs-fade-up mt-4 font-heading font-black uppercase leading-[0.88] tracking-tight"
            style={{ animationDelay: '0.1s' }}
          >
            <span className="block text-[15vw] sm:text-[11vw] md:text-[8vw] lg:text-[7.5vw]">
              Step Into
            </span>
            <span className="block text-[15vw] text-primary sm:text-[11vw] md:text-[8vw] lg:text-[7.5vw]">
              Reality
            </span>
          </h1>

          <p
            className="rs-fade-up mt-5 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base"
            style={{ animationDelay: '0.2s' }}
          >
            Suficiente calidad para igualar la originalidad. Zapatillas, perfumes y accesorios premium seleccionados para ti.
          </p>

          <div
            className="rs-fade-up mt-8 flex flex-wrap items-center gap-4"
            style={{ animationDelay: '0.3s' }}
          >
            <a
              href="#catalog"
              className="group inline-flex items-center gap-3 rounded-full bg-foreground px-8 py-4 font-heading text-xs font-black uppercase tracking-widest text-background transition-all duration-300 hover:bg-primary hover:text-white"
            >
              Comprar ahora
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
            <a
              href="#offers"
              className="inline-flex items-center gap-2 border-b border-foreground/30 pb-1 text-xs font-bold uppercase tracking-widest text-foreground/70 transition-colors hover:border-primary hover:text-primary"
            >
              Ver ofertas
            </a>
          </div>
        </div>
      </div>

      {/* Indicadores de slide minimalistas */}
      {images.length > 1 && (
        <div className="absolute bottom-6 right-6 z-10 flex items-center gap-2 md:right-10">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentImageIndex(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-[3px] rounded-full transition-all duration-500 ${
                idx === currentImageIndex ? 'w-8 bg-primary' : 'w-3 bg-white/25 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
