'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Search, ShoppingBag, X, Menu, User } from 'lucide-react'
import { useCart } from '@/components/cart-context'
import { supabase } from '@/lib/supabase'

const NAV_LINKS = [
  { label: 'Novedades', href: '#new-collection' },
  { label: 'Zapatillas', href: '#catalog' },
  { label: 'Ofertas', href: '#offers' },
]

interface HeaderProps {
  query?: string
  onQueryChange?: (query: string) => void
}

export function Header({ query = '', onQueryChange }: HeaderProps) {
  const { count, openCart } = useCart()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [productsList, setProductsList] = useState<any[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadProducts() {
      try {
        const { data, error } = await supabase.from('products').select('*')
        if (!error && data) setProductsList(data)
      } catch (err) {
        console.error('Error cargando productos:', err)
      }
    }
    loadProducts()
  }, [])

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFocused(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const suggestions =
    query.trim() === ''
      ? []
      : productsList
          .filter((item) => {
            const q = query.toLowerCase().trim()
            const name = String(item.name || '').toLowerCase()
            const category = String(item.category || '').toLowerCase()
            const sub = String(item.subcategory || '').toLowerCase()
            return name.includes(q) || category.includes(q) || sub.includes(q)
          })
          .slice(0, 6)

  const handleSelectProduct = (productId: string) => {
    setIsFocused(false)
    setTimeout(() => {
      const target = document.getElementById(`product-${productId}`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.classList.add('ring-2', 'ring-foreground', 'ring-offset-2', 'ring-offset-background')
        setTimeout(() => {
          target.classList.remove('ring-2', 'ring-foreground', 'ring-offset-2', 'ring-offset-background')
        }, 2500)
      } else {
        document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })
      }
    }, 100)
  }

  return (
    <>
      {/* Ticker superior tipo Nike */}
      <div className="overflow-hidden border-b border-white/10 bg-foreground text-background">
        <div className="rs-marquee flex w-max gap-12 py-2 text-[10px] font-black uppercase tracking-[0.2em]">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="flex items-center gap-12 whitespace-nowrap">
              Envíos a todo Venezuela
              <span className="text-primary">•</span>
              Step Into Reality
              <span className="text-primary">•</span>
              Calidad Premium
              <span className="text-primary">•</span>
              Pago Móvil · Zelle · Binance
              <span className="text-primary">•</span>
            </span>
          ))}
        </div>
      </div>

      <header
        className={`sticky top-0 z-40 border-b transition-all duration-300 ${
          isScrolled
            ? 'border-white/10 bg-background/95 backdrop-blur-xl'
            : 'border-transparent bg-background'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-5 md:h-[72px] md:px-8">
          {/* LOGO */}
          <a href="#home" className="flex shrink-0 items-center gap-2">
            <img
              src="/Realityshop.png"
              alt="Reality Shop"
              className="h-9 w-auto object-contain md:h-10"
            />
          </a>

          {/* NAV DESKTOP — estilo Nike: minimal, uppercase, hover underline */}
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Navegación principal">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="group relative py-1 text-[13px] font-bold uppercase tracking-wide text-foreground/80 transition-colors hover:text-foreground"
              >
                {link.label}
                <span className="absolute -bottom-0.5 left-0 h-[2px] w-0 bg-primary transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>

          {/* ACCIONES */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Buscador */}
            <div ref={containerRef} className="relative w-full max-w-[220px] md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  onQueryChange?.(e.target.value)
                  setIsFocused(true)
                }}
                onFocus={() => setIsFocused(true)}
                placeholder="Buscar"
                className="h-10 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-8 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:bg-white/8"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    onQueryChange?.('')
                    setIsFocused(false)
                  }}
                  aria-label="Limpiar"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}

              {isFocused && query.trim() && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 w-[300px] overflow-y-auto rounded-2xl border border-white/10 bg-popover p-1.5 shadow-2xl">
                  {suggestions.length > 0 ? (
                    suggestions.map((product) => {
                      const finalPrice = product.discount_price ?? product.price
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleSelectProduct(product.id)}
                          className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
                        >
                          <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white/5">
                            <Image
                              src={product.image || '/placeholder.svg'}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold uppercase text-foreground">
                              {product.name}
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {product.category}
                            </p>
                          </div>
                          {finalPrice && (
                            <span className="font-mono text-xs font-black text-primary">
                              ${finalPrice}
                            </span>
                          )}
                        </button>
                      )
                    })
                  ) : (
                    <div className="p-5 text-center text-xs font-semibold uppercase text-muted-foreground">
                      Sin resultados
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Carrito */}
            <button
              type="button"
              onClick={openCart}
              aria-label={`Carrito, ${count} productos`}
              className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:border-primary/50 hover:bg-white/8"
            >
              <ShoppingBag className="size-[18px]" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-black leading-none text-white">
                  {count}
                </span>
              )}
            </button>

            {/* Menú móvil */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menú"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-foreground lg:hidden"
            >
              {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* NAV MÓVIL */}
        {isMobileMenuOpen && (
          <nav className="border-t border-white/10 bg-background px-5 pb-5 pt-3 lg:hidden">
            <div className="flex flex-col">
              {NAV_LINKS.map((link, i) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="border-b border-white/5 py-3.5 font-heading text-sm font-black uppercase tracking-wide text-foreground/80 transition-colors hover:text-primary"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
