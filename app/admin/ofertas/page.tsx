'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  Sparkles, 
  Flame, 
  Trash2, 
  Search, 
  Clock, 
  Edit3, 
  X, 
  Check, 
  Calendar 
} from 'lucide-react'
import Image from 'next/image'
import { ProductItem } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { PinGate } from '@/components/admin/pin-gate'

const supabase = createClient()

export default function OffersPage() {
  // 1. ESTADOS DE DATOS
  const [products, setProducts] = useState<ProductItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // 2. FILTROS Y BÚSQUEDA
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // 3. SELECCIÓN DE PRODUCTOS
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [discountPercentage, setDiscountPercentage] = useState<number>(15)
  const [isApplying, setIsApplying] = useState<boolean>(false)

  // 4. ESTADOS PARA MODALES Y CONFIGURACIÓN DE DURACIÓN
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false)
  const [showActiveOffersModal, setShowActiveOffersModal] = useState<boolean>(false)
  const [durationType, setDurationType] = useState<string>('indefinite')
  const [customDays, setCustomDays] = useState<number>(3)

  // 5. ESTADOS DE EDICIÓN RÁPIDA DENTRO DEL MODAL
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPercent, setEditPercent] = useState<number>(15)
  const [editDuration, setEditDuration] = useState<string>('indefinite')
  const [editDays, setEditDays] = useState<number>(3)

  // CARGAR PRODUCTOS DESDE SUPABASE
  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, inventory(*)')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setProducts(data as ProductItem[])
    } catch (error) {
      console.error('Error cargando productos para ofertas:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // FILTRADO DE PRODUCTOS
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || prod.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  // PRODUCTOS EN OFERTA
  const productsOnSale = useMemo(() => {
    return products.filter((prod: any) => 
      Boolean(prod.on_sale) === true || (prod.discount_price !== null && prod.discount_price !== undefined && Number(prod.discount_price) > 0)
    )
  }, [products])

  // MANEJO DE SELECCIÓN
  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([])
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p.id))
    }
  }

  // APLICAR OFERTA EN SUPABASE CON MANEJO DE ERRORES SEGURO
  const handleConfirmApplyDiscount = async () => {
    if (selectedProductIds.length === 0) return
    if (discountPercentage <= 0 || discountPercentage >= 100) {
      alert('Ingresa un porcentaje de descuento válido (entre 1% y 99%).')
      return
    }

    setIsApplying(true)
    try {
      const selectedProducts = products.filter((prod) => selectedProductIds.includes(prod.id))

      for (const prod of selectedProducts) {
        const originalPrice = Number(prod.price) || 0
        const discountPrice = Math.round((originalPrice * (1 - discountPercentage / 100)) * 100) / 100

        // Objeto de actualización limpio
        const updateData: Record<string, any> = {
          on_sale: true,
          discount_price: discountPrice,
          discount_percent: discountPercentage
        }

        // Intento de actualización
        const { error } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', prod.id)

        if (error) {
          console.error(`Error actualizando producto ${prod.id}:`, error.message, error.details)
          throw error
        }
      }

      await fetchProducts()
      setSelectedProductIds([])
      setShowApplyModal(false)
    } catch (error: any) {
      console.error('Error detallado al aplicar la oferta:', error)
      alert(`Ocurrió un error al aplicar el descuento: ${error.message || 'Verifica la consola'}`)
    } finally {
      setIsApplying(false)
    }
  }

  // EDICIÓN RÁPIDA DE OFERTA EN SUPABASE
  const handleSaveEditOffer = async (productId: string, originalPrice: number) => {
    try {
      const discountPrice = Math.round((originalPrice * (1 - editPercent / 100)) * 100) / 100

      const { error } = await supabase
        .from('products')
        .update({
          on_sale: true,
          discount_price: discountPrice,
          discount_percent: editPercent
        })
        .eq('id', productId)

      if (error) throw error
      await fetchProducts()
      setEditingId(null)
    } catch (error: any) {
      console.error('Error editando la oferta:', error)
      alert(`Ocurrió un error al editar la oferta: ${error.message || ''}`)
    }
  }

  // REMOVER OFERTA EN SUPABASE
  const handleRemoveDiscount = async (productId?: string) => {
    const confirmMsg = productId
      ? '¿Quitar la oferta de este producto?'
      : '¿Quitar la oferta de TODOS los productos en promoción?'

    if (!confirm(confirmMsg)) return

    try {
      if (productId) {
        await supabase
          .from('products')
          .update({
            on_sale: false,
            discount_price: null,
            discount_percent: null
          })
          .eq('id', productId)
      } else {
        const idsToRemove = productsOnSale.map((p) => p.id)
        for (const id of idsToRemove) {
          await supabase
            .from('products')
            .update({
              on_sale: false,
              discount_price: null,
              discount_percent: null
            })
            .eq('id', id)
        }
      }
      await fetchProducts()
    } catch (error: any) {
      console.error('Error removiendo oferta:', error)
      alert(`Ocurrió un error al remover la oferta: ${error.message || ''}`)
    }
  }

  return (
    <PinGate sectionName="Ofertas">
    <div className="space-y-8 pb-12 px-2 sm:px-4">
      {/* HEADER DE LA SECCIÓN */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="ds-eyebrow">Promociones</p>
          <h1 className="ds-text-gold mt-1 text-3xl tracking-tight">Eventos y Ofertas</h1>
          <p className="mt-1 text-xs font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
            Crea promociones con descuentos y gestiona eventos especiales
          </p>
        </div>

        <button
          onClick={() => setShowActiveOffersModal(true)}
          className="ds-btn-gold px-5 py-3 text-xs uppercase tracking-widest"
        >
          <Flame className="size-4" />
          Ofertas Activas ({productsOnSale.length})
        </button>
      </div>

      {/* CARD PRINCIPAL DE ACCIÓN */}
      <div className="ds-card relative overflow-hidden rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-400">
              <Sparkles className="h-3 w-3" /> Evento Promocional
            </span>
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide text-white">
              APLICAR DESCUENTO MASIVO O INDIVIDUAL
            </h2>
            <p className="text-xs text-neutral-400">
              Selecciona los productos del catálogo abajo e ingresa el porcentaje que deseas descontar.
            </p>
          </div>

          <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center gap-4 md:w-auto">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Porcentaje (%)
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                className="w-full sm:w-28 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm font-bold text-white focus:border-red-600 focus:outline-none"
              />
            </div>

            <button
              disabled={selectedProductIds.length === 0}
              onClick={() => setShowApplyModal(true)}
              className="sm:mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-900/30 transition hover:from-red-500 hover:to-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Flame className="h-4 w-4" />
              Aplicar a ({selectedProductIds.length})
            </button>
          </div>
        </div>
      </div>

      {/* SELECCIÓN DE PRODUCTOS EN EL CATÁLOGO */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-heading text-sm font-black uppercase tracking-wider text-white">
            SELECCIONAR PRODUCTOS DEL CATÁLOGO
          </h3>

          <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-2 pl-9 pr-4 text-xs text-white placeholder-neutral-500 focus:border-red-600 focus:outline-none"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-300 focus:border-red-600 focus:outline-none sm:w-auto"
            >
              <option value="all">TODAS LAS CATEGORÍAS</option>
              <option value="zapatillas">Zapatillas</option>
              <option value="ropa">Ropa</option>
              <option value="perfumes">Perfumes</option>
              <option value="accesorios">Accesorios</option>
            </select>
          </div>
        </div>

        {/* TABLA DE PRODUCTOS CON CONTEXTO SCROLLABLE EN MÓVIL */}
        <div className="overflow-x-auto rounded-2xl border border-neutral-800/80 bg-neutral-900/30 backdrop-blur-md">
          {isLoading ? (
            <div className="p-8 text-center text-xs font-bold uppercase tracking-wider text-neutral-500">
              Cargando catálogo...
            </div>
          ) : (
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="border-b border-neutral-800 bg-neutral-950/60 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="w-12 p-4 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedProductIds.length === filteredProducts.length
                      }
                      onChange={toggleSelectAll}
                      className="cursor-pointer accent-red-600"
                    />
                  </th>
                  <th className="p-4">PRODUCTO</th>
                  <th className="p-4">CATEGORÍA</th>
                  <th className="p-4">PRECIO ORIGINAL</th>
                  <th className="p-4">CON DESCUENTO ({discountPercentage}%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {filteredProducts.map((product: any) => {
                  const isSelected = selectedProductIds.includes(product.id)
                  const originalPrice = Number(product.price) || 0
                  const calculatedDiscount = (originalPrice * (1 - discountPercentage / 100)).toFixed(2)

                  return (
                    <tr
                      key={product.id}
                      onClick={() => toggleSelectProduct(product.id)}
                      className={`cursor-pointer transition hover:bg-neutral-800/40 ${
                        isSelected ? 'bg-red-950/20' : ''
                      }`}
                    >
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(product.id)}
                          className="cursor-pointer accent-red-600"
                        />
                      </td>
                      <td className="p-4 font-bold uppercase tracking-wide text-white">
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                            <Image
                              src={product.image || '/placeholder.png'}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <span>{product.name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-medium capitalize text-neutral-400">
                        {product.category}
                      </td>
                      <td className="p-4 font-mono font-bold text-white">
                        ${originalPrice.toFixed(2)}
                      </td>
                      <td className="p-4 font-mono font-black text-red-400">
                        ${calculatedDiscount}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL 1: APLICAR DESCUENTO Y SELECCIONAR DURACIÓN (CON SCROLL PARA MÓVIL) */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-auto flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-neutral-800 bg-[#0a0a0e] p-6 shadow-2xl space-y-6">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-red-500" />
                <h3 className="font-heading text-lg font-black uppercase tracking-wider text-white">
                  CONFIGURAR DURACIÓN
                </h3>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="text-neutral-500 transition hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-3 text-xs text-neutral-400">
                  Aplicando <span className="font-bold text-red-500">{discountPercentage}% OFF</span> a{' '}
                  <span className="font-bold text-white">{selectedProductIds.length} producto(s)</span>.
                </p>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  Selecciona la Duración de la Oferta (Opcional)
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'indefinite', label: 'Indefinido' },
                    { id: 'days', label: 'Días específicos' },
                    { id: 'week', label: '1 Semana' },
                    { id: 'month', label: '1 Mes' },
                    { id: 'season', label: 'Temporada' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDurationType(option.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-xs font-bold uppercase tracking-wider transition ${
                        durationType === option.id
                          ? 'border-red-600 bg-red-600/15 text-white shadow-sm shadow-red-950/50'
                          : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-white'
                      }`}
                    >
                      {option.label}
                      {durationType === option.id && <Check className="h-4 w-4 text-red-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {durationType === 'days' && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Cantidad de Días Activa
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white focus:border-red-600 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-neutral-800 pt-4">
              <button
                onClick={() => setShowApplyModal(false)}
                className="rounded-xl border border-neutral-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmApplyDiscount}
                disabled={isApplying}
                className="rounded-xl bg-red-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 disabled:opacity-40"
              >
                {isApplying ? 'Guardando...' : 'Confirmar y Activar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GESTIÓN DE OFERTAS ACTIVAS (CON SCROLL PARA MÓVIL) */}
      {showActiveOffersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-auto flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-neutral-800 bg-[#0a0a0e] p-6 shadow-2xl space-y-6">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-red-500" />
                <h3 className="font-heading text-lg font-black uppercase tracking-wider text-white">
                  OFERTAS ACTIVAS EN EL CATÁLOGO
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowActiveOffersModal(false)
                  setEditingId(null)
                }}
                className="text-neutral-500 transition hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {productsOnSale.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold uppercase tracking-wider text-neutral-500">
                  No hay ofertas activas en este momento.
                </div>
              ) : (
                productsOnSale.map((prod: any) => {
                  const isEditing = editingId === prod.id
                  const origPrice = Number(prod.price) || 0
                  const discPrice = Number(prod.discount_price) || origPrice
                  const percent = prod.discount_percent || Math.round((1 - discPrice / origPrice) * 100)

                  return (
                    <div
                      key={prod.id}
                      className="flex flex-col justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 transition hover:border-neutral-700 md:flex-row md:items-center"
                    >
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold uppercase tracking-wide text-white">
                          {prod.name}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-neutral-400">
                          <span>
                            Precio orig: <strong className="text-white">${origPrice.toFixed(2)}</strong>
                          </span>
                          <span>-</span>
                          <span className="font-bold text-amber-400">
                            Con desc: ${discPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-2">
                          <input
                            type="number"
                            value={editPercent}
                            onChange={(e) => setEditPercent(Number(e.target.value))}
                            className="w-16 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs font-bold text-white"
                          />
                          <span className="text-xs font-bold">%</span>

                          <button
                            onClick={() => handleSaveEditOffer(prod.id, origPrice)}
                            className="rounded bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white"
                          >
                            Guardar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between md:justify-end gap-4">
                          <div className="text-left md:text-right">
                            <span className="inline-block rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-black text-red-400">
                              -{percent}% OFF
                            </span>
                          </div>

                          <div className="flex items-center gap-1 border-l border-neutral-800 pl-3">
                            <button
                              onClick={() => {
                                setEditingId(prod.id)
                                setEditPercent(percent)
                              }}
                              className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
                              title="Editar Oferta"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveDiscount(prod.id)}
                              className="rounded-lg p-2 text-neutral-400 transition hover:bg-red-950/40 hover:text-red-400"
                              title="Remover Oferta"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-neutral-800 pt-4">
              {productsOnSale.length > 0 && (
                <button
                  onClick={() => handleRemoveDiscount()}
                  className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-900/50 hover:text-white"
                >
                  Desactivar Todas
                </button>
              )}
              <button
                onClick={() => setShowActiveOffersModal(false)}
                className="ml-auto rounded-xl border border-neutral-800 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PinGate>
  )
}