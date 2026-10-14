'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Search, X, PackageSearch } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/components/catalog'

interface SearchOverlayProps {
  externalQuery?: string
  onQueryChange?: (val: string) => void
  onSelectProduct?: (product: Product) => void
}

export function SearchOverlay({ externalQuery, onQueryChange, onSelectProduct }: SearchOverlayProps) {
  const [internalQuery, setInternalQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentQuery = externalQuery !== undefined ? externalQuery : internalQuery

  const handleInputChange = (val: string) => {
    if (onQueryChange) onQueryChange(val)
    else setInternalQuery(val)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!currentQuery.trim()) {
      setProducts([])
      setIsOpen(false)
      return
    }

    setIsOpen(true)
    setLoading(true)

    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, inventory(size_or_detail, stock)')
        .or(`name.ilike.%${currentQuery}%,category.ilike.%${currentQuery}%,subcategory.ilike.%${currentQuery}%`)
        .limit(5)

      if (!error && data) {
        const formatted: Product[] = data.map((item: any) => {
          const availableSizes = item.inventory
            ? item.inventory
                .filter((i: any) => i.stock > 0)
                .map((i: any) => String(i.size_or_detail))
            : []

          return {
            ...item,
            sizes: availableSizes,
          }
        })
        setProducts(formatted)
      } else {
        setProducts([])
      }
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [currentQuery])

  const handleProductClick = (product: Product) => {
    if (onSelectProduct) {
      onSelectProduct(product)
    } else {
      // Intenta ir directamente al elemento del producto o al catálogo
      const targetElement = document.getElementById(`product-${product.id}`) || document.getElementById('catalog')
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        window.location.hash = `#product-${product.id}`
      }
    }
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full z-50">
      {/* Input de Búsqueda */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={currentQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => currentQuery.trim() && setIsOpen(true)}
          placeholder="Buscar zapatillas..."
          className="h-10 w-full rounded-sm border border-border bg-secondary pl-9 pr-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {currentQuery && (
          <button
            type="button"
            onClick={() => {
              handleInputChange('')
              setIsOpen(false)
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* OVERLAY COMPACTO */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[88vw] max-w-md bg-black/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl p-2 space-y-2 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="py-4 text-center text-xs text-muted-foreground font-medium animate-pulse">
              Buscando...
            </div>
          ) : products.length === 0 ? (
            <div className="py-4 flex flex-col items-center justify-center text-center space-y-1">
              <PackageSearch className="w-6 h-6 text-zinc-600" />
              <p className="text-xs text-zinc-400 font-medium">No se encontraron resultados</p>
            </div>
          ) : (
            products.map((product) => {
              const sizesString = product.sizes && product.sizes.length > 0 
                ? product.sizes.join(', ') 
                : 'Agotado'
              const currentPrice = product.discount_price ?? product.price

              return (
                <a
                  key={product.id}
                  href={`#product-${product.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    handleProductClick(product)
                  }}
                  className="group flex items-center gap-2.5 bg-zinc-950 border border-zinc-800 hover:border-red-600/60 p-2 rounded-lg transition-all duration-150"
                >
                  {/* Imagen Compacta con Borde Rojo */}
                  <div className="relative size-16 sm:size-20 shrink-0 bg-white rounded-lg overflow-hidden border-2 border-red-600 p-0.5 flex items-center justify-center">
                    <Image
                      src={product.image || '/placeholder.svg'}
                      alt={product.name}
                      fill
                      className="object-contain p-0.5 transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>

                  {/* Información */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
                    {/* Título */}
                    <div className="bg-white text-black px-2.5 py-0.5 rounded-full font-extrabold text-[11px] sm:text-xs tracking-wide truncate text-center shadow-sm">
                      {product.name}
                    </div>

                    {/* Categoría y Subcategoría */}
                    <div className="flex items-center gap-1">
                      <div className="flex-1 bg-white text-black px-2 py-0.5 rounded-full font-bold text-[9px] sm:text-[10px] uppercase truncate text-center">
                        {product.category}
                      </div>

                      {product.subcategory && (
                        <div className="flex-1 bg-white text-black px-2 py-0.5 rounded-full font-bold text-[9px] sm:text-[10px] uppercase truncate text-center">
                          {product.subcategory}
                        </div>
                      )}
                    </div>

                    {/* Talla en Texto Rojo (Sin fondo) y Precio en Pastilla Roja */}
                    <div className="flex items-center justify-between px-1">
                      <span className="text-red-500 font-black text-[11px] sm:text-xs tracking-tight">
                        Talla: {sizesString}
                      </span>

                      <div className="bg-red-600 text-white px-2.5 py-0.5 rounded-full font-black text-xs sm:text-sm shadow-sm">
                        ${currentPrice}
                      </div>
                    </div>
                  </div>
                </a>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}