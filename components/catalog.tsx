'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useCart } from '@/components/cart-context'
import { NotifyButton } from '@/components/notify-button'
import {
  Footprints,
  LayoutGrid,
  ShoppingCart,
  Check,
  PackageSearch,
  Crown,
  Heart,
  Baby,
  Gem,
  Ruler,
  Tag,
} from 'lucide-react'

export interface Product {
  id: string
  name: string
  category: string
  subcategory?: string
  price: number
  discount_price?: number
  sizes: string[]
  allSizes?: string[]
  image: string
  is_new?: boolean
  created_at?: string
  gender?: string
  isOutOfStock?: boolean
  inventory?: { id: string; size_or_detail: string; stock: number }[]
}

interface CatalogProps {
  products: Product[]
  loading: boolean
  mode: 'new' | 'main' | 'soldout' | 'offers'
  query?: string
  selectedGender?: string
  onGenderChange?: (g: string) => void
  selectedCategory?: string
  onCategoryChange?: (c: string) => void
  selectedBrand?: string
  onBrandChange?: (b: string) => void
  selectedSizeFilter?: string[]
  onSizeFilterChange?: (s: string[]) => void
}

const CATEGORIES = [
  { id: 'todos', label: 'Todo', icon: LayoutGrid },
  { id: 'zapatillas', label: 'Zapatillas', icon: Footprints },
  { id: 'offer', label: 'Ofertas', icon: Tag },
]

const GENDER_FILTERS = [
  { id: 'todos', label: 'Todos', icon: LayoutGrid },
  { id: 'caballeros', label: 'Caballeros', icon: Crown },
  { id: 'damas', label: 'Damas', icon: Heart },
  { id: 'niños', label: 'Niños', icon: Baby },
]

const MODE_CONFIG = {
  new: {
    id: 'new-collection',
    eyebrow: 'Recién llegados',
    title: 'Nueva',
    highlight: 'Colección',
    subtitle: 'Los últimos modelos que acaban de llegar. ¡No te los pierdas!',
  },
  main: {
    id: 'catalog',
    eyebrow: 'Catálogo',
    title: 'Explora la',
    highlight: 'colección',
    subtitle: '',
  },
  soldout: {
    id: 'sold-out',
    eyebrow: '¿No encuentras tu talla?',
    title: 'Productos',
    highlight: 'Agotados',
    subtitle: 'Avisanos qué talla buscas y te notificaremos cuando vuelva a estar disponible.',
  },
  offers: {
    id: 'offers',
    eyebrow: 'Precios especiales',
    title: 'Productos en',
    highlight: 'Oferta',
    subtitle: 'Aprovecha los descuentos disponibles por tiempo limitado.',
  },
} as const

function matchQuery(p: Product, query: string): boolean {
  if (!query.trim()) return true
  const q = query.toLowerCase()
  return (
    p.name.toLowerCase().includes(q) ||
    p.category?.toLowerCase().includes(q) ||
    p.subcategory?.toLowerCase().includes(q) ||
    p.gender?.toLowerCase().includes(q)
  )
}

function sortSizes(a: string, b: string): number {
  const na = parseInt(a, 10)
  const nb = parseInt(b, 10)
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return a.localeCompare(b)
}

export function Catalog({
  products,
  loading,
  mode,
  query = '',
  selectedGender = 'todos',
  onGenderChange,
  selectedCategory = 'todos',
  onCategoryChange,
  selectedBrand = 'todas',
  onBrandChange,
  selectedSizeFilter = [],
  onSizeFilterChange,
}: CatalogProps) {
  const { addItem } = useCart()
  const [cartSizes, setCartSizes] = useState<{ [productId: string]: string[] }>({})
  const [addedIds, setAddedIds] = useState<{ [productId: string]: boolean }>({})
  const [visibleCount, setVisibleCount] = useState<number>(10)

  const config = MODE_CONFIG[mode]
  const isMain = mode === 'main'

  // Resetear límite al cambiar filtros
  useEffect(() => {
    setVisibleCount(10)
  }, [query, selectedCategory, selectedGender, selectedBrand, selectedSizeFilter])

  // Tallas únicas disponibles (para filtro de modo main)
  const allUniqueSizes = Array.from(
    new Set(products.flatMap((p) => p.allSizes || []))
  ).sort(sortSizes)

  // Marcas / subcategorías disponibles
  const availableBrands = Array.from(
    new Set(
      products
        .filter((p) => {
          if (!isMain) return true
          if (selectedCategory === 'todos') return true
          if (selectedCategory === 'offer')
            return Boolean(p.discount_price && p.discount_price < p.price)
          return p.category?.toLowerCase() === selectedCategory.toLowerCase()
        })
        .map((p) => p.subcategory)
        .filter(Boolean)
    )
  )

  // Filtrado
  const filteredProducts = products.filter((p) => {
    if (!matchQuery(p, query)) return false

    // Fuera del modo soldout, nunca mostrar agotados
    if (mode !== 'soldout' && p.isOutOfStock) return false

    if (!isMain) return true // new, soldout, offers: productos ya vienen pre-filtrados

    // Main: filtros completos
    let matchCategory = false
    if (selectedCategory === 'todos') matchCategory = true
    else if (selectedCategory === 'offer')
      matchCategory = Boolean(p.discount_price && p.discount_price < p.price)
    else matchCategory = p.category?.toLowerCase() === selectedCategory.toLowerCase()

    const matchBrand =
      selectedBrand === 'todas' ||
      p.subcategory?.toLowerCase() === selectedBrand.toLowerCase()

    const matchGender =
      selectedGender === 'todos' || p.gender?.toLowerCase() === selectedGender.toLowerCase()

    const matchSize =
      selectedSizeFilter.length === 0 ||
      selectedSizeFilter.some((s) => (p.allSizes || []).includes(s))

    return matchCategory && matchBrand && matchGender && matchSize
  })

  // Productos visibles (límite de 10 + expansión)
  const visibleProducts = filteredProducts.slice(0, visibleCount)
  const hasMore = filteredProducts.length > visibleCount

  const handleToggleCartSize = (productId: string, size: string) => {
    setCartSizes((prev) => {
      const current = prev[productId] || []
      const exists = current.includes(size)
      return {
        ...prev,
        [productId]: exists ? current.filter((s) => s !== size) : [...current, size],
      }
    })
  }

  const handleAddToCart = (product: Product) => {
    if (product.isOutOfStock) return
    const chosen = cartSizes[product.id] || []
    if (product.sizes && product.sizes.length > 0 && chosen.length === 0) {
      alert('Selecciona al menos una talla o variante.')
      return
    }
    const currentPrice = product.discount_price ?? product.price
    const productForContext: any = {
      id: product.id,
      name: product.name,
      price: currentPrice,
      image: product.image,
      gender: product.gender,
      inventory: product.inventory || [],
    }
    if (product.sizes.length === 0) {
      addItem(productForContext, 0, product.gender)
    } else {
      chosen.forEach((sizeStr) => {
        const parsed = Number.parseInt(sizeStr, 10)
        addItem(productForContext, Number.isNaN(parsed) ? (sizeStr as any) : parsed, product.gender)
      })
    }
    setCartSizes((prev) => ({ ...prev, [product.id]: [] }))
    setAddedIds((prev) => ({ ...prev, [product.id]: true }))
    setTimeout(() => setAddedIds((prev) => ({ ...prev, [product.id]: false })), 1500)
  }

  const toggleSizeFilter = (size: string) => {
    if (!onSizeFilterChange) return
    const exists = selectedSizeFilter.includes(size)
    onSizeFilterChange(
      exists ? selectedSizeFilter.filter((s) => s !== size) : [...selectedSizeFilter, size]
    )
  }

  const getVariantTitle = (category: string) => {
    const cat = category?.toLowerCase() || ''
    if (cat === 'perfumes') return 'Volumen'
    if (cat === 'zapatillas' || cat === 'zapatos') return 'Talla'
    return 'Variante'
  }

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-primary" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Cargando colección
          </p>
        </div>
      </div>
    )
  }

  return (
    <section id={config.id} className="mx-auto max-w-[1600px] px-5 py-12 md:px-8 md:py-16">
      {/* Encabezado */}
      <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary">
            {config.eyebrow}
          </p>
          <h2 className="mt-2 font-heading text-3xl font-black uppercase leading-none tracking-tight md:text-5xl">
            {config.title} <span className="text-primary">{config.highlight}</span>
          </h2>
          {config.subtitle && (
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{config.subtitle}</p>
          )}
        </div>
        <p className="text-sm font-medium text-muted-foreground md:text-right">
          {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} disponible
          {filteredProducts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filtros (solo modo main) */}
      {isMain && (
        <>
          {/* Categoría */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const isActive = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange?.(cat.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-bold uppercase tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-white/10 bg-white/[0.03] text-foreground/70 hover:border-white/25 hover:text-foreground'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {cat.label}
                </button>
              )
            })}
          </div>

          {/* Género */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {GENDER_FILTERS.map((g) => {
              const Icon = g.icon
              const isActive = selectedGender === g.id
              return (
                <button
                  key={g.id}
                  onClick={() => onGenderChange?.(g.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-white/8 bg-transparent text-foreground/50 hover:border-white/20 hover:text-foreground/80'
                  }`}
                >
                  <Icon className="size-3" />
                  {g.label}
                </button>
              )
            })}
          </div>

          {/* Marca */}
          {availableBrands.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2 border-t border-white/5 pt-5">
              <span className="mr-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Marca
              </span>
              <button
                onClick={() => onBrandChange?.('todas')}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all ${
                  selectedBrand === 'todas'
                    ? 'bg-white text-background'
                    : 'text-foreground/50 hover:text-foreground'
                }`}
              >
                Todas
              </button>
              {availableBrands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => onBrandChange?.(brand!)}
                  className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all ${
                    selectedBrand === brand
                      ? 'bg-white text-background'
                      : 'text-foreground/50 hover:text-foreground'
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>
          )}

          {/* Talla */}
          {allUniqueSizes.length > 0 && (
            <div className="mb-10 flex flex-wrap items-center gap-2 border-t border-white/5 pt-5">
              <span className="mr-1 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                <Ruler className="size-3" />
                Talla
              </span>
              {selectedSizeFilter.length > 0 && (
                <button
                  onClick={() => onSizeFilterChange?.([])}
                  className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-primary"
                >
                  Limpiar
                </button>
              )}
              {allUniqueSizes.map((size) => {
                const isActive = selectedSizeFilter.includes(size)
                return (
                  <button
                    key={size}
                    onClick={() => toggleSizeFilter(size)}
                    className={`min-w-[38px] rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all duration-200 ${
                      isActive
                        ? 'border-primary bg-primary text-white'
                        : 'border-white/10 bg-transparent text-foreground/60 hover:border-white/25 hover:text-foreground'
                    }`}
                  >
                    {size}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Grid de productos */}
      {filteredProducts.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10">
          <PackageSearch className="size-10 text-muted-foreground" />
          <p className="font-heading text-lg font-black uppercase tracking-wide">
            {mode === 'soldout' ? '¡Buenas noticias!' : 'Sin resultados'}
          </p>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            {mode === 'soldout'
              ? 'No hay productos agotados en este momento.'
              : 'Ajusta los filtros o prueba con otro término de búsqueda.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => {
            const productCartSizes = cartSizes[product.id] || []
            const isAdded = addedIds[product.id]
            const hasDiscount = Boolean(
              product.discount_price && product.discount_price < product.price
            )
            const isOutOfStock = Boolean(product.isOutOfStock)
            const allSizes = product.allSizes || []

            return (
              <div
                key={product.id}
                id={`product-${product.id}`}
                className="group flex flex-col scroll-mt-28"
              >
                {/* Imagen */}
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/[0.04]">
                  <Image
                    src={product.image || '/placeholder.svg'}
                    alt={product.name}
                    fill
                    className={`object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105 ${
                      isOutOfStock ? 'grayscale opacity-40' : ''
                    }`}
                  />

                  {/* Badges */}
                  <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
                    {hasDiscount && (
                      <span className="rounded-full bg-primary px-3 py-1 font-mono text-[10px] font-black uppercase tracking-wide text-white">
                        −
                        {Math.round(
                          ((product.price - (product.discount_price || 0)) / product.price) * 100
                        )}
                        %
                      </span>
                    )}
                    {product.is_new && !hasDiscount && (
                      <span className="rounded-full bg-foreground px-3 py-1 text-[10px] font-black uppercase tracking-wide text-background">
                        Nuevo
                      </span>
                    )}
                  </div>

                  {isOutOfStock && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
                      <span className="rounded-full border border-white/30 bg-black/70 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                        Agotado
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="mt-3.5 flex flex-1 flex-col">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>{product.category}</span>
                    {product.subcategory && (
                      <>
                        <span className="text-white/20">/</span>
                        <span className="text-primary">{product.subcategory}</span>
                      </>
                    )}
                  </div>

                  <h3 className="mt-1 font-heading text-sm font-bold uppercase leading-tight tracking-tight text-foreground md:text-base">
                    {product.name}
                  </h3>

                  {/* Tallas para agregar al carrito */}
                  {!isOutOfStock && product.sizes && product.sizes.length > 0 && (
                    <div className="mt-2.5">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {getVariantTitle(product.category)}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {product.sizes.map((size) => {
                          const isSelected = productCartSizes.includes(size)
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => handleToggleCartSize(product.id, size)}
                              className={`min-w-[36px] rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all duration-200 ${
                                isSelected
                                  ? 'border-foreground bg-foreground text-background'
                                  : 'border-white/10 bg-transparent text-foreground/70 hover:border-white/30'
                              }`}
                            >
                              {size}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {isOutOfStock && (
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-red-400">
                      No disponible
                    </p>
                  )}

                  {/* Precio */}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-baseline gap-2">
                      {hasDiscount ? (
                        <>
                          <span className="font-mono text-lg font-black text-primary">
                            ${product.discount_price}
                          </span>
                          <span className="font-mono text-xs font-medium text-muted-foreground line-through">
                            ${product.price}
                          </span>
                        </>
                      ) : (
                        <span className="font-mono text-lg font-black text-foreground">
                          ${product.price}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botón add o Notify */}
                  {isOutOfStock ? (
                    <NotifyButton
                      productId={product.id}
                      productName={product.name}
                      allSizes={allSizes}
                      category={product.category}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full py-3 font-heading text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                        isAdded
                          ? 'bg-emerald-500 text-white'
                          : productCartSizes.length > 0
                            ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary/90'
                            : 'border border-white/15 bg-white/[0.04] text-foreground hover:border-primary/50'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="size-4" /> Agregado
                        </>
                      ) : productCartSizes.length > 0 ? (
                        <>
                          <ShoppingCart className="size-4" />
                          Continuar al carrito ({productCartSizes.length})
                        </>
                      ) : product.sizes.length > 0 ? (
                        <>
                          <ShoppingCart className="size-4" />
                          Seleccionar talla
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="size-4" />
                          Añadir al carrito
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          </div>

          {/* Ver todo el catálogo */}
          {hasMore && (
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 20)}
                className="group inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] px-8 py-4 font-heading text-xs font-black uppercase tracking-widest text-foreground transition-all duration-300 hover:border-primary hover:bg-primary hover:text-white"
              >
                Ver todo el catálogo
                <span className="font-mono text-[10px] text-muted-foreground group-hover:text-white/80">
                  ({filteredProducts.length})
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
