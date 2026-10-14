'use client'

import { useState, useEffect, useCallback } from 'react'
import { Catalog, Product } from '@/components/catalog'
import { SectionBanner } from '@/components/section-banner'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { supabase } from '@/lib/supabase'

const EXCLUDED_CATEGORIES = ['perfumes', 'accesorios']

function getBannerTitle(gender: string, category: string, brand: string): string {
  if (brand !== 'todas') return brand.toUpperCase()
  if (gender !== 'todos') return gender.toUpperCase()
  if (category !== 'todos' && category !== 'offer') return category.toUpperCase()
  return 'CATÁLOGO'
}

function getBannerHighlight(gender: string, category: string, brand: string): string {
  if (brand !== 'todas') return 'por marca'
  if (gender !== 'todos') return 'selección'
  if (category !== 'todos' && category !== 'offer') return 'disponibles'
  return 'completo'
}

export default function Page() {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros compartidos entre banner dinámico y catálogo principal
  const [selectedGender, setSelectedGender] = useState('todos')
  const [selectedCategory, setSelectedCategory] = useState('todos')
  const [selectedBrand, setSelectedBrand] = useState('todas')
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string[]>([])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*, inventory(id, size_or_detail, stock)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const twoMonthsAgo = new Date()
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

      const formatted: Product[] = data
        .filter((p: any) => {
          const cat = p.category?.toLowerCase() || ''
          return !EXCLUDED_CATEGORIES.includes(cat)
        })
        .map((p: any) => {
          const inv = Array.isArray(p.inventory) ? p.inventory : []
          const totalStock = inv.reduce(
            (acc: number, i: any) => acc + (Number(i.stock) || 0),
            0
          )
          const availableSizes = inv
            .filter((i: any) => Number(i.stock) > 0)
            .map((i: any) => String(i.size_or_detail))
          const allSizes = inv.map((i: any) => String(i.size_or_detail))
          const isNew = p.created_at ? new Date(p.created_at) > twoMonthsAgo : false

          return {
            ...p,
            sizes: availableSizes,
            allSizes,
            isOutOfStock: inv.length === 0 || totalStock <= 0,
            is_new: isNew,
          }
        })
      setProducts(formatted)
    } else if (error) {
      console.error('Error cargando productos:', error.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Resetear filtros al buscar
  useEffect(() => {
    if (query) {
      setSelectedCategory('todos')
      setSelectedBrand('todas')
      setSelectedGender('todos')
      setSelectedSizeFilter([])
    }
  }, [query])

  // Productos para el banner dinámico (reacciona a los filtros)
  const bannerProducts = products.filter((p) => {
    if (selectedGender !== 'todos' && p.gender?.toLowerCase() !== selectedGender.toLowerCase())
      return false
    if (
      selectedCategory !== 'todos' &&
      selectedCategory !== 'offer' &&
      p.category?.toLowerCase() !== selectedCategory.toLowerCase()
    )
      return false
    if (
      selectedCategory === 'offer' &&
      !(p.discount_price && p.discount_price < p.price)
    )
      return false
    if (selectedBrand !== 'todas' && p.subcategory?.toLowerCase() !== selectedBrand.toLowerCase())
      return false
    return true
  })

  // Productos nuevos (< 2 meses)
  const newProducts = products.filter((p) => p.is_new)

  // Productos agotados
  const soldOutProducts = products.filter((p) => p.isOutOfStock)

  // Productos en oferta/descuento
  const offerProducts = products.filter(
    (p) => p.discount_price && p.discount_price < p.price
  )

  const bannerImages = (list: Product[]) =>
    list.slice(0, 8).map((p) => p.image).filter(Boolean)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header query={query} onQueryChange={setQuery} />

      {/* 1. Banner NUEVA COLECCIÓN */}
      <SectionBanner
        images={bannerImages(newProducts)}
        eyebrow="Recién llegados"
        title="NUEVA"
        highlight="COLECCIÓN"
        subtitle="Los últimos modelos que acaban de llegar. Descubre lo nuevo antes que nadie."
        ctaLabel="Ver colección"
        ctaHref="#new-collection"
        height="lg"
      />

      {/* 2. Catálogo NUEVA COLECCIÓN */}
      <Catalog
        mode="new"
        products={newProducts}
        loading={loading}
        query={query}
      />

      {/* 3. Banner CATÁLOGO dinámico */}
      <SectionBanner
        images={bannerImages(bannerProducts)}
        eyebrow="Explora"
        title={getBannerTitle(selectedGender, selectedCategory, selectedBrand)}
        highlight={getBannerHighlight(selectedGender, selectedCategory, selectedBrand)}
        subtitle="Filtra por género, talla, marca y más para encontrar tu modelo perfecto."
        ctaLabel="Ver catálogo"
        ctaHref="#catalog"
        height="sm"
      />

      {/* 4. CATÁLOGO + Filtros */}
      <Catalog
        mode="main"
        products={products}
        loading={loading}
        query={query}
        selectedGender={selectedGender}
        onGenderChange={setSelectedGender}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedBrand={selectedBrand}
        onBrandChange={setSelectedBrand}
        selectedSizeFilter={selectedSizeFilter}
        onSizeFilterChange={setSelectedSizeFilter}
      />

      {/* 5. Banner AGOTADOS */}
      <SectionBanner
        images={bannerImages(soldOutProducts)}
        eyebrow="¿No encuentras tu talla?"
        title="PRODUCTOS"
        highlight="AGOTADOS"
        subtitle="Avisanos qué talla buscas y te notificaremos cuando vuelva a estar disponible."
        height="sm"
      />

      {/* 6. Productos agotados con votación */}
      <Catalog
        mode="soldout"
        products={soldOutProducts}
        loading={loading}
        query={query}
      />

      {/* 7. Banner OFERTAS */}
      <SectionBanner
        images={bannerImages(offerProducts)}
        eyebrow="Precios especiales"
        title="PRODUCTOS EN"
        highlight="OFERTA"
        subtitle="Aprovecha los descuentos disponibles por tiempo limitado."
        ctaLabel="Ver ofertas"
        ctaHref="#offers"
        height="sm"
      />

      {/* 8. Catálogo OFERTAS */}
      <Catalog
        mode="offers"
        products={offerProducts}
        loading={loading}
        query={query}
      />

      <Footer />
    </main>
  )
}
